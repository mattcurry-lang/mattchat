import React, { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useMusicColors } from '../../../../hooks/useMusicColors'
import { IconGraduationCap, IconMusic, IconShield, IconUsers, IconLock, IconCheck, IconLoader2 } from '../../../Icons'

/**
 * Campus Trends onboarding. Rendered by the Campus tab while ct.step is not null.
 *   step 'campus'    -> choose your campus
 *   step 'consent'   -> contribute / not now (nothing preselected, both equally prominent)
 *   step 'reconsent' -> same, after the notice text changed
 * Choosing "Not now" changes nothing about music, playlists, or the charts you can view.
 */

const MAX_W = 520
// Solid brand gradient dark enough for white text (about 5:1 contrast)
const PRIMARY = 'linear-gradient(135deg,#6c63ff,#5648e6)'

const CSS = `
.ct-btn:focus-visible, .ct-link:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
.ct-opt:focus-within { outline: 2px solid #a78bfa; outline-offset: 2px; }
@keyframes ctSpin { to { transform: rotate(360deg); } }
.ct-spin { animation: ctSpin 0.8s linear infinite; display: inline-flex; }
@keyframes ctPulse { 50% { opacity: 0.45; } }
.ct-skel { animation: ctPulse 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .ct-spin, .ct-skel { animation: none; } }
`

function Shell({ colors, reduce, icon, title, subtitle, children }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{ maxWidth: MAX_W, margin: '0 auto', borderRadius: 22, overflow: 'hidden', background: colors.surface2, border: `1px solid ${colors.border}` }}
    >
      <style>{CSS}</style>
      <div style={{ padding: '22px 20px 16px', background: 'linear-gradient(135deg, rgba(167,139,250,0.28), rgba(108,99,255,0.12))' }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: PRIMARY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(108,99,255,0.35)' }}>
          {icon}
        </div>
        <h2 style={{ margin: '14px 0 4px', fontSize: 22, fontWeight: 900, letterSpacing: -0.4, color: colors.textPrimary }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: colors.textSecondary }}>{subtitle}</p>
      </div>
      <div style={{ padding: '14px 20px 20px' }}>{children}</div>
    </motion.div>
  )
}

function Button({ children, primary, busy, disabled, onClick, colors }) {
  const off = disabled || busy
  return (
    <button
      className="ct-btn"
      onClick={onClick}
      disabled={off}
      style={{
        flex: 1, minHeight: 48, padding: '0 14px', borderRadius: 14, fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
        cursor: off ? 'default' : 'pointer', opacity: off ? 0.6 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        border: primary ? 'none' : `1.5px solid ${colors.isDark ? 'rgba(167,139,250,0.6)' : '#6c63ff'}`,
        background: primary ? PRIMARY : 'transparent',
        color: primary ? '#fff' : colors.textPrimary,
      }}
    >
      {children}
    </button>
  )
}

function ErrorLine({ text, colors }) {
  if (!text) return null
  return (
    <div role="alert" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: colors.isDark ? '#fca5a5' : '#b91c1c', background: 'rgba(248,113,113,0.12)' }}>
      {text}
    </div>
  )
}

/* ── step 1: campus ── */

function CampusStep({ ct, colors, reduce }) {
  const [selected, setSelected] = useState(null)
  const [waited, setWaited] = useState(false)
  useEffect(() => { const t = setTimeout(() => setWaited(true), 6000); return () => clearTimeout(t) }, [])

  const list = ct.campuses
  const failed = list.length === 0 && Boolean(ct.actionError)
  const loading = list.length === 0 && !failed && !waited

  return (
    <Shell
      colors={colors} reduce={reduce} icon={<IconGraduationCap size={22} />}
      title="Which campus are you at?"
      subtitle="Campus Trends shows what students at the same campus are listening to. It's your own choice, so charts say who they count: students who chose that campus."
    >
      {loading && [0, 1].map((i) => (
        <div key={i} className="ct-skel" aria-hidden="true" style={{ height: 64, borderRadius: 14, marginBottom: 10, background: colors.surface1 }} />
      ))}

      {failed && (
        <div style={{ fontSize: 13, color: colors.textSecondary }}>
          Couldn't load the campuses.{' '}
          <button className="ct-link" onClick={() => { ct.clearActionError(); ct.loadCampuses() }} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 800, color: '#a78bfa', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      )}

      {!loading && !failed && list.length === 0 && (
        <div style={{ fontSize: 13, color: colors.textSecondary }}>No campuses are available yet.</div>
      )}

      {list.length > 0 && (
        <div role="radiogroup" aria-label="Your campus" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((c) => {
            const on = selected === c.id
            return (
              <label
                key={c.id} className="ct-opt"
                style={{
                  position: 'relative', display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '12px 14px',
                  borderRadius: 14, cursor: 'pointer', color: colors.textPrimary,
                  background: on ? 'rgba(167,139,250,0.16)' : 'transparent',
                  border: `1.5px solid ${on ? '#a78bfa' : colors.border}`,
                }}
              >
                <input
                  type="radio" name="campus" value={c.id} checked={on} onChange={() => setSelected(c.id)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                />
                <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa', background: 'rgba(167,139,250,0.14)' }}>
                  <IconGraduationCap size={18} />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700 }}>{c.name}</span>
                {on && <IconCheck size={18} style={{ color: '#a78bfa', flexShrink: 0 }} />}
              </label>
            )
          })}
        </div>
      )}

      <ErrorLine text={list.length > 0 ? ct.actionError : null} colors={colors} />

      <p style={{ margin: '14px 0 14px', fontSize: 12, lineHeight: 1.5, color: colors.textMuted }}>
        You can change it later, once every 28 days. A change starts the following Monday.
      </p>

      <div style={{ display: 'flex' }}>
        <Button primary colors={colors} disabled={!selected} busy={ct.busy} onClick={() => ct.chooseCampus(selected)}>
          {ct.busy && <span className="ct-spin" aria-hidden="true"><IconLoader2 size={16} /></span>}
          {ct.busy ? 'Saving' : 'Continue'}
        </Button>
      </div>
    </Shell>
  )
}

/* ── step 2: consent ── */

const POINTS = [
  { Icon: IconMusic, title: 'What counts',
    text: 'Songs you add to a playlist and songs you play for 30 seconds or more, from the moment you say yes. Nothing from before that.' },
  { Icon: IconShield, title: 'What is shown',
    text: 'Only ranks, never names or counts. A chart appears only when at least 20 students at your campus took part, and a song needs at least 5 of them.' },
  { Icon: IconUsers, title: 'Who can see what',
    text: 'No other student, and no Mattchat admin screen, can see what you listen to or save. Playlists you make public are visible to others, as they always were.' },
  { Icon: IconLock, title: 'Your control',
    text: 'Turn it off any time in the Campus tab. That stops counting you, including this week. Charts already published stay, because they hold no personal data. Exact song totals are deleted after a limited time (currently 12 weeks).' },
]

function ConsentStep({ ct, colors, reduce, again }) {
  return (
    <Shell
      colors={colors} reduce={reduce} icon={<IconMusic size={22} />}
      title={again ? 'We updated how campus trends work' : 'Share the campus sound.'}
      subtitle={again
        ? 'Please read the changes and choose again. Your music and playlists are not affected either way.'
        : 'Help your campus discover popular music through weekly charts built from combined activity. It is optional, and it changes nothing about your music or playlists whichever you choose.'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {POINTS.map(({ Icon, title, text }) => (
          <div key={title} style={{ display: 'flex', gap: 12 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa', background: 'rgba(167,139,250,0.14)' }}>
              <Icon size={16} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: colors.textPrimary }}>{title}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: colors.textSecondary, marginTop: 2 }}>{text}</div>
            </div>
          </div>
        ))}
      </div>

      <p style={{ margin: '16px 0 0', fontSize: 11.5, lineHeight: 1.5, color: colors.textMuted }}>
        What other students see is combined. Inside Mattchat, your activity is counted using your account once a week, so we treat it as personal data.{' '}
        <a className="ct-link" href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', fontWeight: 700 }}>
          Read the privacy notice
        </a>
      </p>

      <ErrorLine text={ct.actionError} colors={colors} />

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <Button primary colors={colors} busy={ct.busy} onClick={() => ct.setContribute(true)}>
          Contribute to campus trends
        </Button>
        <Button colors={colors} busy={ct.busy} onClick={() => ct.setContribute(false)}>
          Not now
        </Button>
      </div>
    </Shell>
  )
}

export default function CampusTrendsOnboarding({ ct }) {
  const colors = useMusicColors()
  const reduce = useReducedMotion()
  if (!ct?.step) return null
  if (ct.step === 'campus') return <CampusStep ct={ct} colors={colors} reduce={reduce} />
  return <ConsentStep ct={ct} colors={colors} reduce={reduce} again={ct.step === 'reconsent'} />
}
