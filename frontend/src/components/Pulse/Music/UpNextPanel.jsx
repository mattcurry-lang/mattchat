import React, { useEffect, useState } from 'react'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { RecommendationEngine } from '../../../lib/music/RecommendationEngine'
import { OfflineCache } from '../../../lib/music/OfflineCache'
import { IconPlus, IconTrash } from '../../Icons'
import TrackArt from './TrackArt'
import Equalizer from './Equalizer'

const labelStyle = (c) => ({ fontSize: 11, fontWeight: 800, color: c(0.55), textTransform: 'uppercase', letterSpacing: 0.8, margin: '18px 0 6px' })

// note: small status under the artist - used for the offline notes ("Saved on this device" / "Needs internet")
function Row({ track, active, playing, onPlay, onRemove, onAdd, c, note, dim }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 8px', borderRadius: 12, background: active ? c(0.10) : 'transparent', opacity: dim ? 0.5 : 1 }}>
      <button onClick={onPlay} disabled={!onPlay} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: onPlay ? 'pointer' : 'default', fontFamily: 'inherit' }}>
        <div style={{ position: 'relative' }}>
          <TrackArt src={track.artwork} size={44} radius={8} iconSize={16} />
          {active && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Equalizer playing={playing} size={16} color="#fff" />
            </div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c(1), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
          <div style={{ fontSize: 12.5, color: c(0.6), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
          {note && <div style={{ fontSize: 11, fontWeight: 700, marginTop: 1, color: note.color || c(0.5) }}>{note.text}</div>}
        </div>
      </button>
      {onRemove && (
        <button onClick={onRemove} aria-label="Remove from queue" style={{ background: 'transparent', border: 'none', color: c(0.55), padding: 8, cursor: 'pointer' }}>
          <IconTrash size={16} />
        </button>
      )}
      {onAdd && (
        <button onClick={onAdd} aria-label="Add to queue" style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: c(1), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IconPlus size={15} />
        </button>
      )}
    </div>
  )
}

export default function UpNextPanel({ rgb = '255,255,255' }) {
  const c = (a) => (a === 1 ? `rgb(${rgb})` : `rgba(${rgb},${a})`)
  const label = labelStyle(c)
  const { queue, queueIndex, currentTrack, isPlaying, playFromQueue, removeFromQueue, clearQueue, addToQueue, isAutoContinuing, radio, isOffline } = useMusicPlayer()
  const upcoming = queue.slice(queueIndex + 1)
  const [suggested, setSuggested] = useState([])
  const [savedIds, setSavedIds] = useState(() => new Set())

  // which songs are saved in Mattchat (playable with no internet)
  useEffect(() => {
    let alive = true
    const load = () => OfflineCache.listDownloads().then((d) => { if (alive) setSavedIds(new Set(d.map((x) => x.id))) }).catch(() => {})
    load()
    window.addEventListener('mattchat-downloads-changed', load)
    return () => { alive = false; window.removeEventListener('mattchat-downloads-changed', load) }
  }, [])

  // Offline notes: say plainly what will and won't play without internet
  const offlineNote = (t) => {
    if (!isOffline) return undefined
    return savedIds.has(t.id) ? { text: 'Saved on this device', color: '#4ade80' } : { text: 'Needs internet', color: c(0.5) }
  }

  useEffect(() => {
    if (!currentTrack) return undefined
    let cancelled = false
    const exclude = new Set(queue.map((t) => t.id))
    RecommendationEngine.getSimilarTracks(currentTrack, exclude, 8, queue)
      .then((r) => { if (!cancelled) setSuggested(r || []) })
      .catch(() => { if (!cancelled) setSuggested([]) })
    return () => { cancelled = true }
    // refresh when the song changes, not on every queue edit
  }, [currentTrack?.id, isOffline])

  const queuedIds = new Set(queue.map((t) => t.id))
  const shown = suggested.filter((t) => !queuedIds.has(t.id)).slice(0, 6)

  const savedUpcoming = upcoming.filter((t) => savedIds.has(t.id)).length

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 14px 40px', scrollbarWidth: 'none' }}>
      {isOffline && (
        <div role="status" style={{ margin: '8px 0 0', padding: '10px 12px', borderRadius: 12, background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.25)', color: c(0.85), fontSize: 12.5, lineHeight: 1.45 }}>
          <strong style={{ color: '#4ade80' }}>You're offline.</strong>{' '}
          {savedIds.size > 0
            ? `Playing songs saved in Mattchat${upcoming.length ? ` · ${savedUpcoming} of the next ${upcoming.length} are saved` : ''}. Anything that needs internet is skipped.`
            : 'No songs are saved on this device yet. Download songs while online to play them here.'}
        </div>
      )}
      {currentTrack && (<><div style={{ ...label, marginTop: 8 }}>Now playing</div><Row c={c} track={currentTrack} active playing={isPlaying} /></>)}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={label}>Next up{upcoming.length > 0 && ` · ${upcoming.length}`}</div>
          {radio?.seed && (
            <div style={{ fontSize: 11.5, color: c(0.55), marginTop: -2 }}>
              {isOffline ? 'Radio from your saved songs' : `Radio · songs like ${radio.seed.title}`}{radio.filling ? ' · finding more…' : ''}
            </div>
          )}
        </div>
        {upcoming.length > 0 && (
          <button onClick={clearQueue} style={{ marginTop: 12, background: 'transparent', border: 'none', color: c(0.7), fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Clear</button>
        )}
      </div>
      {upcoming.length === 0 ? (
        <div style={{ fontSize: 13, color: c(0.55), padding: '8px 8px 4px' }}>
          {isAutoContinuing ? 'Finding more songs…' : 'Nothing queued. We\'ll keep the music going with similar songs.'}
        </div>
      ) : upcoming.map((t) => (
        <Row c={c} key={t.id} track={t} note={offlineNote(t)} dim={isOffline && !savedIds.has(t.id)} onPlay={() => playFromQueue(t.id)} onRemove={() => removeFromQueue(t.id)} />
      ))}

      {shown.length > 0 && (<>
        <div style={label}>{isOffline ? 'From your saved songs' : 'Suggested for you'}</div>
        {shown.map((t) => <Row c={c} key={t.id} track={t} note={offlineNote(t)} dim={isOffline && !savedIds.has(t.id)} onAdd={() => addToQueue(t)} />)}
      </>)}
    </div>
  )
}
