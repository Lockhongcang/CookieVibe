import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { Button, DatePicker, Input, InputNumber, Modal, Select, TimePicker, Typography } from 'antd'
import { toast } from 'react-toastify'
import { toNumber } from '../../utils/number.js'
import { updateBooking } from '../../services/booking.service'

const DEFAULT_DURATION_MINUTES = 60

const isValidVnPhone = (value) => {
  if (!value) return true
  const normalized = String(value).trim().replace(/[\s.-]/g, '')
  return /^(?:\+?84|0)\d{9,10}$/.test(normalized)
}

export default function BookingModal({
  open,
  booking,
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
  packageOptions = [],
  onClose,
  onUpdated,
  confirmLoading = false,
  onCancel,
  onOpenInvoice
}) {
  const [saving, setSaving] = useState(false)

  const isCompleted = booking?.status === 'completed'
  const isCancelled = booking?.status === 'canceled'
  const isBusy = saving || confirmLoading
  const canEdit = Boolean(booking) && !isCompleted && !isCancelled

  const [initialSnapshot] = useState(() => {
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
      note: booking?.note ?? ''
    }
  })

  const [form, setForm] = useState(initialSnapshot)

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
      note: String(initialSnapshot.note || '')
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
      note: String(form.note || '')
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
        , icon: (
          <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
            warning
          </span>
        )
        , okText: 'Huỷ'
        , okButtonProps: { danger: true }
        , cancelText: 'Tiếp tục chỉnh'
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

  const handleSave = async () => {
    if (!booking) return
    if (!canEdit) return

    const start = dayjs(`${form.start_date}T${form.start_time}`)
    const end = dayjs(`${form.start_date}T${form.end_time}`)
    if (!start.isValid() || !end.isValid()) return toast.error('Vui lòng nhập ngày/giờ hợp lệ')
    if (!end.isAfter(start)) return toast.error('Giờ kết thúc phải sau giờ bắt đầu')

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

    if (!payload.customer_name) return toast.error('Vui lòng nhập tên khách hàng')
    if (!payload.package_id) return toast.error('Vui lòng chọn gói')
    if (!isValidVnPhone(payload.customer_phone)) return toast.error('Số điện thoại không hợp lệ')

    setSaving(true)
    const { error } = await updateBooking(booking.id, payload)
    setSaving(false)

    if (error) {
      console.error(error)
      toast.error(error.message || 'Không thể cập nhật booking')
      return
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
        content: 'Bạn có chắc chắn muốn huỷ lịch chụp này không?',
        icon: (
          <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
            warning
          </span>
        ),
        okText: 'Huỷ lịch',
        okButtonProps: { danger: true },
        cancelText: 'Đóng',
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
                  onChange={(d) => setForm((p) => ({ ...p, start_time: d ? dayjs(d).format('HH:mm') : '' }))}
                  format="HH:mm"
                  allowClear={false}
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
                  onChange={(d) => setForm((p) => ({ ...p, end_time: d ? dayjs(d).format('HH:mm') : '' }))}
                  format="HH:mm"
                  allowClear={false}
                  suffixIcon={(
                    <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
                      schedule
                    </span>
                  )}
                  disabled={!canEdit || isBusy}
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
                disabled={!canEdit || isBusy}
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
                disabled={!canEdit || isBusy}
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
                disabled={!canEdit || isBusy}
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
                disabled={!canEdit || isBusy || !packageOptions?.length}
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
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
