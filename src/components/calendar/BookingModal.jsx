import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { AutoComplete, Button, DatePicker, Input, InputNumber, Modal, Select, TimePicker, Typography } from 'antd'
import { toast } from 'react-toastify'
import { toNumber } from '../../utils/number.js'
import { updateBooking } from '../../services/booking.service'
import { createInvoice, getInvoiceByBookingId, updateInvoice } from '../../services/invoice.service'
import QuickNoteSuggestions from '../ui/QuickNoteSuggestions'

const DEFAULT_DURATION_MINUTES = 60

const CURRENCY_MIN = 1000
const CURRENCY_MAX = 10000000

const LOCATION_SUGGESTIONS = [
  'Bến Ninh Kiều',
  'Lăng Thủ Khoa',
  'Chùa Nam Nhã',
  'Thiền Viện Trúc Lâm'
]

const toInt = (value, fallback = 0) => {
  const n = toNumber(value, fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.round(n)
}

const formatWithCommas = (value) => {
  if (value === null || value === undefined || value === '') return ''
  const raw = String(value)

  const sign = raw.startsWith('-') ? '-' : ''
  const unsigned = sign ? raw.slice(1) : raw
  const [intPart, decPart] = unsigned.split('.')
  const formattedInt = String(intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  if (decPart !== undefined && decPart !== '') return `${sign}${formattedInt}.${decPart}`
  return `${sign}${formattedInt}`
}

const parseCommas = (value) => {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/[,\s]/g, '')
    .replace(/[^\d.-]/g, '')
}

const normalizeInvoiceStatus = (status) => {
  // Backward compatibility: treat legacy 'paid' as 'completed' in UI.
  if (status === 'paid') return 'completed'
  return status
}

const normalizeToVnPhone10 = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('84') && digits.length === 11) return `0${digits.slice(2)}`
  return digits
}

const isValidVnPhone10Digits = (value) => {
  if (!value) return false
  const normalized = normalizeToVnPhone10(value)
  return /^0\d{9}$/.test(normalized)
}

export default function BookingModal({
  open,
  booking,
  invoice,
  existingBookings = [],
  dayBookingLimit = 2,
  packageOptions = [],
  onClose,
  onUpdated,
  confirmLoading = false,
  onQuickComplete,
  onCancel,
  onOpenInvoice
}) {
  const key = `${booking?.id ?? 'none'}-${open ? '1' : '0'}`
  return (
    <BookingModalInner
      key={key}
      open={open}
      booking={booking}
      invoice={invoice}
      existingBookings={existingBookings}
      dayBookingLimit={dayBookingLimit}
      packageOptions={packageOptions}
      onClose={onClose}
      onUpdated={onUpdated}
      confirmLoading={confirmLoading}
      onQuickComplete={onQuickComplete}
      onCancel={onCancel}
      onOpenInvoice={onOpenInvoice}
    />
  )
}

function BookingModalInner({
  open,
  booking,
  invoice,
  existingBookings = [],
  dayBookingLimit = 2,
  packageOptions = [],
  onClose,
  onUpdated,
  confirmLoading = false,
  onCancel,
  onOpenInvoice
}) {
  const [saving, setSaving] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [touched, setTouched] = useState({})

  const isCompleted = booking?.status === 'completed'
  const isCancelled = booking?.status === 'canceled'
  const isBusy = saving || confirmLoading
  const canEdit = Boolean(booking) && !isCompleted && !isCancelled

  const initialSnapshot = useMemo(() => {
    const start = booking?.start_datetime ? dayjs(booking.start_datetime) : null
    const end = booking?.end_datetime ? dayjs(booking.end_datetime) : null
    const safeStart = start && start.isValid() ? start : dayjs()
    const safeEnd = end && end.isValid() ? end : safeStart.add(DEFAULT_DURATION_MINUTES, 'minute')

    return {
      customer_name: booking?.customer_name ?? '',
      customer_phone: booking?.customer_phone ?? '',
      location: booking?.location ?? '',
      package_id: booking?.package_id ?? null,
      start_date: safeStart.format('YYYY-MM-DD'),
      start_time: safeStart.format('HH:mm'),
      end_time: safeEnd.format('HH:mm'),
      people_count: toNumber(booking?.people_count) || 1,
      note: booking?.note ?? '',
      price: invoice?.total_amount ?? booking?.packages?.price ?? null,
      deposit: invoice?.deposit ?? 0
    }
  }, [
    booking?.customer_name,
    booking?.customer_phone,
    booking?.location,
    booking?.package_id,
    booking?.people_count,
    booking?.note,
    booking?.packages?.price,
    booking?.start_datetime,
    booking?.end_datetime,
    invoice?.total_amount,
    invoice?.deposit
  ])

  const [form, setForm] = useState(() => initialSnapshot)

  const locationAutoOptions = useMemo(() => {
    const q = String(form.location || '').trim().toLowerCase()
    const list = q
      ? LOCATION_SUGGESTIONS.filter((s) => s.toLowerCase().includes(q))
      : LOCATION_SUGGESTIONS
    return list.map((value) => ({ value }))
  }, [form.location])

  useEffect(() => {
    if (!open) return
    setSubmitAttempted(false)
    setTouched({})
  }, [open])

  useEffect(() => {
    if (!open) return

    // Keep the form in sync with refreshed invoice data *without* remounting the modal.
    // Only auto-sync price/deposit if user hasn't touched those fields.
    setForm((prev) => {
      const next = { ...prev }
      let changed = false

      if (!touched?.price) {
        const prevPrice = prev.price === null || prev.price === undefined ? null : toInt(prev.price)
        const nextPrice = initialSnapshot.price === null || initialSnapshot.price === undefined ? null : toInt(initialSnapshot.price)
        if (prevPrice !== nextPrice) {
          next.price = initialSnapshot.price
          changed = true
        }
      }

      if (!touched?.deposit) {
        const prevDeposit = prev.deposit === null || prev.deposit === undefined ? 0 : toInt(prev.deposit)
        const nextDeposit = initialSnapshot.deposit === null || initialSnapshot.deposit === undefined ? 0 : toInt(initialSnapshot.deposit)
        if (prevDeposit !== nextDeposit) {
          next.deposit = initialSnapshot.deposit
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [open, initialSnapshot.price, initialSnapshot.deposit, touched?.price, touched?.deposit])

  const isDirty = useMemo(() => {
    const baseline = {
      customer_name: String(initialSnapshot.customer_name || '').trim(),
      customer_phone: String(initialSnapshot.customer_phone || '').trim(),
      location: String(initialSnapshot.location || '').trim(),
      package_id: initialSnapshot.package_id ?? null,
      start_date: String(initialSnapshot.start_date || '').trim(),
      start_time: String(initialSnapshot.start_time || '').trim(),
      end_time: String(initialSnapshot.end_time || '').trim(),
      people_count: toNumber(initialSnapshot.people_count) || 1,
      note: String(initialSnapshot.note || ''),
      price: initialSnapshot.price === null || initialSnapshot.price === undefined ? null : toInt(initialSnapshot.price),
      deposit: initialSnapshot.deposit === null || initialSnapshot.deposit === undefined ? 0 : toInt(initialSnapshot.deposit)
    }

    const current = {
      customer_name: String(form.customer_name || '').trim(),
      customer_phone: String(form.customer_phone || '').trim(),
      location: String(form.location || '').trim(),
      package_id: form.package_id ?? null,
      start_date: String(form.start_date || '').trim(),
      start_time: String(form.start_time || '').trim(),
      end_time: String(form.end_time || '').trim(),
      people_count: toNumber(form.people_count) || 1,
      note: String(form.note || ''),
      price: form.price === null || form.price === undefined ? null : toInt(form.price),
      deposit: form.deposit === null || form.deposit === undefined ? 0 : toInt(form.deposit)
    }

    return JSON.stringify(baseline) !== JSON.stringify(current)
  }, [form, initialSnapshot])

  const confirmDiscardIfDirty = async () => {
    // If user cannot edit (view-only) or there is no change, close immediately.
    if (!canEdit) return true
    if (!isDirty) return true

    return await new Promise((resolve) => {
      Modal.confirm({
        title: 'Huỷ thay đổi?'
        , content: 'Bạn có thay đổi chưa lưu. Nếu huỷ, dữ liệu sẽ bị mất.'
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

  const onChange = (key) => (e) => {
    const value = e?.target?.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handlePackageChange = (value) => {
    setForm((p) => ({ ...p, package_id: value }))
  }

  const selectedPackage = (packageOptions || []).find((p) => p?.value === form.package_id) || null
  const showPeopleCount = selectedPackage?.label === 'Cookie Nhiều mình'

  const invoiceStatus = useMemo(() => {
    return normalizeInvoiceStatus(invoice?.status) || 'draft'
  }, [invoice?.status])

  const isPaidLike = useMemo(() => {
    return invoiceStatus === 'paid' || invoiceStatus === 'completed'
  }, [invoiceStatus])

  const errors = useMemo(() => {
    const out = {}

    const name = String(form.customer_name || '').trim()
    if (!name) out.customer_name = 'Vui lòng nhập tên khách hàng'

    if (!form.package_id) out.package_id = 'Vui lòng chọn gói chụp'

    const phone = String(form.customer_phone || '').trim()
    if (phone && !isValidVnPhone10Digits(phone)) out.customer_phone = 'Số điện thoại phải đủ 10 số'

    const start = dayjs(`${form.start_date}T${form.start_time}`)
    const end = dayjs(`${form.start_date}T${form.end_time}`)
    if (!start.isValid() || !end?.isValid()) out.timeRange = 'Vui lòng nhập ngày/giờ hợp lệ'
    else if (!end.isAfter(start)) out.timeRange = 'Giờ kết thúc phải sau giờ bắt đầu'

    const totalAmount = form.price === null || form.price === undefined ? NaN : toInt(form.price, NaN)
    const deposit = form.deposit === null || form.deposit === undefined ? 0 : toInt(form.deposit, 0)

    if (Number.isFinite(totalAmount)) {
      if (totalAmount > 0 && totalAmount < CURRENCY_MIN) out.price = `Giá phải = 0 hoặc ≥ ${CURRENCY_MIN.toLocaleString('vi-VN')}`
      else if (totalAmount > CURRENCY_MAX) out.price = `Giá không được lớn hơn ${CURRENCY_MAX.toLocaleString('vi-VN')}`
    }

    if (deposit < 0) out.deposit = 'Tiền cọc không hợp lệ'
    else if (deposit > 0 && deposit < CURRENCY_MIN) out.deposit = `Tiền cọc phải = 0 hoặc ≥ ${CURRENCY_MIN.toLocaleString('vi-VN')}`
    else if (deposit > CURRENCY_MAX) out.deposit = `Tiền cọc không được lớn hơn ${CURRENCY_MAX.toLocaleString('vi-VN')}`
    else if (Number.isFinite(totalAmount) && deposit > totalAmount) out.deposit = 'Tiền cọc không được lớn hơn giá'

    return out
  }, [form])

  const showError = (key) => Boolean((submitAttempted || touched?.[key]) && errors?.[key])

  const formatVndOrDash = (value) => {
    if (value === null || value === undefined || value === '') return '--'
    const n = toNumber(value, NaN)
    if (!Number.isFinite(n)) return '--'
    return `${n.toLocaleString('vi-VN')} VNĐ`
  }

  const displayDeposit = useMemo(() => {
    return invoice?.deposit ?? null
  }, [invoice?.deposit])

  const upsertInvoiceForBooking = async (bookingRow) => {
    const bookingId = bookingRow?.id
    if (!bookingId) return { error: { message: 'Thiếu booking_id' } }

    const totalAmount = form.price === null || form.price === undefined
      ? null
      : toInt(form.price, NaN)
    const deposit = form.deposit === null || form.deposit === undefined
      ? 0
      : toInt(form.deposit, 0)

    const payload = {
      booking_id: bookingId,
      package_id: form.package_id,
      ...(Number.isFinite(totalAmount) ? { base_price: totalAmount, total_amount: totalAmount } : {}),
      deposit: isPaidLike ? 0 : deposit
    }

    // Try to update trigger-created invoice (or existing), otherwise create.
    for (let i = 0; i < 2; i++) {
      // eslint-disable-next-line no-await-in-loop
      const { data: inv, error: invErr } = await getInvoiceByBookingId(bookingId)
      if (!invErr && inv?.id) {
        return await updateInvoice(inv.id, payload)
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 250))
    }

    return await createInvoice({ ...payload, status: 'draft' })
  }

  const handleSave = async () => {
    if (!booking) return
    if (!canEdit) return

    setSubmitAttempted(true)
    if (Object.keys(errors || {}).length) return

    const start = dayjs(`${form.start_date}T${form.start_time}`)
    const end = dayjs(`${form.start_date}T${form.end_time}`)
    if (!start.isValid() || !end.isValid()) return
    if (!end.isAfter(start)) return

    // Enforce day booking limit when changing the booking date.
    const targetKey = start.format('YYYY-MM-DD')
    const otherCountSameDay = (existingBookings || []).filter((b) => {
      if (!b) return false
      const rawStatus = String(b?.status || 'scheduled')
      if (rawStatus === 'canceled') return false
      if (b?.id === booking?.id) return false
      const key = b?.start_datetime ? dayjs(b.start_datetime).format('YYYY-MM-DD') : ''
      return key === targetKey
    }).length

    if (otherCountSameDay >= dayBookingLimit) {
      toast.info(`Ngày ${start.format('DD/MM')} chỉ được tối đa ${dayBookingLimit} lịch chụp`)
      return
    }

    const payload = {
      customer_name: String(form.customer_name || '').trim(),
      customer_phone: String(form.customer_phone || '').trim(),
      location: String(form.location || '').trim(),
      start_datetime: start.toISOString(),
      end_datetime: end.toISOString(),
      package_id: form.package_id,
      people_count: showPeopleCount ? Math.max(1, toNumber(form.people_count)) : 1,
      note: String(form.note || '')
    }

    setSaving(true)
    const { error } = await updateBooking(booking.id, payload)
    setSaving(false)

    if (error) {
      console.error(error)
      toast.error(error.message || 'Không thể cập nhật booking')
      return
    }

    // Update invoice amounts (price/deposit) when changed.
    const initialPrice = initialSnapshot.price === null || initialSnapshot.price === undefined
      ? null
      : toInt(initialSnapshot.price, NaN)
    const currentPrice = form.price === null || form.price === undefined
      ? null
      : toInt(form.price, NaN)
    const initialDeposit = initialSnapshot.deposit === null || initialSnapshot.deposit === undefined
      ? 0
      : toInt(initialSnapshot.deposit, 0)
    const currentDeposit = form.deposit === null || form.deposit === undefined
      ? 0
      : toInt(form.deposit, 0)

    const invoiceChanged = JSON.stringify({ package_id: initialSnapshot.package_id ?? null, price: initialPrice, deposit: initialDeposit }) !==
      JSON.stringify({ package_id: form.package_id ?? null, price: currentPrice, deposit: currentDeposit })

    const shouldUpsertInvoice = Boolean(form.package_id) && invoiceChanged
    if (shouldUpsertInvoice) {
      const { error: invErr } = await upsertInvoiceForBooking(booking)
      if (invErr) {
        console.error(invErr)
        toast.error(invErr.message || 'Đã cập nhật booking nhưng không thể cập nhật hoá đơn')
      }
    }

    toast.success('Cập nhật booking thành công')
    await onUpdated?.()
    onClose?.()
  }

  const handleCancelLocal = async () => {
    if (!booking) return
    if (isBusy) return
    if (isCompleted) return
    if (isCancelled) return

    const ok = await new Promise((resolve) => {
      Modal.confirm({
        title: 'Huỷ lịch chụp?',
        content: 'Lịch chụp sẽ chuyển sang trạng thái đã huỷ.',
        centered: true,
        icon: (
          <span className="material-symbols-rounded">
            warning
          </span>
        ),
        okText: 'Huỷ',
        okButtonProps: { danger: true },
        cancelText: 'Giữ',
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })
    if (!ok) return

    if (onCancel) {
      await onCancel(booking)
      return
    }

    const { error } = await updateBooking(booking.id, { status: 'canceled' })
    if (error) return toast.error(error.message || 'Không thể huỷ booking')
    toast.success('Đã huỷ booking')
    await onUpdated?.()
    onClose?.()
  }

  return (
    <Modal
      open={open}
      title={<h1 className="cv-modalH1">Chi tiết lịch</h1>}
      wrapClassName="cv-calendarModal"
      centered
      closeIcon={(
        <span className="material-symbols-rounded" style={{ fontSize: 22, lineHeight: 1 }}>
          close
        </span>
      )}
      onCancel={async () => {
        const ok = await confirmDiscardIfDirty()
        if (!ok) return
        onClose?.()
      }}
      footer={
        <div className="cv-modalFooterGrid">
          <div style={{ gridColumn: 'span 12' }}>
            <Button
              onClick={() => onOpenInvoice?.(booking?.id)}
              disabled={!booking || isBusy}
              block
            >
              Theo dõi hoá đơn
            </Button>
          </div>

          <Button
            onClick={async () => {
              const ok = await confirmDiscardIfDirty()
              if (!ok) return
              onClose?.()
            }}
            disabled={isBusy}
            block
          >
            Hủy
          </Button>

          <Button
            danger
            onClick={handleCancelLocal}
            disabled={!booking || isBusy || isCancelled || isCompleted}
            block
          >
            Huỷ lịch
          </Button>
          <div style={{ gridColumn: 'span 12' }}>
            <Button type="primary" onClick={handleSave} disabled={!canEdit || isBusy} loading={saving} block>
              Lưu thay đổi
            </Button>
          </div>
        </div>
      }
    >
      {!booking ? (
        <Typography.Text type="secondary">Chưa có dữ liệu booking</Typography.Text>
      ) : (
        <div className="cv-modalGrid12">
          <div className="cv-col-12">
            <div className="cv-dateTimeBlock">
              <div className="cv-dateTimeHeader">
                <div className="cv-dateTimeLabel">Ngày & giờ</div>
              </div>

              <DatePicker
                value={form.start_date ? dayjs(form.start_date) : null}
                format="dddd, DD/MM/YYYY"
                allowClear={false}
                disabled
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
                  value={form.start_time ? dayjs(`2000-01-01T${form.start_time}`) : null}
                  onChange={(d) => {
                    setTouched((p) => ({ ...p, timeRange: true }))
                    setForm((p) => ({ ...p, start_time: d ? dayjs(d).format('HH:mm') : '' }))
                  }}
                  format="HH:mm"
                  allowClear={false}
                  getPopupContainer={(trigger) => trigger?.parentElement || document.body}
                  suffixIcon={(
                    <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                      schedule
                    </span>
                  )}
                  disabled={!canEdit || isBusy}
                  style={{ width: '100%' }}
                />
                <span className="material-symbols-rounded cv-timeArrow" aria-hidden>
                  arrow_right_alt
                </span>
                <TimePicker
                  value={form.end_time ? dayjs(`2000-01-01T${form.end_time}`) : null}
                  onChange={(d) => {
                    setTouched((p) => ({ ...p, timeRange: true }))
                    setForm((p) => ({ ...p, end_time: d ? dayjs(d).format('HH:mm') : '' }))
                  }}
                  format="HH:mm"
                  allowClear={false}
                  getPopupContainer={(trigger) => trigger?.parentElement || document.body}
                  suffixIcon={(
                    <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                      schedule
                    </span>
                  )}
                  disabled={!canEdit || isBusy}
                  style={{ width: '100%' }}
                />
              </div>
              {showError('timeRange') ? <div className="cv-fieldErrorText">{errors.timeRange}</div> : null}
            </div>
          </div>

          <div className="cv-col-6">
            <div className="cv-field">
              <div className="cv-fieldLabel">Tên khách hàng</div>
              <Input
                value={form.customer_name}
                onChange={(e) => {
                  setTouched((p) => ({ ...p, customer_name: true }))
                  onChange('customer_name')(e)
                }}
                disabled={!canEdit || isBusy}
                status={showError('customer_name') ? 'error' : ''}
                prefix={(
                  <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                    person
                  </span>
                )}
              />
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
                disabled={!canEdit || isBusy}
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
                disabled={!canEdit || isBusy}
              >
                <Input
                  disabled={!canEdit || isBusy}
                  prefix={(
                    <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                      location_on
                    </span>
                  )}
                />
              </AutoComplete>
            </div>
          </div>

          <div className="cv-col-6">
            <div className="cv-field">
              <div className="cv-fieldLabel">Gói chụp</div>
              <Select
                value={form.package_id || undefined}
                onChange={(value) => {
                  setTouched((p) => ({ ...p, package_id: true }))
                  handlePackageChange(value)
                }}
                options={(packageOptions || []).map((p) => ({ value: p.value, label: p.label }))}
                disabled={!canEdit || isBusy || !packageOptions?.length}
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
                value={form.price === null || form.price === undefined ? null : toInt(form.price)}
                onChange={(v) => {
                  setTouched((p) => ({ ...p, price: true }))
                  setForm((p) => ({ ...p, price: v === null ? null : toInt(v) }))
                }}
                min={0}
                max={CURRENCY_MAX}
                controls={false}
                formatter={formatWithCommas}
                parser={parseCommas}
                status={showError('price') ? 'error' : ''}
                disabled={!canEdit || isBusy}
                style={{ width: '100%' }}
              />
              {showError('price') ? <div className="cv-fieldErrorText">{errors.price}</div> : null}
            </div>
          </div>

          <div className="cv-col-6">
            <div className="cv-field">
              <div className="cv-fieldLabel">Tiền cọc</div>
              <InputNumber
                value={form.deposit === null || form.deposit === undefined ? 0 : toInt(form.deposit)}
                onChange={(v) => {
                  setTouched((p) => ({ ...p, deposit: true }))
                  setForm((p) => ({ ...p, deposit: v === null ? 0 : toInt(v) }))
                }}
                min={0}
                max={(() => {
                  const cap = Number.isFinite(toInt(form.price, NaN)) ? toInt(form.price, NaN) : CURRENCY_MAX
                  return Math.min(CURRENCY_MAX, cap)
                })()}
                controls={false}
                formatter={formatWithCommas}
                parser={parseCommas}
                status={showError('deposit') ? 'error' : ''}
                disabled={!canEdit || isBusy || isPaidLike}
                style={{ width: '100%' }}
              />
              {showError('deposit') ? <div className="cv-fieldErrorText">{errors.deposit}</div> : null}
              {!canEdit ? (
                <Typography.Text type="secondary">{formatVndOrDash(displayDeposit)}</Typography.Text>
              ) : null}
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
                  disabled={!canEdit || isBusy}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          ) : null}

          <div className="cv-col-12">
            <div className="cv-field">
              <div className="cv-fieldLabel">Ghi chú</div>
              <div className="cv-textareaWithIcon">
                <Input.TextArea
                  className="cv-textareaWithLeftIcon"
                  rows={3}
                  value={form.note}
                  onChange={onChange('note')}
                  disabled={!canEdit || isBusy}
                />
              </div>
              <QuickNoteSuggestions
                value={form.note}
                onChange={(next) => setForm((p) => ({ ...p, note: next }))}
                disabled={!canEdit || isBusy}
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
