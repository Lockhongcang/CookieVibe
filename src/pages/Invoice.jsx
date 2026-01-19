import { Button, Card, DatePicker, Input, Select, Space, Table, Typography } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import InvoiceDetailModal from '../components/invoice/InvoiceDetailModal'
import { getInvoices, updateInvoice } from '../services/invoice.service'
import { setBookingStatus } from '../services/booking.service'
import { toNumber } from '../utils/number.js'
import { ShimmerTableCard } from '../components/ui/Shimmer'
import '../styles/pages/invoice.css'

const { Title, Text } = Typography

const INVOICE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Nháp' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'canceled', label: 'Đã huỷ' }
]

const STATUS_SELECT_OPTIONS = INVOICE_STATUS_OPTIONS.map((o) => {
  const icon = o.value === 'completed' ? 'check_circle' : o.value === 'canceled' ? 'cancel' : 'schedule'
  return {
    value: o.value,
    label: (
      <span className="cv-statusOption">
        <span className="material-symbols-rounded cv-statusOptionIcon" aria-hidden>
          {icon}
        </span>
        <span className="cv-statusOptionText">{o.label}</span>
      </span>
    )
  }
})

const toInt = (value, fallback = 0) => {
  const n = toNumber(value, fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.round(n)
}

const formatVnd = (value) => `${toInt(value).toLocaleString('vi-VN')} VNĐ`

const normalizeInvoiceStatus = (status) => {
  if (status === 'paid') return 'completed'
  return status
}

export default function InvoicePage({ bookingId, onBack }) {
  // bookingId is now used as an optional initialBookingId to auto-open the detail modal.
  const initialBookingId = bookingId

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])

  const [detailOpen, setDetailOpen] = useState(() => Boolean(initialBookingId))
  const [detailBookingId, setDetailBookingId] = useState(() => initialBookingId || null)

  const [filterRange, setFilterRange] = useState(() => {
    const today = dayjs()
    return [today, today]
  })
  const [filterPackageId, setFilterPackageId] = useState(null)
  const [filterStatus, setFilterStatus] = useState(null)
  const [searchText, setSearchText] = useState('')

  const [savingStatusId, setSavingStatusId] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 768px)')
    if (!mq) return
    const sync = () => setIsMobile(Boolean(mq.matches))
    sync()

    if (mq.addEventListener) mq.addEventListener('change', sync)
    else mq.addListener(sync)

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', sync)
      else mq.removeListener(sync)
    }
  }, [])

  const packageFilterOptions = useMemo(() => {
    const map = new Map()
    for (const r of rows || []) {
      const id = r?.package_id
      const name = r?.packages?.name
      if (!id) continue
      if (!map.has(id)) map.set(id, name || String(id))
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [rows])

  const filteredRows = useMemo(() => {
    const list = Array.isArray(rows) ? rows : []
    const q = String(searchText || '').trim().toLowerCase()

    const [from, to] = Array.isArray(filterRange) ? filterRange : [null, null]
    const fromDay = from ? dayjs(from).startOf('day') : null
    const toDay = to ? dayjs(to).endOf('day') : null

    return list.filter((r) => {
      if (filterPackageId && r?.package_id !== filterPackageId) return false
      if (filterStatus) {
        if (filterStatus === 'completed') {
          if (!(r?.status === 'completed' || r?.status === 'paid')) return false
        } else if (r?.status !== filterStatus) return false
      }

      const startDt = r?.bookings?.start_datetime ? dayjs(r.bookings.start_datetime) : null
      if (fromDay && startDt?.isValid() && startDt.isBefore(fromDay)) return false
      if (toDay && startDt?.isValid() && startDt.isAfter(toDay)) return false

      if (q) {
        const hay = [
          r?.bookings?.customer_name,
          r?.bookings?.customer_phone,
          r?.packages?.name
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }

      return true
    })
  }, [rows, filterPackageId, filterStatus, filterRange, searchText])
  const getRemaining = (row) => {
    const status = row?.status
    const paidLike = status === 'paid' || status === 'completed'
    if (paidLike) return 0
    return toInt(row?.total_amount) - toInt(row?.deposit)
  }

  const renderStatusSelect = (row) => {
    const value = normalizeInvoiceStatus(row?.status) || 'draft'
    const statusClass = value === 'completed' || value === 'canceled' || value === 'draft' ? value : 'draft'
    const disabled = value !== 'draft' || savingStatusId === row?.id

    return (
      <Select
        value={value}
        variant="borderless"
        options={STATUS_SELECT_OPTIONS}
        optionLabelProp="label"
        onChange={(v) => handleChangeStatus(row, v)}
        disabled={disabled}
        size="middle"
        className={`cv-statusSelect ${statusClass}`}
        rootClassName={`cv-statusSelect ${statusClass}`}
        popupClassName="cv-statusDropdown"
        suffixIcon={(
          <span className="material-symbols-rounded" style={{ fontSize: 20, lineHeight: 1 }}>
            expand_more
          </span>
        )}
        style={{ width: 120 }}
      />
    )
  }

  const fetchInvoices = async () => {
    setLoading(true)
    const { data, error } = await getInvoices()
    setLoading(false)

    if (error) {
      console.error(error)
      toast.error(error.message || 'Không tải được danh sách hoá đơn')
      return
    }

    setRows(data || [])
  }

  const handleChangeStatus = async (row, nextStatus) => {
    if (!row?.id) return
    if (!row?.booking_id) return

    const current = normalizeInvoiceStatus(row?.status) || 'draft'
    if (current !== 'draft') {
      toast.error('Chỉ được đổi trạng thái khi hoá đơn đang ở Nháp')
      return
    }

    const prevStatus = row?.status
    const prevDeposit = row?.deposit

    setRows((prev) => (prev || []).map((r) => {
      if (r?.id !== row.id) return r
      return {
        ...r,
        status: nextStatus,
        deposit: nextStatus === 'completed' ? 0 : r?.deposit
      }
    }))

    setSavingStatusId(row.id)
    const payload = { status: nextStatus }
    if (nextStatus === 'completed') payload.deposit = 0

    const { error } = await updateInvoice(row.id, payload)
    setSavingStatusId(null)

    if (error) {
      console.error(error)
      toast.error(error.message || 'Không thể cập nhật trạng thái')
      setRows((prev) => (prev || []).map((r) => {
        if (r?.id !== row.id) return r
        return { ...r, status: prevStatus, deposit: prevDeposit }
      }))
      return
    }

    try {
      if (nextStatus === 'completed') await setBookingStatus(row.booking_id, 'completed')
      else if (nextStatus === 'canceled') await setBookingStatus(row.booking_id, 'canceled')
    } catch (e) {
      // silently fail
    }

    toast.success('Đã cập nhật trạng thái')
    fetchInvoices()
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInvoices()
  }, [])

  // Note: initialBookingId is only used for initial open; subsequent opens are user actions.

  const columnsDesktop = [
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, row) => {
        const customer = row?.bookings?.customer_name || '(Chưa có tên)'
        return <span className="cv-invoiceName">{customer}</span>
      },
      sorter: (a, b) => String(a?.bookings?.customer_name || '').localeCompare(String(b?.bookings?.customer_name || '')),
      width: 200
    },
    {
      title: 'Gói',
      key: 'package',
      render: (_, row) => {
        const pack = row?.packages?.name || '-'
        return <span className="cv-invoicePackage">{pack}</span>
      },
      sorter: (a, b) => String(a?.packages?.name || '').localeCompare(String(b?.packages?.name || '')),
      width: 170
    },
    {
      title: 'Thời gian',
      key: 'start_datetime',
      render: (_, row) => {
        const start = row?.bookings?.start_datetime
          ? dayjs(row.bookings.start_datetime).format('HH:mm – DD/MM/YYYY')
          : '-'
        return <span className="cv-invoiceDatetime">{start}</span>
      },
      sorter: (a, b) => {
        const aDate = a?.bookings?.start_datetime ? dayjs(a.bookings.start_datetime).valueOf() : 0
        const bDate = b?.bookings?.start_datetime ? dayjs(b.bookings.start_datetime).valueOf() : 0
        return aDate - bDate
      },
      width: 190
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right',
      width: 150,
      render: (v) => <span className="cv-invoiceMoneyTotal">{formatVnd(v)}</span>,
      sorter: (a, b) => toInt(a?.total_amount) - toInt(b?.total_amount)
    },
    {
      title: 'Tiền còn lại',
      key: 'remaining',
      align: 'right',
      width: 150,
      render: (_, row) => {
        const n = getRemaining(row)
        const isPaid = toInt(n) <= 0
        const cls = isPaid
          ? 'cv-invoiceMoneyRemaining cv-invoiceMoneyRemaining--paid'
          : 'cv-invoiceMoneyRemaining cv-invoiceMoneyRemaining--due'
        return <span className={cls}>{formatVnd(isPaid ? 0 : n)}</span>
      },
      sorter: (a, b) => getRemaining(a) - getRemaining(b)
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 140,
      render: (_, row) => (
        <div
          className="cv-invoiceStatusCell"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {renderStatusSelect(row)}
        </div>
      )
    }
  ]

  const columnsMobile = [
    {
      key: 'mobile_card',
      render: (_, row) => {
        const customer = row?.bookings?.customer_name || '(Chưa có tên)'
        const pack = row?.packages?.name || '-'
        const start = row?.bookings?.start_datetime ? dayjs(row.bookings.start_datetime).format('HH:mm – DD/MM/YYYY') : '-'

        const statusValue = normalizeInvoiceStatus(row?.status) || 'draft'
        const statusLabel = INVOICE_STATUS_OPTIONS.find((o) => o.value === statusValue)?.label || 'Nháp'

        const total = formatVnd(row?.total_amount)
        const remain = getRemaining(row)
        const remainPaid = toInt(remain) <= 0

        return (
          <div className="cv-invoiceCard">
            <div className="cv-invoiceCardTop">
              <div className="cv-invoiceCardTopLeft">{customer}</div>
              <div className="cv-invoiceCardTopRight">{pack}</div>
            </div>

            <div className="cv-invoiceCardRow">
              <div className="cv-invoiceCardLabel">Thời gian</div>
              <div className="cv-invoiceCardValue">{start}</div>
            </div>

            <div
              className="cv-invoiceCardRow"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="cv-invoiceCardLabel">Trạng thái</div>
              <div className="cv-invoiceCardStatus" aria-label={`Trạng thái hiện tại: ${statusLabel}`}
              >
                {renderStatusSelect(row)}
              </div>
            </div>

            <div className="cv-invoiceCardDivider" role="separator" />

            <div className="cv-invoiceCardRow">
              <div className="cv-invoiceCardLabel">Tổng tiền</div>
              <div className="cv-invoiceMoneyTotal">{total}</div>
            </div>

            <div className="cv-invoiceCardRow">
              <div className="cv-invoiceCardLabel">Tiền còn lại</div>
              <div className="cv-invoiceMoneyRemaining">{formatVnd(remainPaid ? 0 : remain)}</div>
            </div>
          </div>
        )
      }
    }
  ]

  const columns = isMobile ? columnsMobile : columnsDesktop

  return (
    <div className="cv-container">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <div>
            <Title level={3} style={{ margin: 0 }}>Hoá đơn</Title>
            <Text type="secondary">Mặc định hiển thị hoá đơn trong ngày. Dùng lọc/tìm kiếm để xem thêm.</Text>
          </div>
        </Space>

        <Card>
          <Space size={10} wrap style={{ width: '100%', marginBottom: 12 }} className="cv-invoiceFilters">
            <DatePicker.RangePicker
              value={filterRange}
              onChange={(range) => setFilterRange(range || null)}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              size="middle"
            />

            <Select
              value={filterPackageId || undefined}
              onChange={(v) => setFilterPackageId(v || null)}
              options={packageFilterOptions}
              placeholder="Lọc gói"
              allowClear
              size="middle"
              style={{ minWidth: 180 }}
            />

            <Select
              value={filterStatus || undefined}
              onChange={(v) => setFilterStatus(v || null)}
              options={INVOICE_STATUS_OPTIONS}
              placeholder="Lọc trạng thái"
              allowClear
              size="middle"
              style={{ minWidth: 180 }}
            />

            <Input.Search
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Tìm khách / SĐT / gói"
              allowClear
              size="middle"
              style={{ minWidth: 240 }}
            />

            <Button
              onClick={() => {
                const today = dayjs()
                setFilterRange([today, today])
                setFilterPackageId(null)
                setFilterStatus(null)
                setSearchText('')
              }}
              type="link"
              size="middle"
              className="cv-invoiceResetLink"
            >
              Reset lọc
            </Button>
          </Space>

          {loading && !rows?.length ? (
            <ShimmerTableCard rows={8} />
          ) : (
            <Table
              rowKey={(r) => r.id}
              loading={loading}
              columns={columns}
              dataSource={filteredRows}
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: loading
                  ? 'Đang tải…'
                  : (
                      <div className="cv-emptyState cv-emptyState--compact">
                        <span className="material-symbols-rounded cv-emptyStateIcon" aria-hidden>
                          receipt
                        </span>
                        <div className="cv-emptyStateTitle">Chưa có hoá đơn</div>
                        <div className="cv-emptyStateHint">Khi bạn tạo booking và cập nhật hoá đơn, dữ liệu sẽ hiện ở đây.</div>
                      </div>
                    )
              }}
              className="cv-invoiceTable"
              showHeader={!isMobile}
              scroll={isMobile ? undefined : { x: 980 }}
              onRow={(row) => ({
                onClick: () => {
                  setDetailBookingId(row.booking_id)
                  setDetailOpen(true)
                }
              })}
            />
          )}
        </Card>

        <InvoiceDetailModal
          open={detailOpen}
          bookingId={detailBookingId}
          onClose={() => {
            if (initialBookingId && onBack) {
              onBack()
              return
            }
            setDetailOpen(false)
            setDetailBookingId(null)
          }}
          onSaved={fetchInvoices}
        />
      </Space>
    </div>
  )
}
