import { Card, Skeleton } from 'antd'
import { useMemo } from 'react'

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

const formatVnd = (value) => `${toNumber(value).toLocaleString('vi-VN')} đ`

const formatPctSigned = (value) => {
  const n = toNumber(value)
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}${Math.abs(n).toFixed(2)}%`
}

const TrendBadge = ({ pct = 0 }) => {
  const isUp = toNumber(pct) >= 0
  return (
    <span className={`cv-kpiBadge ${isUp ? 'cv-kpiBadge--up' : 'cv-kpiBadge--down'}`}>
      {formatPctSigned(pct)}
    </span>
  )
}

export default function DashboardKpiCards({ data, loading = false }) {
  const kpi = useMemo(() => {
    const safe = data || {}
    return {
      totalRevenue: toNumber(safe.totalRevenue),
      totalRevenueMonth: toNumber(safe.totalRevenueMonth),
      totalRemainingMonth: toNumber(safe.totalRemainingMonth),
      totalOrders: toNumber(safe.totalOrders),
      rateTotalRevenue: toNumber(safe.rateTotalRevenue),
      rateTotalRevenueMonth: toNumber(safe.rateTotalRevenueMonth),
      rateRemainingMonth: toNumber(safe.rateRemainingMonth),
      rateOrders: toNumber(safe.rateOrders)
    }
  }, [data])

  // UX: Make one KPI primary (monthly revenue) to anchor attention.
  const primary = {
    key: 'totalRevenueMonth',
    icon: 'monitoring',
    title: 'Tổng doanh thu theo tháng',
    value: formatVnd(kpi.totalRevenueMonth),
    pct: kpi.rateTotalRevenueMonth,
    label: 'so với tháng trước'
  }

  const secondary = [
    {
      key: 'totalRevenue',
      icon: 'payments',
      title: 'Tổng doanh thu',
      value: formatVnd(kpi.totalRevenue),
      pct: kpi.rateTotalRevenue,
      label: 'so với tuần trước'
    },
    {
      key: 'totalRemainingMonth',
      icon: 'receipt_long',
      title: 'Tổng tiền còn phải thu',
      value: formatVnd(kpi.totalRemainingMonth),
      pct: kpi.rateRemainingMonth,
      label: 'so với tháng trước'
    },
    {
      key: 'totalOrders',
      icon: 'shopping_bag',
      title: 'Tổng đơn hàng',
      value: kpi.totalOrders.toLocaleString('vi-VN'),
      pct: kpi.rateOrders,
      label: 'so với tháng trước'
    }
  ]

  return (
    <div className="cv-kpiGrid">
      <Card className="cv-kpiCard cv-kpiCard--primary cv-dashboardCard" bordered={false}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        ) : (
          <div className="cv-kpiInner">
            <div className="cv-kpiHead">
              <div className="cv-kpiTopRow">
                <div className="cv-kpiIcon cv-kpiIcon--primary" aria-hidden>
                  <span className="material-symbols-rounded">{primary.icon}</span>
                </div>
                <TrendBadge pct={primary.pct} />
              </div>
              <div className="cv-kpiTitle">{primary.title}</div>
            </div>

            <div className="cv-kpiMid">
              <div className="cv-kpiValue cv-kpiValue--primary">{primary.value}</div>
            </div>

            <div className="cv-kpiFoot">
              <div className="cv-kpiCaption">{primary.label}</div>
            </div>
          </div>
        )}
      </Card>

      {secondary.map((it) => (
        <Card
          key={it.key}
          className="cv-kpiCard cv-kpiCard--secondary cv-dashboardCard cv-dashboardCard--glass"
          bordered={false}
        >
          {loading ? (
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          ) : (
            <div className="cv-kpiInner">
              <div className="cv-kpiHead">
                <div className="cv-kpiTopRow">
                  <div className="cv-kpiIcon" aria-hidden>
                    <span className="material-symbols-rounded">{it.icon}</span>
                  </div>
                  <TrendBadge pct={it.pct} />
                </div>
                <div className="cv-kpiTitle">{it.title}</div>
              </div>

              <div className="cv-kpiMid">
                <div className="cv-kpiValue">{it.value}</div>
              </div>

              <div className="cv-kpiFoot">
                <div className="cv-kpiCaption">{it.label}</div>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
