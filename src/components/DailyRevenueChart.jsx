import { Card, theme } from 'antd'
import { useMemo } from 'react'

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

const formatVndCompact = (value) => {
  const number = toNumber(value)
  // Compact isn't always ideal for VND; keep readable but shorter.
  return `${new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(number)} ₫`
}

/**
 * data: [{ date: 'YYYY-MM-DD', value: number }]
 */
export default function DailyRevenueChart({ data = [], loading = false }) {
  const { token } = theme.useToken()

  const series = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    return list.map((d) => ({
      date: d?.date,
      value: toNumber(d?.value)
    }))
  }, [data])

  const maxValue = useMemo(() => {
    return series.reduce((m, d) => Math.max(m, d.value), 0)
  }, [series])

  const svg = useMemo(() => {
    const width = 600
    const height = 140
    const padding = 12
    const innerW = width - padding * 2
    const innerH = height - padding * 2

    const n = series.length
    if (n === 0) return null

    const barGap = 2
    const barW = Math.max(2, Math.floor((innerW - barGap * (n - 1)) / n))

    const scaleY = (v) => {
      if (maxValue <= 0) return 0
      return Math.round((v / maxValue) * innerH)
    }

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Biểu đồ doanh thu theo ngày"
      >
        <rect x="0" y="0" width={width} height={height} fill={token.colorBgContainer} />

        {series.map((d, i) => {
          const h = scaleY(d.value)
          const x = padding + i * (barW + barGap)
          const y = padding + (innerH - h)
          const fill = d.value > 0 ? token.colorPrimary : token.colorFillSecondary

          return (
            <rect
              key={`${d.date}-${i}`}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={2}
              fill={fill}
            />
          )
        })}

        {/* baseline */}
        <line
          x1={padding}
          y1={padding + innerH}
          x2={padding + innerW}
          y2={padding + innerH}
          stroke={token.colorBorderSecondary}
          strokeWidth="1"
        />
      </svg>
    )
  }, [maxValue, series, token.colorBgContainer, token.colorBorderSecondary, token.colorFillSecondary, token.colorPrimary])

  const startLabel = series[0]?.date
  const endLabel = series[series.length - 1]?.date

  return (
    <Card
      title="Biểu đồ doanh thu theo ngày (30 ngày)"
      loading={loading}
      extra={
        maxValue > 0 ? `Max: ${formatVndCompact(maxValue)}` : undefined
      }
    >
      <div style={{ width: '100%' }}>{svg}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: token.colorTextSecondary }}>
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </Card>
  )
}
