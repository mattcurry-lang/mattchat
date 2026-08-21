// hooks/useCycleData.js
import { useState, useEffect, useCallback } from 'react'
import { getCycleSettings, listPeriodRecords } from '../lib/cycle'
import { computeCycleInfo, computeCycleStats } from '../lib/cycleMath'

export function useCycleData(userId) {
  const [settings, setSettings] = useState(undefined) // undefined = loading, null = not onboarded
  const [periodRecords, setPeriodRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const [s, records] = await Promise.all([
        getCycleSettings(userId),
        listPeriodRecords(userId),
      ])
      setSettings(s)
      setPeriodRecords(records)
    } catch (e) {
      console.error('useCycleData reload failed:', e)
      setError(e)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { reload() }, [reload])

  const cycleInfo = settings?.last_period_start
    ? computeCycleInfo({
        lastPeriodStart: settings.last_period_start,
        averageCycleLength: settings.average_cycle_length,
        averagePeriodLength: settings.average_period_length,
      })
    : null

  const stats = computeCycleStats(periodRecords.map(r => r.start_date))

  return { settings, periodRecords, cycleInfo, stats, loading, error, reload }
}
