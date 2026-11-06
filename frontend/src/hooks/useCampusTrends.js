import { useCallback, useEffect, useRef, useState } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import {
  CAMPUS_TRENDS_EVENT, getChart, getMyState, listCampuses, onboardingStep, setMyCampus, setParticipation,
} from '../lib/music/CampusTrends'

/**
 * hooks/useCampusTrends.js
 *
 * Everything the Campus tab needs: the student's own state (campus, participation),
 * which onboarding step to show, and the latest published chart.
 *
 *   const ct = useCampusTrends(userId)
 *   ct.step        'campus' | 'consent' | 'reconsent' | null
 *   ct.chart       the published chart (see lib/music/CampusTrends.js), or null
 *   ct.chooseCampus(id) / ct.setContribute(true|false)   -> { ok, error? }
 *
 * Nothing here touches playback, and a failure here only affects this tab.
 */
export function useCampusTrends(userId, { enabled = true } = {}) {
  const online = useOnlineStatus()
  const [state, setState] = useState(null)
  const [stateLoading, setStateLoading] = useState(Boolean(userId && enabled))
  const [stateError, setStateError] = useState(null)
  const [chart, setChart] = useState(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState(null)
  const [campuses, setCampuses] = useState([])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  const alive = useRef(true)
  const stateSeq = useRef(0) // a slow, outdated answer must never overwrite a newer one
  const chartSeq = useRef(0)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  // a different signed-in user must never see the previous user's data
  useEffect(() => { setState(null); setChart(null); setCampuses([]) }, [userId])

  const loadState = useCallback(async () => {
    if (!userId || !enabled) return
    const seq = ++stateSeq.current
    setStateLoading(true)
    setStateError(null)
    try {
      const s = await getMyState()
      if (!alive.current || seq !== stateSeq.current) return
      setState(s)
    } catch (e) {
      if (!alive.current || seq !== stateSeq.current) return
      setStateError(e?.message || 'Something went wrong. Please try again.')
    } finally {
      if (alive.current && seq === stateSeq.current) setStateLoading(false)
    }
  }, [userId, enabled])

  const loadChart = useCallback(async (force = false) => {
    if (!userId || !enabled) return
    const seq = ++chartSeq.current
    setChartLoading(true)
    setChartError(null)
    try {
      const c = await getChart(userId, { force })
      if (!alive.current || seq !== chartSeq.current) return
      setChart(c)
    } catch (e) {
      if (!alive.current || seq !== chartSeq.current) return
      setChartError(e?.message || 'Something went wrong. Please try again.')
    } finally {
      if (alive.current && seq === chartSeq.current) setChartLoading(false)
    }
  }, [userId, enabled])

  const loadCampuses = useCallback(async () => {
    try {
      const list = await listCampuses()
      if (alive.current) setCampuses(list)
    } catch (e) {
      if (alive.current) setActionError(e?.message || 'Something went wrong. Please try again.')
    }
  }, [])

  // own state, on mount and whenever any screen changes the campus or participation
  useEffect(() => { loadState() }, [loadState])
  useEffect(() => {
    const onChange = () => { loadState() }
    window.addEventListener(CAMPUS_TRENDS_EVENT, onChange)
    return () => window.removeEventListener(CAMPUS_TRENDS_EVENT, onChange)
  }, [loadState])

  // the chart depends only on which campus the student is in (it changes once a week)
  const campusId = state?.campus?.id || null
  useEffect(() => {
    if (!enabled || !userId) return
    if (!campusId) { setChart(null); setChartError(null); return }
    loadChart()
  }, [campusId, enabled, userId, loadChart])

  const step = state ? onboardingStep(state) : null
  useEffect(() => {
    if (step === 'campus' && campuses.length === 0) loadCampuses()
  }, [step, campuses.length, loadCampuses])

  // when the connection comes back, retry whatever failed (or replace a saved copy of the chart)
  useEffect(() => {
    if (!online || !enabled || !userId) return
    if (stateError) loadState()
    if (campusId && (chartError || chart?.fromCache)) loadChart(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  const run = useCallback(async (fn) => {
    setBusy(true)
    setActionError(null)
    try {
      const out = await fn()
      return { ok: true, ...(out && typeof out === 'object' ? out : {}) }
    } catch (e) {
      const error = e?.message || 'Something went wrong. Please try again.'
      if (alive.current) setActionError(error)
      return { ok: false, error }
    } finally {
      if (alive.current) setBusy(false)
    }
  }, [])

  // the service announces success, which reloads our state (and, for a new campus, the chart)
  const chooseCampus = useCallback((campusId) => run(() => setMyCampus(campusId)), [run])
  const setContribute = useCallback((on) => run(() => setParticipation(on)), [run])
  const refresh = useCallback(() => { loadState(); if (campusId) loadChart(true) }, [loadState, loadChart, campusId])

  return {
    ready: Boolean(state),
    loading: stateLoading && !state,
    error: state ? null : stateError,
    state,
    step,                                          // which onboarding screen to show, or null
    campus: state?.campus || null,
    pendingCampus: state?.pending || null,         // a campus change that starts next Monday
    participating: Boolean(state?.preference?.enabled),
    declined: Boolean(state?.preference && !state.preference.enabled),
    campuses,
    chart,
    chartLoading,
    chartError,
    busy,
    actionError,
    clearActionError: () => setActionError(null),
    chooseCampus,
    setContribute,
    loadCampuses,                                  // for a "change campus" picker outside onboarding
    refresh,
  }
}
