import { supabase } from '../lib/supabase'

const TABLE = 'invoices'

const INVOICE_SELECT = `
  id,
  booking_id,
  package_id,
  base_price,
  deposit,
  discount,
  makeup_fee,
  extra_fee,
  penalty_fee,
  tip,
  total_amount,
  status,
  note,
  created_at,
  updated_at
`

const INVOICE_LIST_SELECT = `
  id,
  booking_id,
  package_id,
  total_amount,
  deposit,
  status,
  created_at,
  bookings:booking_id ( id, customer_name, customer_phone, start_datetime ),
  packages:package_id ( id, name, has_makeup )
`

/**
 * =========================
 * GET
 * =========================
 */

export const getInvoiceByBookingId = async (bookingId) => {
  return await supabase
    .from(TABLE)
    .select(INVOICE_SELECT)
    .eq('booking_id', bookingId)
    .single()
}

export const getInvoices = async () => {
  return await supabase
    .from(TABLE)
    .select(INVOICE_LIST_SELECT)
    .neq('status', 'canceled')
    .order('created_at', { ascending: false })
}

// Used by Calendar to derive booking card colors (e.g., missing makeup).
export const getInvoicesByBookingIds = async (bookingIds) => {
  const ids = (Array.isArray(bookingIds) ? bookingIds : [])
    .filter((id) => id !== null && id !== undefined)

  if (!ids.length) return { data: [], error: null }

  return await supabase
    .from(TABLE)
    .select('booking_id, makeup_fee, deposit, status')
    .in('booking_id', ids)
}

/**
 * =========================
 * CREATE
 * =========================
 */

// Normally invoices are auto-created by DB trigger when booking is created.
export const createInvoice = async (payload) => {
  return await supabase
    .from(TABLE)
    .insert([payload])
    .select(INVOICE_SELECT)
    .single()
}

/**
 * =========================
 * UPDATE
 * =========================
 */

export const updateInvoice = async (id, payload) => {
  return await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select(INVOICE_SELECT)
    .single()
}
