import React, { useState } from 'react'
import CycleRing from './CycleRing'
import { PHASE_INFO } from '../../lib/cycleMath'
import { IconX, IconEyeOff, IconSparkle, IconBell, IconSettings } from '../Icons'
import { logPeriodStart, setHideCycle, upsertCycleSettings } from '../../lib/cycle'
import { format } from 'date-fns'
import TodayForYouCard from './TodayForYouCard'
import CycleDataSettingsModal from './CycleDataSettingsModal'
import { usePendingTrustedInvites } from '../../hooks/usePendingTrustedInvites'
import { motion, AnimatePresence } from 'framer-motion'

// Inline Custom Refined Icons for Warmth & Comfort
function IconUsers({ size = 16, color = 'currentColor', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function CalendarGlyph({ size = 16, color = 'currentColor', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="4" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function HeartPulseIcon({ size = 16, color = 'currentColor', ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M12 11v4" />
      <path d="M10 13h4" />
    </svg>
  )
}

export default function CycleDashboard({
  userId, settings, cycleInfo, stats, recentDailyLogs, checkinStreak, hasAcceptedTrustLinks, onReload,
  onOpenCalendar, onOpenCheckin, onOpenInsights, onOpenReminders, onOpenTrustedCircle,
  onOpenTrustedDashboard, onOpenWellness, onClose
}) {
  const [hiding, setHiding] = useState(false)
  const [showDataSettings, setShowDataSettings] = useState(false)
  const { count: pendingInviteCount } = usePendingTrustedInvites(userId)

  const hasData = !!cycleInfo && !!settings?.onboarded
  const phase = hasData ? PHASE_INFO[cycleInfo.phase] : null

  // Phase-adaptive soft glow colors for feminine comfort and warmth
  const phaseGlowColor = 
    cycleInfo?.phase === 'menstrual' ? 'rgba(244, 63, 94, 0.18)' :
    cycleInfo?.phase === 'ovulatory' ? 'rgba(236, 72, 153, 0.18)' :
    cycleInfo?.phase === 'follicular' ? 'rgba(52, 211, 153, 0.16)' : 'rgba(167, 139, 250, 0.18)'

  const recordTodayAsPeriodStart = async () => {
    try {
      await logPeriodStart(userId, new Date().toISOString().slice(0, 10))
      await upsertCycleSettings(userId, { onboarded: true })
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
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      transition={{ duration: 0.25 }}
      className="cycle-dash-root" 
      style={{
        position: 'fixed', inset: 0, zIndex: 650, overflowY: 'auto',
        background: 'linear-gradient(165deg, #1e1936 0%, #131022 50%, #0d0b16 100%)',
        color: '#fff',
      }}
    >
      {/* Ambient background soft glow aura corresponding to phase */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '600px', height: '320px',
        background: `radial-gradient(circle, ${phaseGlowColor} 0%, transparent 70%)`,
        pointerEvents: 'none', filter: 'blur(40px)', zIndex: 0
      }} />

      {/* Top Header Actions Bar */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(236,72,153,0.35)' }}>
            🌸
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>Cycle Sanctuary</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Your personal wellness space</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => setShowDataSettings(true)} title="Cycle settings" style={iconBtnStyle}><IconSettings size={16} /></motion.button>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={onOpenTrustedCircle} title="Trusted Circle" style={iconBtnStyle}><IconUsers size={16} /></motion.button>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={onOpenInsights} title="Your Patterns & Insights" style={iconBtnStyle}><IconSparkle size={16} /></motion.button>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={onOpenReminders} title="Reminders" style={iconBtnStyle}><IconBell size={16} /></motion.button>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={onOpenCalendar} title="Calendar View" style={iconBtnStyle}><CalendarGlyph size={16} /></motion.button>
          
          {/* Trusted Dashboard Notification Pill */}
          <motion.button 
            whileHover={{ scale: 1.08 }} 
            whileTap={{ scale: 0.92 }} 
            onClick={onOpenTrustedDashboard} 
            title="People you support" 
            style={{ ...iconBtnStyle, position: 'relative', background: pendingInviteCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.08)' }}
          >
            <HeartPulseIcon size={16} color={pendingInviteCount > 0 ? '#f87171' : '#fff'} />
            {pendingInviteCount > 0 && (
              <span style={{
                position: 'absolute', top: -3, right: -3, background: '#ef4444', color: '#fff',
                borderRadius: '50%', width: 17, height: 17, fontSize: 9.5, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #131022',
                boxShadow: '0 2px 6px rgba(239,68,68,0.5)'
              }}>
                {pendingInviteCount > 9 ? '9+' : pendingInviteCount}
              </span>
            )}
          </motion.button>

          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={onClose} title="Close Sanctuary" style={{ ...iconBtnStyle, background: 'rgba(255,255,255,0.12)' }}><IconX size={16} /></motion.button>
        </div>
      </div>

      <div className="cycle-dash-container" style={{ position: 'relative', zIndex: 10 }}>
        {settings?.hide_cycle && (
          <motion.div 
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="cycle-dash-span-all" 
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 16, padding: '12px 18px', fontSize: 13, color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(10px)', marginBottom: 16 }}
          >
            <IconEyeOff size={16} /> Privacy mode is active — sharing is securely paused. Your personal data is completely safe and untouched.
          </motion.div>
        )}

        {!hasData ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="cycle-dash-span-all" 
            style={{ textAlign: 'center', padding: '50px 24px', background: 'rgba(255,255,255,0.03)', borderRadius: 28, border: '1px solid rgba(236,72,153,0.2)', backdropFilter: 'blur(20px)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
          >
            <div style={{ fontSize: 44, marginBottom: 14, filter: 'drop-shadow(0 4px 10px rgba(236,72,153,0.4))' }}>🌸</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8, letterSpacing: '-0.01em' }}>Welcome to Your Cycle Sanctuary</div>
            <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.6 }}>
              Let's understand your unique rhythm. Start by recording the first day of your latest period to unlock tailored insights.
            </div>
            <motion.button 
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="btn-primary" 
              style={{ padding: '12px 28px', fontSize: 14, borderRadius: 24, background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', border: 'none', boxShadow: '0 8px 20px rgba(236,72,153,0.35)', cursor: 'pointer', fontWeight: 700 }} 
              onClick={recordTodayAsPeriodStart}
            >
              ✨ Record Today as Period Start
            </motion.button>
          </motion.div>
        ) : (
          <>
            {/* LEFT COLUMN — The Ring, Phase Insight Card, and Streak */}
            <div className="cycle-dash-left" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{
                background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(236,72,153,0.22)',
                borderRadius: 28, padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
                backdropFilter: 'blur(16px)', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', position: 'relative', overflow: 'hidden'
              }}>
                <CycleRing
                  progressFraction={cycleInfo.progressFraction}
                  dayLabel={`Day ${cycleInfo.dayOfCycle}`}
                  subLabel={
                    cycleInfo.phase === 'menstrual'
                      ? 'On your period · Rest & nourish'
                      : `${cycleInfo.daysUntilNextPeriod} day${cycleInfo.daysUntilNextPeriod === 1 ? '' : 's'} until estimated period`
                  }
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)', padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ color: '#f472b6' }}>✦</span> {cycleInfo.confidence === 'low' ? 'Early estimate — refines as you log more cycles' : 'Personalized estimate based on your history'}
                </div>
              </div>

              {phase && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ background: 'linear-gradient(145deg, rgba(236,72,153,0.08), rgba(139,92,246,0.08))', border: '1px solid rgba(236,72,153,0.25)', borderRadius: 22, padding: '20px 22px', backdropFilter: 'blur(12px)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 800, color: '#f472b6', marginBottom: 8 }}>
                    <span>✨</span> {phase?.label || 'Cycle Phase Update'}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65 }}>{phase?.blurb || ''}</div>
                </motion.div>
              )}

              {checkinStreak > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', background: 'linear-gradient(135deg, rgba(244,63,94,0.15), rgba(236,72,153,0.15))', border: '1px solid rgba(244,63,94,0.35)', borderRadius: 24, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, color: '#fda4af', boxShadow: '0 4px 12px rgba(244,63,94,0.15)' }}>
                  🔥 {checkinStreak}-day mindful check-in streak
                </div>
              )}
            </div>

            {/* RIGHT COLUMN — Today For You, Quick Stats, Check-in CTA */}
            <div className="cycle-dash-right" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <TodayForYouCard phase={cycleInfo.phase} recentDailyLogs={recentDailyLogs} onOpenWellness={onOpenWellness} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <StatCard label="Estimated Next Period" value={cycleInfo.nextPeriodDate ? format(new Date(cycleInfo.nextPeriodDate), 'MMM d') : '—'} icon="🗓️" />
                <StatCard label="Cycle Length" value={`${cycleInfo.cycleLength} days`} icon="🔄" />
                <StatCard label="Last Period Started" value={settings.last_period_start ? format(new Date(settings.last_period_start + 'T00:00:00'), 'MMM d') : '—'} icon="💧" />
                <StatCard label="Average Rhythm" value={stats?.average ? `${stats.average} days` : 'Learning...'} icon="📊" />
              </div>

              <motion.button 
                whileHover={{ scale: 1.015, translateY: -2 }} 
                whileTap={{ scale: 0.98 }}
                onClick={onOpenCheckin} 
                style={{ 
                  padding: '16px 20px', fontSize: 15, fontWeight: 800, borderRadius: 20, 
                  background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', color: '#fff', 
                  border: 'none', cursor: 'pointer', boxShadow: '0 10px 25px rgba(236,72,153,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, letterSpacing: '-0.01em'
                }}
              >
                <span>💖</span> How are you feeling today? (Daily Check-in)
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.06)' }} 
                whileTap={{ scale: 0.98 }}
                onClick={toggleHideCycle} 
                disabled={hiding} 
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18,
                  padding: '12px 16px', color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s'
                }}
              >
                <IconEyeOff size={15} /> {settings.hide_cycle ? 'Resume Trusted Sharing' : 'Temporarily Hide My Cycle'}
              </motion.button>
            </div>
          </>
        )}
      </div>

      {showDataSettings && (
        <CycleDataSettingsModal userId={userId} settings={settings} onSaved={onReload} onCleared={onReload} onClose={() => setShowDataSettings(false)} />
      )}

      {hasAcceptedTrustLinks && (
        <div style={{ padding: '0 24px 30px', maxWidth: '1200px', margin: '0 auto' }}>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onOpenTrustedDashboard}
            style={{
              background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(139,92,246,0.15))', 
              border: '1px solid rgba(236,72,153,0.3)', borderRadius: 20,
              padding: '12px 20px', color: '#f472b6', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(236,72,153,0.1)'
            }}
          >
            <span>🫂</span> View People You Support & Share With
          </motion.button>
        </div>
      )}

      <style>{`
        .cycle-dash-container {
          max-width: 520px;
          margin: 0 auto;
          padding: 10px 20px 100px;
        }
        @media (min-width: 1024px) {
          .cycle-dash-container {
            max-width: 1180px;
            display: grid;
            grid-template-columns: 440px 1fr;
            align-items: start;
            gap: 32px;
            padding: 10px 40px 100px;
          }
          .cycle-dash-span-all { grid-column: 1 / -1; }
        }
      `}</style>
    </motion.div>
  )
}

function StatCard({ label, value, icon }) {
  return (
    <div style={{ 
      background: 'rgba(255,255,255,0.035)', 
      border: '1px solid rgba(255,255,255,0.08)', 
      borderRadius: 18, 
      padding: '14px 16px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 6
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ fontSize: 14 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{value}</div>
    </div>
  )
}

const iconBtnStyle = {
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%',
  width: 38, height: 38, color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 10px rgba(0,0,0,0.2)', transition: 'background 0.2s'
}
