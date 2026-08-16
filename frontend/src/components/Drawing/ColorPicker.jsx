import React, { useState, useEffect, useRef } from 'react'

const PALETTE = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#10b981', '#06b6d4', '#3b82f6', '#4f46e5', '#8b5cf6', '#a855f7',
  '#ec4899', '#f43f5e', '#78350f', '#6b7280',
]

const RECENT_KEY = 'mattchat_drawing_recent_colors'

export default function ColorPicker({ color, onChange, onClose }) {
  const [recent, setRecent] = useState([])
  const [customOpen, setCustomOpen] = useState(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')) } catch {}
  }, [])

  useEffect(() => {
    const handler = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose?.() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const pick = (c) => {
    onChange(c)
    const next = [c, ...recent.filter(r => r !== c)].slice(0, 8)
    setRecent(next)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
  }

  return (
    <div
      ref={pickerRef}
      style={{
        position: 'absolute', bottom: 'calc(100% + 10px)', left: 0,
        background: '#1e1e2e', border: '1px solid rgba(167,139,250,0.25)',
        borderRadius: 16, padding: 12, width: 236, zIndex: 40,
        boxShadow: '0 -6px 30px rgba(0,0,0,0.45)',
        animation: 'colorPickerPop 0.16s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <style>{`@keyframes colorPickerPop { from { opacity:0; transform: scale(0.94) translateY(6px);} to { opacity:1; transform:none; } }`}</style>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
        {PALETTE.map(c => (
          <button
            key={c}
            onClick={() => pick(c)}
            title={c}
            style={{
              width: 22, height: 22, borderRadius: '50%', background: c,
              border: c === color ? '2px solid #a78bfa' : c === '#ffffff' ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(0,0,0,0.15)',
              cursor: 'pointer', padding: 0, boxSizing: 'border-box',
              boxShadow: c === color ? '0 0 0 2px rgba(167,139,250,0.3)' : 'none',
            }}
          />
        ))}
      </div>

      {recent.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '10px 0 6px' }}>
            Recent
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {recent.map((c, i) => (
              <button
                key={`${c}-${i}`}
                onClick={() => pick(c)}
                style={{
                  width: 18, height: 18, borderRadius: '50%', background: c,
                  border: c === color ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            fontSize: 12, fontWeight: 600, color: '#c4b5fd', flex: 1,
          }}
        >
          <span style={{
            width: 20, height: 20, borderRadius: 6,
            background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)',
            border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0,
          }} />
          Custom
          <input
            type="color"
            value={color}
            onChange={(e) => pick(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          />
        </label>
        <div style={{
          width: 20, height: 20, borderRadius: 6, background: color,
          border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0,
        }} title={color} />
      </div>
    </div>
  )
}
