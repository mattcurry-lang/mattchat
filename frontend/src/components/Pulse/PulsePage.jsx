import React, { useState, useMemo } from 'react'
import PulseSummaryCard from './PulseSummaryCard'
import PulseFilterBar from './PulseFilterBar'
import PulseActivityCard from './PulseActivityCard'
import PulseLockedCard from './PulseLockedCard'
import BirthdayCard from './BirthdayCard'
import BirthdayExperience from './BirthdayExperience'
import TeamPicker from './TeamPicker'
import TeamSection from './TeamSection'
import BibleCard from './BibleCard'
import { useBirthday } from '../../hooks/useBirthday'
import { PLATFORM_META, AppIcon } from './PulseIcons'
import { usePulseData, usePulseSettings } from '../../hooks/usePulseData'
import { getPulsePlugin } from '../../lib/pulsePlugins'
import { supabase } from '../../lib/supabase'
import YouTubePulsePage from './YouTubePulsePage'
import CyclePage from '../Cycle/CyclePage'
import { IconFlower } from '../Icons'


const LOCKED_PLATFORMS = Object.entries(PLATFORM_META).filter(([, meta]) => meta.supportLevel === 'native_only')

export default function PulsePage({
  session, userId, profile, conversations, unreadCounts, getConvoName,
  onOpenConversation, onSelectVideo, aiSummary, onOpenShorts,
}) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showYouTubePulse, setShowYouTubePulse] = useState(false)
  const [showCycle, setShowCycle] = useState(false)
  const { privacyMode, setPrivacyMode } = usePulseSettings(userId)
  const { items, loading, error, reload } = usePulseData(session, { conversations, unreadCounts, getConvoName })
  const birthday = useBirthday(userId, profile)

  // Local override so picking/clearing a team updates Pulse instantly —
  // `profile` is a prop from ChatPage and PulsePage has no way to push
  // updates back up into it, same pattern as other Pulse writes here.
  const [teamOverride, setTeamOverride] = useState(undefined) // undefined = "use profile", null = "explicitly cleared"
  const favoriteTeam = teamOverride !== undefined ? teamOverride : profile?.favorite_pl_team

  const selectTeam = async (teamId) => {
    setTeamOverride(teamId) // optimistic
    const { error: saveError } = await supabase.from('profiles').update({ favorite_pl_team: teamId }).eq('id', userId)
    if (saveError) {
      console.error('selectTeam failed:', saveError)
      setTeamOverride(undefined) // revert on failure
    }
  }

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

  const handleOpen = (item) => {
    const plugin = getPulsePlugin(item.app)
    plugin?.onOpen?.(item, { onOpenConversation })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Pulse</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {birthday.hasBirthday && birthday.isBirthdayToday && (
            <button
              onClick={birthday.reopen}
              title="Revisit your birthday card"
              style={{
                background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#c4b5fd',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.5 5 5.5.8-4 4 1 5.5L12 15l-5 2.3 1-5.5-4-4 5.5-.8z" /></svg>
            </button>
          )}
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
      </div>

      {/* ── PERSONALIZED HIERARCHY ── */}
      {!birthday.hasBirthday && <BirthdayCard onSave={birthday.saveBirthday} />}

      <PulseSummaryCard name={profile?.username} items={items} loading={loading} aiSummary={aiSummary} />

      {favoriteTeam ? (
        <TeamSection userId={userId} teamId={favoriteTeam} onChangeTeam={(id) => setTeamOverride(id)} />
      ) : (
        <div style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
          <TeamPicker onSelect={selectTeam} />
        </div>
      )}

      <BibleCard />

      {/* ── OTHER PULSE CONTENT (existing activity feed, unchanged) ── */}
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
            <button
              onClick={onOpenShorts}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-surface-2)',
                border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#fe2c55,#25f4ee)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Shorts</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Swipe through trending videos</div>
              </div>
            </button>

            <button
              onClick={() => setShowYouTubePulse(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-surface-2)',
                border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
              }}
            >
              <AppIcon.youtube size={40} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>YouTube</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Search and browse videos</div>
              </div>
            </button>
            <button
  onClick={() => setShowCycle(true)}
  style={{
    display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-surface-2)',
    border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px',
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
  }}
>
  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <IconFlower size={18} style={{ color: '#fff' }} />
  </div>
  <div>
    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Cycle Care</div>
    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Private cycle & wellness tracking</div>
  </div>
</button>

            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginTop: 8, marginBottom: 2 }}>
              More apps — coming with the Mattchat mobile app
            </div>
            {LOCKED_PLATFORMS.map(([key, meta]) => (
              <PulseLockedCard key={key} app={key} label={meta.label} />
            ))}
          </>
        )}
      </div>

      {showYouTubePulse && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg-surface-1, #0f0f1a)', overflowY: 'auto' }}>
          <YouTubePulsePage
            session={session}
            userId={userId}
            onSelectVideo={(videoId) => { setShowYouTubePulse(false); onSelectVideo?.(videoId) }}
            onClose={() => setShowYouTubePulse(false)}
          />
        </div>
      )}
      {showCycle && (
  <CyclePage userId={userId} onClose={() => setShowCycle(false)} />
)}

      {birthday.shouldShowExperience && (
        <BirthdayExperience profile={profile} onClose={birthday.dismiss} />
      )}
    </div>
  )
}
