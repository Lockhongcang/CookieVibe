import dayjs from 'dayjs'
import { Button, Collapse, Input, InputNumber, Modal, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { getBookingById } from '../../services/booking.service'
import { getInvoiceByBookingId, updateInvoice } from '../../services/invoice.service'
import { toNumber } from '../../utils/number.js'

const { Text } = Typography

const normalizeInvoiceStatus = (status) => {
  // Backward compatibility: treat legacy 'paid' as 'completed' in UI.
  if (status === 'paid') return 'completed'
  return status
}

const toInt = (value, fallback = 0) => {
  const n = toNumber(value, fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.round(n)
}

const formatVnd = (value) => `${toInt(value).toLocaleString('vi-VN')} đ`

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

const computeCookieNhieuMinhBasePrice = (peopleCount) => {
  const count = Math.max(1, toNumber(peopleCount))
  if (count === 3 || count === 4) return count * 400000
  if (count >= 5) return count * 350000
  return 0
}

// Tổng hoá đơn = package_price(base_price)
// + penalty(penalty_fee) + surcharge(extra_fee) + tip
// - makeup_fee - (discount_percent * package_price)
const computeTotalInvoice = ({
  base_price,
  discount_percent,
  makeup_fee,
  extra_fee,
  penalty_fee,
  tip
}) => {
  const base = toInt(base_price)
  const discountPercent = Math.min(100, Math.max(0, toInt(discount_percent)))
  const discountAmount = Math.round((base * discountPercent) / 100)

  return (
    base +
    toInt(penalty_fee) +
    toInt(extra_fee) +
    toInt(tip) -
    toInt(makeup_fee) -
    discountAmount
  )
}

export default function InvoiceDetailModal({ open, bookingId, onClose, onSaved }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [booking, setBooking] = useState(null)
  const [invoice, setInvoice] = useState(null)

  const [form, setForm] = useState({
    base_price: 0,
    deposit: 0,
    discount: 0,
    makeup_fee: 0,
    extra_fee: 0,
    penalty_fee: 0,
    tip: 0,
    note: ''
  })

  const [initialSnapshot, setInitialSnapshot] = useState(null)

  const packageName = booking?.packages?.name || ''
  const packageHasMakeup = Boolean(booking?.packages?.has_makeup)
  const makeupDisabled = !packageHasMakeup

  const suggestedBasePrice = useMemo(() => {
    if (!booking) return 0
    if (packageName === 'Cookie Nhiều mình') {
      return computeCookieNhieuMinhBasePrice(booking?.people_count)
    }
    return toNumber(booking?.packages?.price)
  }, [booking, packageName])

  const computedTotalAmount = useMemo(() => {
    return computeTotalInvoice({
      base_price: form.base_price,
      discount_percent: form.discount,
      makeup_fee: makeupDisabled ? 0 : form.makeup_fee,
      extra_fee: form.extra_fee,
      penalty_fee: form.penalty_fee,
      tip: form.tip
    })
  }, [form, makeupDisabled])

  const invoiceStatus = useMemo(() => {
    return normalizeInvoiceStatus(invoice?.status) || 'draft'
  }, [invoice?.status])

  const isPaidLike = useMemo(() => {
    return invoiceStatus === 'paid' || invoiceStatus === 'completed'
  }, [invoiceStatus])

  const computedRemainingAmount = useMemo(() => {
    // Requirement: when invoice is completed/paid => deposit=0 and remaining=0.
    if (isPaidLike) return 0
    return toInt(computedTotalAmount) - toInt(form.deposit)
  }, [computedTotalAmount, form.deposit, isPaidLike])

  useEffect(() => {
    const run = async () => {
      if (!open) return
      if (!bookingId) return
      setLoading(true)

      const [{ data: bookingData, error: bookingError }, { data: invoiceData, error: invoiceError }] =
        await Promise.all([
          getBookingById(bookingId),
          getInvoiceByBookingId(bookingId)
        ])

      setLoading(false)

      const anyError = bookingError || invoiceError
      if (anyError) {
        console.error(anyError)
        toast.error(anyError.message || 'Không tải được dữ liệu hoá đơn')
        return
      }

      setBooking(bookingData)
      setInvoice(invoiceData)

      const initialBase = toNumber(invoiceData?.base_price) || 0
      const nextSuggested = (() => {
        const pkgName = bookingData?.packages?.name || ''
        if (pkgName === 'Cookie Nhiều mình') return computeCookieNhieuMinhBasePrice(bookingData?.people_count)
        return toNumber(bookingData?.packages?.price)
      })()

      setForm({
        base_price: initialBase > 0 ? initialBase : toNumber(nextSuggested),
        deposit: toNumber(invoiceData?.deposit),
        discount: toNumber(invoiceData?.discount),
        makeup_fee: toNumber(invoiceData?.makeup_fee),
        extra_fee: toNumber(invoiceData?.extra_fee),
        penalty_fee: toNumber(invoiceData?.penalty_fee),
        tip: toNumber(invoiceData?.tip),
        note: invoiceData?.note || ''
      })

      // Snapshot for dirty-check
      setInitialSnapshot({
        base_price: toInt(initialBase > 0 ? initialBase : toNumber(nextSuggested)),
        deposit: toInt(toNumber(invoiceData?.deposit)),
        discount: toInt(toNumber(invoiceData?.discount)),
        makeup_fee: toInt(toNumber(invoiceData?.makeup_fee)),
        extra_fee: toInt(toNumber(invoiceData?.extra_fee)),
        penalty_fee: toInt(toNumber(invoiceData?.penalty_fee)),
        tip: toInt(toNumber(invoiceData?.tip)),
        note: String(invoiceData?.note || '')
      })
    }

    run()
  }, [open, bookingId])

  const isDirty = useMemo(() => {
    if (!open) return false
    if (!initialSnapshot) return false

    const current = {
      base_price: toInt(form.base_price),
      deposit: toInt(form.deposit),
      discount: toInt(form.discount),
      makeup_fee: makeupDisabled ? 0 : toInt(form.makeup_fee),
      extra_fee: toInt(form.extra_fee),
      penalty_fee: toInt(form.penalty_fee),
      tip: toInt(form.tip),
      note: String(form.note || '')
    }

    const normalizedBaseline = {
      ...initialSnapshot,
      makeup_fee: makeupDisabled ? 0 : toInt(initialSnapshot.makeup_fee)
    }

    return JSON.stringify(normalizedBaseline) !== JSON.stringify(current)
  }, [open, form, initialSnapshot, makeupDisabled])

  const confirmDiscardIfDirty = async () => {
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

  const handleResetBasePrice = () => {
    setForm((p) => ({ ...p, base_price: toNumber(suggestedBasePrice) }))
  }

  const handleCancel = async () => {
    if (saving) return
    const ok = await confirmDiscardIfDirty()
    if (!ok) return
    onClose?.()
  }

  const handleSave = async () => {
    if (!invoice?.id) return
    if (!booking?.id) return

    // Validation (required fields only)
    const basePrice = toInt(form.base_price)
    if (!Number.isFinite(basePrice) || basePrice < 0) return toast.error('Vui lòng nhập giá hợp lệ')

    const discountPercent = toInt(form.discount)
    if (discountPercent < 0 || discountPercent > 100) return toast.error('Giảm giá phải từ 0 đến 100%')

    // Status is edited in Invoice table now. The modal keeps the existing status.
    const rawStatus = invoice?.status || 'draft'

    const payload = {
      booking_id: booking.id,
      package_id: booking.package_id,
      base_price: basePrice,
      deposit: isPaidLike ? 0 : toInt(form.deposit),
      // discount field is treated as discount_percent (0..100)
      discount: discountPercent,
      makeup_fee: makeupDisabled ? 0 : toInt(form.makeup_fee),
      extra_fee: toInt(form.extra_fee),
      penalty_fee: toInt(form.penalty_fee),
      tip: toInt(form.tip),
      // total_amount stores total invoice (before deposit)
      total_amount: toInt(computedTotalAmount),
      status: rawStatus,
      note: String(form.note || '')
    }

    setSaving(true)
    const { data, error } = await updateInvoice(invoice.id, payload)
    setSaving(false)

    if (error) {
      console.error(error)
      toast.error(error.message || 'Không thể lưu hoá đơn')
      return
    }

    setInvoice(data)

    toast.success('Đã lưu hoá đơn')
    await onSaved?.()
    onClose?.()
  }

  const timeLabel = booking?.start_datetime ? dayjs(booking.start_datetime).format('DD/MM/YYYY HH:mm') : ''
  const remaining = toInt(computedRemainingAmount)

  return (
    <Modal
      open={open}
      title={<h1 className="cv-modalH1">Hoá đơn</h1>}
      wrapClassName="cv-calendarModal"
      centered
      onCancel={handleCancel}
      width={760}
      footer={
        <div className="cv-invoiceFooter">
          <div className="cv-invoiceFooterSummary">
            <div className="cv-invoiceFooterRow">
              <div className="cv-invoiceFooterLabel">Còn lại</div>
              <div className={remaining > 0 ? 'cv-invoiceRemaining cv-invoiceRemaining--due' : 'cv-invoiceRemaining'}>
                {formatVnd(remaining)}
              </div>
            </div>

            <div className="cv-invoiceFooterRow">
              <div className="cv-invoiceFooterLabel">Tổng hoá đơn</div>
              <div className="cv-invoiceTotal">{formatVnd(computedTotalAmount)}</div>
            </div>
          </div>

          <div className="cv-modalFooterGrid">
            <Button onClick={handleCancel} disabled={saving} block>
              Huỷ
            </Button>
            <Button type="primary" onClick={handleSave} loading={saving} disabled={loading || !booking} block>
              Lưu hoá đơn
            </Button>
          </div>
        </div>
      }
    >
      <div className="cv-modalGrid12">
        <div className="cv-col-12">
          <div className="cv-modalSection">
            <div className="cv-modalSectionTitle">Thông tin khách hàng</div>
            <div className="cv-modalGrid12">
              <div className="cv-col-6">
                <div className="cv-field">
                  <div className="cv-fieldLabel">Tên</div>
                  <Input value={booking?.customer_name || ''} disabled />
                </div>
              </div>

              <div className="cv-col-6">
                <div className="cv-field">
                  <div className="cv-fieldLabel">Số điện thoại</div>
                  <Input value={booking?.customer_phone || ''} disabled />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="cv-col-12">
          <div className="cv-modalSection">
            <div className="cv-modalSectionTitle">Thông tin gói chụp</div>
            <div className="cv-modalGrid12">
              <div className="cv-col-4">
                <div className="cv-field">
                  <div className="cv-fieldLabel">Gói chụp</div>
                  <Input value={packageName || ''} disabled />
                </div>
              </div>

              <div className="cv-col-4">
                <div className="cv-field">
                  <div className="cv-fieldLabel">Thời gian chụp</div>
                  <Input value={timeLabel || ''} disabled />
                </div>
              </div>

              <div className="cv-col-4">
                <div className="cv-field">
                  <div className="cv-fieldLabelRow">
                    <div className="cv-fieldLabel">Giá</div>
                    <Button
                      type="text"
                      size="small"
                      onClick={handleResetBasePrice}
                      disabled={loading}
                      aria-label="Reset giá"
                      icon={(
                        <span className="material-symbols-rounded" style={{ fontSize: 18, lineHeight: 1 }}>
                          refresh
                        </span>
                      )}
                    />
                  </div>
                  <InputNumber
                    min={0}
                    step={10000}
                    value={form.base_price}
                    formatter={formatWithCommas}
                    parser={parseCommas}
                    onChange={(v) => setForm((p) => ({ ...p, base_price: v === null ? null : toInt(v) }))}
                    disabled={loading}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="cv-col-4">
                <div className="cv-field">
                  <div className="cv-fieldLabel">Tiền cọc</div>
                  <InputNumber
                    min={0}
                    step={10000}
                    value={form.deposit}
                    formatter={formatWithCommas}
                    parser={parseCommas}
                    onChange={(v) => setForm((p) => ({ ...p, deposit: v === null ? null : toInt(v) }))}
                    disabled={loading || isPaidLike}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="cv-col-4">
                <div className="cv-field">
                  <div className="cv-fieldLabel">Make up</div>
                  <InputNumber
                    min={0}
                    step={10000}
                    value={makeupDisabled ? 0 : form.makeup_fee}
                    formatter={formatWithCommas}
                    parser={parseCommas}
                    onChange={(v) => setForm((p) => ({ ...p, makeup_fee: v === null ? null : toInt(v) }))}
                    disabled={loading || makeupDisabled}
                    style={{ width: '100%' }}
                  />
                  {makeupDisabled ? (
                    <Text type="secondary">Gói này không có makeup.</Text>
                  ) : null}
                </div>
              </div>

              <div className="cv-col-4">
                <div className="cv-field">
                  <div className="cv-fieldLabel">Phụ thu</div>
                  <InputNumber
                    min={0}
                    step={10000}
                    value={form.extra_fee}
                    formatter={formatWithCommas}
                    parser={parseCommas}
                    onChange={(v) => setForm((p) => ({ ...p, extra_fee: v === null ? null : toInt(v) }))}
                    disabled={loading}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="cv-col-12">
          <Collapse
            items={[{
              key: 'other',
              label: 'Các phụ phí khác',
              children: (
                <div className="cv-modalGrid12" style={{ marginTop: 8 }}>
                  <div className="cv-col-4">
                    <div className="cv-field">
                      <div className="cv-fieldLabel">Tip</div>
                      <InputNumber
                        min={0}
                        step={10000}
                        value={form.tip}
                        formatter={formatWithCommas}
                        parser={parseCommas}
                        onChange={(v) => setForm((p) => ({ ...p, tip: v === null ? null : toInt(v) }))}
                        disabled={loading}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div className="cv-col-4">
                    <div className="cv-field">
                      <div className="cv-fieldLabel">Giảm giá (%)</div>
                      <InputNumber
                        min={0}
                        max={100}
                        step={1}
                        value={toInt(form.discount)}
                        onChange={(v) => setForm((p) => ({ ...p, discount: toInt(v) }))}
                        disabled={loading}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div className="cv-col-4">
                    <div className="cv-field">
                      <div className="cv-fieldLabel">Phạt</div>
                      <InputNumber
                        min={0}
                        step={10000}
                        value={form.penalty_fee}
                        formatter={formatWithCommas}
                        parser={parseCommas}
                        onChange={(v) => setForm((p) => ({ ...p, penalty_fee: v === null ? null : toInt(v) }))}
                        disabled={loading}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              )
            }]}
          />
        </div>

        <div className="cv-col-12">
          <div className="cv-invoiceSectionTitle">Ghi chú</div>
        </div>

        <div className="cv-col-12">
          <div className="cv-field">
            <Input.TextArea
              rows={3}
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              disabled={loading}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
