import React, { useState } from 'react'
import { useCycleData } from '../../hooks/useCycleData'
import CycleOnboarding from './CycleOnboarding'
import CycleDashboard from './CycleDashboard'
import CycleCheckin from './CycleCheckin'
import CycleCalendar from './CycleCalendar'

export default function CyclePage({ userId, onClose }) {
  const { settings, periodRecords, cycleInfo, stats, loading, reload } = useCycleData(userId)
  const [showCheckin, setShowCheckin] = useState(false)
  const [checkinDate, setCheckinDate] = useState(null) // yyyy-MM-dd
  const [showCalendar, setShowCalendar] = useState(false)

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
    </>
  )
}
