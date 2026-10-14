import React, { useEffect, useState } from 'react'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { RecommendationEngine } from '../../../lib/music/RecommendationEngine'
import { IconPlus, IconTrash } from '../../Icons'
import TrackArt from './TrackArt'
import Equalizer from './Equalizer'

const label = { fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8, margin: '18px 0 6px' }

function Row({ track, active, playing, onPlay, onRemove, onAdd }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 8px', borderRadius: 12, background: active ? 'rgba(255,255,255,0.10)' : 'transparent' }}>
      <button onClick={onPlay} disabled={!onPlay} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: onPlay ? 'pointer' : 'default', fontFamily: 'inherit' }}>
        <div style={{ position: 'relative' }}>
          <TrackArt src={track.artwork} size={44} radius={8} iconSize={16} />
          {active && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Equalizer playing={playing} size={16} />
            </div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
        </div>
      </button>
      {onRemove && (
        <button onClick={onRemove} aria-label="Remove from queue" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)', padding: 8, cursor: 'pointer' }}>
          <IconTrash size={16} />
        </button>
      )}
      {onAdd && (
        <button onClick={onAdd} aria-label="Add to queue" style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <IconPlus size={15} />
        </button>
      )}
    </div>
  )
}

export default function UpNextPanel() {
  const { queue, queueIndex, currentTrack, isPlaying, playFromQueue, removeFromQueue, clearQueue, addToQueue, isAutoContinuing } = useMusicPlayer()
  const upcoming = queue.slice(queueIndex + 1)
  const [suggested, setSuggested] = useState([])

  useEffect(() => {
    if (!currentTrack) return undefined
    let cancelled = false
    const exclude = new Set(queue.map((t) => t.id))
    RecommendationEngine.getSimilarTracks(currentTrack, exclude, 8)
      .then((r) => { if (!cancelled) setSuggested(r || []) })
      .catch(() => { if (!cancelled) setSuggested([]) })
    return () => { cancelled = true }
    // refresh when the song changes, not on every queue edit
  }, [currentTrack?.id])

  const queuedIds = new Set(queue.map((t) => t.id))
  const shown = suggested.filter((t) => !queuedIds.has(t.id)).slice(0, 6)

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 14px 40px', scrollbarWidth: 'none' }}>
      {currentTrack && (<><div style={{ ...label, marginTop: 8 }}>Now playing</div><Row track={currentTrack} active playing={isPlaying} /></>)}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={label}>Next up{upcoming.length > 0 && ` · ${upcoming.length}`}</div>
        {upcoming.length > 0 && (
          <button onClick={clearQueue} style={{ marginTop: 12, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Clear</button>
        )}
      </div>
      {upcoming.length === 0 ? (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', padding: '8px 8px 4px' }}>
          {isAutoContinuing ? 'Finding more songs…' : 'Nothing queued. We\'ll keep the music going with similar songs.'}
        </div>
      ) : upcoming.map((t) => (
        <Row key={t.id} track={t} onPlay={() => playFromQueue(t.id)} onRemove={() => removeFromQueue(t.id)} />
      ))}

      {shown.length > 0 && (<>
        <div style={label}>Suggested for you</div>
        {shown.map((t) => <Row key={t.id} track={t} onAdd={() => addToQueue(t)} />)}
      </>)}
    </div>
  )
}
