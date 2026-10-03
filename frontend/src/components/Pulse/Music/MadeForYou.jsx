import React from 'react'
import { motion } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { IconMusic } from '../../Icons'

function Collage({ tracks, colors }) {
  const art = tracks.map(t => t.artwork).filter(Boolean).slice(0, 4)
  return (
    <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 10, overflow: 'hidden', display: 'grid',
      gridTemplateColumns: '1fr 1fr', background: colors.surface2 }}>
      {art.length ? art.map((u, i) => <img key={i} src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)
        : <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconMusic size={28} /></div>}
    </div>
  )
}

export default function MadeForYou({ mixes, colors }) {
  const { playTrack } = useMusicPlayer()
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 700 }}>Made for you</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: colors.textPrimary, marginBottom: 10 }}>Your Daily Mixes</div>
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6 }}>
        {mixes.map((m) => (
          <motion.button key={m.id} whileTap={{ scale: 0.97 }} onClick={() => playTrack(m.tracks[0], m.tracks)}
            style={{ width: 150, flexShrink: 0, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Collage tracks={m.tracks} colors={colors} />
            <div style={{ fontSize: 13, fontWeight: 800, color: colors.textPrimary, marginTop: 8 }}>{m.name}</div>
            <div style={{ fontSize: 11.5, color: colors.textMuted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.subtitle}</div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
