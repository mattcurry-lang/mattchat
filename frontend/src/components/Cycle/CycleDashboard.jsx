import React, { useState } from 'react'
import CycleRing from './CycleRing'
import { PHASE_INFO } from '../../lib/cycleMath'
import { IconX, IconEyeOff, IconSparkle, IconBell } from '../Icons'
import { logPeriodStart, setHideCycle } from '../../lib/cycle'
import { format } from 'date-fns'
import TodayForYouCard from './TodayForYouCard'

// Inline SVG Icon for Users to eliminate ReferenceError
function IconUsers({ size = 15, color = 'currentColor', ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
      <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0 -3 -3.85" />
    </svg>
  )
}

function CalendarGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  )
}

export default function CycleDashboard({ 
  userId, settings, cycleInfo, stats, recentDailyLogs, checkinStreak, onReload, 
  onOpenCalendar, onOpenCheckin, onOpenInsights, onOpenReminders, onOpenTrustedCircle, onOpenWellness, onClose 
}) {
  const [hiding, setHiding] = useState(false)

  const hasData = !!cycleInfo
  const phase = hasData ? PHASE_INFO[cycleInfo.phase] : null

  const recordTodayAsPeriodStart = async () => {
    try {
      await logPeriodStart(userId, new Date().toISOString().slice(0, 10))
      onReload()
    } catch (e) {
      console.error(e)
      alert('Could not record period start.')
    }
  }

  const toggleHideCycle = async () => {
    setHiding(true)
    try {
      await setHideCycle(userId, !settings?.hide_cycle)
      onReload()
    } catch (e) {
      console.error(e)
    }
    setHiding(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 650, overflowY: 'auto',
      background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)',
    }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px', gap: 8 }}>
        <button onClick={onOpenTrustedCircle} title="Trusted Circle" style={iconBtnStyle}>
          <IconUsers size={15} />
        </button>
        <button onClick={onOpenInsights} title="Your Patterns" style={iconBtnStyle}>
          <IconSparkle size={15} />
        </button>
        <button onClick={onOpenReminders} title="Reminders" style={iconBtnStyle}>
          <IconBell size={15} />
        </button>
        <button onClick={onOpenCalendar} title="Calendar" style={iconBtnStyle}>
          <CalendarGlyph size={16} />
        </button>
        <button onClick={onClose} style={iconBtnStyle}>
          <IconX size={15} />
        </button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '8px 20px 100px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {settings?.hide_cycle && (
          <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: '#86efac', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconEyeOff size={14} /> Privacy mode is on — sharing is paused. Your data is safe and untouched.
          </div>
        )}

        {!hasData ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🌸</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Let's get to know your cycle</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.6 }}>
              Start by recording the first day of your latest period.
            </div>
            <button className="btn-primary" style={{ padding: '10px 20px' }} onClick={recordTodayAsPeriodStart}>
              Record Period
            </button>
          </div>
        ) : (
          <>
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,139,250,0.2)',
              borderRadius: 24, padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
            }}>
              <CycleRing
                progressFraction={cycleInfo.progressFraction}
                dayLabel={`Day ${cycleInfo.dayOfCycle}`}
                subLabel={
                  cycleInfo.phase === 'menstrual'
                    ? 'On your period'
                    : `${cycleInfo.daysUntilNextPeriod} day${cycleInfo.daysUntilNextPeriod === 1 ? '' : 's'} until your estimated period`
                }
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>
                {cycleInfo.confidence === 'low' ? 'Early estimate — improves as you log more cycles' : 'Estimate based on your recorded history'}
              </div>
            </div>

            {phase && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '16px 18px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#c4b5fd', marginBottom: 6 }}>
                  {phase?.label || 'Cycle Update'}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
                  {phase?.blurb || ''}
                </div>
              </div>
            )}

            {checkinStreak > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: '#c4b5fd',
              }}>
                🔥 {checkinStreak}-day check-in streak
              </div>
            )}

            {/* Today for you card */}
            <TodayForYouCard
              phase={cycleInfo.phase}
              recentDailyLogs={recentDailyLogs}
              onOpenWellness={onOpenWellness}
            />

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <StatCard label="Estimated next period" value={cycleInfo.nextPeriodDate ? format(new Date(cycleInfo.nextPeriodDate), 'MMM d') : '—'} />
              <StatCard label="Cycle length" value={`${cycleInfo.cycleLength} days`} />
              <StatCard label="Last period" value={settings.last_period_start ? format(new Date(settings.last_period_start + 'T00:00:00'), 'MMM d') : '—'} />
              <StatCard
                label="Average cycle"
                value={stats?.average ? `${stats.average} days` : 'Need more data'}
              />
            </div>

            <button
              onClick={onOpenCheckin}
              className="btn-primary"
              style={{ padding: 14, fontSize: 14, borderRadius: 16 }}
            >
              How are you feeling today?
            </button>

            <button
              onClick={toggleHideCycle}
              disabled={hiding}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14,
                padding: '10px 14px', color: 'rgba(255,255,255,0.55)', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <IconEyeOff size={14} /> {settings.hide_cycle ? 'Resume sharing' : 'Hide my cycle'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{value}</div>
    </div>
  )
}

const iconBtnStyle = {
  background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%',
  width: 32, height: 32, color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
