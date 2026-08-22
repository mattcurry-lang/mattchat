import React, { useState } from 'react'
import { getPartnerTips, getApproachingTips, getGiftIdeas } from '../../lib/partnerSupport'
import NearbyShopButton from './NearbyShopButton'
import { IconSparkle } from '../Icons'

// phase: only present for Level 3 (Cycle Sharing) links.
// approachingPeriod: the boolean from Level 2 (Support tier) status.
// Neither prop ever carries mood/symptom/notes data — partners never
// receive that regardless of permission level.
export default function PartnerSupportCard({ phase, approachingPeriod }) {
  const [showGifts, setShowGifts] = useState(false)

  const tips = phase ? getPartnerTips(phase) : (approachingPeriod ? getApproachingTips() : null)
  const gifts = getGiftIdeas(phase)

  if (!tips) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,139,250,0.2)',
      borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconSparkle size={13} /> {tips.headline}
      </div>

      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tips.tips.map((t, i) => (
          <li key={i} style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{t}</li>
        ))}
      </ul>

      <button
        onClick={() => setShowGifts(v => !v)}
        style={{
          alignSelf: 'flex-start', background: 'none', border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 20, padding: '6px 14px', color: '#c4b5fd', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {showGifts ? 'Hide ideas' : '💗 A little something for her'}
      </button>

      {showGifts && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {gifts.map(item => (
            <div key={item.id} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{item.emoji}</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{item.note}</div>
                </div>
              </div>
              <NearbyShopButton searchCategory={item.searchCategory} label={`Find nearby`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
