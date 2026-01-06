import { Card, Space, Table, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { getDashboardOverview } from '../services/dashboard.service'
import DashboardKpiCards from '../components/dashboard/DashboardKpiCards'
import MonthlyRevenueAreaChart from '../components/dashboard/MonthlyRevenueAreaChart'
import TopPackagesDonutChart from '../components/dashboard/TopPackagesDonutChart'
import '../styles/pages/dashboard.css'

const { Title, Text } = Typography

const statusTag = (status) => {
	if (status === 'completed') return <Tag className="cv-statusTag cv-statusTag--success">Hoàn thành</Tag>
	if (status === 'canceled') return <Tag className="cv-statusTag cv-statusTag--danger">Huỷ</Tag>
	if (status === 'in_progress') return <Tag className="cv-statusTag cv-statusTag--info">Đang chụp</Tag>
	return <Tag className="cv-statusTag cv-statusTag--muted">Đã đặt</Tag>
}

const formatDateTime = (b) => {
	if (!b?.start_datetime) return ''
	return dayjs(b.start_datetime).format('DD/MM/YYYY HH:mm')
}

export default function DashboardPage() {
	const today = useMemo(() => dayjs(), [])
	const month = today.month() + 1
	const year = today.year()

	const [overview, setOverview] = useState(null)
	const [loading, setLoading] = useState(false)
	const [revenueMode, setRevenueMode] = useState('year')
	const [revenueYear, setRevenueYear] = useState(() => year)
	const [revenueMonth, setRevenueMonth] = useState(() => month)

	useEffect(() => {
		const run = async () => {
			setLoading(true)
			const { data, error } = await getDashboardOverview(month, year, {
				revenueMode,
				revenueYear,
				revenueMonth
			})
			setLoading(false)

			if (error) {
				console.error(error)
				toast.error(error.message || 'Không tải được dữ liệu tổng quan')
				return
			}
			setOverview(data)
		}

		run()
	}, [month, year, revenueMode, revenueMonth, revenueYear])

	const recentColumns = useMemo(() => {
		return [
			{
				title: 'Khách hàng',
				key: 'customer',
				ellipsis: true,
				render: (_, b) => b?.customer_name || '(Chưa có tên)'
			},
			{
				title: 'Thời gian',
				key: 'time',
				width: 150,
				ellipsis: true,
				render: (_, b) => formatDateTime(b)
			},
			{
				title: 'Trạng thái',
				key: 'status',
				width: 120,
				render: (_, b) => statusTag(b?.status)
			}
		]
	}, [])

	const recentRows = useMemo(() => {
		const list = Array.isArray(overview?.recentBookings) ? overview.recentBookings : []
		return list.slice(0, 5)
	}, [overview])

	return (
		<div className="cv-container">
			<Space direction="vertical" size={18} className="cv-dashboard">

				{/* Layout: 2 columns (8-4). Typography-led, white cards, minimal decoration. */}
				<section className="cv-dashboardGrid">
					<div className="cv-dashboardCol cv-dashboardCol--main">
						{/* Left / Row 1: KPI block (2x2) */}
						<section className="cv-dashboardSection">
							<DashboardKpiCards data={overview?.kpis} loading={loading} />
						</section>

						{/* Left / Row 2: Area chart with subtle gradient */}
						<section className="cv-dashboardSection">
							<MonthlyRevenueAreaChart
								data={overview?.revenueSeries || []}
								loading={loading}
								mode={revenueMode}
								year={revenueYear}
								month={revenueMonth}
								onModeChange={setRevenueMode}
								onYearChange={setRevenueYear}
								onMonthChange={setRevenueMonth}
							/>
						</section>
					</div>

					<div className="cv-dashboardCol cv-dashboardCol--side">
						{/* Right / Row 1: Top packages (slightly featured) */}
						<section className="cv-dashboardSection">
							<TopPackagesDonutChart data={overview?.topPackages || []} loading={loading} />
						</section>

						{/* Right / Row 2: Recent orders (max 5-10) */}
						<section className="cv-dashboardSection">
							<Card title="Đơn gần đây" loading={loading} className="cv-dashboardCard cv-dashboardCard--solid" bordered={false}>
								<div className="cv-dashboardRecentDesktop">
									<Table
										rowKey={(r) => r.id}
										columns={recentColumns}
										dataSource={recentRows}
										pagination={false}
										size="small"
										tableLayout="fixed"
										className="cv-dashboardRecentTable"
										locale={{
											emptyText: loading
												? 'Đang tải…'
												: (
													<div className="cv-emptyState cv-emptyState--compact">
														<span className="material-symbols-rounded cv-emptyStateIcon" aria-hidden>
															receipt_long
														</span>
														<div className="cv-emptyStateTitle">Chưa có đơn gần đây</div>
														<div className="cv-emptyStateHint">Khi có booking mới, danh sách sẽ hiện ở đây.</div>
													</div>
												)
										}}
									/>
								</div>
								<div className="cv-dashboardRecentMobile">
									{recentRows.length ? (
										<div className="cv-recentCards">
											{recentRows.map((b) => (
												<div key={b.id} className="cv-recentCard">
													<div className="cv-recentCardRow">
														<span className="cv-recentCardLabel">Khách hàng</span>
														<span className="cv-recentCardValue">{b?.customer_name || '(Chưa có tên)'}</span>
													</div>
													<div className="cv-recentCardRow">
														<span className="cv-recentCardLabel">Thời gian</span>
														<span className="cv-recentCardValue">{formatDateTime(b)}</span>
													</div>
													<div className="cv-recentCardRow">
														<span className="cv-recentCardLabel">Trạng thái</span>
														{statusTag(b?.status)}
													</div>
												</div>
											))}
										</div>
									) : (
										loading ? (
											<div className="cv-recentEmpty">Đang tải…</div>
										) : (
											<div className="cv-emptyState cv-emptyState--compact">
												<span className="material-symbols-rounded cv-emptyStateIcon" aria-hidden>
													receipt_long
												</span>
												<div className="cv-emptyStateTitle">Chưa có đơn gần đây</div>
												<div className="cv-emptyStateHint">Khi có booking mới, danh sách sẽ hiện ở đây.</div>
											</div>
										)
									)}
								</div>
							</Card>
						</section>
					</div>
				</section>
			</Space>
		</div>
	)
}
