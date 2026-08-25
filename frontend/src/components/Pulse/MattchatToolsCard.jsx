import React from 'react'

// Grid designed to be expandable — add new entries here as more Mattchat
// Tools ship (Equation Solver, Graphing Calculator, Unit Converter, etc).
// Only Scientific Calculator is implemented for now, so it's the only tile shown.
const TOOLS = [
  {
    id: 'scientific-calculator',
    icon: '🧮',
    label: 'Scientific Calculator',
    description: 'Powerful calculator for everyday and advanced mathematics.',
  },
]

export default function MattchatToolsCard({ onOpenTool }) {
  return (
    <div style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
        🧰 Mattchat Tools
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onOpenTool(tool.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-surface-1, rgba(255,255,255,0.03))',
              border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}
            >
              {tool.icon}
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{tool.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{tool.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
