import React from 'react'
import { createPortal } from 'react-dom'

export default function PlayerDetailModal({ player, onClose }) {
  if (!player) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Player</div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {player.photo && (
          <img src={player.photo} alt={player.name} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(167,139,250,0.4)' }} />
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{player.name}</div>
          {player.team && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
              {player.teamCrest && <img src={player.teamCrest} alt={player.team} style={{ width: 16, height: 16, objectFit: 'contain' }} />}
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{player.team}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, width: '100%', maxWidth: 320 }}>
          <StatBox label="Goals" value={player.goals} />
          <StatBox label="Assists" value={player.assists} />
          <StatBox label="Appearances" value={player.appearances} />
          <StatBox label="Minutes" value={player.minutes} />
        </div>
      </div>
    </div>,
    document.body
  )
}

function StatBox({ label, value }) {
  if (value == null) return null // gracefully hide anything the API didn't provide
  return (
    <div style={{ borderRadius: 14, padding: '14px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(167,139,250,0.2)', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>{label}</div>
    </div>
  )
}
