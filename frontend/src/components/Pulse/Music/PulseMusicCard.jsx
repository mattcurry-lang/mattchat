import React, { useState } from 'react'
import MusicSearch from './MusicSearch'
import TrackRail from './TrackRail'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { IconMusic, IconX } from '../../Icons'

/**
 * components/Pulse/Music/PulseMusicCard.jsx
 *
 * The Phase-1 entry point into Music from Pulse. Deliberately small —
 * a single card, not a takeover of the Pulse layout (per spec §3).
 * Tapping it opens a fullscreen overlay with the hero + rails + search,
 * the same pattern PulsePage already uses for RoomFinder/FresherMode/etc.
 */

export function PulseMusicEntryCard({ onOpen }) {
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-surface-2)',
        border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconMusic size={18} style={{ color: '#fff' }} />
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Music</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Discover, search, and play — keeps going while you chat</div>
      </div>
    </button>
  )
}

export function PulseMusicOverlay({ onClose }) {
  const { recentlyPlayed, likedTracks } = useMusicPlayer()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg-surface-1, #0f0f1a)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 16, paddingBottom: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Music</h2>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'var(--bg-surface-2)', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconX size={15} />
          </button>
        </div>

        <div style={{
          borderRadius: 18, padding: '20px 18px', marginBottom: 18,
          background: 'linear-gradient(135deg, rgba(167,139,250,0.16), rgba(108,99,255,0.10))',
          border: '1px solid rgba(167,139,250,0.25)',
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            Music for your moment
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Discover music, build your playlists, and keep listening while you use Mattchat.
          </div>
        </div>

        {/* Only render rails with content — an empty "Recently Played"
            on someone's very first visit would just be dead space. */}
        {recentlyPlayed.length > 0 && (
          <TrackRail title="Recently Played" tracks={recentlyPlayed} />
        )}
        {likedTracks.length > 0 && (
          <TrackRail title="Liked Music" tracks={likedTracks} />
        )}

        <MusicSearch autoFocus />
      </div>
    </div>
  )
}

/**
 * Convenience wrapper bundling the entry-card + overlay's open/close
 * state, so wiring it into PulsePage is a single import + two lines.
 */
export default function PulseMusicCard() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <PulseMusicEntryCard onOpen={() => setOpen(true)} />
      {open && <PulseMusicOverlay onClose={() => setOpen(false)} />}
    </>
  )
}
