// lib/cycleInsights.js
// Computes plain-language pattern observations from recorded history.
// Every insight here is descriptive, never diagnostic — see phrasing.

export function computeInsights({ periodRecords = [], dailyLogs = [], stats }) {
  const insights = []

  if (stats && stats.samples >= 2) {
    insights.push({
      id: 'avg_length',
      text: `Your cycles have averaged around ${stats.average} days.`,
    })
    if (stats.min !== stats.max) {
      insights.push({
        id: 'length_range',
        text: `Your recorded cycle lengths have varied between ${stats.min} and ${stats.max} days.`,
      })
    }
  }

  // Symptom-near-period-start pattern: look at logs within the first
  // 3 days of a recorded period and find the most common symptom.
  if (periodRecords.length >= 2 && dailyLogs.length >= 5) {
    const symptomCounts = {}
    let earlyPeriodLogCount = 0

    periodRecords.forEach(record => {
      const start = new Date(record.start_date + 'T00:00:00')
      dailyLogs.forEach(log => {
        const logDate = new Date(log.log_date + 'T00:00:00')
        const dayDiff = Math.round((logDate - start) / (24 * 60 * 60 * 1000))
        if (dayDiff >= 0 && dayDiff <= 2) {
          earlyPeriodLogCount++
          ;(log.symptoms || []).forEach(s => {
            symptomCounts[s] = (symptomCounts[s] || 0) + 1
          })
        }
      })
    })

    const topSymptom = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1])[0]
    if (topSymptom && topSymptom[1] >= 2 && earlyPeriodLogCount >= 3) {
      const label = topSymptom[0].replace(/_/g, ' ')
      insights.push({
        id: 'top_symptom_early',
        text: `You may be noticing ${label} around the beginning of your period, based on your recorded history.`,
      })
    }
  }

  // Mood tendency during luteal-ish window (last 5 logs before a period start)
  if (periodRecords.length >= 1 && dailyLogs.length >= 5) {
    const moodCounts = {}
    let preWindowCount = 0
    periodRecords.forEach(record => {
      const start = new Date(record.start_date + 'T00:00:00')
      dailyLogs.forEach(log => {
        const logDate = new Date(log.log_date + 'T00:00:00')
        const dayDiff = Math.round((start - logDate) / (24 * 60 * 60 * 1000))
        if (dayDiff >= 1 && dayDiff <= 5 && log.mood) {
          preWindowCount++
          moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1
        }
      })
    })
    const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]
    if (topMood && topMood[1] >= 2 && preWindowCount >= 3) {
      const label = topMood[0].replace(/_/g, ' ')
      insights.push({
        id: 'premenstrual_mood',
        text: `Your data suggests you sometimes feel ${label} in the days leading up to your period.`,
      })
    }
  }

  return insights
}
