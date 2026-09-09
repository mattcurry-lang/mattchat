import React from 'react'
import { motion } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { IconX, IconMusic, IconTrash } from '../../Icons'

export default function QueueDrawer({ onClose }) {
  const { queue, queueIndex, currentTrack, playFromQueue, removeFromQueue, clearQueue } = useMusicPlayer()
  const upcoming = queue.slice(queueIndex + 1)

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        style={{
          width: '100%', maxHeight: '70vh', overflowY: 'auto',
          background: 'var(--bg-surface-1)', border: '1px solid var(--border)', borderBottom: 'none',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Queue</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {upcoming.length > 0 && (
              <button onClick={clearQueue} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Clear</button>
            )}
            <button onClick={onClose} aria-label="Close queue" style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <IconX size={14} />
            </button>
          </div>
        </div>

        {currentTrack && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Now Playing</div>
            <QueueRow track={currentTrack} active />
          </>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '14px 0 6px' }}>
          Next Up {upcoming.length > 0 && `(${upcoming.length})`}
        </div>

        {upcoming.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '12px 0' }}>Nothing queued — songs you play next will show up here.</div>
        ) : (
          upcoming.map((track) => (
            <QueueRow key={track.id} track={track} onPlay={() => playFromQueue(track.id)} onRemove={() => removeFromQueue(track.id)} />
          ))
        )}
      </motion.div>
    </motion.div>
  )
}

function QueueRow({ track, active = false, onPlay, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 10, background: active ? 'rgba(167,139,250,0.10)' : 'transparent' }}>
      <button onClick={onPlay} disabled={active} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: active ? 'default' : 'pointer', padding: 0, textAlign: 'left' }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {track.artwork ? <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={14} style={{ color: 'var(--text-muted)' }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: active ? '#a78bfa' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
        </div>
      </button>
      {onRemove && (
        <button onClick={onRemove} aria-label="Remove from queue" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, flexShrink: 0 }}>
          <IconTrash size={15} />
        </button>
      )}
    </div>
  )
}
