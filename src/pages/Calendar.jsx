import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import viLocale from '@fullcalendar/core/locales/vi'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal } from 'antd'
import { toast } from 'react-toastify'
import { ShimmerCard } from '../components/ui/Shimmer'
import CreateBookingModal from '../components/calendar/CreateBookingModal'
import BookingModal from '../components/calendar/BookingModal'
import NoteModal from '../components/calendar/NoteModal'
import CalendarDayCellHeader from '../components/calendar/CalendarDayCellHeader'
import CalendarEventContent from '../components/calendar/CalendarEventContent'
import { getBookings, setBookingStatus, updateBooking } from '../services/booking.service'
import { getPackages } from '../services/package.service'
import { getInvoicesByBookingIds } from '../services/invoice.service'
import { createNote, getNotesByDateRange, updateNote } from '../services/note.service'

import '../styles/pages/calendar.css'

const NOTE_STATUSES = new Set(['todo', 'completed'])

const DAY_BOOKING_LIMIT = 3
const DAY_NOTE_LIMIT = 1

const formatWeekdayHeader = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  const dow = d.getDay() // 0..6 (Sun..Sat)
  if (dow === 0) return 'CN'
  return `T${dow + 1}`
}

export default function CalendarPage({ onOpenInvoice, autoOpenBookingId, onAutoOpenConsumed }) {
  const [bookings, setBookings] = useState([])
  const [notes, setNotes] = useState([])
  const [packages, setPackages] = useState([])

  const [loadingBookings, setLoadingBookings] = useState(true)

  const [invoicesByBookingId, setInvoicesByBookingId] = useState({})

  const [notesRange, setNotesRange] = useState(null)

  const [selectedBooking, setSelectedBooking] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedRange, setSelectedRange] = useState(null)

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [activeNote, setActiveNote] = useState(null)
  const [noteBaseline, setNoteBaseline] = useState(null)
  const [noteForm, setNoteForm] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    time: '08:00',
    content: '',
    status: 'todo'
  })

  const calendarRef = useRef(null)
  const calendarWrapRef = useRef(null)
  const lastRefreshAtRef = useRef(0)
  // Responsive behavior:
  // - >= 1800px: show event chips + right panel
  // - 1200-1799px: show event dots + right panel
  // - < 1200px: show dots + hide right panel (use day-sheet)
  const [isPhone, setIsPhone] = useState(false)
  const [isDotMonth, setIsDotMonth] = useState(false)

  const [currentViewType, setCurrentViewType] = useState('dayGridMonth')

  const [daySheetOpen, setDaySheetOpen] = useState(false)
  const [daySheetDate, setDaySheetDate] = useState(null) // YYYY-MM-DD

  // Desktop contextual panel selection (YYYY-MM-DD)
  const [selectedDayKey, setSelectedDayKey] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [selectedItemId, setSelectedItemId] = useState(null)

  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 1199px)')
    if (!mq) return
    const sync = () => setIsPhone(Boolean(mq.matches))
    sync()

    if (mq.addEventListener) mq.addEventListener('change', sync)
    else mq.addListener(sync)

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', sync)
      else mq.removeListener(sync)
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 1799px)')
    if (!mq) return
    const sync = () => setIsDotMonth(Boolean(mq.matches))
    sync()

    if (mq.addEventListener) mq.addEventListener('change', sync)
    else mq.addListener(sync)

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', sync)
      else mq.removeListener(sync)
    }
  }, [])


  const isTouch = useMemo(() => {
    try {
      return window.matchMedia?.('(pointer: coarse)')?.matches ?? false
    } catch {
      return false
    }
  }, [])

  const atTime = (date, hh, mm) => {
    const d = new Date(date)
    d.setHours(hh, mm, 0, 0)
    return d
  }

  const toDayKey = (date) => (date ? dayjs(date).format('YYYY-MM-DD') : '')

  const dayCountsByKey = useMemo(() => {
    const map = {}

    for (const b of bookings || []) {
      const rawStatus = String(b?.status || 'scheduled')
      if (rawStatus === 'canceled') continue
      const key = b?.start_datetime ? dayjs(b.start_datetime).format('YYYY-MM-DD') : ''
      if (!key) continue
      map[key] = map[key] || { bookingCount: 0, noteCount: 0 }
      map[key].bookingCount += 1
    }

    for (const n of notes || []) {
      const key = String(n?.date || '').slice(0, 10)
      if (!key) continue
      map[key] = map[key] || { bookingCount: 0, noteCount: 0 }
      map[key].noteCount += 1
    }

    return map
  }, [bookings, notes])

  const getDayCounts = useCallback(
    (dayKey) => {
      const key = String(dayKey || '').trim()
      return dayCountsByKey?.[key] || { bookingCount: 0, noteCount: 0 }
    },
    [dayCountsByKey]
  )

  const packageOptions = useMemo(() => {
    const list = Array.isArray(packages) ? packages : []
    return list
      .filter((p) => p?.is_active !== false)
      .map((p) => ({
        value: p.id,
        label: p.name,
        price: p.price,
        has_makeup: Boolean(p.has_makeup)
      }))
  }, [packages])

  const mapBookingToEvent = useCallback(
    (b) => {
      const startIso = b.start_datetime
      const endIso = b.end_datetime || null

      const rawStatus = String(b?.status || 'scheduled')
      const isLocked = rawStatus === 'completed' || rawStatus === 'canceled'

      const displayStatus = (() => {
        if (rawStatus === 'canceled') return 'canceled'
        // DB status 'completed' means the booking is finished.
        if (rawStatus === 'completed') return 'done'

        const missingLocation = !String(b?.location || '').trim()
        const packageHasMakeup = Boolean(b?.packages?.has_makeup)
        const invoice = invoicesByBookingId?.[b?.id] || null
        const missingMakeup = packageHasMakeup && (invoice?.makeup_fee === null || invoice?.makeup_fee === undefined)

        // Requirement: If missing address OR makeup => use scheduled color, else default to completed color.
        return missingLocation || missingMakeup ? 'scheduled' : 'completed'
      })()

      const title = b.customer_name || '(Chưa có tên)'

      return {
        id: `b_${b.id}`,
        start: startIso,
        end: endIso || undefined,
        title,
        editable: !isLocked,
        startEditable: !isLocked,
        durationEditable: !isLocked,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        extendedProps: {
          type: 'booking',
          raw: b,
          displayStatus
        }
      }
    },
    [invoicesByBookingId]
  )

  const getBookingDisplayStatus = useCallback(
    (booking) => {
      const rawStatus = String(booking?.status || 'scheduled')
      if (rawStatus === 'canceled') return 'canceled'
      if (rawStatus === 'completed') return 'done'

      const missingLocation = !String(booking?.location || '').trim()
      const packageHasMakeup = Boolean(booking?.packages?.has_makeup)
      const invoice = invoicesByBookingId?.[booking?.id] || null
      const missingMakeup = packageHasMakeup && (invoice?.makeup_fee === null || invoice?.makeup_fee === undefined)
      return missingLocation || missingMakeup ? 'scheduled' : 'completed'
    },
    [invoicesByBookingId]
  )

  const mapNoteToEvent = useCallback((n) => {
    const date = n?.date
    const content = String(n?.content || '').trim()

    const rawStatus = String(n?.status || 'todo')
    const displayStatus = rawStatus === 'completed' ? 'done' : 'todo'

    return {
      id: `n_${n.id}`,
      // Notes render in a separate "lane" (all-day row) to avoid overlapping bookings in timeGrid.
      allDay: true,
      start: date || null,
      title: content || '(Note)',
      editable: false,
      startEditable: false,
      durationEditable: false,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      extendedProps: {
        type: 'note',
        raw: n,
        fullText: content,
        displayStatus
      }
    }
  }, [])

  const events = useMemo(() => {
    // UI requirement: canceled bookings are never shown.
    const list = (Array.isArray(bookings) ? bookings : [])
      .filter((b) => String(b?.status || 'scheduled') !== 'canceled')
      .sort((a, b) => {
        const av = a?.start_datetime ? dayjs(a.start_datetime).valueOf() : 0
        const bv = b?.start_datetime ? dayjs(b.start_datetime).valueOf() : 0
        return av - bv
      })

    const bookingEvents = list.map(mapBookingToEvent)
    const noteEvents = (notes || []).map(mapNoteToEvent)
    return [...bookingEvents, ...noteEvents]
  }, [bookings, notes, mapBookingToEvent, mapNoteToEvent])

  const fetchInvoicesForBookings = useCallback(async (list) => {
    const ids = (Array.isArray(list) ? list : [])
      .map((b) => b?.id)
      .filter((id) => id !== null && id !== undefined)

    if (!ids.length) {
      setInvoicesByBookingId({})
      return
    }

    const { data, error } = await getInvoicesByBookingIds(ids)
    if (error) {
      console.error(error)
      setInvoicesByBookingId({})
      return
    }

    const map = {}
    for (const inv of data || []) {
      if (inv?.booking_id !== null && inv?.booking_id !== undefined) {
        map[inv.booking_id] = inv
      }
    }
    setInvoicesByBookingId(map)
  }, [])

  const fetchBookings = useCallback(async () => {
    setLoadingBookings(true)
    const { data, error } = await getBookings()
    setLoadingBookings(false)
    if (error) {
      console.error(error)
      toast.error(error.message || 'Không tải được danh sách booking')
      return
    }

    const normalized = data || []
    setBookings(normalized)
    await fetchInvoicesForBookings(normalized)
    return normalized
  }, [fetchInvoicesForBookings])

  const fetchNotesForRange = useCallback(async (from, toExclusive) => {
    const { data, error } = await getNotesByDateRange(from, toExclusive)
    if (error) {
      console.error(error)
      toast.error(error.message || 'Không tải được notes')
      return
    }
    setNotes(data || [])
  }, [])

  const refreshNotesInCurrentRange = useCallback(async () => {
    if (notesRange?.from && notesRange?.toExclusive) {
      await fetchNotesForRange(notesRange.from, notesRange.toExclusive)
    }
  }, [fetchNotesForRange, notesRange?.from, notesRange?.toExclusive])

  const fetchPackages = useCallback(async () => {
    const { data, error } = await getPackages()
    if (error) {
      console.error(error)
      toast.error(error.message || 'Không tải được danh sách gói')
      return
    }
    setPackages(data || [])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings()
  }, [fetchBookings])

  useEffect(() => {
    // If booking status changes in another page/tab (e.g., Invoice), refresh when user returns.
    const safeRefresh = () => {
      const now = Date.now()
      if (now - lastRefreshAtRef.current < 400) return
      lastRefreshAtRef.current = now
      fetchBookings()
    }

    const onFocus = () => safeRefresh()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') safeRefresh()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchBookings])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPackages()
  }, [fetchPackages])


  const openNote = useCallback((note) => {
    if (!note) return
    const nextForm = {
      date: String(note?.date || dayjs().format('YYYY-MM-DD')),
      time: String(note?.time || '08:00'),
      content: String(note?.content || ''),
      status: NOTE_STATUSES.has(String(note?.status)) ? String(note?.status) : 'todo'
    }
    setActiveNote(note)
    setNoteForm(nextForm)
    setNoteBaseline({ ...nextForm })
    setNoteOpen(true)
  }, [])

  const openBooking = useCallback((booking) => {
    if (!booking) return
    setSelectedBooking(booking)
    setModalOpen(true)
  }, [])

  const handleCreatedBooking = useCallback(async (createdBooking) => {
    const list = await fetchBookings()
    const createdId = createdBooking?.id
    if (!createdId) return
    const found = (Array.isArray(list) ? list : []).find((b) => b?.id === createdId) || null
    if (found) openBooking(found)
  }, [fetchBookings, openBooking])

  useEffect(() => {
    if (!autoOpenBookingId) return
    const list = Array.isArray(bookings) ? bookings : []
    const found = list.find((b) => b?.id === autoOpenBookingId) || null
    if (!found) return
    const t = setTimeout(() => {
      openBooking(found)
      onAutoOpenConsumed?.()
    }, 0)

    return () => clearTimeout(t)
  }, [autoOpenBookingId, bookings, onAutoOpenConsumed, openBooking])

  const handleEventClick = (info) => {
    // Mobile month: do not open details directly; go through day-sheet modal.
    if (isPhone && info?.view?.type === 'dayGridMonth') {
      const d = info?.event?.start
      if (d) openDaySheet(d)
      return
    }

    const props = info?.event?.extendedProps || null
    const type = props?.type

    if (type === 'note') {
      openNote(props?.raw || null)
      return
    }

    if (type === 'booking') {
      openBooking(props?.raw || null)
    }
  }

  const syncEventToBooking = async (info) => {
    const props = info?.event?.extendedProps || null
    const booking = props?.raw || null
    if (!booking) return

    const start = info?.event?.start
    const end = info?.event?.end
    if (!start) return

    const safeEnd = end || new Date(start.getTime() + 60 * 60 * 1000)

    // Enforce day booking limit when moving/resizing across days.
    const targetKey = dayjs(start).format('YYYY-MM-DD')
    const otherCountSameDay = (bookings || []).filter((b) => {
      if (!b) return false
      const rawStatus = String(b?.status || 'scheduled')
      if (rawStatus === 'canceled') return false
      if (b?.id === booking?.id) return false
      const key = b?.start_datetime ? dayjs(b.start_datetime).format('YYYY-MM-DD') : ''
      return key === targetKey
    }).length

    if (otherCountSameDay >= DAY_BOOKING_LIMIT) {
      toast.info(`Ngày ${dayjs(start).format('DD/MM')} chỉ được tối đa ${DAY_BOOKING_LIMIT} lịch chụp`)
      info?.revert?.()
      return
    }

    setActionLoading(true)
    const { error } = await updateBooking(booking.id, {
      start_datetime: start.toISOString(),
      end_datetime: safeEnd.toISOString()
    })
    setActionLoading(false)

    if (error) {
      console.error(error)
      toast.error(error.message || 'Không thể cập nhật giờ booking')
      info?.revert?.()
      return
    }

    await fetchBookings()
  }

  const handleEventDrop = async (info) => {
    const type = info?.event?.extendedProps?.type
    if (type !== 'booking') return
    await syncEventToBooking(info)
  }

  const handleEventResize = async (info) => {
    const type = info?.event?.extendedProps?.type
    if (type !== 'booking') return
    await syncEventToBooking(info)
  }

  const handleSelect = (info) => {
    if (!info?.start) return
    openCreateAt(info.start, info.end)
    info?.view?.calendar?.unselect?.()
  }

  const handleDatesSet = (arg) => {
    const viewType = arg?.view?.type
    if (viewType) setCurrentViewType(viewType)

    const from = dayjs(arg?.start).format('YYYY-MM-DD')
    const toExclusive = dayjs(arg?.end).format('YYYY-MM-DD')
    setNotesRange({ from, toExclusive })
    fetchNotesForRange(from, toExclusive)
  }

  const getItemsForDay = useCallback(
    (dayKey) => {
      const key = String(dayKey || '').trim()
      if (!key) return []

      const bookingItems = (bookings || [])
        .filter((b) => {
          const start = b?.start_datetime
          if (!start) return false
          const rawStatus = String(b?.status || 'scheduled')
          if (rawStatus === 'canceled') return false
          return dayjs(start).format('YYYY-MM-DD') === key
        })
        .map((b) => ({
          type: 'booking',
          id: `b_${b.id}`,
          start: b?.start_datetime,
          end: b?.end_datetime || null,
          title: b?.customer_name || '(Chưa có tên)',
          raw: b
        }))

      const noteItems = (notes || [])
        .filter((n) => String(n?.date || '') === key)
        .map((n) => ({
          type: 'note',
          id: `n_${n.id}`,
          start: n?.date && n?.time ? dayjs(`${n.date}T${n.time}`).toISOString() : null,
          title: String(n?.content || '').trim() || '(Note)',
          raw: n
        }))

      const all = [...bookingItems, ...noteItems]
      all.sort((a, b) => {
        // Requirement: show bookings before notes (then by time).
        const order = { booking: 0, note: 1 }
        const oa = order[a?.type] ?? 9
        const ob = order[b?.type] ?? 9
        if (oa !== ob) return oa - ob

        const ta = a?.start ? new Date(a.start).getTime() : 0
        const tb = b?.start ? new Date(b.start).getTime() : 0
        return ta - tb
      })
      return all
    },
    [bookings, notes]
  )

  const openDaySheet = useCallback((date) => {
    const key = date ? dayjs(date).format('YYYY-MM-DD') : ''
    if (!key) return
    setDaySheetDate(key)
    setDaySheetOpen(true)
  }, [])

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedBooking(null)
  }

  const openCreateAt = (start, end) => {
    if (!start) return

    const dayKey = toDayKey(start)
    const counts = getDayCounts(dayKey)
    if ((counts?.bookingCount || 0) >= DAY_BOOKING_LIMIT) {
      toast.info(`Ngày này đã đủ ${DAY_BOOKING_LIMIT} lịch chụp`)
      return
    }

    setSelectedRange({ start, end })
    setCreateOpen(true)
  }

  const handleAddForDay = (date) => {
    const startAt = atTime(date, 8, 0)
    const endAt = atTime(date, 10, 0)
    openCreateAt(startAt, endAt)
  }

  const handleAddNoteForDay = (date) => {
    const startAt = atTime(date, 8, 0)
    openCreateNoteAt(startAt)
  }

  const handleDateClick = (info) => {
    const viewType = info?.view?.type
    const date = info?.date

    if (isPhone && viewType === 'dayGridMonth') {
      if (!date) return
      openDaySheet(date)
      return
    }

    // Clicking inside our day-cell buttons should not trigger dateClick.
    const target = info?.jsEvent?.target
    try {
      if (target?.closest?.('.cv-calendarNoteBtn, .cv-calendarAddBtn')) return
    } catch {
      // ignore
    }

    if (date) {
      setSelectedDayKey(toDayKey(date))
      setSelectedItemId(null)
    }

    // Only used for touch devices on small screens; >=1200 uses in-cell buttons or right panel.
    if (!isPhone) return
    if (!isTouch) return
    if (!date) return
    handleAddForDay(date)
  }

  const openCreateNoteAt = (date) => {
    const start = date ? dayjs(date) : dayjs()
    const key = start.format('YYYY-MM-DD')
    const counts = getDayCounts(key)
    if ((counts?.noteCount || 0) >= DAY_NOTE_LIMIT) {
      toast.info(`Ngày này chỉ được ${DAY_NOTE_LIMIT} note`)
      return
    }

    const nextForm = {
      date: start.format('YYYY-MM-DD'),
      time: start.format('HH:mm'),
      content: '',
      status: 'todo'
    }
    setActiveNote(null)
    setNoteForm(nextForm)
    setNoteBaseline({ ...nextForm })
    setNoteOpen(true)
  }

  const handleSaveNote = async () => {
    const date = String(noteForm.date || '').trim()
    const time = String(noteForm.time || '').trim()
    const content = String(noteForm.content || '').trim()
    const status = NOTE_STATUSES.has(String(noteForm.status)) ? String(noteForm.status) : 'todo'

    if (!date) return toast.error('Vui lòng chọn ngày')
    if (!time) return toast.error('Vui lòng chọn giờ')
    if (!content) return toast.error('Vui lòng nhập nội dung note')

    setNoteSaving(true)
    const op = activeNote?.id
      ? updateNote(activeNote.id, { content, date, time, status })
      : createNote({ booking_id: null, content, date, time, status })

    const { error } = await op
    setNoteSaving(false)

    if (error) {
      console.error(error)
      toast.error(error.message || 'Không thể lưu note')
      return
    }

    toast.success(activeNote?.id ? 'Đã cập nhật note' : 'Đã tạo note')
    setNoteOpen(false)
    setActiveNote(null)

    await refreshNotesInCurrentRange()
  }

  const dayCellContent = (arg) => {
    const key = toDayKey(arg?.date)
    const counts = getDayCounts(key)
    const disableAddBooking = (counts?.bookingCount || 0) >= DAY_BOOKING_LIMIT
    const disableAddNote = (counts?.noteCount || 0) >= DAY_NOTE_LIMIT

    return (
      <CalendarDayCellHeader
        dayNumberText={arg.dayNumberText}
        date={arg.date}
        disableAddBooking={disableAddBooking}
        disableAddNote={disableAddNote}
        onAddNote={(d) => handleAddNoteForDay(d)}
        onAddBooking={(d) => handleAddForDay(d)}
      />
    )
  }

  const eventClassNames = useCallback(
    (arg) => {
      const viewType = arg?.view?.type
      const type = arg?.event?.extendedProps?.type

      const isSelected = selectedItemId && String(arg?.event?.id) === String(selectedItemId)

      // Compact month: render events as colored dots (max handled by dayMaxEvents + "+n more").
      if (isDotMonth && viewType === 'dayGridMonth') {
        if (type === 'booking') {
          const status = String(arg?.event?.extendedProps?.displayStatus || 'scheduled')
          return ['cv-calDot', 'cv-calDot--booking', `status-${status}`, ...(isSelected ? ['cv-event--selected'] : [])]
        }

        if (type === 'note') {
          const status = String(arg?.event?.extendedProps?.displayStatus || 'todo')
          return ['cv-calDot', 'cv-calDot--note', `status-${status}`, ...(isSelected ? ['cv-event--selected'] : [])]
        }

        return isSelected ? ['cv-event--selected'] : []
      }

      // Week view: allow styling booking vs note differently
      if (viewType === 'timeGridWeek' || viewType === 'timeGridDay') {
        if (type === 'booking') {
          const status = String(arg?.event?.extendedProps?.displayStatus || 'scheduled')
          return ['cv-timeBooking', `status-${status}`, ...(isSelected ? ['cv-event--selected'] : [])]
        }

        if (type === 'note') {
          const status = String(arg?.event?.extendedProps?.displayStatus || 'todo')
          return ['cv-timeNote', `status-${status}`, ...(isSelected ? ['cv-event--selected'] : [])]
        }
      }

      return isSelected ? ['cv-event--selected'] : []
    },
    [isDotMonth, selectedItemId]
  )

  const renderEventContent = useCallback(
    (info) => {
      // Compact month: dot indicators only (no chip markup).
      if (isDotMonth && info?.view?.type === 'dayGridMonth') return <span />
      return (
        <CalendarEventContent info={info} />
      )
    },
    [isDotMonth]
  )

  const daySheetItems = useMemo(() => {
    if (!daySheetDate) return []
    return getItemsForDay(daySheetDate)
  }, [daySheetDate, getItemsForDay])

  const daySheetCounts = useMemo(() => {
    if (!daySheetDate) return { bookingCount: 0, noteCount: 0 }
    return getDayCounts(daySheetDate)
  }, [daySheetDate, getDayCounts])

  const canAddBookingInDaySheet = daySheetCounts.bookingCount < DAY_BOOKING_LIMIT
  const canAddNoteInDaySheet = daySheetCounts.noteCount < DAY_NOTE_LIMIT
  const showDaySheetActions = canAddBookingInDaySheet || canAddNoteInDaySheet

  const handleOpenDaySheetItem = useCallback(
    (item) => {
      if (!item) return
      setDaySheetOpen(false)
      if (item.type === 'note') openNote(item.raw)
      if (item.type === 'booking') openBooking(item.raw)
    },
    [openBooking, openNote]
  )

  const selectedDayItems = useMemo(() => {
    if (!selectedDayKey) return []
    return getItemsForDay(selectedDayKey)
  }, [getItemsForDay, selectedDayKey])

  const selectedDayHeader = useMemo(() => {
    const d = selectedDayKey ? dayjs(selectedDayKey).toDate() : new Date()
    const isToday = selectedDayKey ? dayjs(selectedDayKey).isSame(dayjs(), 'day') : false

    const title = isToday ? 'Today' : dayjs(d).format('DD/MM/YYYY')
    const full = new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(d)

    return { title, full, isToday }
  }, [selectedDayKey])

  const selectedSideDay = useMemo(() => {
    return selectedDayKey ? dayjs(selectedDayKey) : dayjs()
  }, [selectedDayKey])

  const selectedDayStats = useMemo(() => {
    const items = Array.isArray(selectedDayItems) ? selectedDayItems : []

    const activeItems = items.filter((it) => {
      if (it?.type === 'booking') return String(it?.raw?.status || '') !== 'canceled'
      if (it?.type === 'note') return String(it?.raw?.status || 'todo') !== 'completed'
      return Boolean(it)
    })

    const bookingItems = activeItems.filter((it) => it?.type === 'booking')
    const bookingCount = bookingItems.length

    const invoiceCount = bookingItems.reduce((acc, it) => {
      const bookingId = it?.raw?.id
      if (bookingId === null || bookingId === undefined) return acc
      return invoicesByBookingId?.[bookingId] ? acc + 1 : acc
    }, 0)

    const bookingLimit = DAY_BOOKING_LIMIT
    const noteLimit = DAY_NOTE_LIMIT
    const availableSlots = Math.max(bookingLimit - bookingCount, 0)

    const noteCount = (notes || []).filter((n) => String(n?.date || '').slice(0, 10) === String(selectedDayKey || '')).length
    const availableNotes = Math.max(noteLimit - noteCount, 0)

    return {
      totalEvents: activeItems.length,
      invoiceCount,
      availableSlots,
      bookingLimit,
      noteCount,
      noteLimit,
      availableNotes
    }
  }, [notes, selectedDayItems, selectedDayKey, invoicesByBookingId])

  const upcomingToday = useMemo(() => {
    if (!selectedDayHeader?.isToday) return null
    const now = dayjs()

    const items = Array.isArray(selectedDayItems) ? selectedDayItems : []
    const upcoming = items
      .filter((it) => it?.type === 'booking' && it?.start)
      .map((it) => ({ ...it, _start: dayjs(it.start) }))
      .filter((it) => it?._start?.isValid?.() && it._start.isAfter(now))
      .sort((a, b) => a._start.valueOf() - b._start.valueOf())[0]

    if (!upcoming) return null

    const mins = Math.max(upcoming._start.diff(now, 'minute'), 0)
    const hours = Math.floor(mins / 60)
    const minutes = mins % 60

    const remainingText = hours > 0
      ? `Còn ${hours} giờ${minutes ? ` ${minutes}p` : ''}`
      : `Còn ${minutes} phút`

    return {
      id: upcoming.id,
      timeText: upcoming._start.format('HH:mm'),
      title: upcoming.title,
      remainingText
    }
  }, [selectedDayHeader?.isToday, selectedDayItems])

  const overdueBookings = useMemo(() => {
    const todayStart = dayjs().startOf('day')
    return (bookings || [])
      .filter((b) => {
        const start = b?.start_datetime ? dayjs(b.start_datetime) : null
        if (!start || !start.isValid()) return false
        const rawStatus = String(b?.status || 'scheduled')
        if (rawStatus === 'completed' || rawStatus === 'canceled') return false
        return start.isBefore(todayStart)
      })
      .sort((a, b) => {
        const ta = a?.start_datetime ? new Date(a.start_datetime).getTime() : 0
        const tb = b?.start_datetime ? new Date(b.start_datetime).getTime() : 0
        return ta - tb
      })
      .slice(0, 6)
      .map((b) => ({
        id: `b_${b.id}`,
        type: 'booking',
        start: b?.start_datetime,
        end: b?.end_datetime || null,
        title: b?.customer_name || '(Chưa có tên)',
        raw: b
      }))
  }, [bookings])

  const handleQuickComplete = async (booking) => {
    setActionLoading(true)
    const { error } = await setBookingStatus(booking.id, 'completed')
    setActionLoading(false)

    if (error) {
      toast.error(error.message || 'Không thể hoàn thành booking')
      return
    }

    toast.success('Đã hoàn thành booking')
    await fetchBookings()
    handleCloseModal()
  }

  const handleCancel = async (booking) => {
    setActionLoading(true)
    const { error } = await setBookingStatus(booking.id, 'canceled')
    setActionLoading(false)

    if (error) {
      toast.error(error.message || 'Không thể huỷ booking')
      return
    }

    toast.success('Đã huỷ booking')
    await fetchBookings()
    handleCloseModal()
  }

  return (
    <>
      <div className="cv-pagePad">
        <div className="cv-container">
          <div className="cv-calendarSplit">
            <div className="cv-calendarMain">
              <div className="cv-calendarPage" ref={calendarWrapRef}>
                {loadingBookings && !bookings?.length ? (
                  <div style={{ padding: 12 }}>
                    <ShimmerCard titleWidth="38%" rows={12} />
                  </div>
                ) : (
                  <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    locale={viLocale}
                    headerToolbar={
                      isPhone
                        ? { left: 'title', center: 'prev,next', right: '' }
                        : { left: 'title prev,next', right: 'today dayGridMonth,timeGridWeek' }
                    }
                    buttonText={{
                      today: 'Hôm nay',
                      month: 'Tháng',
                      week: 'Tuần'
                    }}
                    dayHeaderContent={(arg) => {
                      if (arg?.view?.type !== 'timeGridWeek') return arg.text
                      const day = arg?.date ? dayjs(arg.date).format('D') : ''
                      const top = formatWeekdayHeader(arg?.date)
                      const isToday = arg?.date ? dayjs(arg.date).isSame(dayjs(), 'day') : false
                      const circleClass = isToday ? 'cv-weekDayCircle cv-weekDayCircle--today' : 'cv-weekDayCircle'
                      return {
                        html: `
                          <div class="cv-weekDayHeader">
                            <div class="cv-weekDayHeaderTop">${top}</div>
                            <div class="${circleClass}">${day}</div>
                          </div>
                        `
                      }
                    }}
                    dayCellClassNames={(arg) => {
                      const key = toDayKey(arg?.date)
                      const out = []

                      if (key && selectedDayKey && key === selectedDayKey) out.push('cv-day--selected')

                      return out
                    }}
                    dayCellContent={dayCellContent}
                    dateClick={handleDateClick}
                    selectable={false}
                    selectMirror
                    select={handleSelect}
                    events={events}
                    eventClick={(info) => {
                      const d = info?.event?.start
                      if (d) {
                        setSelectedDayKey(toDayKey(d))
                        setSelectedItemId(String(info?.event?.id || '') || null)
                      }
                      handleEventClick(info)
                    }}
                    eventClassNames={eventClassNames}
                    eventContent={renderEventContent}
                    datesSet={handleDatesSet}
                    eventAllow={(dropInfo, draggedEvent) => {
                      const type = draggedEvent?.extendedProps?.type
                      if (type === 'note') return false
                      if (type !== 'booking') return false

                      const status = String(draggedEvent?.extendedProps?.raw?.status || 'scheduled')
                      if (status === 'completed' || status === 'canceled') return false
                      return true
                    }}
                    editable
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    eventResizableFromStart
                    height="auto"
                    eventDisplay="block"
                    dayMaxEvents={3}
                    allDaySlot={currentViewType === 'timeGridWeek' || currentViewType === 'timeGridDay'}
                    slotMinTime="06:00:00"
                    slotMaxTime="18:00:00"
                    slotEventOverlap={currentViewType === 'timeGridWeek'}
                    views={{
                      dayGridMonth: { editable: false, selectable: false },
                      timeGridWeek: { editable: true, selectable: true }
                    }}
                    eventOrder={(a, b) => {
                      const order = { booking: 1, note: 2 }
                      return (order[a.extendedProps.type] || 9)
                        - (order[b.extendedProps.type] || 9)
                    }}
                    eventTimeFormat={{
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    }}
                  />
                )}
              </div>
            </div>

            {!isPhone ? (
              <aside className="cv-calendarSide" aria-label="Chi tiết ngày">
                <div className="cv-calSideCard">
                <div className="cv-calSideHeader">
                  <div className="cv-calSideDateContent">
                    <div className="cv-calSideDateMain">
                      {selectedSideDay.format('DD')}
                    </div>
                    <div className="cv-calSideDateRight">
                      <div className="cv-calSideDateWeekday">
                        {selectedSideDay.format('dddd')}
                      </div>
                      <div className="cv-calSideDateMonthYear">
                        {selectedSideDay.format('MMMM,YYYY')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cv-calSideMiniStats" aria-label="Thống kê nhanh">
                  <div className="cv-calMiniStat" role="group" aria-label="Tổng việc">
                    <div className="cv-calMiniStatTop">
                      <span className="cv-calMiniStatLabel">Tổng</span>
                      <span className="cv-calMiniStatValue">{selectedDayStats.totalEvents}</span>
                    </div>
                    <div className="cv-calMiniStatHint">việc trong ngày</div>
                  </div>

                  <div className="cv-calMiniStat" role="group" aria-label="Số invoice">
                    <div className="cv-calMiniStatTop">
                      <span className="cv-calMiniStatLabel">Invoice</span>
                      <span className="cv-calMiniStatValue">{selectedDayStats.invoiceCount}</span>
                    </div>
                    <div className="cv-calMiniStatHint">đã tạo</div>
                  </div>

                  <div className="cv-calMiniStat" role="group" aria-label="Số slot trống">
                    <div className="cv-calMiniStatTop">
                      <span className="cv-calMiniStatLabel">Slot</span>
                      <span className="cv-calMiniStatValue">
                        {selectedDayStats.availableSlots}/{selectedDayStats.bookingLimit}
                      </span>
                    </div>
                    <div className="cv-calMiniStatHint">còn trống</div>
                  </div>
                </div>

                {upcomingToday && (
                  <div className="cv-calSideSection cv-calSideSection--upcoming">
                    <div className="cv-calSideSectionTitle">Sắp diễn ra</div>
                    <div className="cv-calSideSectionCard cv-calSideSectionCard--upcoming">
                      <div className="cv-calUpcomingRow" role="group" aria-label="Sự kiện sắp tới">
                        <span className="cv-calUpcomingTime">{upcomingToday.timeText}</span>
                        <span className="cv-calUpcomingTitle" title={upcomingToday.title}>{upcomingToday.title}</span>
                        <span className="cv-calUpcomingMeta">{upcomingToday.remainingText}</span>
                      </div>
                    </div>
                  </div>
                )}


                <div className="cv-calSideActions">
                  <Button
                    type="primary"
                    className="cv-calSideActionBtn cv-calSideActionBtn--primary"
                    icon={
                      <span className="material-symbols-rounded" style={{ fontSize: 18, lineHeight: 1 }}>
                        calendar_add_on
                      </span>
                    }
                    onClick={() => {
                      const d = selectedDayKey ? dayjs(selectedDayKey).toDate() : new Date()
                      handleAddForDay(d)
                    }}
                    disabled={selectedDayStats.availableSlots <= 0}
                    block
                  >
                    Thêm lịch
                  </Button>

                  <Button
                    className="cv-calSideActionBtn cv-calSideActionBtn--secondary"
                    icon={
                      <span className="material-symbols-rounded" style={{ fontSize: 18, lineHeight: 1 }}>
                        note_add
                      </span>
                    }
                    onClick={() => {
                      const d = selectedDayKey ? dayjs(selectedDayKey).toDate() : new Date()
                      handleAddNoteForDay(d)
                    }}
                    disabled={selectedDayStats.availableNotes <= 0}
                    block
                  >
                    Thêm note
                  </Button>
                </div>

                <div className="cv-calSideSection">
                  <div className="cv-calSideSectionTitle cv-calSideSectionTitle--focus">
                    {selectedDayHeader.isToday
                      ? 'Những việc hôm nay'
                      : `Những việc ngày ${dayjs(selectedDayKey).format('DD/MM')}`}
                    <span className="cv-calCountBadge" aria-label={`Tổng ${selectedDayItems?.length || 0} mục`}>
                      {selectedDayItems?.length || 0}
                    </span>
                  </div>

                  {selectedDayItems?.length ? (
                    <div className="cv-calSideSectionCard cv-calSideSectionCard--today">
                      <div className="cv-calSideList" role="list">
                        {selectedDayItems.map((it) => {
                          const startText = it?.start ? dayjs(it.start).format('HH:mm') : ''
                          const endText = it?.end ? dayjs(it.end).format('HH:mm') : ''
                          const timeText = startText ? (endText ? `${startText} - ${endText}` : startText) : ''

                          const status = it?.type === 'note'
                            ? (String(it?.raw?.status || 'todo') === 'completed' ? 'done' : 'todo')
                            : getBookingDisplayStatus(it?.raw)

                          const active = selectedItemId && String(it.id) === String(selectedItemId)
                          const cls = active
                            ? `cv-calSideItem cv-calSideItem--active status-${status}`
                            : `cv-calSideItem status-${status}`

                          return (
                            <button
                              key={it.id}
                              type="button"
                              className={cls}
                              onClick={() => {
                                setSelectedItemId(String(it.id))
                                if (it?.start) setSelectedDayKey(toDayKey(it.start))
                              }}
                              aria-pressed={Boolean(active)}
                            >
                              <span className={`cv-calSideDot status-${status}`} aria-hidden />
                              <span className="cv-calSideTime">{timeText || '--:--'}</span>
                              <span className="cv-calSideText">{it.title}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="cv-calSideSectionCard cv-calSideSectionCard--today">
                      <div className="cv-calSideEmpty">
                        <div className="cv-emptyState cv-emptyState--compact">
                          <span className="material-symbols-rounded cv-emptyStateIcon" aria-hidden>
                            event_busy
                          </span>
                          <div className="cv-emptyStateTitle">Chưa có lịch trong ngày này</div>
                          <div className="cv-emptyStateHint">Bạn có quên thêm note không? Hãy bấm “Thêm note” để ghi lại việc cần làm.</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="cv-calSideSection">
                  <div className="cv-calSideSectionTitle cv-calSideSectionTitle--warn">
                    Lịch chưa hoàn thành
                    <span className="cv-calCountBadge" aria-label={`Tổng ${overdueBookings.length || 0} mục`}>
                      {overdueBookings.length || 0}
                    </span>
                  </div>

                  {overdueBookings.length ? (
                    <div className="cv-calSideSectionCard cv-calSideSectionCard--overdue">
                      <div className="cv-calSideList" role="list">
                        {overdueBookings.map((it) => {
                          const startText = it?.start ? dayjs(it.start).format('HH:mm') : ''
                          const dateText = it?.start ? dayjs(it.start).format('DD/MM') : ''
                          const timeText = startText ? `${dateText} • ${startText}` : dateText
                          const status = 'warning'

                          const active = selectedItemId && String(it.id) === String(selectedItemId)
                          const cls = active
                            ? `cv-calSideItem cv-calSideItem--active status-${status}`
                            : `cv-calSideItem status-${status}`

                          return (
                            <button
                              key={it.id}
                              type="button"
                              className={cls}
                              onClick={() => {
                                const start = it?.start ? dayjs(it.start) : null
                                if (start?.isValid()) {
                                  setSelectedDayKey(start.format('YYYY-MM-DD'))
                                  setSelectedItemId(String(it.id))
                                  calendarRef.current?.getApi?.()?.gotoDate?.(start.toDate())
                                }
                                openBooking(it.raw)
                              }}
                              aria-pressed={Boolean(active)}
                            >
                              <span className={`cv-calSideDot status-${status}`} aria-hidden />
                              <span className="cv-calSideTime">{timeText || '--'}</span>
                              <span className="cv-calSideText">{it.title}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="cv-calSideSectionCard cv-calSideSectionCard--overdue">
                      <div className="cv-calSideEmpty">
                        <div className="cv-emptyState cv-emptyState--compact">
                          <span className="material-symbols-rounded cv-emptyStateIcon" aria-hidden>
                            task_alt
                          </span>
                          <div className="cv-emptyStateTitle">Không có lịch quá hạn</div>
                          <div className="cv-emptyStateHint">Mọi lịch đều đang đúng hạn. Nếu cần, bạn có thể thêm note để nhắc việc.</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </div>

      <Modal
        open={daySheetOpen}
        onCancel={() => setDaySheetOpen(false)}
        footer={null}
        centered
        wrapClassName="cv-calendarModal cv-daySheetModal"
        title={null}
      >
        <div className="cv-daySheet">
          <div className="cv-daySheetHeader">
            <div className="cv-calSideDateContent">
              <div className="cv-calSideDateMain">
                {daySheetDate ? dayjs(daySheetDate).format('DD') : '--'}
              </div>
              <div className="cv-calSideDateRight">
                <div className="cv-calSideDateWeekday">
                  {daySheetDate ? dayjs(daySheetDate).format('dddd') : ''}
                </div>
                <div className="cv-calSideDateMonthYear">
                  {daySheetDate ? dayjs(daySheetDate).format('MMMM,YYYY') : ''}
                </div>
              </div>
            </div>
          </div>

          {showDaySheetActions ? (
            <div className="cv-daySheetActions">
              {canAddBookingInDaySheet ? (
                <Button
                  type="primary"
                  className="cv-calSideActionBtn cv-calSideActionBtn--primary cv-daySheetActionBtn"
                  icon={
                    <span className="material-symbols-rounded" style={{ fontSize: 18, lineHeight: 1 }}>
                      calendar_add_on
                    </span>
                  }
                  onClick={() => {
                    const d = daySheetDate ? dayjs(daySheetDate).toDate() : new Date()
                    setDaySheetOpen(false)
                    handleAddForDay(d)
                  }}
                  block
                >
                  Thêm lịch
                </Button>
              ) : null}

              {canAddNoteInDaySheet ? (
                <Button
                  className="cv-calSideActionBtn cv-calSideActionBtn--secondary cv-daySheetActionBtn"
                  icon={
                    <span className="material-symbols-rounded" style={{ fontSize: 18, lineHeight: 1 }}>
                      note_add
                    </span>
                  }
                  onClick={() => {
                    const d = daySheetDate ? dayjs(daySheetDate).toDate() : new Date()
                    setDaySheetOpen(false)
                    handleAddNoteForDay(d)
                  }}
                  block
                >
                  Thêm note
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="cv-daySheetSectionTitle">
            <span className="cv-daySheetSectionText">
              {daySheetDate
                ? `Những việc ngày ${dayjs(daySheetDate).format('DD/MM')}`
                : 'Những việc'}
            </span>
            <span className="cv-calCountBadge" aria-label={`Tổng ${daySheetItems?.length || 0} mục`}>
              {daySheetItems?.length || 0}
            </span>
          </div>

          {daySheetItems.length ? (
            <div className="cv-daySheetList" role="list">
              {daySheetItems.map((it) => {
                const isNote = it?.type === 'note'

                const timeText = (() => {
                  if (isNote) {
                    const rawDate = it?.raw?.date
                    const rawTime = it?.raw?.time
                    if (rawDate && rawTime) return dayjs(`${rawDate}T${rawTime}`).format('HH:mm')
                    return ''
                  }

                  const startText = it?.start ? dayjs(it.start).format('HH:mm') : ''
                  const endText = it?.end ? dayjs(it.end).format('HH:mm') : ''
                  return startText ? (endText ? `${startText} - ${endText}` : startText) : ''
                })()

                const status = isNote
                  ? (String(it?.raw?.status || 'todo') === 'completed' ? 'done' : 'todo')
                  : getBookingDisplayStatus(it?.raw)

                const cls = `cv-daySheetItem cv-eventRow ${isNote ? 'note' : 'booking'} status-${status}`

                return (
                  <button
                    key={it.id}
                    type="button"
                    className={cls}
                    onClick={() => handleOpenDaySheetItem(it)}
                    aria-label={`${timeText || ''} ${it.title}`.trim()}
                    data-cv-type={isNote ? 'note' : 'booking'}
                    data-cv-status={status}
                  >
                    <span className="cv-eventTime">{timeText || '--:--'}</span>
                    <span className="cv-eventText">{it.title}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="cv-daySheetEmpty">
              <div className="cv-emptyState cv-emptyState--compact">
                <span className="material-symbols-rounded cv-emptyStateIcon" aria-hidden>
                  calendar_clock
                </span>
                <div className="cv-emptyStateTitle">Ngày này chưa có gì</div>
                <div className="cv-emptyStateHint">Bạn có quên thêm note không? Dùng nút “Thêm lịch” hoặc “Thêm note” ở phía trên.</div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <BookingModal
        open={modalOpen}
        booking={selectedBooking}
        invoice={selectedBooking?.id ? invoicesByBookingId?.[selectedBooking.id] : null}
        existingBookings={bookings}
        dayBookingLimit={DAY_BOOKING_LIMIT}
        packageOptions={packageOptions}
        confirmLoading={actionLoading}
        onClose={handleCloseModal}
        onUpdated={fetchBookings}
        onQuickComplete={handleQuickComplete}
        onCancel={handleCancel}
        onOpenInvoice={onOpenInvoice}
      />

      <CreateBookingModal
        open={createOpen}
        defaultRange={selectedRange}
        existingBookings={bookings}
        packageOptions={packageOptions}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreatedBooking}
      />

      <NoteModal
        open={noteOpen}
        note={activeNote}
        form={noteForm}
        baseline={noteBaseline}
        onChangeForm={setNoteForm}
        onCancel={() => {
          setNoteOpen(false)
          setActiveNote(null)
          setNoteBaseline(null)
        }}
        onOk={handleSaveNote}
        confirmLoading={noteSaving}
      />
    </>
  )
}
