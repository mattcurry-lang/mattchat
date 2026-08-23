import React from 'react'

function Bar({ width, height = 12, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: 6, background: 'rgba(255,255,255,0.06)',
      animation: 'pulseSkeleton 1.4s ease-in-out infinite', ...style,
    }} />
  )
}

export default function TeamSectionSkeleton() {
  return (
    <div style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', animation: 'pulseSkeleton 1.4s ease-in-out infinite' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Bar width={70} height={9} />
          <Bar width={130} height={14} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Bar width={64} height={40} style={{ borderRadius: 12 }} />
        <Bar width={64} height={40} style={{ borderRadius: 12 }} />
        <Bar width={64} height={40} style={{ borderRadius: 12 }} />
      </div>

      <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', animation: 'pulseSkeleton 1.4s ease-in-out infinite' }} />
        ))}
      </div>

      <Bar width="100%" height={90} style={{ borderRadius: 16, marginBottom: 12 }} />

      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Bar key={i} width={108} height={100} style={{ borderRadius: 14 }} />
        ))}
      </div>

      <style>{`
        @keyframes pulseSkeleton {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
