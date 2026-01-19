import dayjs from 'dayjs'
import { useMemo, useRef, useState } from 'react'
import { AutoComplete, Button, DatePicker, Input, InputNumber, Modal, Select, Switch, TimePicker } from 'antd'
import { toast } from 'react-toastify'
import { toNumber } from '../../utils/number.js'
import { createBooking } from '../../services/booking.service'
import { createInvoice, getInvoiceByBookingId, updateInvoice } from '../../services/invoice.service'
import QuickNoteSuggestions from '../ui/QuickNoteSuggestions'

const DEFAULT_DURATION_MINUTES = 60
const INITIAL_DEFAULT_DURATION_MINUTES = 120

const DAY_SHOOTING_LIMIT = 2
const DAY_LESSON_LIMIT = 1
const DAY_BOOKING_LIMIT = DAY_SHOOTING_LIMIT + DAY_LESSON_LIMIT

const LESSON_PACKAGE_NAME = 'Cookie khác'
const LESSON_DEFAULT_LOCATION = 'Đại học FPT'

const LOCATION_SUGGESTIONS = [
  'Bến Ninh Kiều',
  'Lăng Thủ Khoa',
  'Chùa Nam Nhã',
  'Thiền Viện Trúc Lâm'
]

const CURRENCY_MIN = 1000
const CURRENCY_MAX = 10000000

const normalizeToVnPhone10 = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''

  // +84xxxxxxxxx / 84xxxxxxxxx => 0xxxxxxxxx
  if (digits.startsWith('84') && digits.length === 11) return `0${digits.slice(2)}`
  return digits
}

const isValidVnPhone10Digits = (value) => {
  if (!value) return false
  const normalized = normalizeToVnPhone10(value)
  return /^0\d{9}$/.test(normalized)
}

const timeStringToDayjs = (value) => {
  if (!value) return null
  const [hh, mm] = String(value).split(':').map((s) => Number(s))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return dayjs().hour(hh).minute(mm).second(0)
}

const dayjsToTimeString = (d) => {
  if (!d) return ''
  try {
    return dayjs(d).format('HH:mm')
  } catch {
    return ''
  }
}

const getInitialFormFromRange = (defaultRange) => {
  const start = defaultRange?.start ?? defaultRange?.time ?? defaultRange?.date
  const end = defaultRange?.end ?? null

  const startDayjs = start ? dayjs(start) : null
  const baseStart = startDayjs && startDayjs.isValid() ? startDayjs : dayjs().hour(8).minute(0)
  const normalizedStart = baseStart.hour() === 0 && baseStart.minute() === 0
    ? baseStart.hour(8).minute(0)
    : baseStart

  const endDayjs = end ? dayjs(end) : null
  const normalizedEnd = endDayjs && endDayjs.isValid()
    ? endDayjs
    : normalizedStart.add(INITIAL_DEFAULT_DURATION_MINUTES, 'minute')

  return {
    customer_name: '',
    customer_phone: '',
    location: '',
    start_date: normalizedStart.format('YYYY-MM-DD'),
    start_time: normalizedStart.format('HH:mm'),
    end_time: normalizedEnd.format('HH:mm'),
    package_id: null,
    people_count: 1,
    note: '',
    price: null,
    deposit: 0
  }
}

const isLessonBookingRow = (bookingRow) => {
  const note = String(bookingRow?.note || '')
  if (/\[HỌC/i.test(note)) return true
  const pkgName = String(bookingRow?.packages?.name || '')
  if (pkgName.trim() === LESSON_PACKAGE_NAME) return true
  return false
}

export default function CreateBookingModal(props) {
  const start = props?.defaultRange?.start ?? props?.defaultRange?.time ?? props?.defaultRange?.date
  const end = props?.defaultRange?.end ?? null

  const key = `${props.open ? '1' : '0'}-${start ? new Date(start).toISOString() : ''}-${end ? new Date(end).toISOString() : ''}`
  return <CreateBookingModalInner key={key} {...props} />
}

function CreateBookingModalInner({
  open,
  defaultRange,
  existingBookings = [],
  packageOptions = [],
  onClose,
  onCreated
}) {
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(() => getInitialFormFromRange(defaultRange))
  const initialForm = useMemo(() => getInitialFormFromRange(defaultRange), [defaultRange])

  const [priceTouched, setPriceTouched] = useState(false)

  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [touched, setTouched] = useState({})

  const [eventType, setEventType] = useState('shooting') // shooting | lesson

  const [allDay, setAllDay] = useState(false)
  const lastTimeRangeRef = useRef({ start_time: form.start_time, end_time: form.end_time })

  const hasPresetDay = Boolean(defaultRange?.start ?? defaultRange?.time ?? defaultRange?.date)

  const onChange = (key) => (e) => {
    const value = e?.target?.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handlePackageChange = (value) => {
    if (eventType === 'lesson') return
    setForm((p) => ({ ...p, package_id: value }))
  }

  const cookieKhacPackageId = useMemo(() => {
    const list = Array.isArray(packageOptions) ? packageOptions : []
    const found = list.find((p) => String(p?.label || '').trim() === LESSON_PACKAGE_NAME)
    return found?.value ?? null
  }, [packageOptions])

  const resolvedPackageId = eventType === 'lesson' ? cookieKhacPackageId : form.package_id
  const selectedPackage = (packageOptions || []).find((p) => p?.value === resolvedPackageId) || null
  const showPeopleCount = selectedPackage?.label === 'Cookie Nhiều mình'

  const toInt = (value, fallback = 0) => {
    const n = toNumber(value, fallback)
    if (!Number.isFinite(n)) return fallback
    return Math.round(n)
  }

  const computeCookieNhieuMinhBasePrice = (peopleCount) => {
    const count = Math.max(1, toNumber(peopleCount))
    if (count === 3 || count === 4) return count * 400000
    if (count >= 5) return count * 350000
    return 0
  }

  const computedDefaultPrice = useMemo(() => {
    if (showPeopleCount) return computeCookieNhieuMinhBasePrice(form.people_count)
    return selectedPackage?.price ?? null
  }, [form.people_count, selectedPackage?.price, showPeopleCount])

  const effectivePrice = priceTouched ? form.price : computedDefaultPrice

  const isDirty = useMemo(() => {
    const base = initialForm || {}
    const baseline = {
      customer_name: String(base.customer_name || '').trim(),
      customer_phone: String(base.customer_phone || '').trim(),
      location: String(base.location || '').trim(),
      start_date: String(base.start_date || '').trim(),
      start_time: String(base.start_time || '').trim(),
      end_time: String(base.end_time || '').trim(),
      package_id: base.package_id ?? null,
      people_count: toNumber(base.people_count) || 1,
      note: String(base.note || '').trim(),
      price: base.price === null || base.price === undefined ? null : toNumber(base.price),
      deposit: toNumber(base.deposit) || 0,
      allDay: false
    }

    const current = {
      customer_name: String(form.customer_name || '').trim(),
      customer_phone: String(form.customer_phone || '').trim(),
      location: String(form.location || '').trim(),
      start_date: String(form.start_date || '').trim(),
      start_time: String(form.start_time || '').trim(),
      end_time: String(form.end_time || '').trim(),
      package_id: form.package_id ?? null,
      people_count: toNumber(form.people_count) || 1,
      note: String(form.note || '').trim(),
      price: form.price === null || form.price === undefined ? null : toNumber(form.price),
      deposit: toNumber(form.deposit) || 0,
      allDay: Boolean(allDay)
    }

    return JSON.stringify(baseline) !== JSON.stringify(current)
  }, [allDay, form, initialForm])

  const conflictMsg = useMemo(() => {
    const start = dayjs(`${form.start_date}T${form.start_time}`).second(0).millisecond(0)
    const end = dayjs(`${form.start_date}T${form.end_time}`).second(0).millisecond(0)

    if (!start.isValid() || !end?.isValid()) return 'Vui lòng nhập ngày/giờ hợp lệ'
    if (!end.isAfter(start)) return 'Giờ kết thúc phải sau giờ bắt đầu'

    const overlap = (existingBookings || []).some((b) => {
      if (!b) return false
      if (b.status === 'canceled') return false

      const otherStart = b.start_datetime ? dayjs(b.start_datetime).second(0).millisecond(0) : null
      const otherEnd = b.end_datetime
        ? dayjs(b.end_datetime).second(0).millisecond(0)
        : otherStart && otherStart.isValid()
          ? otherStart.add(DEFAULT_DURATION_MINUTES, 'minute')
          : null

      if (!otherStart?.isValid() || !otherEnd?.isValid()) return false
      return start.isBefore(otherEnd) && end.isAfter(otherStart)
    })

    if (overlap) return 'Trùng lịch: thời gian này đã có ca chụp'
    return null
  }, [existingBookings, form.end_time, form.start_date, form.start_time])

  const errors = useMemo(() => {
    const out = {}

    // Day limit: max N bookings per day (exclude canceled)
    const dayKey = String(form.start_date || '').trim()
    if (dayKey) {
      const sameDay = (existingBookings || []).filter((b) => {
        if (!b) return false
        const rawStatus = String(b?.status || 'scheduled')
        if (rawStatus === 'canceled') return false
        const key = b?.start_datetime ? dayjs(b.start_datetime).format('YYYY-MM-DD') : ''
        return key === dayKey
      })

      const shootingCount = sameDay.filter((b) => !isLessonBookingRow(b)).length
      const lessonCount = sameDay.filter((b) => isLessonBookingRow(b)).length
      const totalCount = sameDay.length

      if (eventType === 'lesson' && lessonCount >= DAY_LESSON_LIMIT) {
        out.conflict = `Ngày này đã đủ ${DAY_LESSON_LIMIT} lịch học`
      } else if (eventType === 'shooting' && shootingCount >= DAY_SHOOTING_LIMIT) {
        out.conflict = `Ngày này đã đủ ${DAY_SHOOTING_LIMIT} lịch chụp`
      } else if (totalCount >= DAY_BOOKING_LIMIT) {
        out.conflict = `Ngày này đã đủ ${DAY_BOOKING_LIMIT} lịch`
      }
    }

    const name = String(form.customer_name || '').trim()
    if (!name) out.customer_name = eventType === 'lesson' ? 'Vui lòng chọn Online/Offline' : 'Vui lòng nhập tên khách hàng'

    if (eventType === 'lesson') {
      if (!cookieKhacPackageId) out.package_id = `Chưa có gói "${LESSON_PACKAGE_NAME}" (vui lòng tạo trong mục Packages)`
    } else if (!form.package_id) {
      out.package_id = 'Vui lòng chọn gói chụp'
    }

    const phone = String(form.customer_phone || '').trim()
    if (phone && !isValidVnPhone10Digits(phone)) out.customer_phone = 'Số điện thoại phải đủ 10 số'

    const start = dayjs(`${form.start_date}T${form.start_time}`)
    const end = dayjs(`${form.start_date}T${form.end_time}`)
    if (!start.isValid() || !end?.isValid()) out.timeRange = 'Vui lòng nhập ngày/giờ hợp lệ'
    else if (!end.isAfter(start)) out.timeRange = 'Giờ kết thúc phải sau giờ bắt đầu'

    const shouldValidateInvoice = Boolean(
      form.package_id
      || (effectivePrice !== null && effectivePrice !== undefined && String(effectivePrice) !== '')
      || toInt(form.deposit, 0) > 0
    )

    if (shouldValidateInvoice) {
      const totalAmount = toInt(effectivePrice, NaN)
      const deposit = toInt(form.deposit, 0)
      if (Number.isFinite(totalAmount)) {
        if (totalAmount > 0 && totalAmount < CURRENCY_MIN) out.price = `Giá phải = 0 hoặc ≥ ${CURRENCY_MIN.toLocaleString('vi-VN')}`
        else if (totalAmount > CURRENCY_MAX) out.price = `Giá không được lớn hơn ${CURRENCY_MAX.toLocaleString('vi-VN')}`
      }

      if (deposit < 0) out.deposit = 'Tiền cọc không hợp lệ'
      else if (deposit > 0 && deposit < CURRENCY_MIN) out.deposit = `Tiền cọc phải = 0 hoặc ≥ ${CURRENCY_MIN.toLocaleString('vi-VN')}`
      else if (deposit > CURRENCY_MAX) out.deposit = `Tiền cọc không được lớn hơn ${CURRENCY_MAX.toLocaleString('vi-VN')}`
      else if (Number.isFinite(totalAmount) && deposit > totalAmount) out.deposit = 'Tiền cọc không được lớn hơn giá'
    }

    if (!out.conflict && conflictMsg) out.conflict = conflictMsg

    return out
  }, [form, existingBookings, eventType, cookieKhacPackageId, conflictMsg, effectivePrice])

  const locationAutoOptions = useMemo(() => {
    const q = String(form.location || '').trim().toLowerCase()
    const list = q
      ? LOCATION_SUGGESTIONS.filter((s) => s.toLowerCase().includes(q))
      : LOCATION_SUGGESTIONS
    return list.map((value) => ({ value }))
  }, [form.location])

  const showError = (key) => Boolean((submitAttempted || touched?.[key]) && errors?.[key])

  const upsertInvoiceForBooking = async (bookingRow) => {
    const bookingId = bookingRow?.id
    if (!bookingId) return { error: { message: 'Thiếu booking_id' } }

    const totalAmount = toInt(effectivePrice, 0)
    const deposit = toInt(form.deposit, 0)

    const resolvedPackageId = eventType === 'lesson' ? cookieKhacPackageId : form.package_id
    if (!resolvedPackageId) return { error: { message: 'Thiếu package_id' } }

    const payload = {
      booking_id: bookingId,
      package_id: resolvedPackageId,
      base_price: totalAmount,
      total_amount: totalAmount,
      deposit
    }

    // Try to update trigger-created invoice (with short retries), otherwise create.
    let lastErr = null
    for (let i = 0; i < 3; i++) {
      const { data: inv, error: invErr } = await getInvoiceByBookingId(bookingId)
      if (!invErr && inv?.id) {
        return await updateInvoice(inv.id, payload)
      }
      lastErr = invErr

      await new Promise((r) => setTimeout(r, 300))
    }

    const created = await createInvoice({ ...payload, status: 'draft' })
    if (created?.error) return created
    if (created?.data) return created
    return { data: null, error: lastErr || { message: 'Không thể tạo/ cập nhật hoá đơn' } }
  }

  const confirmCreate = async () => {
    return await new Promise((resolve) => {
      Modal.confirm({
        title: 'Tạo lịch mới?'
        , content: 'Bạn muốn tạo lịch với thông tin hiện tại?'
        , centered: true
        , icon: (
          <span className="material-symbols-rounded">
            help
          </span>
        )
        , okText: 'Tạo'
        , cancelText: 'Xem lại'
        , onOk: () => resolve(true)
        , onCancel: () => resolve(false)
      })
    })
  }

  const confirmCancel = async () => {
    return await new Promise((resolve) => {
      Modal.confirm({
        title: 'Bỏ tạo lịch?'
        , content: 'Thông tin bạn nhập sẽ không được lưu.'
        , centered: true
        , icon: (
          <span className="material-symbols-rounded">
            warning
          </span>
        )
        , okText: 'Bỏ'
        , okButtonProps: { danger: true }
        , cancelText: 'Tiếp tục'
        , onOk: () => resolve(true)
        , onCancel: () => resolve(false)
      })
    })
  }

  const handleCreate = async () => {
    try {
      if (creating) return

      setSubmitAttempted(true)
      if (Object.keys(errors || {}).length) return

      const start = dayjs(`${form.start_date}T${form.start_time}`)
      const end = dayjs(`${form.start_date}T${form.end_time}`)
      if (!start.isValid() || !end.isValid()) return
      if (!end.isAfter(start)) return

      if (conflictMsg) return

      const finalPackageId = eventType === 'lesson' ? cookieKhacPackageId : form.package_id
      if (!finalPackageId) return

      const payload = {
        customer_name: form.customer_name.trim(),
        customer_phone: String(form.customer_phone || '').trim(),
        location: String(form.location || '').trim(),
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        package_id: finalPackageId,
        people_count: showPeopleCount ? Math.max(1, toNumber(form.people_count)) : 1,
        note: String(form.note || '')
      }

      const ok = await confirmCreate()
      if (!ok) return

      setCreating(true)
      const { data: createdBooking, error } = await createBooking(payload)
      setCreating(false)

      if (error) {
        toast.error(error.message || 'Không thể tạo booking')
        return
      }

      // Auto-create/update invoice with user-entered price & deposit (when enough data is present).
      const totalAmount = toInt(effectivePrice, NaN)
      const deposit = toInt(form.deposit, 0)
      const canUpsertInvoice = Boolean(finalPackageId) && ((Number.isFinite(totalAmount) && totalAmount > 0) || deposit > 0)
      if (canUpsertInvoice) {
        const { error: invErr } = await upsertInvoiceForBooking(createdBooking)
        if (invErr) {
          console.error(invErr)
          toast.error(invErr.message || 'Đã tạo booking nhưng không thể tạo/cập nhật hoá đơn')
        }
      }

      toast.success('Tạo booking thành công')
      await onCreated?.(createdBooking)
      onClose?.()
    } catch (err) {
      setCreating(false)
      console.error(err)
    }
  }

  return (
    <Modal
      open={open}
      title={<h1 className="cv-modalH1">Tạo lịch mới</h1>}
      wrapClassName="cv-calendarModal"
      centered
      closeIcon={(
        <span className="material-symbols-rounded" style={{ fontSize: 22, lineHeight: 1 }}>
          close
        </span>
      )}
      onCancel={async () => {
        if (!isDirty) {
          onClose?.()
          return
        }

        const ok = await confirmCancel()
        if (!ok) return
        onClose?.()
      }}
      footer={
        <div className="cv-modalFooterGrid">
          <Button
            onClick={async () => {
              if (!isDirty) {
                onClose?.()
                return
              }

              const ok = await confirmCancel()
              if (!ok) return
              onClose?.()
            }}
            disabled={creating}
            block
          >
            Huỷ
          </Button>
          <Button type="primary" onClick={handleCreate} loading={creating} block>
            Tạo lịch
          </Button>
        </div>
      }
    >
      <div className="cv-modalGrid12">

        <div className="cv-col-6">
          <div className="cv-field">
            <div className="cv-fieldLabel">Loại lịch</div>
            <Select
              value={eventType}
              onChange={(value) => {
                setEventType(value)
                setTouched((p) => ({ ...p, eventType: true }))
                if (value === 'lesson') {
                  setForm((p) => ({
                    ...p,
                    package_id: cookieKhacPackageId ?? p.package_id,
                    location: String(p.location || '').trim() ? p.location : LESSON_DEFAULT_LOCATION,
                    customer_name: p.customer_name ? p.customer_name : 'Offline'
                  }))
                }
              }}
              options={[
                { value: 'shooting', label: 'Lịch chụp' },
                { value: 'lesson', label: 'Học' }
              ]}
              suffixIcon={(
                <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                  expand_more
                </span>
              )}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className="cv-col-6" />

        <div className="cv-col-12">
          <div className="cv-dateTimeBlock">
            <div className="cv-dateTimeHeader">
              <div className="cv-dateTimeLabel">Ngày & giờ</div>
              <div className="cv-allDayToggle">
                <span className="cv-allDayLabel">Cả ngày</span>
                <Switch
                  checked={allDay}
                  onChange={(checked) => {
                    setAllDay(checked)
                    setForm((prev) => {
                      if (checked) {
                        lastTimeRangeRef.current = { start_time: prev.start_time, end_time: prev.end_time }
                        return { ...prev, start_time: '00:00', end_time: '23:59' }
                      }

                      const restore = lastTimeRangeRef.current || { start_time: '08:00', end_time: '10:00' }
                      return {
                        ...prev,
                        start_time: restore.start_time || '08:00',
                        end_time: restore.end_time || '10:00'
                      }
                    })
                  }}
                />
              </div>
            </div>

            <DatePicker
              value={form.start_date ? dayjs(form.start_date) : null}
              onChange={(d) => setForm((p) => ({ ...p, start_date: d ? dayjs(d).format('YYYY-MM-DD') : '' }))}
              format="dddd, DD/MM/YYYY"
              allowClear={false}
              disabled={hasPresetDay}
              inputReadOnly
              getPopupContainer={(trigger) => trigger?.parentElement || document.body}
              suffixIcon={(
                <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                  calendar_month
                </span>
              )}
              style={{ width: '100%' }}
            />

            <div className="cv-timeRangeRow">
              <TimePicker
                value={timeStringToDayjs(form.start_time)}
                onChange={(d) => {
                  setTouched((p) => ({ ...p, timeRange: true }))
                  setForm((p) => ({ ...p, start_time: dayjsToTimeString(d) }))
                }}
                format="HH:mm"
                allowClear={false}
                getPopupContainer={(trigger) => trigger?.parentElement || document.body}
                suffixIcon={(
                  <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                    schedule
                  </span>
                )}
                style={{ width: '100%' }}
              />
              <span className="material-symbols-rounded cv-timeArrow" aria-hidden>
                arrow_right_alt
              </span>
              <TimePicker
                value={timeStringToDayjs(form.end_time)}
                onChange={(d) => {
                  setTouched((p) => ({ ...p, timeRange: true }))
                  setForm((p) => ({ ...p, end_time: dayjsToTimeString(d) }))
                }}
                format="HH:mm"
                allowClear={false}
                getPopupContainer={(trigger) => trigger?.parentElement || document.body}
                suffixIcon={(
                  <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                    schedule
                  </span>
                )}
                style={{ width: '100%' }}
              />
            </div>

            {showError('timeRange') ? <div className="cv-fieldErrorText">{errors.timeRange}</div> : null}
            {showError('conflict') ? <div className="cv-fieldErrorText">{errors.conflict}</div> : null}
          </div>
        </div>

        <div className="cv-col-6">
          <div className="cv-field">
            <div className="cv-fieldLabel">Tên khách hàng</div>
            {eventType === 'lesson' ? (
              <Select
                value={form.customer_name || undefined}
                onChange={(value) => {
                  setTouched((p) => ({ ...p, customer_name: true }))
                  setForm((p) => ({
                    ...p,
                    customer_name: value,
                    location: value === 'Online' ? 'Online' : LESSON_DEFAULT_LOCATION
                  }))
                }}
                options={[
                  { value: 'Offline', label: 'Offline' },
                  { value: 'Online', label: 'Online' }
                ]}
                placeholder="Chọn Online/Offline"
                status={showError('customer_name') ? 'error' : ''}
                suffixIcon={(
                  <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                    expand_more
                  </span>
                )}
                style={{ width: '100%' }}
              />
            ) : (
              <Input
                value={form.customer_name}
                onChange={(e) => {
                  setTouched((p) => ({ ...p, customer_name: true }))
                  onChange('customer_name')(e)
                }}
                placeholder="Nhập tên khách…"
                status={showError('customer_name') ? 'error' : ''}
                prefix={(
                  <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                    person
                  </span>
                )}
              />
            )}
            {showError('customer_name') ? <div className="cv-fieldErrorText">{errors.customer_name}</div> : null}
          </div>
        </div>

        <div className="cv-col-6">
          <div className="cv-field">
            <div className="cv-fieldLabel">Số điện thoại</div>
            <Input
              inputMode="tel"
              type="tel"
              autoComplete="tel"
              value={form.customer_phone}
              onChange={(e) => {
                setTouched((p) => ({ ...p, customer_phone: true }))
                onChange('customer_phone')(e)
              }}
              placeholder="Nhập số điện thoại…"
              status={showError('customer_phone') ? 'error' : ''}
              prefix={(
                <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                  call
                </span>
              )}
            />
            {showError('customer_phone') ? <div className="cv-fieldErrorText">{errors.customer_phone}</div> : null}
          </div>
        </div>

        <div className="cv-col-6">
          <div className="cv-field">
            <div className="cv-fieldLabel">Địa điểm</div>
            <AutoComplete
              value={form.location}
              options={locationAutoOptions}
              onChange={(value) => {
                setTouched((p) => ({ ...p, location: true }))
                setForm((p) => ({ ...p, location: value }))
              }}
              filterOption={false}
            >
              <Input
                placeholder="Nhập địa chỉ…"
                status={showError('location') ? 'error' : ''}
                prefix={(
                  <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                    location_on
                  </span>
                )}
              />
            </AutoComplete>
            {showError('location') ? <div className="cv-fieldErrorText">{errors.location}</div> : null}
          </div>
        </div>

        <div className="cv-col-6">
          <div className="cv-field">
            <div className="cv-fieldLabel">Gói chụp</div>
            <Select
              value={resolvedPackageId || undefined}
              onChange={(value) => {
                setTouched((p) => ({ ...p, package_id: true }))
                handlePackageChange(value)
              }}
              options={(packageOptions || []).map((p) => ({ value: p.value, label: p.label }))}
              placeholder={packageOptions?.length ? 'Chọn gói' : 'Chưa có danh sách gói'}
              disabled={!packageOptions?.length || eventType === 'lesson'}
              status={showError('package_id') ? 'error' : ''}
              suffixIcon={(
                <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                  expand_more
                </span>
              )}
              style={{ width: '100%' }}
            />
            {showError('package_id') ? <div className="cv-fieldErrorText">{errors.package_id}</div> : null}
          </div>
        </div>

        <div className="cv-col-6">
          <div className="cv-field">
            <div className="cv-fieldLabel">Giá</div>
            <InputNumber
              value={effectivePrice === null || effectivePrice === undefined ? null : toInt(effectivePrice)}
              onChange={(v) => {
                setPriceTouched(true)
                setTouched((p) => ({ ...p, price: true }))
                setForm((p) => ({ ...p, price: v === null ? null : toInt(v) }))
              }}
              min={0}
              max={CURRENCY_MAX}
              controls={false}
              status={showError('price') ? 'error' : ''}
              style={{ width: '100%' }}
              formatter={(v) => {
                if (v === null || v === undefined || v === '') return ''
                const n = toInt(v, NaN)
                if (!Number.isFinite(n)) return ''
                return n.toLocaleString('vi-VN')
              }}
              parser={(v) => {
                if (v === null || v === undefined) return ''
                return String(v)
                  .replace(/[\s,.đ₫]/g, '')
                  .replace(/vnđ|vnd/gi, '')
              }}
            />
            {showError('price') ? <div className="cv-fieldErrorText">{errors.price}</div> : null}
          </div>
        </div>

        <div className="cv-col-6">
          <div className="cv-field">
            <div className="cv-fieldLabel">Tiền cọc</div>
            <InputNumber
              value={toInt(form.deposit)}
              onChange={(v) => {
                setTouched((p) => ({ ...p, deposit: true }))
                setForm((p) => ({ ...p, deposit: v === null ? 0 : toInt(v) }))
              }}
              min={0}
              max={(() => {
                const priceCap = effectivePrice !== null && effectivePrice !== undefined ? toInt(effectivePrice) : CURRENCY_MAX
                return Math.min(CURRENCY_MAX, priceCap)
              })()}
              controls={false}
              status={showError('deposit') ? 'error' : ''}
              style={{ width: '100%' }}
              formatter={(v) => {
                if (v === null || v === undefined || v === '') return ''
                const n = toInt(v, NaN)
                if (!Number.isFinite(n)) return ''
                return n.toLocaleString('vi-VN')
              }}
              parser={(v) => {
                if (v === null || v === undefined) return ''
                return String(v)
                  .replace(/[\s,.đ₫]/g, '')
                  .replace(/vnđ|vnd/gi, '')
              }}
            />
            {showError('deposit') ? <div className="cv-fieldErrorText">{errors.deposit}</div> : null}
          </div>
        </div>

        {showPeopleCount ? (
          <div className="cv-col-12">
            <div className="cv-field">
              <div className="cv-fieldLabel">Số lượng người</div>
              <InputNumber
                min={1}
                step={1}
                controls={false}
                value={toNumber(form.people_count) || 1}
                onChange={(v) => setForm((p) => ({ ...p, people_count: toNumber(v) }))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        ) : null}

        <div className="cv-col-12">
          <div className="cv-field">
            <div className="cv-fieldLabel">Ghi chú</div>
            <div className="cv-textareaWithIcon">
              <span className="material-symbols-rounded cv-inputIcon" aria-hidden>
                edit_note
              </span>
              <Input.TextArea
                className="cv-textareaWithLeftIcon"
                rows={3}
                value={form.note}
                onChange={onChange('note')}
                placeholder="Ghi chú cho ca chụp…"
              />
            </div>
            <QuickNoteSuggestions
              value={form.note}
              onChange={(next) => setForm((p) => ({ ...p, note: next }))}
              disabled={creating}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
