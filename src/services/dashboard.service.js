import { supabase } from '../lib/supabase'

const pad2 = (n) => String(n).padStart(2, '0')

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

const getMonthRange = (month, year) => {
  const monthNumber = Number(month)
  const yearNumber = Number(year)

  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error('month phải là số nguyên từ 1 đến 12')
  }
  if (!Number.isInteger(yearNumber) || yearNumber < 1900) {
    throw new Error('year không hợp lệ')
  }

  const from = `${yearNumber}-${pad2(monthNumber)}-01`

  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
  const nextYear = monthNumber === 12 ? yearNumber + 1 : yearNumber
  const toExclusive = `${nextYear}-${pad2(nextMonth)}-01`

  return { from, toExclusive }
}

/**
 * Fetch bookings trong tháng và tính metrics ở frontend.
 *
 * @param {number} month - 1..12
 * @param {number} year
 * @returns {Promise<{data: {
 *  totalRevenue: number,
 *  totalPaid: number,
 *  totalRemaining: number,
 *  totalBookings: number,
 *  completedCount: number,
 *  scheduledCount: number,
 *  cancelledCount: number
 * } | null, error: any}>}
 */
export const getMonthlyDashboardData = async (month, year) => {
  let range
  try {
    range = getMonthRange(month, year)
  } catch (error) {
    return { data: null, error }
  }

  const fromIso = `${range.from}T00:00:00`
  const toExclusiveIso = `${range.toExclusive}T00:00:00`

  const [{ data: invoices, error: invError }, { data: bookings, error: bookingError }] = await Promise.all([
    supabase
      .from('invoices')
      .select('total_amount, deposit, status, created_at')
      .gte('created_at', fromIso)
      .lt('created_at', toExclusiveIso),
    supabase
      .from('bookings')
      .select('status, start_datetime')
      .gte('start_datetime', fromIso)
      .lt('start_datetime', toExclusiveIso)
  ])

  const anyError = invError || bookingError
  if (anyError) return { data: null, error: anyError }

  const invoiceList = Array.isArray(invoices) ? invoices : []
  const bookingList = Array.isArray(bookings) ? bookings : []

  const financials = invoiceList.reduce(
    (acc, inv) => {
      const status = inv?.status
      const total = toNumber(inv?.total_amount)
      const deposit = toNumber(inv?.deposit)

      const isPaidLike = status === 'paid' || status === 'completed'

      if (isPaidLike) {
        acc.totalRevenue += total
      }

      // Optional helpers for existing UI cards.
      if (status !== 'canceled') {
        if (isPaidLike) {
          acc.totalPaid += total
          acc.totalRemaining += 0
        } else {
          acc.totalPaid += deposit
          acc.totalRemaining += total - deposit
        }
      }

      return acc
    },
    { totalRevenue: 0, totalPaid: 0, totalRemaining: 0 }
  )

  const counts = bookingList.reduce(
    (acc, b) => {
      const status = b?.status
      acc.totalBookings += 1
      if (status === 'completed') acc.completedCount += 1
      else if (status === 'canceled') acc.cancelledCount += 1
      else acc.scheduledCount += 1 // scheduled + in_progress
      return acc
    },
    {
      totalBookings: 0,
      completedCount: 0,
      scheduledCount: 0,
      cancelledCount: 0
    }
  )

  return {
    data: {
      ...financials,
      ...counts
    },
    error: null
  }
}

const pctChange = (current, previous) => {
  const c = toNumber(current)
  const p = toNumber(previous)
  if (p === 0) return c === 0 ? 0 : 100
  return ((c - p) / Math.abs(p)) * 100
}

const sumPaidRevenue = (invoiceList) => {
  const list = Array.isArray(invoiceList) ? invoiceList : []
  return list.reduce((acc, inv) => {
    const status = inv?.status
    if (!(status === 'paid' || status === 'completed')) return acc
    return acc + toNumber(inv?.total_amount)
  }, 0)
}

const sumRemaining = (invoiceList) => {
  const list = Array.isArray(invoiceList) ? invoiceList : []
  return list.reduce((acc, inv) => {
    const status = inv?.status
    if (status === 'canceled') return acc
    if (status === 'paid' || status === 'completed') return acc
    return acc + (toNumber(inv?.total_amount) - toNumber(inv?.deposit))
  }, 0)
}

const buildMonthDays = (month, year) => {
  const m = Number(month)
  const y = Number(year)
  const daysInMonth = new Date(y, m, 0).getDate()
  return Array.from({ length: daysInMonth }).map((_, idx) => {
    const d = idx + 1
    return `${y}-${pad2(m)}-${pad2(d)}`
  })
}

/**
 * Dashboard overview tailored to the new layout.
 * - Row1 KPIs + rates
 * - Row2 charts (monthly revenue + top packages)
 * - Row3 recent bookings table
 */
const buildYearMonths = (year) => {
  const y = Number(year)
  return Array.from({ length: 12 }).map((_, idx) => {
    const m = idx + 1
    return { key: `${y}-${pad2(m)}`, label: `T${m}` }
  })
}

const buildMonthDaysLabeled = (month, year) => {
  const days = buildMonthDays(month, year)
  return days.map((d) => ({ key: d, label: d.slice(8, 10) }))
}

const fetchAllInvoicesForPackageTotals = async () => {
  const pageSize = 1000
  let from = 0
  const acc = []

  // NOTE: We paginate to satisfy "tổng toàn bộ" as accurately as possible.
  // This can be heavy if the table is very large.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, status, total_amount, package_id, packages:package_id ( name )')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) return { data: null, error }

    const list = Array.isArray(data) ? data : []
    acc.push(...list)

    if (list.length < pageSize) break
    from += pageSize
  }

  return { data: acc, error: null }
}

export const getDashboardOverview = async (month, year, revenueOptions = {}) => {
  let range
  try {
    range = getMonthRange(month, year)
  } catch (error) {
    return { data: null, error }
  }

  const fromIso = `${range.from}T00:00:00`
  const toExclusiveIso = `${range.toExclusive}T00:00:00`

  const now = new Date()
  const todayIso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  const todayStart = `${todayIso}T00:00:00`
  const todayEnd = `${todayIso}T23:59:59.999`

  // Week ranges (current 7 days vs previous 7 days) by created_at/start_datetime.
  const nowDate = new Date(`${todayIso}T00:00:00`)
  const startCurrWeek = new Date(nowDate)
  startCurrWeek.setDate(startCurrWeek.getDate() - 6)
  const startPrevWeek = new Date(nowDate)
  startPrevWeek.setDate(startPrevWeek.getDate() - 13)
  const endPrevWeek = new Date(nowDate)
  endPrevWeek.setDate(endPrevWeek.getDate() - 7)

  const toIsoStart = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T00:00:00`
  const toIsoEnd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T23:59:59.999`

  const currWeekFrom = toIsoStart(startCurrWeek)
  const currWeekTo = todayEnd
  const prevWeekFrom = toIsoStart(startPrevWeek)
  const prevWeekTo = toIsoEnd(endPrevWeek)

  // Previous month (for MoM comparisons)
  const m = Number(month)
  const y = Number(year)
  const prevMonth = m === 1 ? 12 : m - 1
  const prevYear = m === 1 ? y - 1 : y
  const prevRange = getMonthRange(prevMonth, prevYear)
  const prevFromIso = `${prevRange.from}T00:00:00`
  const prevToExclusiveIso = `${prevRange.toExclusive}T00:00:00`

  const revenueMode = revenueOptions?.revenueMode === 'month' ? 'month' : 'year'
  const revenueYear = Number.isInteger(Number(revenueOptions?.revenueYear)) ? Number(revenueOptions.revenueYear) : Number(year)
  const revenueMonth = Number.isInteger(Number(revenueOptions?.revenueMonth)) ? Number(revenueOptions.revenueMonth) : Number(month)

  const revenueRange = revenueMode === 'month'
    ? getMonthRange(revenueMonth, revenueYear)
    : { from: `${revenueYear}-01-01`, toExclusive: `${revenueYear + 1}-01-01` }
  const revenueFromIso = `${revenueRange.from}T00:00:00`
  const revenueToExclusiveIso = `${revenueRange.toExclusive}T00:00:00`

  const [{ data: invoicesMonth, error: invMonthErr },
    { data: invoicesPrevMonth, error: invPrevErr },
    { data: invoicesCurrWeek, error: invWeekErr },
    { data: invoicesPrevWeek, error: invPrevWeekErr },
    { data: bookingsMonth, error: bookingMonthErr },
    { data: bookingsPrevMonth, error: bookingPrevMonthErr },
    { data: bookingsCurrWeek, error: bookingWeekErr },
    { data: bookingsPrevWeek, error: bookingPrevWeekErr },
    { data: bookingsRecent, error: bookingRecentErr },
    { data: invoicesRevenue, error: invRevenueErr },
    { data: allInvoicesForPackages, error: invAllErr }]
    = await Promise.all([
      supabase
        .from('invoices')
        .select('created_at, status, total_amount, deposit')
        .gte('created_at', fromIso)
        .lt('created_at', toExclusiveIso),
      supabase
        .from('invoices')
        .select('created_at, status, total_amount, deposit')
        .gte('created_at', prevFromIso)
        .lt('created_at', prevToExclusiveIso),
      supabase
        .from('invoices')
        .select('created_at, status, total_amount')
        .gte('created_at', currWeekFrom)
        .lte('created_at', currWeekTo),
      supabase
        .from('invoices')
        .select('created_at, status, total_amount')
        .gte('created_at', prevWeekFrom)
        .lte('created_at', prevWeekTo),
      supabase
        .from('bookings')
        .select('id, package_id, status, start_datetime, packages:package_id ( name )')
        .gte('start_datetime', fromIso)
        .lt('start_datetime', toExclusiveIso),
      supabase
        .from('bookings')
        .select('id, status, start_datetime')
        .gte('start_datetime', prevFromIso)
        .lt('start_datetime', prevToExclusiveIso),
      supabase
        .from('bookings')
        .select('id, status, start_datetime')
        .gte('start_datetime', currWeekFrom)
        .lte('start_datetime', currWeekTo),
      supabase
        .from('bookings')
        .select('id, status, start_datetime')
        .gte('start_datetime', prevWeekFrom)
        .lte('start_datetime', prevWeekTo),
      supabase
        .from('bookings')
        .select('id, customer_name, status, start_datetime, packages:package_id ( name )')
        .lte('start_datetime', todayEnd)
        .order('start_datetime', { ascending: false })
        .limit(10)
      ,
      supabase
        .from('invoices')
        .select('created_at, status, total_amount')
        .gte('created_at', revenueFromIso)
        .lt('created_at', revenueToExclusiveIso),
      fetchAllInvoicesForPackageTotals()
    ])

  const anyError = invMonthErr
    || invPrevErr
    || invWeekErr
    || invPrevWeekErr
    || bookingMonthErr
    || bookingPrevMonthErr
    || bookingWeekErr
    || bookingPrevWeekErr
    || bookingRecentErr
    || invRevenueErr
    || invAllErr
  if (anyError) return { data: null, error: anyError }

  const monthRevenue = sumPaidRevenue(invoicesMonth)
  const prevMonthRevenue = sumPaidRevenue(invoicesPrevMonth)
  const monthRemaining = sumRemaining(invoicesMonth)
  const prevMonthRemaining = sumRemaining(invoicesPrevMonth)

  const weekRevenue = sumPaidRevenue(invoicesCurrWeek)
  const prevWeekRevenue = sumPaidRevenue(invoicesPrevWeek)

  const monthBookingsCount = (Array.isArray(bookingsMonth) ? bookingsMonth : []).filter((b) => b?.status !== 'canceled').length
  const prevMonthBookingsCount = (Array.isArray(bookingsPrevMonth) ? bookingsPrevMonth : []).filter((b) => b?.status !== 'canceled').length
  const weekBookingsCount = (Array.isArray(bookingsCurrWeek) ? bookingsCurrWeek : []).filter((b) => b?.status !== 'canceled').length
  const prevWeekBookingsCount = (Array.isArray(bookingsPrevWeek) ? bookingsPrevWeek : []).filter((b) => b?.status !== 'canceled').length
  const recentBookings = Array.isArray(bookingsRecent) ? bookingsRecent : []

  // Top packages (ALL TIME by total invoice amount, excluding canceled)
  const packageTotals = new Map()
  for (const inv of (Array.isArray(allInvoicesForPackages) ? allInvoicesForPackages : [])) {
    if (inv?.status === 'canceled') continue
    const name = inv?.packages?.name || 'Khác'
    packageTotals.set(name, (packageTotals.get(name) || 0) + toNumber(inv?.total_amount))
  }
  const topPackages = Array.from(packageTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({ name, total }))

  // Revenue series for chart (month or year)
  const revenueList = Array.isArray(invoicesRevenue) ? invoicesRevenue : []
  const paidLike = (s) => s === 'paid' || s === 'completed'

  let revenueSeries = []
  if (revenueMode === 'month') {
    const keys = buildMonthDaysLabeled(revenueMonth, revenueYear)
    const map = new Map(keys.map((d) => [d.key, 0]))
    for (const inv of revenueList) {
      if (!paidLike(inv?.status)) continue
      const date = String(inv?.created_at || '').slice(0, 10)
      if (!map.has(date)) continue
      map.set(date, map.get(date) + toNumber(inv?.total_amount))
    }
    revenueSeries = keys.map((d) => ({ label: d.label, value: map.get(d.key) || 0 }))
  } else {
    const months = buildYearMonths(revenueYear)
    const map = new Map(months.map((m) => [m.key, 0]))
    for (const inv of revenueList) {
      if (!paidLike(inv?.status)) continue
      const date = String(inv?.created_at || '').slice(0, 10)
      const key = date.slice(0, 7) // YYYY-MM
      if (!map.has(key)) continue
      map.set(key, map.get(key) + toNumber(inv?.total_amount))
    }
    revenueSeries = months.map((m) => ({ label: m.label, value: map.get(m.key) || 0 }))
  }

  return {
    data: {
      kpis: {
        totalRevenue: weekRevenue,
        totalRevenueMonth: monthRevenue,
        totalRemainingMonth: monthRemaining,
        totalOrders: monthBookingsCount,
        rateTotalRevenue: pctChange(weekRevenue, prevWeekRevenue),
        rateTotalRevenueMonth: pctChange(monthRevenue, prevMonthRevenue),
        rateRemainingMonth: pctChange(monthRemaining, prevMonthRemaining),
        rateOrders: pctChange(monthBookingsCount, prevMonthBookingsCount)
      },
      revenueSeries,
      topPackages,
      recentBookings
    },
    error: null
  }
}
