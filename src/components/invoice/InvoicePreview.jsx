import dayjs from 'dayjs'
import { forwardRef } from 'react'
import { computeInvoiceAmounts } from '../../utils/invoice'

const formatVnd = (value) => {
  const n = Number(value)
  const safe = Number.isFinite(n) ? Math.round(n) : 0
  return `${safe.toLocaleString('vi-VN')} ₫`
}

const InvoicePreview = forwardRef(function InvoicePreview({ booking, invoice }, ref) {
  if (!booking || !invoice) return null

  const packageName = invoice?.packages?.name || booking?.packages?.name || ''
  const dateTimeText = booking?.start_datetime
    ? dayjs(booking.start_datetime).format('HH:mm – DD/MM/YYYY')
    : '—'

  const locationText = booking?.location || '—'

  const { basePrice, deposit, surchargeForBill, totalAmount, remainingAmount } = computeInvoiceAmounts(invoice)

  return (
    <div className="invoice-preview" ref={ref}>
      {/* Row 1 */}
      <div className="invoice-row2">
        <div className="invoice-row2Left">
          <Field label="Tên khách hàng" value={booking?.customer_name || '—'} />
        </div>
        <div className="invoice-row2Right">
          <Field label="Tên khách hàng" value={booking?.customer_name || '—'} />
        </div>
      </div>

      {/* Row 2 */}
      <div className="invoice-row2">
        <div className="invoice-row2Left">
          <Field label="Ngày giờ" value={dateTimeText} strong />
          <Field label="Địa điểm" value={locationText} strong />
        </div>
        <div className="invoice-row2Right">
          <Field label="Gói chụp" value={packageName || '—'} lightValue />
        </div>
      </div>

      <div className="invoice-divider" />

      {/* Row 3-5 */}
      <RowBetween label="Giá gói" value={formatVnd(basePrice)} />
      <RowBetween label="Đã cọc" value={formatVnd(deposit)} />
      <RowBetween label="Phụ phí" value={formatVnd(surchargeForBill)} />
      <RowBetween label="Tổng tiền" value={formatVnd(totalAmount)} />
      <div className="invoice-divider" />

      {/* Row 6 */}
      <RowBetween label="Tổng tiền còn lại" value={formatVnd(remainingAmount)} emphasis />
    </div>
  )
})

export default InvoicePreview

function Field({ label, value, strong = false, lightValue = false }) {
  return (
    <div className="invoice-field">
      <div className="invoice-label">{label}</div>
      <div
        className={
          strong
            ? 'invoice-value invoice-value--strong'
            : lightValue
              ? 'invoice-value invoice-value--light'
              : 'invoice-value'
        }
      >
        {value || '—'}
      </div>
    </div>
  )
}

function RowBetween({ label, value, emphasis = false }) {
  return (
    <div className={emphasis ? 'invoice-rowBetween invoice-rowBetween--emphasis' : 'invoice-rowBetween'}>
      <div className="invoice-label">{label}</div>
      <div className="invoice-value">{value}</div>
    </div>
  )
}
