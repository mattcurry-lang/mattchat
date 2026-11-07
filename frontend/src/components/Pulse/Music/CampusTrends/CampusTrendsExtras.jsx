import React, { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { formatPeriod } from '../../../../lib/music/CampusTrends'
import { IconPlay, IconShuffle, IconMusic, IconStar, IconUsers, IconTrendingUp, IconSparkles, IconChart } from '../../../Icons'

// Both blocks are built ONLY from the published chart. They never see or store anything about any person.

const artZoom = (url = '') => (/ytimg|ggpht|googleusercontent/i.test(url) ? 1.34 : 1)
const hueOf = (s) => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h }
const ellipsis = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

// "Dedan Kimathi University of Technology (DeKUT)" -> "DeKUT"
export function shortCampus(name = '') {
  const m = /\(([^)]{2,20})\)\s*$/.exec(name)
  return m ? m[1] : (name.split(' ')[0] || 'Campus')
}

const toTrack = (row) => ({ album: null, artistId: null, streamUrl: null, isDownloadable: false, ...row.track })

function shuffled(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}

export function Block({ title, subtitle, colors, delay = 0, children }) {
  const reduce = useReducedMotion()
  return (
    <motion.section
      aria-label={title}
      initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }} style={{ marginBottom: 22 }}
    >
      <h3 style={{ margin: '4px 2px 4px', fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, color: colors.textPrimary }}>{title}</h3>
      {subtitle && <p style={{ margin: '0 2px 10px', fontSize: 12, lineHeight: 1.5, color: colors.textMuted }}>{subtitle}</p>}
      {children}
    </motion.section>
  )
}

/* ── campus playlists (play-only) ── */

function CoverCell({ src, seed }) {
  const [bad, setBad] = useState(false)
  const h = hueOf(seed)
  return (
    <div style={{ overflow: 'hidden', background: `linear-gradient(135deg, hsl(${h} 60% 42%), hsl(${(h + 50) % 360} 62% 28%))` }}>
      {src && !bad && (
        <img src={src} alt="" loading="lazy" draggable={false} onError={() => setBad(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: `scale(${artZoom(src)})` }} />
      )}
    </div>
  )
}

function Cover({ items, name }) {
  const cells = [0, 1, 2, 3].map((i) => items[i]?.track?.artwork || null)
  return (
    <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2, aspectRatio: '1 / 1', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
      {cells.map((src, i) => <CoverCell key={i} src={src} seed={`${name}${i}`} />)}
    </div>
  )
}

export function CampusPlaylists({ chart, rows, colors, disabled = false, onPlayList, delay = 0 }) {
  const campus = shortCampus(chart?.campus)
  const lists = useMemo(() => {
    const out = []
    const add = (id, name, sub, items) => out.push({ id, name, sub, items })
    if (rows.length >= 3) add('top', `${campus} Top ${rows.length}`, 'This week’s chart', rows)
    const rising = rows.filter((r) => r.is_rising)
    if (rising.length >= 3) add('rising', `${campus} Rising Hits`, 'Climbing fastest', rising)
    const byGenre = new Map()
    for (const r of rows) {
      const g = r.track.genre
      if (g && g !== 'Other') byGenre.set(g, [...(byGenre.get(g) || []), r])
    }
    ;[...byGenre.entries()].filter(([, v]) => v.length >= 5).sort((a, b) => b[1].length - a[1].length).slice(0, 3)
      .forEach(([g, v]) => add(`genre-${g}`, `${campus} ${g}`, `${v.length} songs this week`, v))
    return out
  }, [rows, campus])

  if (!lists.length) return null

  const play = (l, shuffle) => {
    if (disabled) return
    const tracks = l.items.map(toTrack)
    onPlayList(shuffle ? shuffled(tracks) : tracks)
  }

  return (
    <Block colors={colors} delay={delay} title="Campus playlists"
      subtitle="Made from this week’s chart. Play them here. To keep a song, add it to your own playlist with the plus button, one at a time, so the chart reflects real choices.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {lists.map((l) => (
          <div key={l.id} style={{ padding: 10, borderRadius: 16, background: colors.surface2, border: `1px solid ${colors.border}`, minWidth: 0 }}>
            <Cover items={l.items} name={l.name} />
            <div style={{ margin: '8px 2px 10px', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: colors.textPrimary, ...ellipsis }}>{l.name}</div>
              <div style={{ fontSize: 11.5, color: colors.textSecondary, ...ellipsis }}>{l.sub}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="ctt-btn" disabled={disabled} onClick={() => play(l, false)} aria-label={`Play ${l.name}`}
                title={disabled ? 'Not available in demo mode' : undefined}
                style={{ flex: 1, minHeight: 44, borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color: '#fff', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg,#6c63ff,#5648e6)' }}
              >
                <IconPlay size={14} /> Play
              </button>
              <button
                className="ctt-btn" disabled={disabled} onClick={() => play(l, true)} aria-label={`Shuffle ${l.name}`}
                title={disabled ? 'Not available in demo mode' : undefined}
                style={{ width: 44, minHeight: 44, borderRadius: 12, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: colors.textPrimary, border: `1.5px solid ${colors.isDark ? 'rgba(167,139,250,0.6)' : '#6c63ff'}` }}
              >
                <IconShuffle size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Block>
  )
}

/* ── weekly recap ── */

function Tile({ colors, Icon, label, main, sub }) {
  return (
    <div style={{ padding: 12, borderRadius: 16, background: colors.surface2, border: `1px solid ${colors.border}`, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textMuted }}>
        <Icon size={13} /> {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, lineHeight: 1.3, color: colors.textPrimary, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{main}</div>
      {sub && <div style={{ marginTop: 2, fontSize: 12, color: colors.textSecondary, ...ellipsis }}>{sub}</div>}
    </div>
  )
}

export function WeeklyRecap({ chart, rows, colors, delay = 0 }) {
  const s = useMemo(() => {
    if (!rows.length) return null
    const prev = Boolean(chart?.has_previous)
    const climbers = rows.filter((r) => r.movement === 'up')
    const best = climbers.reduce((a, r) => (!a || (r.rank_change || 0) > (a.rank_change || 0) ? r : a), null)
    return {
      prev,
      top: rows[0],
      artist: chart.artists?.[0] || null,
      genre: chart.genres?.[0] || null,
      best,
      fresh: rows.filter((r) => r.movement === 'new').length,
      up: climbers.length,
      down: rows.filter((r) => r.movement === 'down').length,
      same: rows.filter((r) => r.movement === 'same').length,
    }
  }, [chart, rows])

  if (!s) return null
  const period = formatPeriod(chart)

  return (
    <Block colors={colors} delay={delay} title="Weekly recap" subtitle={period ? `Week of ${period}` : undefined}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Tile colors={colors} Icon={IconStar} label="Top song" main={s.top.track.title} sub={s.top.track.artist} />
        {s.artist && <Tile colors={colors} Icon={IconUsers} label="Top artist" main={s.artist.name} />}
        {s.genre && <Tile colors={colors} Icon={IconMusic} label="Leading genre" main={s.genre.genre} sub={`${s.genre.share_pct}% of genre picks`} />}
        {s.prev && s.best && (
          <Tile colors={colors} Icon={IconTrendingUp} label="Biggest climber" main={s.best.track.title} sub={`Up ${s.best.rank_change} place${s.best.rank_change === 1 ? '' : 's'}`} />
        )}
        {s.prev && (
          <Tile colors={colors} Icon={IconSparkles} label="New on the chart" main={s.fresh === 0 ? 'No new songs' : `${s.fresh} new song${s.fresh === 1 ? '' : 's'}`} />
        )}
        {s.prev && (
          <Tile colors={colors} Icon={IconChart} label="Chart movement" main={`${s.up} up · ${s.down} down`} sub={`${s.same} unchanged`} />
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: colors.textMuted }}>
        {s.prev
          ? 'Built only from the published chart. Nothing here shows what any person listened to.'
          : 'Changes from the previous week appear once there are two weekly charts to compare.'}
      </div>
    </Block>
  )
}
