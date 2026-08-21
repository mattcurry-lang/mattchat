import { supabase } from './supabase'
 
export function getCycleInfo(settings) {
  if (!settings || !settings.last_period_start) return null

  const cycleLength = settings.average_cycle_length || 28
  const periodLength = settings.average_period_length || 5

  const lastStart = new Date(settings.last_period_start)
  const today = new Date()

  // Clear time portions for accurate day calculations
  lastStart.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  const diffTime = today - lastStart
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // Calculate current cycle day (1-indexed)
  const dayOfCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength + 1

  // Determine current phase
  let phase = 'Follicular'
  if (dayOfCycle <= periodLength) {
    phase = 'Menstrual'
  } else if (dayOfCycle >= cycleLength - 16 && dayOfCycle <= cycleLength - 12) {
    phase = 'Ovulation'
  } else if (dayOfCycle > cycleLength - 12) {
    phase = 'Luteal'
  }

  // Calculate next period date
  const nextPeriod = new Date(lastStart)
  const cycleMultiplier = Math.floor(diffDays / cycleLength) + (diffDays >= 0 ? 1 : 0)
  nextPeriod.setDate(lastStart.getDate() + cycleMultiplier * cycleLength)

  const daysUntilNext = Math.ceil((nextPeriod - today) / (1000 * 60 * 60 * 24))

  return {
    dayOfCycle,
    phase,
    daysUntilNext,
    nextPeriodDate: nextPeriod.toISOString().split('T')[0],
    cycleLength,
    periodLength,
  }
}

/**
 * Fetch basic cycle analytics and statistics for the user
 */
export async function getCycleStats(userId) {
  const records = await listPeriodRecords(userId, 12)
  if (!records || records.length === 0) {
    return { avgCycle: 28, avgPeriod: 5, totalLogged: 0 }
  }

  return {
    avgCycle: 28,
    avgPeriod: 5,
    totalLogged: records.length,
  }
}

// ── Settings & Database Queries ─────────────────────────────

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
