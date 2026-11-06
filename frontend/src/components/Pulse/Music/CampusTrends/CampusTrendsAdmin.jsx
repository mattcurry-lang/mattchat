import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useMusicColors } from '../../../../hooks/useMusicColors'
import { useMusicPlayer } from '../../../context/MusicPlayerContext'
import { IconX, IconAlertTriangle, IconCheck, IconLoader2 } from '../../../Icons'

/**
 * Campus Trends admin. Campus-level numbers only: nothing here can show what an individual
 * student listens to or saves. Every rule is also enforced by the database (admin-only
 * policies, hard limits, audit trigger), so this screen is a convenience, not the guard.
 */

const DAY = 86400000
const EAT_MS = 3 * 3600 * 1000

// Monday 00:00 Nairobi of the most recently finished week (ms since epoch)
function lastWeekStart(now = Date.now()) {
  const l = new Date(now + EAT_MS)
  const dow = (l.getUTCDay() + 6) % 7
  return Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() - dow) - 7 * DAY - EAT_MS
}

const nairobi = (v, o) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', ...o }).format(new Date(v))
const weekLabel = (iso) => `${nairobi(iso, { day: 'numeric', month: 'short' })} to ${nairobi(new Date(iso).getTime() + 6 * DAY, { day: 'numeric', month: 'short' })}`
const whenLabel = (iso) => nairobi(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const REASONS = {
  campus_threshold: 'Not enough active students',
  too_few_tracks: 'Fewer than 3 songs qualified',
  metadata_pending: 'Waiting for song details to be verified',
  partial_metadata: 'Published without songs that could not be verified',
}
const reasonLabel = (r) => (!r ? '' : REASONS[r] || `Error: ${String(r).slice(0, 120)}`)

// weaker: which direction makes privacy protection weaker (shown as a warning before saving)
const FIELDS = [
  { key: 'min_campus_contributors', label: 'Minimum students per campus', hint: 'A chart is published only if at least this many students at the campus took part that week.', min: 10, weaker: 'lower' },
  { key: 'min_track_contributors', label: 'Minimum students per song', hint: 'A song needs at least this many different students to appear.', min: 3, weaker: 'lower' },
  { key: 'min_artist_contributors', label: 'Minimum students per artist', hint: 'Counted as different students across all of an artist’s songs.', min: 3, weaker: 'lower' },
  { key: 'min_genre_contributors', label: 'Minimum students per genre', hint: 'Smaller genres are merged into Other or left out.', min: 5, weaker: 'lower' },
  { key: 'max_tracks_per_user', label: 'Most songs one student can count for', hint: 'Stops one person from steering the chart.', min: 5, max: 100, weaker: 'higher' },
  { key: 'min_account_age_days', label: 'Minimum account age (days)', hint: 'Newer accounts are not counted.', min: 0, max: 90, weaker: 'lower' },
  { key: 'chart_size', label: 'Songs in the weekly chart', hint: 'How many ranked songs are published.', min: 10, max: 50 },
  { key: 'rising_min_growth_pct', label: 'Growth needed to count as rising (%)', hint: 'Compared with the previous week’s number of students.', min: 10, max: 1000 },
  { key: 'internal_retention_days', label: 'Days to keep exact song totals', hint: 'Exact totals stay in an admin-only table, then are deleted.', min: 28, max: 365, weaker: 'higher' },
]

const toDraft = (s) => ({
  ...Object.fromEntries(FIELDS.map((f) => [f.key, String(s[f.key])])),
  adds: String(Math.round(Number(s.weight_adds) * 100)),
  feature_enabled: Boolean(s.feature_enabled),
})

function validate(d) {
  const e = {}
  for (const f of FIELDS) {
    const raw = String(d[f.key]).trim()
    const n = Number(raw)
    if (raw === '' || !Number.isInteger(n) || n < f.min || (f.max != null && n > f.max)) {
      e[f.key] = `Enter a whole number from ${f.min}${f.max != null ? ` to ${f.max}` : ' upwards'}`
    }
  }
  const raw = String(d.adds).trim()
  const a = Number(raw)
  if (raw === '' || !Number.isInteger(a) || a < 0 || a > 100) e.adds = 'Enter a whole number from 0 to 100'
  return e
}

function diffs(s, d) {
  const out = []
  for (const f of FIELDS) {
    const n = Number(d[f.key])
    if (Number.isInteger(n) && n !== s[f.key]) {
      out.push({ key: f.key, label: f.label, from: s[f.key], to: n, weaker: f.weaker === 'lower' ? n < s[f.key] : f.weaker === 'higher' ? n > s[f.key] : false })
    }
  }
  const a = Number(d.adds)
  const cur = Math.round(Number(s.weight_adds) * 100)
  if (Number.isInteger(a) && a >= 0 && a <= 100 && a !== cur) {
    out.push({ key: 'weights', label: 'Ranking weights (playlist adds / plays)', from: `${cur} / ${100 - cur}`, to: `${a} / ${100 - a}`, weaker: false })
  }
  if (d.feature_enabled !== Boolean(s.feature_enabled)) {
    out.push({ key: 'feature_enabled', label: 'Campus Trends', from: s.feature_enabled ? 'On' : 'Off', to: d.feature_enabled ? 'On' : 'Off', weaker: false })
  }
  return out
}

/* ── small pieces ── */

function Card({ colors, title, hint, children }) {
  return (
    <section style={{ marginBottom: 16, padding: '16px 16px 18px', borderRadius: 18, background: colors.surface2, border: `1px solid ${colors.border}` }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>{title}</h3>
      {hint && <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5, color: colors.textMuted }}>{hint}</p>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  )
}

function Chip({ colors, level, children }) {
  const map = {
    ok: { bg: 'rgba(74,222,128,0.16)', fg: colors.isDark ? '#4ade80' : '#15803d' },
    warn: { bg: 'rgba(251,191,36,0.18)', fg: colors.isDark ? '#fbbf24' : '#92400e' },
    bad: { bg: 'rgba(248,113,113,0.16)', fg: colors.isDark ? '#fca5a5' : '#b91c1c' },
    info: { bg: 'rgba(167,139,250,0.16)', fg: colors.isDark ? '#c4b5fd' : '#5b4bd5' },
  }[level] || {}
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: map.bg, color: map.fg }}>{children}</span>
}

const btn = (colors, primary) => ({
  minHeight: 44, padding: '0 16px', borderRadius: 12, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
  border: primary ? 'none' : `1.5px solid ${colors.isDark ? 'rgba(167,139,250,0.6)' : '#6c63ff'}`,
  background: primary ? 'linear-gradient(135deg,#6c63ff,#5648e6)' : 'transparent',
  color: primary ? '#fff' : colors.textPrimary,
})

const inputStyle = (colors, bad) => ({
  width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0 12px', borderRadius: 10, fontFamily: 'inherit',
  fontSize: 16, // 16px stops iOS from zooming into the field
  color: colors.textPrimary, background: colors.surface1, border: `1.5px solid ${bad ? '#f87171' : colors.border}`,
})

const Msg = ({ colors, m }) => !m ? null : (
  <div role={m.kind === 'error' ? 'alert' : 'status'} style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: m.kind === 'error' ? (colors.isDark ? '#fca5a5' : '#b91c1c') : colors.textPrimary, background: m.kind === 'error' ? 'rgba(248,113,113,0.12)' : 'rgba(167,139,250,0.14)' }}>
    {m.text}
  </div>
)

/* ── settings ── */

function SettingsCard({ settings, colors, onSaved }) {
  const [draft, setDraft] = useState(() => toDraft(settings))
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => { setDraft(toDraft(settings)) }, [settings])

  const errors = useMemo(() => validate(draft), [draft])
  const changes = useMemo(() => diffs(settings, draft), [settings, draft])
  const invalid = Object.keys(errors).length > 0
  const set = (k, v) => { setDraft((d) => ({ ...d, [k]: v })); setReview(false); setMsg(null) }
  const weaker = changes.filter((c) => c.weaker)

  const save = async () => {
    setBusy(true)
    setMsg(null)
    const payload = {}
    for (const c of changes) {
      if (c.key === 'weights') { const a = Number(draft.adds); payload.weight_adds = a / 100; payload.weight_plays = (100 - a) / 100 }
      else if (c.key === 'feature_enabled') payload.feature_enabled = draft.feature_enabled
      else payload[c.key] = c.to
    }
    const { error } = await supabase.from('campus_trend_settings').update(payload).eq('id', 1).select().single()
    setBusy(false)
    if (error) {
      setMsg({ kind: 'error', text: error.code === 'PGRST116' ? "You don't have permission to change these settings."
        : error.code === '23514' ? 'One of the values is outside the allowed range.' : "Couldn't save. Please try again." })
      return
    }
    setReview(false)
    setMsg({ kind: 'ok', text: 'Saved. The changes apply from the next weekly run. Weeks already published are not changed.' })
    onSaved()
  }

  const adds = Number(draft.adds)
  return (
    <Card colors={colors} title="Settings" hint="These control the next weekly run. Limits are enforced by the database as well, so nothing here can go below the safe minimums.">
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 13.5, fontWeight: 700, color: colors.textPrimary, cursor: 'pointer' }}>
        <input type="checkbox" checked={draft.feature_enabled} onChange={(e) => set('feature_enabled', e.target.checked)} style={{ width: 20, height: 20, accentColor: '#6c63ff' }} />
        Campus Trends is on
      </label>

      <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`ctadm-${f.key}`} style={{ display: 'block', fontSize: 13, fontWeight: 700, color: colors.textPrimary, marginBottom: 4 }}>{f.label}</label>
            <input id={`ctadm-${f.key}`} inputMode="numeric" value={draft[f.key]} onChange={(e) => set(f.key, e.target.value)} aria-invalid={Boolean(errors[f.key])} aria-describedby={`ctadm-${f.key}-h`} style={inputStyle(colors, errors[f.key])} />
            <div id={`ctadm-${f.key}-h`} style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.45, color: errors[f.key] ? (colors.isDark ? '#fca5a5' : '#b91c1c') : colors.textMuted }}>
              {errors[f.key] || f.hint}
            </div>
          </div>
        ))}

        <div>
          <label htmlFor="ctadm-adds" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: colors.textPrimary, marginBottom: 4 }}>Weight of playlist adds (%)</label>
          <input id="ctadm-adds" inputMode="numeric" value={draft.adds} onChange={(e) => set('adds', e.target.value)} aria-invalid={Boolean(errors.adds)} aria-describedby="ctadm-adds-h" style={inputStyle(colors, errors.adds)} />
          <div id="ctadm-adds-h" style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.45, color: errors.adds ? (colors.isDark ? '#fca5a5' : '#b91c1c') : colors.textMuted }}>
            {errors.adds || `Plays get the rest: ${100 - adds}%. Adds show deliberate interest; plays show listening.`}
          </div>
        </div>
      </div>

      {!review && (
        <button disabled={invalid || changes.length === 0} onClick={() => setReview(true)}
          style={{ ...btn(colors, true), marginTop: 16, opacity: invalid || changes.length === 0 ? 0.5 : 1, cursor: invalid || changes.length === 0 ? 'default' : 'pointer' }}>
          Review changes{changes.length ? ` (${changes.length})` : ''}
        </button>
      )}

      {review && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: colors.surface1, border: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: colors.textPrimary, marginBottom: 8 }}>You are about to change</div>
          {changes.map((c) => (
            <div key={c.key} style={{ fontSize: 12.5, lineHeight: 1.5, color: colors.textSecondary }}>
              {c.label}: <strong style={{ color: colors.textPrimary }}>{String(c.from)} → {String(c.to)}</strong>
            </div>
          ))}
          {weaker.length > 0 && (
            <div role="alert" style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5, fontWeight: 600, color: colors.textPrimary, background: 'rgba(251,191,36,0.16)' }}>
              This weakens privacy protection: {weaker.map((c) => c.label.toLowerCase()).join('; ')}. Smaller groups make it easier to work out what a few students did. Continue only if you are sure.
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button disabled={busy} onClick={save} style={{ ...btn(colors, true), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {busy ? <IconLoader2 size={16} /> : <IconCheck size={16} />}{busy ? 'Saving' : 'Confirm and save'}
            </button>
            <button disabled={busy} onClick={() => setReview(false)} style={{ ...btn(colors, false), flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}
      <Msg colors={colors} m={msg} />
    </Card>
  )
}

/* ── campuses ── */

function CampusesCard({ rows, colors, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState(null)

  const toggle = async (c) => {
    if (c.is_active && !window.confirm(`Deactivate ${c.name}? Its students will stop seeing charts, and no new weekly chart will be made for it.`)) return
    setBusyId(c.id); setMsg(null)
    const { error } = await supabase.from('campuses').update({ is_active: !c.is_active }).eq('id', c.id)
    setBusyId(null)
    if (error) { setMsg({ kind: 'error', text: "Couldn't change that campus." }); return }
    onChanged()
  }

  const slugOk = /^[a-z0-9-]{2,40}$/.test(slug)
  const nameOk = name.trim().length >= 2 && name.trim().length <= 120
  const add = async () => {
    setBusyId('new'); setMsg(null)
    const { error } = await supabase.from('campuses').insert({ slug, name: name.trim(), is_active: false })
    setBusyId(null)
    if (error) { setMsg({ kind: 'error', text: error.code === '23505' ? 'That short name is already used.' : "Couldn't add the campus." }); return }
    setSlug(''); setName(''); setMsg({ kind: 'ok', text: 'Added. It is switched off until you activate it.' })
    onChanged()
  }

  return (
    <Card colors={colors} title="Campuses" hint="A campus must be active for students to pick it and for its chart to be made.">
      {rows.map((c) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{c.name}</div>
            <div style={{ fontSize: 11.5, color: colors.textMuted }}>{c.slug}</div>
          </div>
          <Chip colors={colors} level={c.is_active ? 'ok' : 'info'}>{c.is_active ? 'Active' : 'Off'}</Chip>
          <button disabled={busyId === c.id} onClick={() => toggle(c)} style={{ ...btn(colors, false), minHeight: 40, padding: '0 12px' }}>
            {c.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      ))}
      <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>Add a campus</div>
        <input aria-label="Short name, for example jkuat" placeholder="Short name, e.g. jkuat" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} style={inputStyle(colors, slug && !slugOk)} />
        <input aria-label="Full name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle(colors, false)} />
        <div style={{ fontSize: 11.5, color: colors.textMuted }}>Short name: 2 to 40 characters, lower-case letters, numbers and hyphens.</div>
        <button disabled={!slugOk || !nameOk || busyId === 'new'} onClick={add} style={{ ...btn(colors, true), opacity: slugOk && nameOk ? 1 : 0.5, cursor: slugOk && nameOk ? 'pointer' : 'default' }}>Add campus</button>
      </div>
      <Msg colors={colors} m={msg} />
    </Card>
  )
}

/* ── the screen ── */

function describe(a, me) {
  const who = a.actor === me ? 'You' : a.actor ? 'Another admin' : 'System'
  const changed = (keys) => keys.filter((k) => JSON.stringify(a.new_values?.[k]) !== JSON.stringify(a.old_values?.[k]))
    .map((k) => `${k}: ${a.old_values?.[k] ?? 'none'} → ${a.new_values?.[k]}`).join(', ')
  let what
  if (a.action === 'settings_update') what = changed(Object.keys(a.new_values || {}).filter((k) => !['updated_at', 'updated_by'].includes(k))) || 'saved with no changes'
  else if (a.action === 'campus_insert') what = `added campus ${a.new_values?.slug}`
  else if (a.action === 'campus_update') what = `${a.new_values?.slug}: ${changed(['name', 'is_active']) || 'updated'}`
  else what = a.action
  return { who, what }
}

export default function CampusTrendsAdmin({ onClose }) {
  const colors = useMusicColors()
  const { userId } = useMusicPlayer()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      const [ov, cs, st, au] = await Promise.all([
        supabase.rpc('campus_trends_admin_overview'),
        supabase.from('campuses').select('id, slug, name, is_active').order('name'),
        supabase.from('campus_trend_settings').select('*').eq('id', 1).single(),
        supabase.from('campus_trend_audit').select('id, at, actor, action, old_values, new_values').order('id', { ascending: false }).limit(20),
      ])
      const failed = [ov, cs, st, au].find((r) => r.error)
      if (failed) throw failed.error
      if (alive.current) setData({ overview: ov.data, campuses: cs.data, settings: st.data, audit: au.data })
    } catch (e) {
      if (alive.current) setError(e?.code === '42501' ? "You don't have access to this screen." : "Couldn't load Campus Trends admin data.")
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const view = useMemo(() => {
    if (!data) return null
    const optedBySlug = new Map((data.overview?.campuses || []).map((c) => [c.slug, c.opted_in]))
    const campuses = data.campuses.map((c) => ({ ...c, opted_in: optedBySlug.get(c.slug) ?? 0 }))
    const byId = new Map(campuses.map((c) => [c.id, c]))
    const runs = data.overview?.recent_runs || []
    const start = lastWeekStart()
    const health = campuses.filter((c) => c.is_active).map((c) => {
      const run = runs.find((r) => r.campus_id === c.id && new Date(r.period_start).getTime() === start)
      if (!run) return Date.now() - (start + 7 * DAY) > 2 * 3600 * 1000
        ? { c, level: 'warn', text: 'No weekly run is recorded for last week.' }
        : { c, level: 'info', text: 'Waiting for the weekly run.' }
      if (run.status === 'failed') return { c, level: 'bad', text: `Last week's run failed: ${reasonLabel(run.reason)}` }
      if (run.status === 'published' && run.reason === 'partial_metadata') return { c, level: 'warn', text: 'Published, but some songs were left out because their details could not be verified.' }
      if (run.status === 'published') return { c, level: 'ok', text: "Last week's chart was published." }
      return { c, level: 'info', text: `Last week's chart was not published: ${reasonLabel(run.reason) || run.status}.` }
    })
    return { campuses, byId, runs, health, optedTotal: campuses.reduce((n, c) => n + (c.opted_in || 0), 0) }
  }, [data])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 40 }}>
      <style>{`.ctadm-spin svg { animation: ctadmSpin .8s linear infinite } @keyframes ctadmSpin { to { transform: rotate(360deg) } } @media (prefers-reduced-motion: reduce) { .ctadm-spin svg { animation: none } } .ctadm button:focus-visible, .ctadm input:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px }`}</style>
      <div className="ctadm">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 6px' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: -0.3, color: colors.textPrimary }}>Campus Trends admin</h2>
          <button onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, borderRadius: '50%', border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.textPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconX size={18} />
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12, lineHeight: 1.5, color: colors.textMuted }}>
          Campus-level numbers only. What an individual student listens to or saves cannot be seen here.
        </p>

        {loading && <div className="ctadm-spin" style={{ padding: 24, display: 'flex', justifyContent: 'center', color: colors.textSecondary }}><IconLoader2 size={22} /></div>}

        {!loading && error && (
          <Card colors={colors} title="Couldn't load">
            <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>{error}</div>
            <button onClick={() => { setLoading(true); load() }} style={btn(colors, true)}>Try again</button>
          </Card>
        )}

        {view && (
          <>
            <Card colors={colors} title="Overview" hint={`${view.optedTotal} student${view.optedTotal === 1 ? '' : 's'} opted in across all campuses. This counts choices, not activity.`}>
              {view.campuses.length === 0 && <div style={{ fontSize: 13, color: colors.textSecondary }}>No campuses yet.</div>}
              {view.campuses.map((c) => {
                const h = view.health.find((x) => x.c.id === c.id)
                return (
                  <div key={c.id} style={{ padding: '10px 0', borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{c.name}</div>
                      <Chip colors={colors} level={c.is_active ? 'ok' : 'info'}>{c.is_active ? 'Active' : 'Off'}</Chip>
                    </div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{c.opted_in} opted in</div>
                    {h && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 6, fontSize: 12, lineHeight: 1.45, color: colors.textPrimary }}>
                        {h.level === 'ok' ? <IconCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <IconAlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
                        <span>{h.text}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </Card>

            <Card colors={colors} title="Recent weekly runs" hint="Weeks run Monday to Sunday, Nairobi time. A published week is final.">
              {view.runs.length === 0 && <div style={{ fontSize: 13, color: colors.textSecondary }}>No runs yet. The first runs after the first full week.</div>}
              {view.runs.map((r) => {
                const level = r.status === 'published' ? (r.reason ? 'warn' : 'ok') : r.status === 'failed' ? 'bad' : 'info'
                return (
                  <div key={`${r.campus_id}-${r.period_start}-${r.ran_at}`} style={{ padding: '10px 0', borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{view.byId.get(r.campus_id)?.name || 'Campus'} · {weekLabel(r.period_start)}</div>
                      <Chip colors={colors} level={level}>{r.status === 'published' ? 'Published' : r.status === 'failed' ? 'Failed' : 'Not published'}</Chip>
                    </div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {r.active_contributors != null ? `${r.active_contributors} active students` : ''}
                      {r.tracks_published != null ? ` · ${r.tracks_published} songs` : ''}
                      {r.reason ? `${r.active_contributors != null ? ' · ' : ''}${reasonLabel(r.reason)}` : ''}
                      {' · ran '}{whenLabel(r.ran_at)}
                    </div>
                  </div>
                )
              })}
              <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.5, color: colors.textMuted }}>
                A failed or "waiting for song details" week retries automatically through Monday, then publishes with the songs that are verified.
              </div>
            </Card>

            <SettingsCard settings={data.settings} colors={colors} onSaved={load} />
            <CampusesCard rows={view.campuses} colors={colors} onChanged={load} />

            <Card colors={colors} title="Change log" hint="Every settings and campus change is recorded.">
              {data.audit.length === 0 && <div style={{ fontSize: 13, color: colors.textSecondary }}>No changes yet.</div>}
              {data.audit.map((a) => {
                const d = describe(a, userId)
                return (
                  <div key={a.id} style={{ padding: '8px 0', borderBottom: `1px solid ${colors.border}`, fontSize: 12, lineHeight: 1.5, color: colors.textSecondary }}>
                    <span style={{ color: colors.textMuted }}>{whenLabel(a.at)}</span> · <strong style={{ color: colors.textPrimary }}>{d.who}</strong> {d.what}
                  </div>
                )
              })}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
