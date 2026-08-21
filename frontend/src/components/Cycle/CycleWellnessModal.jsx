import React, { useState, useEffect } from 'react'
import { 
  PHASE_RECOMMENDATIONS, 
  ITEM_DETAILS, 
  getMealSuggestions, 
  listWellnessPreferences, 
  setWellnessPreference 
} from '../../lib/cycleWellness'
import { IconX } from '../Icons'

const TABS = [
  { key: 'foods', label: 'Food', emoji: '🍽' },
  { key: 'drinks', label: 'Drinks', emoji: '🥤' },
  { key: 'selfCare', label: 'Self-care', emoji: '🧘' },
  { key: 'movement', label: 'Movement', emoji: '🏃' },
]

export default function CycleWellnessModal({ userId, phase, initialTab = 'foods', onClose }) {
  const [tab, setTab] = useState(initialTab)
  const [detailItem, setDetailItem] = useState(null)
  const [saved, setSaved] = useState(new Set())
  const [mealSeed, setMealSeed] = useState(0)
  const [showMeals, setShowMeals] = useState(false)
  const [prefsLoading, setPrefsLoading] = useState(true)

  // Load persisted preferences on mount
  useEffect(() => {
    let cancelled = false
    listWellnessPreferences(userId)
      .then(prefs => {
        if (cancelled) return
        setSaved(new Set(prefs.filter(p => p.status === 'saved').map(p => p.item_id)))
        setPrefsLoading(false)
      })
      .catch(e => { 
        console.error('listWellnessPreferences failed:', e)
        if (!cancelled) setPrefsLoading(false) 
      })
    return () => { cancelled = true }
  }, [userId])

  const rec = PHASE_RECOMMENDATIONS[phase] || PHASE_RECOMMENDATIONS.follicular
  const items = rec[tab] || []
  const meals = getMealSuggestions(phase, mealSeed)

  // Persists to the DB — optimistic update, reverts on failure
  const toggleSaved = async (id) => {
    const wasSaved = saved.has(id)
    setSaved(prev => {
      const next = new Set(prev)
      wasSaved ? next.delete(id) : next.add(id)
      return next
    })
    try {
      await setWellnessPreference(userId, id, wasSaved ? null : 'saved')
    } catch (e) {
      console.error('setWellnessPreference failed:', e)
      // Revert on failure
      setSaved(prev => {
        const next = new Set(prev)
        wasSaved ? next.add(id) : next.delete(id)
        return next
      })
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 750, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>
          What your body might like today
        </h2>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer' }}>
          <IconX size={15} />
        </button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 18px 90px' }}>

        <button
          onClick={() => setShowMeals(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'linear-gradient(135deg,#6c63ff,#a78bfa)', border: 'none', borderRadius: 16,
            padding: 14, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            marginBottom: 16,
          }}
        >
          🍽 What should I eat today?
        </button>

        {showMeals && meals && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['Breakfast', meals.breakfast], ['Lunch', meals.lunch], ['Snack', meals.snack], ['Dinner', meals.dinner]].map(([label, item]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{label}</div>
                <button onClick={() => setDetailItem(item)} style={{ background: 'none', border: 'none', color: '#e5e7eb', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {item.emoji} {item.label}
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => setMealSeed(s => s + 1)} style={pillBtnStyle}>↻ Refresh suggestions</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 4, marginBottom: 16 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, background: tab === t.key ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : 'transparent',
                border: 'none', borderRadius: 12, padding: '8px 4px', color: '#fff', fontSize: 11.5, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => setDetailItem(item)}
              style={{
                textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '14px', cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
              }}
            >
              {saved.has(item.id) && <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 12 }}>💗</span>}
              <div style={{ fontSize: 24, marginBottom: 6 }}>{item.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{item.blurb}</div>
            </button>
          ))}
          {items.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: 30 }}>
              Nothing here yet for this phase.
            </div>
          )}
        </div>
      </div>

      {detailItem && (
        <ItemDetailSheet
          item={detailItem}
          allItems={items}
          isSaved={saved.has(detailItem.id)}
          onToggleSaved={() => toggleSaved(detailItem.id)}
          onShowAnother={(next) => setDetailItem(next)}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  )
}

function ItemDetailSheet({ item, allItems, isSaved, onToggleSaved, onShowAnother, onClose }) {
  const detail = ITEM_DETAILS[item.id]
  const alternativeItems = (detail?.alternatives || [])
    .map(id => allItems.find(i => i.id === id))
    .filter(Boolean)

  const showAnother = () => {
    const others = allItems.filter(i => i.id !== item.id)
    if (others.length === 0) return
    onShowAnother(others[Math.floor(Math.random() * others.length)])
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, margin: '0 auto', background: '#1b1730',
          borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 22px 28px',
          border: '1px solid rgba(167,139,250,0.25)', borderBottom: 'none',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 40 }}>{item.emoji}</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', cursor: 'pointer' }}>
            <IconX size={14} />
          </button>
        </div>

        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{item.label}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{item.blurb}</div>

        {detail?.prep && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 3 }}>Preparation idea</div>
            <div style={{ fontSize: 13, color: '#e5e7eb' }}>{detail.prep}</div>
          </div>
        )}
        {detail?.serving && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 3 }}>Serving idea</div>
            <div style={{ fontSize: 13, color: '#e5e7eb' }}>{detail.serving}</div>
          </div>
        )}
        {alternativeItems.length > 0 && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>Alternatives</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {alternativeItems.map(alt => (
                <button key={alt.id} onClick={() => onShowAnother(alt)} style={pillBtnStyle}>
                  {alt.emoji} {alt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button onClick={onToggleSaved} style={{ ...pillBtnStyle, flex: 1, background: isSaved ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : pillBtnStyle.background, color: isSaved ? '#fff' : pillBtnStyle.color }}>
            {isSaved ? '💗 Saved' : '🤍 Save'}
          </button>
          <button onClick={onClose} style={{ ...pillBtnStyle, flex: 1 }}>I've tried this</button>
          <button onClick={showAnother} style={{ ...pillBtnStyle, flex: 1 }}>Show another</button>
        </div>
      </div>
    </div>
  )
}

const pillBtnStyle = {
  background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 20,
  padding: '8px 14px', color: '#c4b5fd', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}
