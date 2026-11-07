import React, { useEffect, useMemo, useState } from 'react'
import { formatPeriod, getWrapped, getBattle } from '../../../../lib/music/CampusTrends'
import { IconPlay, IconMusic } from '../../../Icons'
import { Block, shortCampus } from './CampusTrendsExtras'

// Genre Wars, Campus Wrapped and the campus face-off. All three show only data that is already published
// for the campus (or, for the face-off, for both campuses). They never see or store anything about a person.

const artZoom = (url = '') => (/ytimg|ggpht|googleusercontent/i.test(url) ? 1.34 : 1)
const ellipsis = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const toTrack = (t) => ({ album: null, artistId: null, streamUrl: null, isDownloadable: false, ...t })
const ordinal = (n) => `#${n}`

function Thumb({ src, size, colors }) {
  const [bad, setBad] = useState(false)
  useEffect(() => { setBad(false) }, [src])
  return (
    <div style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: colors.surface1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {src && !bad
        ? <img src={src} alt="" loading="lazy" draggable={false} onError={() => setBad(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${artZoom(src)})` }} />
        : <IconMusic size={Math.round(size * 0.4)} style={{ color: colors.textMuted }} />}
    </div>
  )
}

function Panel({ colors, children }) {
  return <div style={{ borderRadius: 18, padding: 4, background: colors.surface2, border: `1px solid ${colors.border}` }}>{children}</div>
}

function Label({ colors, children }) {
  return <div style={{ margin: '12px 4px 4px', fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted }}>{children}</div>
}

function MiniRow({ track, lead, tag, colors, accent, disabled, onPlay }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px 8px 10px' }}>
      {lead && <div style={{ width: 62, flexShrink: 0, fontSize: 11.5, fontWeight: 800, lineHeight: 1.35, color: colors.textSecondary }}>{lead}</div>}
      <Thumb src={track.artwork} size={44} colors={colors} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, ...ellipsis }}>{track.title}</div>
        <div style={{ fontSize: 11.5, color: colors.textSecondary, ...ellipsis }}>{track.artist}</div>
        {tag && <span style={{ display: 'inline-block', marginTop: 3, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, padding: '1px 6px', borderRadius: 5, textTransform: 'uppercase', color: accent, background: 'rgba(167,139,250,0.16)' }}>{tag}</span>}
      </div>
      <button className="ctt-btn" disabled={disabled} onClick={() => onPlay(track)} aria-label={`Play ${track.title}`}
        style={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', border: 'none', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.surface1, color: colors.textPrimary }}>
        <IconPlay size={15} style={{ marginLeft: 1 }} />
      </button>
    </div>
  )
}

// Fetches once. These blocks are extras: if anything goes wrong they simply stay hidden.
function useExtra(loader, userId, demoData) {
  const [data, setData] = useState(demoData || null)
  useEffect(() => {
    if (demoData) { setData(demoData); return undefined }
    if (!userId) return undefined
    let alive = true
    loader().then((d) => { if (alive) setData(d) }).catch(() => {})
    return () => { alive = false }
   
  }, [userId, demoData])
  return data
}

/* ── Genre Wars ── */

const selectStyle = (colors) => ({
  width: '100%', minHeight: 44, padding: '0 10px', borderRadius: 12, fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
  color: colors.textPrimary, background: colors.surface1, border: `1.5px solid ${colors.border}`,
})

export function GenreWars({ chart, colors, delay = 0 }) {
  const genres = chart?.genres || []
  const names = genres.map((g) => g.genre)
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)
  if (names.length < 2) return null

  const left = a && names.includes(a) ? a : names[0]
  const right = b && names.includes(b) && b !== left ? b : names.find((n) => n !== left)
  const share = (n) => genres.find((g) => g.genre === n)?.share_pct ?? 0
  const sa = share(left)
  const sb = share(right)
  const total = sa + sb
  const pa = total ? (sa / total) * 100 : 50
  const pickLeft = (v) => { if (v === right) setB(left); setA(v) }
  const pickRight = (v) => { if (v === left) setA(right); setB(v) }
  const verdict = sa === sb ? `${left} and ${right} are level this week.` : sa > sb ? `${left} is ahead of ${right} this week.` : `${right} is ahead of ${left} this week.`

  return (
    <Block colors={colors} delay={delay} title="Genre Wars" subtitle="Pick two genres and see which one your campus is picking more this week.">
      <div style={{ padding: 14, borderRadius: 18, background: colors.surface2, border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select aria-label="First genre" value={left} onChange={(e) => pickLeft(e.target.value)} style={selectStyle(colors)}>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span aria-hidden="true" style={{ fontSize: 12, fontWeight: 900, color: colors.textMuted }}>vs</span>
          <select aria-label="Second genre" value={right} onChange={(e) => pickRight(e.target.value)} style={selectStyle(colors)}>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '14px 2px 6px', fontSize: 13, fontWeight: 800, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
          <span>{left} {sa}%</span><span>{sb}% {right}</span>
        </div>
        <div aria-hidden="true" style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
          <div style={{ width: `${pa}%`, background: 'linear-gradient(90deg,#6c63ff,#a78bfa)' }} />
          <div style={{ flex: 1, background: colors.isDark ? '#22d3ee' : '#0e7490' }} />
        </div>
        <div role="status" style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>{verdict}</div>
        <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.5, color: colors.textMuted }}>Shares are rounded to the nearest 5% and count genre picks, not students.</div>
      </div>
    </Block>
  )
}

/* ── Campus Wrapped: the last four weekly charts ── */

export function CampusWrapped({ userId, colors, accent = '#a78bfa', disabled = false, onPlayList, demoData, delay = 0 }) {
  const data = useExtra(getWrapped, userId, demoData)

  const tracks = useMemo(() => {
    if (!data || data.status !== 'ok') return []
    const out = [data.song?.track, ...(data.staying || []).map((s) => s.track), ...(data.newcomers || []).map((s) => s.track)].filter(Boolean)
    const seen = new Set()
    return out.filter((t) => !seen.has(t.id) && seen.add(t.id)).map(toTrack)
  }, [data])

  if (!data) return null

  if (data.status === 'not_enough_history') {
    return (
      <Block colors={colors} delay={delay} title="Campus Wrapped">
        <div style={{ padding: '14px 16px', borderRadius: 18, fontSize: 13, lineHeight: 1.55, color: colors.textSecondary, background: colors.surface2, border: `1px solid ${colors.border}` }}>
          Campus Wrapped appears once your campus has three weekly charts. So far: {data.weeks || 0}.
        </div>
      </Block>
    )
  }
  if (data.status !== 'ok') return null

  const play = (track) => { if (!disabled) onPlayList(tracks, tracks.find((t) => t.id === track.id) || tracks[0]) }
  const song = data.song
  const period = formatPeriod(data)

  return (
    <Block colors={colors} delay={delay} title="Campus Wrapped" subtitle={`The last ${data.weeks} weeks${period ? ` · ${period}` : ''}`}>
      <div style={{ borderRadius: 20, padding: 16, color: '#fff', background: 'linear-gradient(135deg,#4a3fd4 0%,#2e2780 100%)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: '#ddd6fe' }}>Song of the month</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <div style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {song.track.artwork
              ? <img src={song.track.artwork} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${artZoom(song.track.artwork)})` }} />
              : <IconMusic size={28} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.3, ...ellipsis }}>{song.track.title}</div>
            <div style={{ fontSize: 13, color: '#e0e7ff', ...ellipsis }}>{song.track.artist}</div>
            <div style={{ fontSize: 12, color: '#e0e7ff', marginTop: 4 }}>On the chart {song.weeks} of {data.weeks} weeks · best rank {ordinal(song.best_rank)}</div>
          </div>
          <button className="ctt-btn" disabled={disabled} onClick={() => play(song.track)} aria-label={`Play ${song.track.title}`}
            style={{ width: 48, height: 48, flexShrink: 0, borderRadius: '50%', border: 'none', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#2e2780' }}>
            <IconPlay size={18} style={{ marginLeft: 2 }} />
          </button>
        </div>
        {data.artist && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)', fontSize: 13, color: '#e0e7ff' }}>
            Most charted artist: <strong style={{ color: '#fff' }}>{data.artist.name}</strong>
            {data.artist.songs > 1 ? ` · ${data.artist.songs} songs on the chart now` : ''}
          </div>
        )}
      </div>

      {(data.staying || []).length > 0 && (
        <>
          <Label colors={colors}>Staying power</Label>
          <Panel colors={colors}>
            {data.staying.map((s) => <MiniRow key={s.track.id} track={s.track} tag={`${s.weeks} weeks`} colors={colors} accent={accent} disabled={disabled} onPlay={play} />)}
          </Panel>
        </>
      )}
      {(data.newcomers || []).length > 0 && (
        <>
          <Label colors={colors}>Fresh this month</Label>
          <Panel colors={colors}>
            {data.newcomers.map((s) => <MiniRow key={s.track.id} track={s.track} tag={`Peak ${ordinal(s.best_rank)}`} colors={colors} accent={accent} disabled={disabled} onPlay={play} />)}
          </Panel>
        </>
      )}
      <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: colors.textMuted }}>
        Built only from published weekly charts, and only songs still on the chart. Nothing here shows what any person listened to.
      </div>
    </Block>
  )
}

/* ── Campus face-off: shown only when two campuses have both switched it on ── */

export function CampusFaceOff({ userId, colors, accent = '#a78bfa', disabled = false, onPlayList, demoData, delay = 0 }) {
  const data = useExtra(getBattle, userId, demoData)

  const shared = useMemo(() => (data?.shared || []).filter((s) => s.track), [data])
  const only = useMemo(() => (data?.only_there || []).filter((s) => s.track), [data])
  const tracks = useMemo(() => [...shared, ...only].map((s) => toTrack(s.track)), [shared, only])

  if (!data || data.status !== 'ok') return null

  const me = shortCampus(data.campus)
  const them = shortCampus(data.opponent)
  const period = formatPeriod(data)
  const play = (track) => { if (!disabled) onPlayList(tracks, tracks.find((t) => t.id === track.id) || tracks[0]) }

  return (
    <Block colors={colors} delay={delay} title={`Campus face-off: ${me} and ${them}`} subtitle={period ? `Week of ${period}` : undefined}>
      <div style={{ padding: '14px 16px', borderRadius: 18, background: colors.surface2, border: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
          {data.shared_total} of {data.my_songs} songs on your chart are also on {them}'s
        </div>
        <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: colors.textMuted }}>
          We compare taste, not size. Campuses differ in size, so there is no winner and no student numbers.
        </div>
      </div>

      {shared.length > 0 && (
        <>
          <Label colors={colors}>On both charts</Label>
          <Panel colors={colors}>
            {shared.map((s) => (
              <MiniRow key={s.track.id} track={s.track} colors={colors} accent={accent} disabled={disabled} onPlay={play}
                lead={<><div>{me} {ordinal(s.my_rank)}</div><div>{them} {ordinal(s.their_rank)}</div></>} />
            ))}
          </Panel>
        </>
      )}
      {only.length > 0 && (
        <>
          <Label colors={colors}>Big at {them}, not on your chart</Label>
          <Panel colors={colors}>
            {only.map((s) => <MiniRow key={s.track.id} track={s.track} tag={`${them} ${ordinal(s.their_rank)}`} colors={colors} accent={accent} disabled={disabled} onPlay={play} />)}
          </Panel>
        </>
      )}
    </Block>
  )
}
