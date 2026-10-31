import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMusicPlayer } from '../../context/MusicPlayerContext'

const cleanArtist = (a = '') => a.replace(/\s*-\s*Topic\s*$/i, '').trim()
const cleanTitle = (t = '') =>
  t.replace(/\s*[\(\[][^)\]]*(official|video|audio|lyrics?|hd|4k|visuali[sz]er)[^)\]]*[\)\]]/gi, '').trim()

const ico = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'currentColor' }
const Prev = () => <svg {...ico}><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
const Next = () => <svg {...ico}><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
const Play = () => <svg {...ico} width="26" height="26"><path d="M8 5v14l11-7z" /></svg>
const Pause = () => <svg {...ico} width="26" height="26"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>

const btn = { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 6, display: 'flex' }

// Lives inside the pop-out window. Inline styles only: the new window has none of the app's CSS.
function MiniControls() {
  const { currentTrack, isPlaying, togglePlayPause, playNext, playPrevious, currentTime, duration, seekTo } = useMusicPlayer()
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  if (!currentTrack) {
    return <div style={{ color: '#8d8fb0', font: '13px system-ui', padding: 18 }}>Nothing playing</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, font: '13px system-ui', color: '#fff' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: '#1c1b2e', flexShrink: 0 }}>
          {currentTrack.artwork && <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanTitle(currentTrack.title)}</div>
          <div style={{ color: '#a9abc9', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanArtist(currentTrack.artist)}</div>
        </div>
        <button style={btn} onClick={playPrevious} aria-label="Previous"><Prev /></button>
        <button style={{ ...btn, background: '#fff', color: '#0b0b16', borderRadius: '50%', padding: 8 }} onClick={togglePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <button style={btn} onClick={playNext} aria-label="Next"><Next /></button>
      </div>
      <div
        role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(duration || 0)} aria-valuenow={Math.round(currentTime || 0)}
        onClick={(e) => {
          if (!duration) return
          const r = e.currentTarget.getBoundingClientRect()
          seekTo(((e.clientX - r.left) / r.width) * duration)
        }}
        style={{ height: 14, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
      >
        <div style={{ position: 'relative', width: '100%', height: 4, borderRadius: 2, background: '#2a2840' }}>
          <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${pct}%`, borderRadius: 2, background: '#a78bfa' }} />
        </div>
      </div>
    </div>
  )
}

export default function PopOutPlayerButton({ size = 18, style }) {
  const [pip, setPip] = useState(null)
  if (typeof window === 'undefined' || !('documentPictureInPicture' in window)) return null

  const toggle = async () => {
    if (pip) { pip.close(); return }
    try {
      const w = await window.documentPictureInPicture.requestWindow({ width: 380, height: 130 })
      w.document.body.style.cssText = 'margin:0;background:#0b0b16;overflow:hidden'
      w.addEventListener('pagehide', () => setPip(null))
      setPip(w)
    } catch (e) {
      console.error('Pop-out player failed:', e)
    }
  }

  return (
    <>
      <button
        onClick={toggle}
        title={pip ? 'Close mini player' : 'Pop out mini player'}
        aria-label={pip ? 'Close mini player' : 'Pop out mini player'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: pip ? '#a78bfa' : 'inherit', display: 'flex', ...style }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="14" rx="2" /><rect x="12" y="11" width="7" height="5" rx="1" fill="currentColor" />
        </svg>
      </button>
      {pip && createPortal(<MiniControls />, pip.document.body)}
    </>
  )
}
