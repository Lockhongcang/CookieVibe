import { Card, Empty } from 'antd'
import { useMemo } from 'react'

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

/**
 * data: [{ name: string, total: number }]
 */
export default function TopPackagesDonutChart({ data = [], loading = false }) {
  const items = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    return list
      .map((d) => ({
        name: d?.name || '-',
        total: toNumber(d?.total)
      }))
      .filter((d) => d.total > 0)
  }, [data])

  const maxTotal = useMemo(() => {
    return items.reduce((m, it) => Math.max(m, it.total), 0)
  }, [items])

  const totalAll = useMemo(() => {
    return items.reduce((acc, it) => acc + it.total, 0)
  }, [items])

  const formatVndCompact = (value) => {
    const number = toNumber(value)
    return `${new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 0 }).format(number)} ₫`
  }

  return (
    <Card
      title="Gói bán chạy"
      loading={loading}
      className="cv-dashboardCard cv-dashboardCard--solid cv-packagesCard"
      bordered={false}
      extra={totalAll > 0 ? <span className="cv-packagesTotal">Tổng: {formatVndCompact(totalAll)}</span> : null}
    >
      {items.length ? (
        <div className="cv-packagesList" aria-label="Danh sách gói bán chạy">
          {items.map((it) => {
            const pct = maxTotal > 0 ? Math.round((it.total / maxTotal) * 100) : 0
            return (
              <div key={it.name} className="cv-packagesRow">
                <div className="cv-packagesRowTop">
                  <div className="cv-packagesName" title={it.name}>{it.name}</div>
                  <div className="cv-packagesValue">{formatVndCompact(it.total)}</div>
                </div>
                <div className="cv-packagesBar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="cv-packagesBarFill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="cv-dashboardEmpty">
          <div className="cv-emptyState">
            <span className="material-symbols-rounded cv-emptyStateIcon" aria-hidden>
              donut_large
            </span>
            <div className="cv-emptyStateTitle">Chưa có dữ liệu</div>
            <div className="cv-emptyStateHint">Khi có đơn phát sinh, gói bán chạy sẽ hiển thị ở đây.</div>
          </div>
        </div>
      )}
    </Card>
  )
}
