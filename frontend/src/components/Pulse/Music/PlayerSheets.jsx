import React from 'react'
import { motion } from 'framer-motion'
import { IconCheck, IconX } from '../../Icons'
import AddToPlaylistPicker from './AddToPlaylistPicker'

export function Sheet({ title, onClose, children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        style={{
          width: '100%', maxWidth: 480, maxHeight: '75%', overflowY: 'auto', background: 'rgba(24,21,38,0.98)', color: '#fff',
          borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '16px 8px calc(16px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -16px 50px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 8px' }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconX size={14} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

function Option({ label, sub, selected, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 12px', background: 'transparent', border: 'none', borderRadius: 12, color: selected ? '#fff' : 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: selected ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
      <span>{label}{sub && <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{sub}</span>}</span>
      {selected && <IconCheck size={18} />}
    </button>
  )
}

export function SleepSheet({ sleepTimer, remainingLabel, onPick, onClose }) {
  const pick = (v) => { onPick(v); onClose() }
  const mins = [15, 30, 45, 60]
  return (
    <Sheet title="Sleep timer" onClose={onClose}>
      {sleepTimer && (
        <Option label="Turn off timer" sub={remainingLabel ? `Stops in ${remainingLabel}` : 'Stops at end of this track'} onClick={() => pick(null)} />
      )}
      {mins.map((m) => (
        <Option key={m} label={`${m} minutes`} selected={sleepTimer?.mode === 'time' && Math.abs((sleepTimer.endsAt - Date.now()) / 60000 - m) < 0.1} onClick={() => pick(m)} />
      ))}
      <Option label="End of track" selected={sleepTimer?.mode === 'track'} onClick={() => pick('track')} />
    </Sheet>
  )
}

export function SpeedSheet({ rate, onPick, onClose }) {
  const rates = [0.75, 1, 1.25, 1.5, 2]
  return (
    <Sheet title="Playback speed" onClose={onClose}>
      {rates.map((r) => (
        <Option key={r} label={r === 1 ? 'Normal' : `${r}x`} selected={rate === r} onClick={() => { onPick(r); onClose() }} />
      ))}
    </Sheet>
  )
}

export function PlaylistSheet({ track, onClose }) {
  return (
    <Sheet title="Add to playlist" onClose={onClose}>
      <AddToPlaylistPicker track={track} onDone={onClose} />
    </Sheet>
  )
}
