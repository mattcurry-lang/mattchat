// src/components/CurryMedia.jsx
// The playable cards Curry shows under its reply when you ask for a song or a video.
//
//   songs   a hero card (artwork with a soft glow, title, artist, source, play/pause) plus
//           "More results" for the alternatives. Plays through your normal music player, so
//           the mini player, queue and offline saving all behave like any other song.
//   videos  a big thumbnail you tap to play, plus smaller rows. Opens your YouTube player
//           (or YouTube itself if this screen has no player to open).
//
// Props: media (see lib/curryMediaFlow), onPlayYouTube(videoId) optional.

import React, { useState } from 'react'
import { useMusicPlayer } from './context/MusicPlayerContext'
import { ensureYouTubeStyles } from './youtube/youtubeStyles'
import { PlayIcon } from './youtube/ytIcons'
import { baseThumbUrl, fallbackThumbUrl, decodeEntities, formatDuration, watchUrl, avatarGradient, initialOf } from '../lib/youtubeThumb'

const CSS = `
.mc-cm{display:flex; flex-direction:column; gap:8px; margin-top:8px; width:min(340px,100%)}
.mc-cm-hero{position:relative; isolation:isolate; display:flex; align-items:center; gap:12px; padding:10px; border-radius:18px; background:var(--yt-surface); border:1px solid var(--yt-line); box-shadow:0 10px 28px -14px rgba(0,0,0,.7)}
.mc-cm-glow{position:absolute; inset:-10px; z-index:-1; border-radius:26px; background-size:cover; background-position:center; filter:blur(24px) saturate(1.6); opacity:.45; pointer-events:none}
.mc-cm-art{position:relative; width:64px; height:64px; flex:none; border-radius:14px; overflow:hidden; display:grid; place-items:center; color:#fff; background:linear-gradient(135deg,#6d28d9,#0e7490)}
.mc-cm-art img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover}
.mc-cm-meta{min-width:0; flex:1; display:flex; flex-direction:column; gap:3px}
.mc-cm-title{display:flex; align-items:center; gap:7px; font-size:14px; font-weight:700; line-height:1.3; color:var(--yt-text); min-width:0}
.mc-cm-title>span:first-child{overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.mc-cm-artist{font-size:12.5px; color:var(--yt-text2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.mc-cm-tags{display:flex; align-items:center; gap:7px; margin-top:2px}
.mc-cm-pill{font-size:10.5px; font-weight:750; padding:1px 8px; border-radius:999px; color:var(--yt-text2); background:rgba(255,255,255,.08); border:1px solid var(--yt-line)}
.mc-cm-dur{font-size:11.5px; color:var(--yt-text3); font-variant-numeric:tabular-nums}
.mc-cm-play{width:46px; height:46px; flex:none; border:0; border-radius:50%; display:grid; place-items:center; color:#fff; background:var(--yt-grad); box-shadow:0 6px 18px -6px rgba(14,116,144,.7); transition:transform .15s,filter .2s}
.mc-cm-play:hover{filter:brightness(1.12)}
.mc-cm-play:active{transform:scale(.94)}
.mc-cm-eq{display:inline-flex; align-items:flex-end; gap:2px; height:11px; flex:none}
.mc-cm-eq i{display:block; width:2.5px; height:3px; border-radius:1px; background:var(--yt-cyan); animation:mc-cm-eq .9s ease-in-out infinite}
.mc-cm-eq i:nth-child(2){animation-delay:.2s} .mc-cm-eq i:nth-child(3){animation-delay:.4s}
@keyframes mc-cm-eq{0%,100%{height:3px}50%{height:11px}}
.mc-cm-list{display:flex; flex-direction:column; gap:6px}
.mc-cm-row{display:flex; align-items:center; gap:10px; padding:6px 8px; border-radius:14px; background:rgba(255,255,255,.04); border:1px solid var(--yt-line)}
.mc-cm-row .mc-cm-art{width:40px; height:40px; border-radius:10px}
.mc-cm-row .mc-cm-play{width:34px; height:34px}
.mc-cm-note{font-size:12px; color:var(--yt-text3); margin:0 2px}
.mc-cm-vhero{position:relative; display:block; width:100%; padding:0; border:0; border-radius:16px; overflow:hidden; aspect-ratio:16/9; background:#0b0a14; text-align:left}
.mc-cm-vhero:hover .mc-yt-img{transform:scale(1.045)}
.mc-cm-vcap{position:absolute; left:0; right:0; bottom:0; padding:22px 12px 10px; background:linear-gradient(to top,rgba(10,8,24,.88),transparent); color:#fff}
.mc-cm-vcap b{display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; font-size:13.5px; line-height:1.3}
.mc-cm-vcap span{display:block; margin-top:2px; font-size:11.5px; color:#d6d1ef}
.mc-cm-vrow{display:flex; align-items:center; gap:10px; width:100%; padding:6px; border-radius:14px; border:1px solid var(--yt-line); background:rgba(255,255,255,.04); text-align:left; color:var(--yt-text)}
.mc-cm-vrow:hover{background:rgba(255,255,255,.08)}
.mc-cm-vthumb{position:relative; width:96px; flex:none; aspect-ratio:16/9; border-radius:10px; overflow:hidden; background:#0b0a14}
.mc-cm-vthumb .mc-yt-play{width:30px; height:30px; margin:-15px 0 0 -15px}
.mc-cm-vinfo{min-width:0}
.mc-cm-vinfo b{display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; font-size:12.5px; line-height:1.3; font-weight:650}
.mc-cm-vinfo span{display:block; margin-top:2px; font-size:11.5px; color:var(--yt-text2)}
`

function ensureCurryMediaStyles() {
  ensureYouTubeStyles()
  if (typeof document === 'undefined' || document.getElementById('mc-cm-styles')) return
  const el = document.createElement('style')
  el.id = 'mc-cm-styles'
  el.textContent = CSS
  document.head.appendChild(el)
}
ensureCurryMediaStyles()

const PROVIDERS = { youtube: 'YouTube', mattchat: 'Mattchat', jamendo: 'Jamendo', audius: 'Audius', spotify: 'Spotify' }

const NoteGlyph = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></svg>
)
const PauseGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
)

function Art({ track }) {
  const [bad, setBad] = useState(false)
  return (
    <span className="mc-cm-art">
      {track.artwork && !bad ? <img src={track.artwork} alt="" loading="lazy" onError={() => setBad(true)} /> : <NoteGlyph />}
    </span>
  )
}

function SongCard({ track, queue, hero, player }) {
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = player
  const isThis = !!currentTrack && currentTrack.id === track.id
  const playing = isThis && !!isPlaying
  const duration = formatDuration(track.duration)
  const label = `${playing ? 'Pause' : 'Play'} ${track.title}${track.artist ? ` by ${track.artist}` : ''}`

  const onClick = () => {
    if (isThis && togglePlayPause) togglePlayPause()
    // the other results go in as the queue, so "next" carries on through them
    else if (playTrack) playTrack(track, queue, { origin: 'chat' })
  }

  return (
    <div className={hero ? 'mc-cm-hero' : 'mc-cm-row'}>
      {hero && track.artwork && <span className="mc-cm-glow" aria-hidden="true" style={{ backgroundImage: `url(${track.artwork})` }} />}
      <Art track={track} />
      <div className="mc-cm-meta">
        <div className="mc-cm-title">
          <span>{track.title}</span>
          {playing && <span className="mc-cm-eq" aria-hidden="true"><i /><i /><i /></span>}
        </div>
        <div className="mc-cm-artist">{track.artist}</div>
        {hero && (
          <div className="mc-cm-tags">
            <span className="mc-cm-pill">{PROVIDERS[track.provider] || track.provider || 'Music'}</span>
            {duration && <span className="mc-cm-dur">{duration}</span>}
          </div>
        )}
      </div>
      <button type="button" className="mc-cm-play" onClick={onClick} aria-label={label} aria-pressed={playing} disabled={!playTrack}>
        {playing ? <PauseGlyph /> : <PlayIcon size={hero ? 20 : 16} />}
      </button>
    </div>
  )
}

function SongList({ media }) {
  const player = useMusicPlayer() || {}
  const [open, setOpen] = useState(false)
  const [first, ...rest] = media.tracks
  if (!first) return null
  return (
    <div className="mc-yt mc-cm">
      <SongCard track={first} queue={media.tracks} hero player={player} />
      {rest.length > 0 && (
        <button type="button" className="mc-yt-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Hide other results' : `More results (${rest.length})`}
        </button>
      )}
      {open && (
        <div className="mc-cm-list">
          {rest.map((t) => <SongCard key={t.id} track={t} queue={media.tracks} player={player} />)}
        </div>
      )}
      {media.approximate && <p className="mc-cm-note">These are the closest matches I could find.</p>}
    </div>
  )
}

function VideoThumb({ video }) {
  const [broken, setBroken] = useState(false)
  const src = broken ? fallbackThumbUrl(video.videoId) : (video.thumbnailUrl || baseThumbUrl(video.videoId))
  return <img className="mc-yt-img" src={src} alt="" loading="lazy" onError={() => setBroken(true)} />
}

function VideoList({ media, onPlayYouTube }) {
  const [open, setOpen] = useState(false)
  const [first, ...rest] = media.videos
  if (!first) return null
  const play = (id) => {
    if (onPlayYouTube) onPlayYouTube(id)
    else window.open(watchUrl(id), '_blank', 'noopener,noreferrer')
  }
  const title = (v) => decodeEntities(v.title)
  const channel = (v) => decodeEntities(v.channelTitle)
  return (
    <div className="mc-yt mc-cm">
      <button type="button" className="mc-cm-vhero" onClick={() => play(first.videoId)} aria-label={`Play ${title(first)}${channel(first) ? ` by ${channel(first)}` : ''}`}>
        <VideoThumb video={first} />
        <span className="mc-yt-scrim" />
        <span className="mc-yt-play"><PlayIcon size={22} /></span>
        <span className="mc-cm-vcap"><b>{title(first)}</b><span>{channel(first)}</span></span>
      </button>
      {rest.length > 0 && (
        <button type="button" className="mc-yt-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Hide other videos' : `More videos (${rest.length})`}
        </button>
      )}
      {open && (
        <div className="mc-cm-list">
          {rest.map((v) => (
            <button key={v.videoId} type="button" className="mc-cm-vrow" onClick={() => play(v.videoId)} aria-label={`Play ${title(v)}${channel(v) ? ` by ${channel(v)}` : ''}`}>
              <span className="mc-cm-vthumb"><VideoThumb video={v} /><span className="mc-yt-play"><PlayIcon size={13} /></span></span>
              <span className="mc-cm-vinfo"><b>{title(v)}</b><span>{channel(v)}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CurryMedia({ media, onPlayYouTube }) {
  if (!media) return null
  if (media.kind === 'video' && Array.isArray(media.videos)) return <VideoList media={media} onPlayYouTube={onPlayYouTube} />
  if (media.kind === 'song' && Array.isArray(media.tracks)) return <SongList media={media} />
  return null
}
