import { supabase } from '../lib/supabase'

const TABLE = 'notes'

const NOTE_SELECT = `
  id,
  booking_id,
  content,
  date,
  time,
  status
`

/**
 * =========================
 * GET
 * =========================
 */

export const getNotesByBookingId = async (bookingId) => {
  return await supabase
    .from(TABLE)
    .select(NOTE_SELECT)
    .eq('booking_id', bookingId)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
}

// Lấy notes theo khoảng ngày (phục vụ calendar)
// from/toExclusive: YYYY-MM-DD
export const getNotesByDateRange = async (from, toExclusive) => {
  return await supabase
    .from(TABLE)
    .select(NOTE_SELECT)
    .gte('date', from)
    .lt('date', toExclusive)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
}

/**
 * =========================
 * CREATE
 * =========================
 */

export const createNote = async (payload) => {
  return await supabase
    .from(TABLE)
    .insert([payload])
    .select(NOTE_SELECT)
    .single()
}

/**
 * =========================
 * UPDATE
 * =========================
 */

export const updateNote = async (id, payload) => {
  return await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select(NOTE_SELECT)
    .single()
}
