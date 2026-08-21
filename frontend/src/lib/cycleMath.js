// lib/cycleMath.js
// Pure cycle-phase math. No network calls. Everything here produces
// ESTIMATES, never guarantees — see PHASE_INFO copy below.

const DAY_MS = 24 * 60 * 60 * 1000

export const PHASE_INFO = {
  menstrual: {
    label: 'Menstrual phase',
    blurb: 'Your period. Energy may be lower — rest is good if you need it.',
  },
  follicular: {
    label: 'Follicular phase',
    blurb: 'Your body may be moving toward ovulation. Some people notice increased energy during this part of their cycle.',
  },
  ovulation: {
    label: 'Ovulation (estimated)',
    blurb: 'Estimated fertile window. Some people notice a boost in energy or mood around now.',
  },
  luteal: {
    label: 'Luteal phase',
    blurb: 'The days before your next estimated period. Mood or energy shifts are common for some people here.',
  },
}

/**
 * Given cycle settings + the most recent period record, compute the
 * current position in the cycle. Returns null if there isn't enough
 * data yet (no last_period_start) — caller should show an empty state.
 */
export function computeCycleInfo({ lastPeriodStart, averageCycleLength = 28, averagePeriodLength = 5 }) {
  if (!lastPeriodStart) return null

  const start = new Date(lastPeriodStart + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysSinceStart = Math.floor((today - start) / DAY_MS)
  // dayOfCycle is 1-indexed and wraps using the average length —
  // if someone's cycle runs long/short this keeps the ring sensible
  // instead of showing "day 40".
  const cycleLength = averageCycleLength || 28
  const dayOfCycle = ((daysSinceStart % cycleLength) + cycleLength) % cycleLength + 1

  const periodLength = averagePeriodLength || 5
  const ovulationDay = cycleLength - 14 // luteal phase is consistently ~14 days
  const ovulationWindowStart = Math.max(1, ovulationDay - 2)
  const ovulationWindowEnd = ovulationDay + 1

  let phase
  if (dayOfCycle <= periodLength) phase = 'menstrual'
  else if (dayOfCycle < ovulationWindowStart) phase = 'follicular'
  else if (dayOfCycle <= ovulationWindowEnd) phase = 'ovulation'
  else phase = 'luteal'

  const daysUntilNextPeriod = cycleLength - dayOfCycle + 1
  const nextPeriodDate = new Date(today.getTime() + daysUntilNextPeriod * DAY_MS)

  // Confidence is intentionally coarse — more history = more confidence,
  // never expressed as a guarantee.
  const confidence = daysSinceStart < cycleLength * 2 ? 'low' : 'estimated'

  return {
    dayOfCycle,
    cycleLength,
    phase,
    daysUntilNextPeriod,
    nextPeriodDate,
    confidence,
    progressFraction: (dayOfCycle - 1) / cycleLength, // 0..1, for the ring
  }
}

/** Average + range from a list of period start dates (chronological). */
export function computeCycleStats(periodStartDates) {
  if (!periodStartDates || periodStartDates.length < 2) return null
  const sorted = [...periodStartDates].sort((a, b) => new Date(a) - new Date(b))
  const lengths = []
  for (let i = 1; i < sorted.length; i++) {
    const days = Math.round((new Date(sorted[i]) - new Date(sorted[i - 1])) / DAY_MS)
    if (days > 10 && days < 90) lengths.push(days) // filter obvious data-entry glitches
  }
  if (lengths.length === 0) return null
  const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
  return { average: avg, min: Math.min(...lengths), max: Math.max(...lengths), samples: lengths.length }
}
