import React, { useState, useMemo } from 'react'
import PulseSummaryCard from './PulseSummaryCard'
import PulseFilterBar from './PulseFilterBar'
import PulseActivityCard from './PulseActivityCard'
import PulseLockedCard from './PulseLockedCard'
import { PLATFORM_META } from './PulseIcons'
import { usePulseData, usePulseSettings } from '../../hooks/usePulseData'
import { getPulsePlugin } from '../../lib/pulsePlugins'

const LOCKED_PLATFORMS = Object.entries(PLATFORM_META).filter(([, meta]) => meta.supportLevel === 'native_only')

export default function PulsePage({
  session, userId, profile, conversations, unreadCounts, getConvoName,
  onOpenConversation, aiSummary,
}) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const { privacyMode, setPrivacyMode } = usePulseSettings(userId)
  const { items, loading, error, reload } = usePulseData(session, { conversations, unreadCounts, getConvoName })

  const filtered = useMemo(() => {
    let list = items
    if (filter === 'priority') list = list.filter((i) => i.importance === 'high' || i.importance === 'critical')
    else if (filter === 'unread') list = list.filter((i) => i.count > 0)
    else if (filter !== 'all' && filter !== 'more') list = list.filter((i) => i.app === filter)

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((i) => i.sender?.toLowerCase().includes(q) || i.title?.toLowerCase().includes(q) || i.app.includes(q))
    }
    return list
  }, [items, filter, search])

  // FIX/REFACTOR: this used to be an if/else chain hardcoding what
  // "tap this card" means per app (mattchat / instagram / gmail),
  // which meant every new integration needed an edit here too. Each
  // plugin now owns its own onOpen behavior — this just delegates.
  const handleOpen = (item) => {
    const plugin = getPulsePlugin(item.app)
    plugin?.onOpen?.(item, { onOpenConversation })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Pulse</h2>
        <button
          onClick={() => setPrivacyMode(!privacyMode)}
          title={privacyMode ? 'Privacy mode is on — tap to turn off' : 'Turn on Privacy Mode'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700,
            background: privacyMode ? 'rgba(74,222,128,0.12)' : 'var(--bg-surface-2)',
            border: `1px solid ${privacyMode ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
            color: privacyMode ? '#4ade80' : 'var(--text-secondary)',
            borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {privacyMode ? '🔒 Privacy on' : '🔓 Privacy mode'}
        </button>
      </div>

      <PulseSummaryCard name={profile?.username} items={items} loading={loading} aiSummary={aiSummary} />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search sender, app, or title…"
        style={{
          background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit',
        }}
      />

      <PulseFilterBar active={filter} onChange={setFilter} />

      {error && (
        <div style={{ fontSize: 12.5, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 12px' }}>
          Couldn't load your connected accounts right now.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12.5, color: 'var(--text-muted)' }}>Loading your activity…</div>
        )}

        {!loading && filtered.length === 0 && filter !== 'more' && (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
            Nothing here right now.
          </div>
        )}

        {filter !== 'more' && filtered.map((item) => (
          <PulseActivityCard
            key={item.id}
            item={item}
            privacyMode={privacyMode}
            onOpen={handleOpen}
            onMarkRead={() => {}}
          />
        ))}

        {(filter === 'all' || filter === 'more') && (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginTop: 8, marginBottom: 2 }}>
              More apps — coming with the Mattchat mobile app
            </div>
            {LOCKED_PLATFORMS.map(([key, meta]) => (
              <PulseLockedCard key={key} app={key} label={meta.label} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
