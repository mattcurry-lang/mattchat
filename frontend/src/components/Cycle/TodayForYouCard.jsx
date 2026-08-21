import React, { useState } from 'react'
import { getTodayForYou, getTodaysLittleThing, PHASE_RECOMMENDATIONS } from '../../lib/cycleWellness'
import { IconSparkle } from '../Icons'

// recentDailyLogs: last ~14 days of daily_logs rows (optional — pass []
// if not loaded yet, the card still renders generic phase copy).
export default function TodayForYouCard({ phase, recentDailyLogs = [], onOpenWellness }) {
  if (!phase) return null

  const today = getTodayForYou(phase, recentDailyLogs)
  const littleThing = getTodaysLittleThing(new Date().toISOString().slice(0, 10))

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1))',
      border: '1px solid rgba(167,139,250,0.25)', borderRadius: 20, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 12, margin: 0,
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconSparkle size={13} /> Today for you
      </div>

      <div style={{ fontSize: 14.5, color: '#e8e8f0', lineHeight: 1.55 }}>
        {today.body}
      </div>

      {today.showIdeaButtons && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['food', 'drinks', 'movement', 'selfCare'].map(tab => (
            <button
              key={tab}
              onClick={() => onOpenWellness?.(tab)}
              style={{
                background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: 20, padding: '6px 14px', color: '#c4b5fd', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
              }}
            >
              {tab === 'selfCare' ? 'Self-care' : tab}
            </button>
          ))}
        </div>
      )}

      <div style={{
        marginTop: 4, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)',
        fontSize: 13, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>{littleThing.emoji}</span> {littleThing.text}
      </div>
    </div>
  )
}
