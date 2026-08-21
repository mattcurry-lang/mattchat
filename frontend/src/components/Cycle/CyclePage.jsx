import React from 'react'
import { useCycleData } from '../../hooks/useCycleData'
import CycleOnboarding from './CycleOnboarding'
import CycleDashboard from './CycleDashboard'

// Decides onboarding vs dashboard based on settings.onboarded — same
// "container decides which sub-view" pattern as ChatPage does for
// Curry AI vs normal chat.
export default function CyclePage({ userId, onClose }) {
  const { settings, cycleInfo, stats, loading, reload } = useCycleData(userId)

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 650, background: '#14121f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        Loading your cycle…
      </div>
    )
  }

  if (!settings?.onboarded) {
    return (
      <CycleOnboarding
        userId={userId}
        onComplete={reload}
        onClose={onClose}
      />
    )
  }

  return (
    <CycleDashboard
      userId={userId}
      settings={settings}
      cycleInfo={cycleInfo}
      stats={stats}
      onReload={reload}
      onOpenCalendar={() => {/* Phase 2 */}}
      onOpenCheckin={() => {/* Phase 2 */}}
      onClose={onClose}
    />
  )
}
