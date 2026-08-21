import { supabase } from './supabase'

const DAY_MS = 24 * 60 * 60 * 1000

export function getCycleInfo(settings) {
  if (!settings || !settings.last_period_start) return null

  const cycleLength = settings.average_cycle_length || 28
  const periodLength = settings.average_period_length || 5

  const lastStart = new Date(settings.last_period_start + 'T00:00:00')
  const today = new Date()
  lastStart.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((today - lastStart) / DAY_MS)
  const dayOfCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength + 1

  // NOTE: lowercase keys — must match PHASE_INFO's keys in CycleDashboard,
  // or PHASE_INFO[phase] comes back undefined and .label throws.
  const ovulationDay = cycleLength - 14
  const ovulationWindowStart = Math.max(1, ovulationDay - 2)
  const ovulationWindowEnd = ovulationDay + 1

  let phase = 'follicular'
  if (dayOfCycle <= periodLength) phase = 'menstrual'
  else if (dayOfCycle >= ovulationWindowStart && dayOfCycle <= ovulationWindowEnd) phase = 'ovulation'
  else if (dayOfCycle > ovulationWindowEnd) phase = 'luteal'

  const daysUntilNextPeriod = cycleLength - dayOfCycle + 1
  const nextPeriodDate = new Date(today.getTime() + daysUntilNextPeriod * DAY_MS) // real Date object, not a string

  const confidence = diffDays < cycleLength * 2 ? 'low' : 'estimated'

  return {
    dayOfCycle,
    phase,
    daysUntilNextPeriod,
    nextPeriodDate,
    cycleLength,
    periodLength,
    confidence,
    progressFraction: (dayOfCycle - 1) / cycleLength, // needed by CycleRing
  }
}

/**
 * Real average/min/max from recorded period start dates — matches the
 * { average, min, max, samples } shape CycleDashboard's stats card expects.
 */
export async function getCycleStats(userId) {
  const records = await listPeriodRecords(userId, 12)
  const starts = (records || []).map(r => r.start_date).sort()
  if (starts.length < 2) return null

  const lengths = []
  for (let i = 1; i < starts.length; i++) {
    const days = Math.round((new Date(starts[i]) - new Date(starts[i - 1])) / DAY_MS)
    if (days > 10 && days < 90) lengths.push(days) // filter obvious glitches
  }
  if (lengths.length === 0) return null

  const average = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
  return { average, min: Math.min(...lengths), max: Math.max(...lengths), samples: lengths.length }
}

// ── Settings & Database Queries ─────────────────────────────

export async function getCycleSettings(userId) {
  const { data, error } = await supabase
    .from('cycle_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertCycleSettings(userId, patch) {
  const { error } = await supabase
    .from('cycle_settings')
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
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
 
export async function syncUserTimezone(userId, currentSettings) {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (!detected || detected === currentSettings?.timezone) return
  await upsertCycleSettings(userId, { timezone: detected })
}
export async function listDailyLogs(userId, { fromDate, toDate } = {}) {
  let query = supabase.from('daily_logs').select('*').eq('user_id', userId)
  if (fromDate) query = query.gte('log_date', fromDate)
  if (toDate) query = query.lte('log_date', toDate)
  const { data, error } = await query.order('log_date', { ascending: true })
  if (error) throw error
  return data || []
}
