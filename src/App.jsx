import { Avatar, Button, Drawer, Layout, Tooltip } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardPage from './pages/Dashboard'
import CalendarPage from './pages/Calendar'
import PackagesPage from './pages/Packages'
import InvoicePage from './pages/Invoice'
import logoUrl from './assets/logo.png'
import './App.css'

const { Header, Content } = Layout

const Icon = ({ name }) => (
  <span className="material-symbols-rounded cv-icon" aria-hidden="true">
    {name}
  </span>
)

export default function App() {
  const [activeKey, setActiveKey] = useState('dashboard')
  const [invoiceBookingId, setInvoiceBookingId] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
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

  const openInvoice = useCallback((bookingId) => {
    if (!bookingId) return
    setInvoiceBookingId(bookingId)
    setActiveKey('invoice')
  }, [])

  const navItems = useMemo(
    () => [
      { key: 'dashboard', label: 'Tổng quan', icon: <Icon name="grid_view" /> },
      { key: 'calendar', label: 'Lịch', icon: <Icon name="calendar_month" /> },
      { key: 'packages', label: 'Gói dịch vụ', icon: <Icon name="inventory_2" /> },
      { key: 'invoice', label: 'Hoá đơn', icon: <Icon name="table_view" /> }
    ],
    []
  )

  const content = useMemo(() => {
    if (activeKey === 'invoice') {
      return (
        <InvoicePage
          bookingId={invoiceBookingId}
        />
      )
    }
    if (activeKey === 'calendar') return <CalendarPage onOpenInvoice={openInvoice} />
    if (activeKey === 'packages') return <PackagesPage />
    return <DashboardPage />
  }, [activeKey, invoiceBookingId, openInvoice])

  const goTo = useCallback((key) => {
    if (!key) return
    if (key === 'invoice') setInvoiceBookingId(null)
    setActiveKey(key)
    setMobileNavOpen(false)
  }, [])

  return (
    <div className="cv-shell">
      <div className="cv-frame">
        <Layout className="cv-layout">
          <Header className={isMobile ? 'cv-navbar cv-navbar--mobile' : 'cv-navbar'}>
            {isMobile ? (
              <>
                <Button
                  className="cv-iconBtn"
                  type="text"
                  aria-label="Mở menu"
                  onClick={() => setMobileNavOpen(true)}
                  icon={<Icon name="menu" />}
                />

                <Avatar className="cv-avatar" size={34} style={{ background: 'var(--cv-primary)' }}>
                  CV
                </Avatar>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="cv-navbarBrand"
                  onClick={() => goTo('dashboard')}
                  aria-label="Về trang tổng quan"
                >
                  <img src={logoUrl} alt="CookieVibe" className="cv-navbarLogo" />
                </button>

                <div className="cv-navCenter" role="navigation" aria-label="Điều hướng chính">
                  <div className="cv-navPills">
                    {navItems.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={activeKey === item.key ? 'cv-navPill cv-navPill--active' : 'cv-navPill'}
                        onClick={() => goTo(item.key)}
                      >
                        {item.icon}
                        <span className="cv-navLabel">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cv-navActions" aria-label="Công cụ">
                  <Tooltip title="Tìm kiếm">
                    <Button
                      className="cv-iconBtn"
                      type="text"
                      aria-label="Tìm kiếm"
                      icon={<Icon name="search" />}
                    />
                  </Tooltip>

                  <Tooltip title="Thông báo">
                    <Button
                      className="cv-iconBtn"
                      type="text"
                      aria-label="Thông báo"
                      icon={<Icon name="notifications" />}
                    />
                  </Tooltip>

                  <Avatar className="cv-avatar" size={32} style={{ background: 'var(--cv-primary)' }}>
                    CV
                  </Avatar>
                </div>
              </>
            )}
          </Header>

          <Drawer
            open={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            placement="left"
            width={300}
            closable={false}
            className="cv-mobileDrawer"
          >
            <div className="cv-mobileDrawerHeader">
              <div className="cv-mobileDrawerBrand">
                <img src={logoUrl} alt="CookieVibe" className="cv-mobileDrawerLogo" />
              </div>
              <Button
                type="text"
                aria-label="Đóng menu"
                className="cv-mobileDrawerClose"
                onClick={() => setMobileNavOpen(false)}
                icon={<Icon name="close" />}
              />
            </div>

            <nav className="cv-mobileDrawerNav" aria-label="Điều hướng">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={activeKey === item.key ? 'cv-mobileNavItem cv-mobileNavItem--active' : 'cv-mobileNavItem'}
                  onClick={() => goTo(item.key)}
                >
                  <span className="cv-mobileNavIcon" aria-hidden="true">{item.icon}</span>
                  <span className="cv-mobileNavLabel">{item.label}</span>
                </button>
              ))}
            </nav>
          </Drawer>

          <Content className="cv-content">{content}</Content>
        </Layout>
      </div>
    </div>
  )
}
