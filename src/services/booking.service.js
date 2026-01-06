import { supabase } from '../lib/supabase'

const TABLE = 'bookings'

const BOOKING_SELECT = `
  id,
  customer_name,
  customer_phone,
  start_datetime,
  end_datetime,
  package_id,
  location,
  people_count,
  status,
  note,
  created_at,
  updated_at,
  packages:package_id ( id, name, price, has_makeup, is_active )
`

/**
 * =========================
 * GET
 * =========================
 */

// Lấy tất cả booking (dùng cho calendar)
export const getBookings = async () => {
  return await supabase
    .from(TABLE)
    .select(BOOKING_SELECT)
    .order('start_datetime', { ascending: true })
}

// Lấy booking theo khoảng ngày (dashboard / upcoming)
// from/to: YYYY-MM-DD
export const getBookingsByDateRange = async (from, to) => {
  const fromIso = `${from}T00:00:00`
  const toIso = `${to}T23:59:59.999`

  return await supabase
    .from(TABLE)
    .select(BOOKING_SELECT)
    .gte('start_datetime', fromIso)
    .lte('start_datetime', toIso)
    .neq('status', 'canceled')
    .order('start_datetime', { ascending: true })
}

// Lấy booking theo ID
export const getBookingById = async (id) => {
  return await supabase
    .from(TABLE)
    .select(BOOKING_SELECT)
    .eq('id', id)
    .single()
}

/**
 * =========================
 * CREATE
 * =========================
 */

// Tạo booking mới
// NOTE: invoices sẽ được tạo tự động qua trigger phía Supabase.
export const createBooking = async (payload) => {
  const {
    customer_name,
    customer_phone,
    start_datetime,
    end_datetime,
    package_id,
    location,
    people_count = 1,
    note
  } = payload

  return await supabase
    .from(TABLE)
    .insert([
      {
        customer_name,
        customer_phone,
        start_datetime,
        end_datetime,
        package_id,
        location,
        people_count,
        note,
        status: 'scheduled'
      }
    ])
    .select(BOOKING_SELECT)
    .single()
}

/**
 * =========================
 * UPDATE
 * =========================
 */

export const updateBooking = async (id, payload) => {
  return await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select(BOOKING_SELECT)
    .single()
}

export const setBookingStatus = async (id, status) => {
  return await supabase
    .from(TABLE)
    .update({ status })
    .eq('id', id)
    .select(BOOKING_SELECT)
    .single()
}
