import React from 'react'
import { motion } from 'framer-motion'

const pulseAnim = {
  animate: { opacity: [0.5, 1, 0.5] },
  transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
}

function Bar({ width, height = 12, style = {}, delay = 0 }) {
  return (
    <motion.div
      animate={pulseAnim.animate}
      transition={{ ...pulseAnim.transition, delay }}
      style={{ width, height, borderRadius: 6, background: 'rgba(127,127,127,0.18)', ...style }}
    />
  )
}

function Circle({ size, delay = 0 }) {
  return (
    <motion.div
      animate={pulseAnim.animate}
      transition={{ ...pulseAnim.transition, delay }}
      style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(127,127,127,0.18)', flexShrink: 0 }}
    />
  )
}

export default function TeamSectionSkeleton() {
  return (
    <div style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Circle size={30} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Bar width={70} height={9} delay={0.05} />
          <Bar width={130} height={14} delay={0.1} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Bar width={64} height={40} style={{ borderRadius: 12 }} delay={0.05} />
        <Bar width={64} height={40} style={{ borderRadius: 12 }} delay={0.1} />
        <Bar width={64} height={40} style={{ borderRadius: 12 }} delay={0.15} />
      </div>

      <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Circle key={i} size={20} delay={i * 0.05} />
        ))}
      </div>

      <Bar width="100%" height={90} style={{ borderRadius: 16, marginBottom: 12 }} />

      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Bar key={i} width={108} height={100} style={{ borderRadius: 14 }} delay={i * 0.1} />
        ))}
      </div>
    </div>
  )
}
