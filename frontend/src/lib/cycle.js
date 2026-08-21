// lib/cycle.js
import { supabase } from './supabase'

export async function getCycleSettings(userId) {
  const { data, error } = await supabase
    .from('cycle_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data // null if the user has never onboarded
}

export async function upsertCycleSettings(userId, patch) {
  const { error } = await supabase
    .from('cycle_settings')
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function completeCycleOnboarding(userId, { lastPeriodStart, averageCycleLength, averagePeriodLength }) {
  await upsertCycleSettings(userId, {
    onboarded: true,
    last_period_start: lastPeriodStart || null,
    average_cycle_length: averageCycleLength || 28,
    average_period_length: averagePeriodLength || 5,
  })
  if (lastPeriodStart) {
    await logPeriodStart(userId, lastPeriodStart)
  }
}

export async function listPeriodRecords(userId, limit = 24) {
  const { data, error } = await supabase
    .from('period_records')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function logPeriodStart(userId, startDate) {
  const { error } = await supabase
    .from('period_records')
    .insert({ user_id: userId, start_date: startDate, is_estimated: false })
  if (error) throw error
  await upsertCycleSettings(userId, { last_period_start: startDate })
}

export async function logPeriodEnd(recordId, endDate) {
  const { error } = await supabase
    .from('period_records')
    .update({ end_date: endDate })
    .eq('id', recordId)
  if (error) throw error
}

export async function setHideCycle(userId, hide) {
  await upsertCycleSettings(userId, { hide_cycle: hide })
}

// ── Daily logs ─────────────────────────────────────────────
export async function getDailyLog(userId, dateStr) {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', dateStr)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertDailyLog(userId, dateStr, patch) {
  const { error } = await supabase
    .from('daily_logs')
    .upsert(
      { user_id: userId, log_date: dateStr, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,log_date' }
    )
  if (error) throw error
}

export async function listDailyLogs(userId, { fromDate, toDate } = {}) {
  let query = supabase.from('daily_logs').select('*').eq('user_id', userId)
  if (fromDate) query = query.gte('log_date', fromDate)
  if (toDate) query = query.lte('log_date', toDate)
  const { data, error } = await query.order('log_date', { ascending: true })
  if (error) throw error
  return data || []
}
