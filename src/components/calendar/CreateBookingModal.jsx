import dayjs from 'dayjs'
import { useMemo, useRef, useState } from 'react'
import { Button, DatePicker, Input, InputNumber, Modal, Select, Switch, TimePicker } from 'antd'
import { toast } from 'react-toastify'
import { toNumber } from '../../utils/number.js'
import { createBooking } from '../../services/booking.service'

const DEFAULT_DURATION_MINUTES = 60
const INITIAL_DEFAULT_DURATION_MINUTES = 120

const isValidVnPhone = (value) => {
  if (!value) return true
  const normalized = String(value).trim().replace(/[\s.-]/g, '')
  return /^(?:\+?84|0)\d{9,10}$/.test(normalized)
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
    note: ''
  }
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

  const [allDay, setAllDay] = useState(false)
  const lastTimeRangeRef = useRef({ start_time: form.start_time, end_time: form.end_time })

  const hasPresetDay = Boolean(defaultRange?.start ?? defaultRange?.time ?? defaultRange?.date)

  const onChange = (key) => (e) => {
    const value = e?.target?.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handlePackageChange = (value) => {
    setForm((p) => ({ ...p, package_id: value }))
  }

  const selectedPackage = (packageOptions || []).find((p) => p?.value === form.package_id) || null
  const showPeopleCount = selectedPackage?.label === 'Cookie Nhiều mình'

  const hasUserInput = useMemo(() => {
    return Boolean(
      String(form.customer_name || '').trim()
      || String(form.customer_phone || '').trim()
      || String(form.location || '').trim()
      || String(form.note || '').trim()
      || form.package_id
    )
  }, [form.customer_name, form.customer_phone, form.location, form.note, form.package_id])

  const hasConflict = () => {
    const start = dayjs(`${form.start_date}T${form.start_time}`)
    const end = dayjs(`${form.start_date}T${form.end_time}`)

    if (!start.isValid() || !end?.isValid()) return 'Vui lòng nhập ngày/giờ hợp lệ'
    if (!end.isAfter(start)) return 'Giờ kết thúc phải sau giờ bắt đầu'

    const overlap = (existingBookings || []).some((b) => {
      if (!b) return false
      if (b.status === 'canceled') return false

      const otherStart = b.start_datetime ? dayjs(b.start_datetime) : null
      const otherEnd = b.end_datetime
        ? dayjs(b.end_datetime)
        : otherStart && otherStart.isValid()
          ? otherStart.add(DEFAULT_DURATION_MINUTES, 'minute')
          : null

      if (!otherStart?.isValid() || !otherEnd?.isValid()) return false
      return start.isBefore(otherEnd) && end.isAfter(otherStart)
    })

    if (overlap) return 'Trùng lịch: thời gian này đã có ca chụp'
    return null
  }

  const confirmCreate = async () => {
    return await new Promise((resolve) => {
      Modal.confirm({
        title: 'Tạo lịch mới?'
        , content: 'Xác nhận tạo lịch với thông tin hiện tại.'
        , icon: (
          <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
            help
          </span>
        )
        , okText: 'Tạo lịch'
        , cancelText: 'Xem lại'
        , onOk: () => resolve(true)
        , onCancel: () => resolve(false)
      })
    })
  }

  const confirmCancel = async () => {
    if (!hasUserInput) return true
    return await new Promise((resolve) => {
      Modal.confirm({
        title: 'Huỷ thao tác?'
        , content: 'Thông tin bạn nhập sẽ bị mất.'
        , icon: (
          <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
            warning
          </span>
        )
        , okText: 'Huỷ'
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

      if (!form.customer_name.trim()) return toast.error('Vui lòng nhập tên khách hàng')
      if (!form.start_date) return toast.error('Vui lòng chọn ngày chụp')
      if (!form.start_time || !form.end_time) return toast.error('Vui lòng chọn giờ chụp')
      if (!form.package_id) return toast.error('Vui lòng chọn gói')
      if (!isValidVnPhone(form.customer_phone)) return toast.error('Số điện thoại không hợp lệ')

      const start = dayjs(`${form.start_date}T${form.start_time}`)
      const end = dayjs(`${form.start_date}T${form.end_time}`)
      if (!start.isValid() || !end.isValid()) return toast.error('Vui lòng nhập ngày/giờ hợp lệ')
      if (!end.isAfter(start)) return toast.error('Giờ kết thúc phải sau giờ bắt đầu')

      const conflictMsg = hasConflict()
      if (conflictMsg) return toast.error(conflictMsg)

      const payload = {
        customer_name: form.customer_name.trim(),
        customer_phone: String(form.customer_phone || '').trim(),
        location: String(form.location || '').trim(),
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        package_id: form.package_id,
        people_count: showPeopleCount ? Math.max(1, toNumber(form.people_count)) : 1,
        note: String(form.note || '')
      }

      const ok = await confirmCreate()
      if (!ok) return

      setCreating(true)
      const { error } = await createBooking(payload)
      setCreating(false)

      if (error) {
        toast.error(error.message || 'Không thể tạo booking')
        return
      }

      toast.success('Tạo booking thành công')
      await onCreated?.()
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
        const ok = await confirmCancel()
        if (!ok) return
        onClose?.()
      }}
      footer={
        <div className="cv-modalFooterGrid">
          <Button
            onClick={async () => {
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
                onChange={(d) => setForm((p) => ({ ...p, start_time: dayjsToTimeString(d) }))}
                format="HH:mm"
                allowClear={false}
                disabled={allDay}
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
                onChange={(d) => setForm((p) => ({ ...p, end_time: dayjsToTimeString(d) }))}
                format="HH:mm"
                allowClear={false}
                disabled={allDay}
                suffixIcon={(
                  <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                    schedule
                  </span>
                )}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        <div className="cv-col-6">
          <div className="cv-field">
            <div className="cv-fieldLabel">Tên khách hàng</div>
            <Input
              value={form.customer_name}
              onChange={onChange('customer_name')}
              placeholder="Nhập tên khách…"
              prefix={(
                <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                  person
                </span>
              )}
            />
          </div>
        </div>

        <div className="cv-col-6">
          <div className="cv-field">
            <div className="cv-fieldLabel">Số điện thoại</div>
            <Input
              inputMode="tel"
              value={form.customer_phone}
              onChange={onChange('customer_phone')}
              placeholder="Nhập số điện thoại…"
              prefix={(
                <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                  call
                </span>
              )}
            />
          </div>
        </div>

        <div className="cv-col-6">
          <div className="cv-field">
            <div className="cv-fieldLabel">Địa điểm</div>
            <Input
              value={form.location}
              onChange={onChange('location')}
              placeholder="Nhập địa chỉ…"
              prefix={(
                <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                  location_on
                </span>
              )}
            />
          </div>
        </div>

        <div className="cv-col-6">
          <div className="cv-field">
            <div className="cv-fieldLabel">Gói chụp</div>
            <Select
              value={form.package_id || undefined}
              onChange={handlePackageChange}
              options={(packageOptions || []).map((p) => ({ value: p.value, label: p.label }))}
              placeholder={packageOptions?.length ? 'Chọn gói' : 'Chưa có danh sách gói'}
              disabled={!packageOptions?.length}
              suffixIcon={(
                <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                  expand_more
                </span>
              )}
              style={{ width: '100%' }}
            />
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
          </div>
        </div>
      </div>
    </Modal>
  )
}
