import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useMusicPlayer } from '../../../context/MusicPlayerContext'
import { useMusicColors } from '../../../../hooks/useMusicColors'
import { useCampusTrends } from '../../../../hooks/useCampusTrends'
import { chartTracks, describeMovement, formatPeriod } from '../../../../lib/music/CampusTrends'
import { IconChevronUp, IconChevronDown, IconPlay, IconPause, IconPlus, IconMusic } from '../../../Icons'
import AddToPlaylistPicker from '../AddToPlaylistPicker'
import CampusTrendsOnboarding from './CampusTrendsOnboarding'

const TOP_N = 10
const SR_ONLY = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }

const CSS = `
.ctt-btn:focus-visible, .ctt-link:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
@keyframes cttPulse { 50% { opacity: 0.45; } }
.ctt-skel { animation: cttPulse 1.2s ease-in-out infinite; }
@keyframes cttBar { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
.ctt-bar { transform-origin: bottom; animation: cttBar 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .ctt-skel, .ctt-bar { animation: none; } }
`

// YouTube thumbnails have black bars baked in; zooming crops them (same rule as the player)
const artZoom = (url = '') => (/ytimg|ggpht|googleusercontent/i.test(url) ? 1.34 : 1)
const hueOf = (s) => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h }
const fmtDay = (iso) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(iso))

/* ── small pieces ── */

function Art({ src, size, colors }) {
  const [bad, setBad] = useState(false)
  useEffect(() => { setBad(false) }, [src])
  return (
    <div style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: colors.surface1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {src && !bad
        ? <img src={src} alt="" loading="lazy" draggable={false} onError={() => setBad(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${artZoom(src)})` }} />
        : <IconMusic size={Math.round(size * 0.36)} style={{ color: colors.textMuted }} />}
    </div>
  )
}

function Heading({ colors, children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 2px 8px' }}>
      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, color: colors.textPrimary }}>{children}</h3>
      {right}
    </div>
  )
}

function Note({ colors, tone, children }) {
  const warn = tone === 'warn'
  return (
    <div role="status" style={{
      margin: '0 0 12px', padding: '10px 12px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, fontWeight: 600, color: colors.textPrimary,
      background: warn ? 'rgba(251,191,36,0.14)' : 'rgba(167,139,250,0.12)',
      border: `1px solid ${warn ? 'rgba(251,191,36,0.35)' : 'rgba(167,139,250,0.28)'}`,
    }}>
      {children}
    </div>
  )
}

function Section({ reduce, delay = 0, children }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }} style={{ marginBottom: 22 }}
    >
      {children}
    </motion.div>
  )
}

function Hero({ campusName, period }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '20px 18px', marginBottom: 16, color: '#fff', background: 'linear-gradient(135deg,#4a3fd4 0%,#2e2780 100%)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', right: 16, bottom: 14, height: 56, display: 'flex', alignItems: 'flex-end', gap: 5 }}>
        {[0.55, 0.9, 0.7, 1, 0.6].map((h, i) => (
          <span key={i} className="ctt-bar" style={{ width: 6, height: `${h * 100}%`, borderRadius: 3, background: 'rgba(255,255,255,0.28)', animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#ddd6fe' }}>Campus Trends</div>
        <h2 style={{ margin: '6px 0 8px', fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>Your campus. Your sound.</h2>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{campusName}</div>
        {period && <div style={{ fontSize: 12.5, color: '#e0e7ff', marginTop: 2 }}>Week of {period}</div>}
        <p style={{ margin: '10px 0 0', maxWidth: 420, fontSize: 12.5, lineHeight: 1.5, color: '#e0e7ff' }}>
          What your campus is playing and saving, combined each week from members who chose to take part. You see ranks only: no names, no counts.
        </p>
      </div>
    </div>
  )
}

function MovementBadge({ row, colors }) {
  const m = describeMovement(row)
  if (m.kind === 'none') return null
  const dark = colors.isDark
  const base = { position: 'relative', display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontWeight: 800 }
  if (m.kind === 'up' || m.kind === 'down') {
    const up = m.kind === 'up'
    return (
      <span style={{ ...base, gap: 1, color: up ? (dark ? '#4ade80' : '#15803d') : (dark ? '#f87171' : '#b91c1c') }}>
        {up ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}{m.amount}
        <span style={SR_ONLY}>{m.label}</span>
      </span>
    )
  }
  if (m.kind === 'same') {
    return (
      <span style={{ ...base, color: colors.textMuted }}>
        <span aria-hidden="true" style={{ width: 10, height: 2, borderRadius: 1, background: 'currentColor' }} />
        <span style={SR_ONLY}>{m.label}</span>
      </span>
    )
  }
  return (
    <span style={{ ...base, fontSize: 9, letterSpacing: 0.3, padding: '1px 5px', borderRadius: 5, textTransform: 'uppercase', color: dark ? '#c4b5fd' : '#5b4bd5', background: 'rgba(167,139,250,0.16)' }}>
      {m.label}
    </span>
  )
}

/* Same popover pattern as TrackRail's menu: the existing picker, in a portal above everything */
function AddToPlaylistButton({ track, colors }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const toggle = (e) => {
    e.stopPropagation()
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const W = 280
      const left = Math.max(8, Math.min(rect.right - W, window.innerWidth - W - 8))
      const below = window.innerHeight - rect.bottom
      const above = rect.top
      const up = below < 380 && above > below
      setPos(up ? { bottom: window.innerHeight - rect.top + 6, left, maxHeight: above - 14 } : { top: rect.bottom + 6, left, maxHeight: below - 14 })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return undefined
    const close = () => setOpen(false)
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef} className="ctt-btn" onClick={toggle} aria-label={`Add ${track.title} to a playlist`} aria-expanded={open}
        style={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', border: 'none', background: 'transparent', color: colors.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <IconPlus size={18} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef} onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', ...pos, zIndex: 3000, overflowY: 'auto', background: colors.surface1, border: `1px solid ${colors.border}`, borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,0.28)' }}
        >
          <AddToPlaylistPicker track={track} onDone={() => setOpen(false)} />
        </div>,
        document.body,
      )}
    </>
  )
}

function SongRow({ row, colors, accent, active, playing, onPlay, tag }) {
  const t = row.track
  return (
    <div
      onClick={() => onPlay(row)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px 8px 10px', borderRadius: 14, cursor: 'pointer', background: active ? 'rgba(167,139,250,0.14)' : 'transparent' }}
    >
      <div style={{ width: 34, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: active ? accent : colors.textPrimary }}>{row.rank}</span>
        <MovementBadge row={row} colors={colors} />
      </div>
      <Art src={t.artwork} size={48} colors={colors} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: active ? accent : colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
        <div style={{ fontSize: 11.5, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {t.artist}{t.genre ? ` · ${t.genre}` : ''}
        </div>
        {tag && <span style={{ display: 'inline-block', marginTop: 3, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, padding: '1px 6px', borderRadius: 5, textTransform: 'uppercase', color: accent, background: 'rgba(167,139,250,0.16)' }}>{tag}</span>}
      </div>
      <AddToPlaylistButton track={t} colors={colors} />
      <button
        className="ctt-btn" aria-label={playing ? `Pause ${t.title}` : `Play ${t.title}`}
        onClick={(e) => { e.stopPropagation(); onPlay(row) }}
        style={{
          width: 40, height: 40, flexShrink: 0, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'linear-gradient(135deg,#6c63ff,#5648e6)' : colors.surface1, color: active ? '#fff' : colors.textPrimary,
        }}
      >
        {playing ? <IconPause size={15} /> : <IconPlay size={15} style={{ marginLeft: 1 }} />}
      </button>
    </div>
  )
}

function Skeleton({ colors }) {
  return (
    <div aria-hidden="true">
      <div className="ctt-skel" style={{ height: 150, borderRadius: 20, marginBottom: 16, background: colors.surface2 }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="ctt-skel" style={{ height: 64, borderRadius: 14, marginBottom: 8, background: colors.surface2 }} />
      ))}
    </div>
  )
}

function EmptyCard({ colors, title, children, action }) {
  return (
    <div style={{ padding: '22px 18px', borderRadius: 18, textAlign: 'center', background: colors.surface2, border: `1px solid ${colors.border}`, marginBottom: 22 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: colors.textSecondary, maxWidth: 380, margin: '0 auto' }}>{children}</div>
      {action}
    </div>
  )
}

/* ── your settings: participation and campus ── */

function Settings({ ct, colors, accent }) {
  const [picking, setPicking] = useState(false)
  const [message, setMessage] = useState(null)
  const on = ct.participating
  const others = ct.campuses.filter((c) => c.id !== ct.campus?.id)

  const openPicker = () => { ct.clearActionError(); setMessage(null); if (!ct.campuses.length) ct.loadCampuses(); setPicking(true) }
  const pick = async (c) => {
    const r = await ct.chooseCampus(c.id)
    if (!r.ok) return
    setPicking(false)
    setMessage(r.status === 'scheduled' ? `Done. You will move to ${c.name} on ${fmtDay(r.effective_from)}.`
      : r.status === 'unchanged' ? 'You are already in that campus.' : 'Saved.')
  }

  return (
    <div style={{ padding: '14px 16px', borderRadius: 18, background: colors.surface2, border: `1px solid ${colors.border}` }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: colors.textPrimary, marginBottom: 10 }}>Your settings</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div id="ctt-switch-label" style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>Contribute to campus trends</div>
          <div style={{ fontSize: 12, lineHeight: 1.45, color: colors.textSecondary, marginTop: 2 }}>
            {on ? 'Turning this off stops counting you, including this week.' : 'Only activity from the moment you turn this on is counted.'}
          </div>
        </div>
        <button
          className="ctt-btn" role="switch" aria-checked={on} aria-labelledby="ctt-switch-label" disabled={ct.busy}
          onClick={() => ct.setContribute(!on)}
          style={{ position: 'relative', width: 52, height: 30, borderRadius: 15, border: 'none', flexShrink: 0, cursor: ct.busy ? 'default' : 'pointer', opacity: ct.busy ? 0.6 : 1,
            background: on ? '#6c63ff' : (colors.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(24,20,42,0.28)') }}
        >
          <span aria-hidden="true" style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.35)' }} />
        </button>
      </div>

      <div style={{ height: 1, background: colors.border, margin: '14px 0' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>Campus</div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{ct.campus?.name}</div>
        </div>
        {!picking && (
          <button className="ctt-btn" onClick={openPicker} style={{ minHeight: 40, padding: '0 14px', borderRadius: 12, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', background: 'transparent', color: colors.textPrimary, border: `1.5px solid ${colors.isDark ? 'rgba(167,139,250,0.6)' : '#6c63ff'}` }}>
            Change
          </button>
        )}
      </div>

      {picking && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, lineHeight: 1.45, color: colors.textMuted, marginBottom: 8 }}>
            A change starts next Monday and can be made once every 28 days.
          </div>
          {others.length === 0 && <div style={{ fontSize: 12.5, color: colors.textSecondary }}>No other campuses are available yet.</div>}
          {others.map((c) => (
            <button key={c.id} className="ctt-btn" disabled={ct.busy} onClick={() => pick(c)}
              style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 44, padding: '0 12px', marginBottom: 6, borderRadius: 12, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: colors.textPrimary, background: 'transparent', border: `1px solid ${colors.border}` }}>
              {c.name}
            </button>
          ))}
          <button className="ctt-btn" onClick={() => { setPicking(false); ct.clearActionError() }}
            style={{ background: 'none', border: 'none', padding: '6px 0', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, color: accent, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}

      {ct.actionError && (
        <div role="alert" style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: colors.isDark ? '#fca5a5' : '#b91c1c', background: 'rgba(248,113,113,0.12)' }}>
          {ct.actionError}
        </div>
      )}
      {message && <div role="status" style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: colors.textPrimary }}>{message}</div>}

      <a className="ctt-link" href="/privacy" target="_blank" rel="noopener noreferrer"
        style={{ display: 'inline-block', marginTop: 12, fontSize: 12, fontWeight: 700, color: accent }}>
        Privacy notice
      </a>
    </div>
  )
}

/* ── the tab ── */

export default function CampusTrendsTab() {
  const { userId, playTrack, togglePlayPause, currentTrack, isPlaying } = useMusicPlayer()
  const colors = useMusicColors()
  const reduce = useReducedMotion()
  const ct = useCampusTrends(userId)
  const [showAll, setShowAll] = useState(false)
  const accent = colors.isDark ? '#a78bfa' : '#5b4bd5'

  const chart = ct.chart
  const ok = chart?.status === 'ok'
  const rows = useMemo(() => (ok ? chart.tracks : []), [ok, chart])
  const list = useMemo(() => chartTracks(chart), [chart])
  const byId = useMemo(() => new Map(list.map((t) => [t.id, t])), [list])
  const rising = useMemo(() => rows.filter((r) => r.is_rising), [rows])
  const fresh = useMemo(() => rows.filter((r) => r.movement === 'new'), [rows])

  const handlePlay = useCallback((row) => {
    if (currentTrack?.id === row.track.id) { togglePlayPause(); return }
    const t = byId.get(row.track.id)
    if (t) playTrack(t, list)
  }, [currentTrack?.id, togglePlayPause, byId, playTrack, list])

  const rowProps = (row) => {
    const active = currentTrack?.id === row.track.id
    return { colors, accent, active, playing: active && isPlaying, onPlay: handlePlay }
  }

  if (!userId) return <div style={{ padding: '20px 0', fontSize: 13, color: colors.textSecondary }}>Sign in to see campus trends.</div>

  const shell = (children) => <div style={{ paddingBottom: 12 }}><style>{CSS}</style>{children}</div>

  if (ct.loading) return shell(<Skeleton colors={colors} />)

  if (ct.error && !ct.ready) {
    return shell(
      <EmptyCard colors={colors} title="Couldn't load campus trends" action={
        <button className="ctt-btn" onClick={ct.refresh} style={{ marginTop: 14, minHeight: 44, padding: '0 20px', borderRadius: 14, border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', color: '#fff', background: 'linear-gradient(135deg,#6c63ff,#5648e6)' }}>
          Try again
        </button>
      }>
        {ct.error}
      </EmptyCard>,
    )
  }

  if (ct.step) return shell(<CampusTrendsOnboarding ct={ct} />)

  const period = formatPeriod(chart)
  const campusName = chart?.campus || ct.campus?.name || ''
  const shownRows = showAll ? rows : rows.slice(0, TOP_N)

  return shell(
    <>
      <Hero campusName={campusName} period={ok ? period : ''} />

      {ct.declined && <Note colors={colors}>You're exploring campus music trends without contributing your personal activity.</Note>}
      {ct.participating && <Note colors={colors}>You're contributing to campus trends. Others only ever see combined ranks.</Note>}
      {ct.pendingCampus && (
        <Note colors={colors}>Your move to {ct.pendingCampus.name} starts {fmtDay(ct.pendingCampus.effective_from)}. Until then you stay with {ct.campus?.name}.</Note>
      )}
      {chart?.fromCache && <Note colors={colors} tone="warn">You're offline. Showing the last chart saved on this device.</Note>}
      {ok && chart.stale && !chart.fromCache && (
        <Note colors={colors}>There's no new chart for this week yet, so this is the latest one. New charts appear every Monday.</Note>
      )}

      {!chart && !ct.chartError && <Skeleton colors={colors} />}

      {!chart && ct.chartError && (
        <EmptyCard colors={colors} title="Couldn't load the chart" action={
          <button className="ctt-btn" onClick={ct.refresh} style={{ marginTop: 14, minHeight: 44, padding: '0 20px', borderRadius: 14, border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', color: '#fff', background: 'linear-gradient(135deg,#6c63ff,#5648e6)' }}>
            Try again
          </button>
        }>
          {ct.chartError}
        </EmptyCard>
      )}

      {chart && (chart.status === 'none_yet' || chart.status === 'not_enough_data') && (
        <EmptyCard colors={colors} title="Your campus sound is still taking shape.">
          As more students participate, campus music trends will appear here. Charts only appear once enough students at your campus take part, so nobody's activity can be picked out.
        </EmptyCard>
      )}
      {chart?.status === 'disabled' && <EmptyCard colors={colors} title="Campus Trends is paused right now.">Check back soon.</EmptyCard>}
      {chart?.status === 'no_campus' && <EmptyCard colors={colors} title="Choose your campus">Pick your campus in the settings below to see its trends.</EmptyCard>}
      {ok && rows.length === 0 && <EmptyCard colors={colors} title="No trends available for this period yet." />}

      {ok && rows.length > 0 && (
        <>
          <Section reduce={reduce}>
            <Heading colors={colors}>Trending on campus</Heading>
            <div style={{ borderRadius: 18, padding: 4, background: colors.surface2, border: `1px solid ${colors.border}` }}>
              {shownRows.map((row) => <SongRow key={row.track.id} row={row} {...rowProps(row)} />)}
            </div>
            {rows.length > TOP_N && (
              <button className="ctt-btn" onClick={() => setShowAll((v) => !v)} style={{ marginTop: 8, minHeight: 40, padding: '0 4px', background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color: accent, cursor: 'pointer' }}>
                {showAll ? 'Show less' : `Show all ${rows.length}`}
              </button>
            )}
            {!chart.has_previous && (
              <div style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.5, color: colors.textMuted }}>Movement appears once there are two weekly charts to compare.</div>
            )}
          </Section>

          {rising.length > 0 && (
            <Section reduce={reduce} delay={0.05}>
              <Heading colors={colors}>Rising songs</Heading>
              <div style={{ borderRadius: 18, padding: 4, background: colors.surface2, border: `1px solid ${colors.border}` }}>
                {rising.map((row) => <SongRow key={row.track.id} row={row} tag={row.rising_kind === 'established' ? 'Established' : 'Emerging'} {...rowProps(row)} />)}
              </div>
            </Section>
          )}

          {fresh.length > 0 && (
            <Section reduce={reduce} delay={0.08}>
              <Heading colors={colors}>New on the chart</Heading>
              <div style={{ borderRadius: 18, padding: 4, background: colors.surface2, border: `1px solid ${colors.border}` }}>
                {fresh.slice(0, 5).map((row) => <SongRow key={row.track.id} row={row} {...rowProps(row)} />)}
              </div>
            </Section>
          )}

          {chart.artists.length > 0 && (
            <Section reduce={reduce} delay={0.1}>
              <Heading colors={colors}>Popular artists</Heading>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {chart.artists.map((a) => (
                  <div key={a.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: colors.surface2, border: `1px solid ${colors.border}` }}>
                    <span style={{ width: 22, fontSize: 13, fontWeight: 900, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: colors.textSecondary }}>{a.rank}</span>
                    <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, hsl(${hueOf(a.name)} 62% 46%), hsl(${(hueOf(a.name) + 50) % 360} 64% 30%))` }}>
                      {String(a.name).trim().charAt(0).toUpperCase()}
                    </span>
                    <span style={{ minWidth: 0, fontSize: 13, fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {chart.genres.length > 0 && (
            <Section reduce={reduce} delay={0.12}>
              <Heading colors={colors}>Campus genres</Heading>
              <div style={{ padding: '12px 14px', borderRadius: 18, background: colors.surface2, border: `1px solid ${colors.border}` }}>
                {chart.genres.slice(0, 8).map((g) => (
                  <div key={g.rank} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, marginBottom: 4 }}>
                      <span>{g.genre}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{g.share_pct}%</span>
                    </div>
                    <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: colors.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(24,20,42,0.1)' }}>
                      <div style={{ width: `${Math.max(4, g.share_pct)}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#a78bfa,#6c63ff)' }} />
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 11.5, lineHeight: 1.5, color: colors.textMuted }}>Estimated from song information, rounded to the nearest 5%. Songs we can't classify are counted as Other.</div>
              </div>
            </Section>
          )}
        </>
      )}

      <Section reduce={reduce} delay={0.14}>
        <Settings ct={ct} colors={colors} accent={accent} />
      </Section>
    </>,
  )
}
