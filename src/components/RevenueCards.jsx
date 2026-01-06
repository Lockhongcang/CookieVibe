import { Card, Col, Row, Space, Statistic, Tag, theme } from 'antd'
import { useMemo } from 'react'

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

const formatVnd = (value) => {
  const number = toNumber(value)
  return `${new Intl.NumberFormat('vi-VN').format(number)} VND`
}

export default function RevenueCards({ data, loading = false }) {
  const { token } = theme.useToken()

  const metrics = useMemo(() => {
    const safe = data || {}
    return {
      totalRevenue: toNumber(safe.totalRevenue),
      totalPaid: toNumber(safe.totalPaid),
      totalRemaining: toNumber(safe.totalRemaining),
      totalBookings: toNumber(safe.totalBookings),
      completedCount: toNumber(safe.completedCount),
      scheduledCount: toNumber(safe.scheduledCount),
      cancelledCount: toNumber(safe.cancelledCount)
    }
  }, [data])

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={12} lg={6}>
        <Card loading={loading}>
          <Statistic
            title="Tổng doanh thu tháng"
            value={metrics.totalRevenue}
            formatter={(v) => formatVnd(v)}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={12} lg={6}>
        <Card loading={loading}>
          <Statistic
            title="Tổng tiền đã thu"
            value={metrics.totalPaid}
            formatter={(v) => formatVnd(v)}
            valueStyle={{ color: token.colorSuccess }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={12} lg={6}>
        <Card loading={loading}>
          <Statistic
            title="Tổng tiền còn phải thu"
            value={metrics.totalRemaining}
            formatter={(v) => formatVnd(v)}
            valueStyle={{ color: token.colorWarning }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={12} lg={6}>
        <Card loading={loading}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Statistic title="Tổng số booking" value={metrics.totalBookings} />
            <Space size={8} wrap>
              <Tag color="green">Hoàn thành: {metrics.completedCount}</Tag>
              <Tag color="gold">Đã đặt: {metrics.scheduledCount}</Tag>
              <Tag color="red">Huỷ: {metrics.cancelledCount}</Tag>
            </Space>
          </Space>
        </Card>
      </Col>
    </Row>
  )
}
