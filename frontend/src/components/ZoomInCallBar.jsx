import React, { useEffect, useState } from 'react'
import { ZoomGlyph } from './ZoomLinkSheet'

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function ZoomInCallBar({ roomUrl, callerName, onEnd }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      position: 'fixed', top: 'calc(10px + env(safe-area-inset-top, 0px))', left: '50%', transform: 'translateX(-50%)', zIndex: 9997,
      display: 'flex', alignItems: 'center', gap: 10, maxWidth: 'calc(100vw - 20px)', padding: '8px 10px 8px 12px',
      background: 'rgba(21,18,31,0.94)', backdropFilter: 'blur(14px)', border: '1px solid rgba(45,140,255,0.45)', borderRadius: 999,
      boxShadow: '0 12px 34px rgba(0,0,0,0.5)', color: '#f6f4ff', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <ZoomGlyph size={26} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          On Zoom{callerName ? ` with ${callerName}` : ''} · {fmt(seconds)}
        </div>
        <div style={{ fontSize: 10.5, color: 'rgba(246,244,255,0.55)', whiteSpace: 'nowrap' }}>Leave the Zoom window to hang up</div>
      </div>
      <button onClick={() => window.open(roomUrl, '_blank', 'noopener,noreferrer')}
        style={{ height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        Open Zoom
      </button>
      <button onClick={onEnd}
        style={{ height: 32, padding: '0 14px', borderRadius: 999, border: 'none', background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
        End
      </button>
    </div>
  )
}
