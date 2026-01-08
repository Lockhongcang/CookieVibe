import { Card, Empty, Select, Space } from 'antd'
import { useMemo } from 'react'
import Chart from 'react-apexcharts'

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

const formatVndCompact = (value) => {
  const number = toNumber(value)
  return `${new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 0 }).format(number)} VNĐ`
}

const cssVar = (name, fallback) => {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export default function MonthlyRevenueAreaChart({
  data = [],
  loading = false,
  mode = 'year',
  year,
  month,
  onModeChange,
  onYearChange,
  onMonthChange
}) {
  const series = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    return [
      {
        name: 'Doanh thu',
        data: list.map((d) => toNumber(d?.value))
      }
    ]
  }, [data])

  const categories = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    return list.map((d) => String(d?.label || ''))
  }, [data])

  const title = useMemo(() => {
    if (mode === 'month') return `Biểu đồ doanh thu tháng ${month}/${year}`
    return `Biểu đồ doanh thu năm ${year}`
  }, [mode, month, year])

  const years = useMemo(() => {
    const nowY = new Date().getFullYear()
    const list = []
    for (let y = nowY - 4; y <= nowY; y += 1) list.push(y)
    return list
  }, [])

  const options = useMemo(() => {
    const primary900 = cssVar('--cv-primary-900', '#3A2312')
    const primary500 = cssVar('--cv-primary-500', '#7A5230')
    const primary100 = cssVar('--cv-primary-100', '#EFE4D8')
    const textSecondary = cssVar('--cv-text-secondary', '#6F6256')
    const borderSoft = cssVar('--cv-border-soft', '#F1EBE4')

    return {
      chart: {
        type: 'area',
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true }
      },
      stroke: {
        curve: 'smooth',
        width: 3,
        colors: [primary900]
      },
      fill: {
        type: 'gradient',
        gradient: {
          type: 'vertical',
          shadeIntensity: 0,
          opacityFrom: 0.32,
          opacityTo: 0.06,
          stops: [0, 70, 100],
          colorStops: [
            { offset: 0, color: primary100, opacity: 0.32 },
            { offset: 70, color: primary100, opacity: 0.12 },
            { offset: 100, color: primary100, opacity: 0.06 }
          ]
        }
      },
      colors: [primary900],
      dataLabels: { enabled: false },
      grid: {
        borderColor: borderSoft,
        strokeDashArray: 0,
        padding: { left: 8, right: 8, top: 8, bottom: 0 }
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: textSecondary, fontWeight: 600 },
          rotate: 0
        }
      },
      yaxis: {
        labels: {
          style: { colors: textSecondary, fontWeight: 600 },
          formatter: (v) => formatVndCompact(v)
        }
      },
      tooltip: {
        y: { formatter: (v) => `${toNumber(v).toLocaleString('vi-VN')} VNĐ` }
      },
      markers: {
        size: 0,
        hover: { size: 5 },
        colors: [primary500]
      }
    }
  }, [categories])

  const hasAnyRevenue = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    return list.some((d) => toNumber(d?.value) > 0)
  }, [data])

  return (
    <Card
      title={title}
      loading={loading}
      className="cv-dashboardCard cv-dashboardCard--glass cv-dashboardChartCard"
      bordered={false}
      extra={(
        <Space size={8} className="cv-dashboardChartControls">
          <Select
            value={mode}
            onChange={(v) => onModeChange?.(v)}
            options={[
              { value: 'year', label: 'Năm' },
              { value: 'month', label: 'Tháng' }
            ]}
            size="middle"
            className="cv-dashboardChartSelect"
          />
          <Select
            value={year}
            onChange={(v) => onYearChange?.(v)}
            options={years.map((y) => ({ value: y, label: String(y) }))}
            size="middle"
            className="cv-dashboardChartSelect"
          />
          {mode === 'month' ? (
            <Select
              value={month}
              onChange={(v) => onMonthChange?.(v)}
              options={Array.from({ length: 12 }).map((_, idx) => {
                const m = idx + 1
                return { value: m, label: `Tháng ${m}` }
              })}
              size="middle"
              className="cv-dashboardChartSelect"
            />
          ) : null}
        </Space>
      )}
    >
      {hasAnyRevenue ? (
        <Chart options={options} series={series} type="area" height={260} />
      ) : (
        <div className="cv-dashboardEmpty">
          <div className="cv-emptyState">
            <span className="material-symbols-rounded cv-emptyStateIcon" aria-hidden>
              insert_chart
            </span>
            <div className="cv-emptyStateTitle">Chưa có dữ liệu doanh thu</div>
            <div className="cv-emptyStateHint">Thử chọn tháng/năm khác hoặc kiểm tra xem đã có booking nào trong kỳ này chưa.</div>
          </div>
        </div>
      )}
    </Card>
  )
}
