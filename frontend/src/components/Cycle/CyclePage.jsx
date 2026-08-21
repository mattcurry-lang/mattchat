import React, { useState } from 'react'
import { useCycleData } from '../../hooks/useCycleData'
import CycleOnboarding from './CycleOnboarding'
import CycleDashboard from './CycleDashboard'
import CycleCheckin from './CycleCheckin'
import CycleCalendar from './CycleCalendar'
import CycleInsights from './CycleInsights'
import CycleReminders from './CycleReminders'


export default function CyclePage({ userId, onClose }) {
  const { settings, periodRecords, cycleInfo, stats, loading, reload } = useCycleData(userId)
  const [showCheckin, setShowCheckin] = useState(false)
  const [checkinDate, setCheckinDate] = useState(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [showReminders, setShowReminders] = useState(false)

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 650, background: '#14121f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        Loading your cycle…
      </div>
    )
  }

  if (!settings?.onboarded) {
    return <CycleOnboarding userId={userId} onComplete={reload} onClose={onClose} />
  }

  const openCheckin = (dateStr) => {
    setCheckinDate(dateStr || new Date().toISOString().slice(0, 10))
    setShowCheckin(true)
  }

  return (
    <>
      <CycleDashboard
        userId={userId}
        settings={settings}
        cycleInfo={cycleInfo}
        stats={stats}
        onReload={reload}
        onOpenCalendar={() => setShowCalendar(true)}
        onOpenCheckin={() => openCheckin()}
        onOpenInsights={() => setShowInsights(true)}
        onOpenReminders={() => setShowReminders(true)}
        onClose={onClose}
      />

      {showCalendar && (
        <CycleCalendar
          userId={userId}
          settings={settings}
          periodRecords={periodRecords}
          cycleInfo={cycleInfo}
          onOpenDay={openCheckin}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {showCheckin && (
        <CycleCheckin
          userId={userId}
          dateStr={checkinDate}
          onSaved={reload}
          onClose={() => setShowCheckin(false)}
        />
      )}

      {showInsights && (
        <CycleInsights
          userId={userId}
          periodRecords={periodRecords}
          stats={stats}
          onClose={() => setShowInsights(false)}
        />
      )}

      {showReminders && (
        <CycleReminders
          userId={userId}
          settings={settings}
          onSaved={reload}
          onClose={() => setShowReminders(false)}
        />
      )}
    </>
  )
}
