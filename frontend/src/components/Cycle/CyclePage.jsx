import React, { useState, useEffect } from 'react'
import CycleDashboard from './CycleDashboard'
import TrustedCircle from './TrustedCircle'
import TrustedPersonDashboard from './TrustedPersonDashboard'
import CycleCalendarModal from './CycleCalendar'
import CycleCheckinModal from './CycleCheckin'
import CycleInsightsModal from './CycleInsights'
import CycleRemindersModal from './CycleReminders'

import { getCycleInfo, getCycleStats } from '../../lib/cycle'
import { getCycleSettings } from '../../lib/cycleTrust'

export default function CyclePage({ userId, onClose, onOpenConversation }) {
  const [view, setView] = useState('dashboard') // 'dashboard' | 'trusted_dashboard'
  const [showTrusted, setShowTrusted] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showCheckin, setShowCheckin] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [showReminders, setShowReminders] = useState(false)

  const [settings, setSettings] = useState(null)
  const [cycleInfo, setCycleInfo] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const s = await getCycleSettings(userId)
      setSettings(s)
      if (s?.last_period_start) {
        setCycleInfo(getCycleInfo(s))
        setStats(await getCycleStats(userId))
      }
    } catch (e) {
      console.error('Error loading cycle data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [userId])

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
          onReload={loadData}
          onOpenCalendar={() => setShowCalendar(true)}
          onOpenCheckin={() => setShowCheckin(true)}
          onOpenInsights={() => setShowInsights(true)}
          onOpenReminders={() => setShowReminders(true)}
          onOpenTrustedCircle={() => setShowTrusted(true)}
          onOpenTrustedDashboard={() => setView('trusted_dashboard')}
          onClose={onClose}
        />
      )}

      {view === 'trusted_dashboard' && (
        <TrustedPersonDashboard
          onOpenConversation={onOpenConversation}
          onClose={() => setView('dashboard')}
        />
      )}

      {/* Modals */}
      {showTrusted && (
        <TrustedCircle 
          userId={userId} 
          onClose={() => setShowTrusted(false)} 
        />
      )}

      {showCalendar && (
        <CycleCalendarModal 
          userId={userId} 
          settings={settings} 
          onReload={loadData} 
          onClose={() => setShowCalendar(false)} 
        />
      )}

      {showCheckin && (
        <CycleCheckinModal 
          userId={userId} 
          onClose={() => setShowCheckin(false)} 
        />
      )}

      {showInsights && (
        <CycleInsightsModal 
          userId={userId} 
          onClose={() => setShowInsights(false)} 
        />
      )}

      {showReminders && (
        <CycleRemindersModal 
          userId={userId} 
          onClose={() => setShowReminders(false)} 
        />
      )}
    </>
  )
}
