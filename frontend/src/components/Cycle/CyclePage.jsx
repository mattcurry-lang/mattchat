import React, { useState, useEffect } from 'react'
import CycleDashboard from './CycleDashboard'
import TrustedCircle from './TrustedCircle'
import TrustedPersonDashboard from './TrustedPersonDashboard'
import CycleCalendarModal from './CycleCalendar'
import CycleCheckinModal from './CycleCheckin'
import CycleInsightsModal from './CycleInsights'
import CycleRemindersModal from './CycleReminders'
import CycleWellnessModal from './CycleWellnessModal'
import { getCycleInfo, getCycleStats, getCycleSettings, listPeriodRecords, listDailyLogs } from '../../lib/cycle'

export default function CyclePage({ userId, onClose, onOpenConversation, conversations, getConvoName, getOtherUserId }) {
  const [view, setView] = useState('dashboard')
  const [showTrusted, setShowTrusted] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showCheckin, setShowCheckin] = useState(false)
  const [checkinDate, setCheckinDate] = useState(null)
  const [showInsights, setShowInsights] = useState(false)
  const [showReminders, setShowReminders] = useState(false)
  const [settings, setSettings] = useState(null)
  const [cycleInfo, setCycleInfo] = useState(null)
  const [stats, setStats] = useState(null)
  const [periodRecords, setPeriodRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [recentDailyLogs, setRecentDailyLogs] = useState([])
  const [showWellness, setShowWellness] = useState(false)
  const [wellnessTab, setWellnessTab] = useState('foods')

  const loadData = async () => {
    try {
      const fromDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const toDate = new Date().toISOString().slice(0, 10)
      const [s, records, logs] = await Promise.all([
        getCycleSettings(userId),
        listPeriodRecords(userId),
        listDailyLogs(userId, { fromDate, toDate }),
      ])
      setSettings(s)
      setPeriodRecords(records || [])
      setRecentDailyLogs(logs || [])
      if (s?.last_period_start) {
        setCycleInfo(getCycleInfo(s))
        setStats(await getCycleStats(userId))
      } else {
        setCycleInfo(null)
        setStats(null)
      }
    } catch (e) {
      console.error('Error loading cycle data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [userId])

  const openDay = (dateStr) => {
    setCheckinDate(dateStr)
    setShowCheckin(true)
  }

  const openTodayCheckin = () => {
    setCheckinDate(new Date().toISOString().slice(0, 10))
    setShowCheckin(true)
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 650, background: '#14121f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13 }}>
        Loading Cycle Care…
      </div>
    )
  }

  return (
    <>
      {view === 'dashboard' && (
        <CycleDashboard
          userId={userId}
          settings={settings}
          cycleInfo={cycleInfo}
          stats={stats}
          recentDailyLogs={recentDailyLogs}
          onReload={loadData}
          onOpenCalendar={() => setShowCalendar(true)}
          onOpenCheckin={openTodayCheckin}
          onOpenInsights={() => setShowInsights(true)}
          onOpenReminders={() => setShowReminders(true)}
          onOpenTrustedCircle={() => setShowTrusted(true)}
          onOpenTrustedDashboard={() => setView('trusted_dashboard')}
          onOpenWellness={(tab) => { setWellnessTab(tab); setShowWellness(true) }}
          onClose={onClose}
        />
      )}

      {view === 'trusted_dashboard' && (
        <TrustedPersonDashboard
          onOpenConversation={onOpenConversation}
          onClose={() => setView('dashboard')}
        />
      )}

      {showTrusted && (
        <TrustedCircle
          userId={userId}
          conversations={conversations}
          getConvoName={getConvoName}
          getOtherUserId={getOtherUserId}
          onClose={() => setShowTrusted(false)}
          onOpenConversation={onOpenConversation}
        />
      )}

      {showWellness && cycleInfo && (
        <CycleWellnessModal
          phase={cycleInfo.phase}
          initialTab={wellnessTab}
          onClose={() => setShowWellness(false)}
        />
      )}

      {showCalendar && (
        <CycleCalendarModal
          userId={userId}
          settings={settings}
          periodRecords={periodRecords}
          cycleInfo={cycleInfo}
          onOpenDay={(dateStr) => { setShowCalendar(false); openDay(dateStr) }}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {showCheckin && (
        <CycleCheckinModal
          userId={userId}
          dateStr={checkinDate || new Date().toISOString().slice(0, 10)}
          onSaved={loadData}
          onClose={() => { setShowCheckin(false); setCheckinDate(null) }}
        />
      )}

      {showInsights && (
        <CycleInsightsModal
          userId={userId}
          periodRecords={periodRecords}
          stats={stats}
          onClose={() => setShowInsights(false)}
        />
      )}

      {showReminders && (
        <CycleRemindersModal
          userId={userId}
          settings={settings}
          onSaved={loadData}
          onClose={() => setShowReminders(false)}
        />
      )}
    </>
  )
}
