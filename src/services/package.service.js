import { supabase } from '../lib/supabase'

const TABLE = 'packages'

export const getPackages = async () => {
  return await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
}

export const createPackage = async (payload) => {
  return await supabase
    .from(TABLE)
    .insert([payload])
    .select('*')
    .single()
}

export const updatePackage = async (id, payload) => {
  return await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
}

export const deletePackage = async (id) => {
  return await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
}
