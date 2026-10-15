import React, { useState, useMemo, useEffect } from 'react'
import PulseSummaryCard from './PulseSummaryCard'
import PulseFilterBar from './PulseFilterBar'
import PulseActivityCard from './PulseActivityCard'
import BirthdayCard from './BirthdayCard'
import BirthdayExperience from './BirthdayExperience'
import TeamPicker from './TeamPicker'
import TeamSection from './TeamSection'
import BibleCard from './BibleCard'
import { useBirthday } from '../../hooks/useBirthday'
import { AppIcon } from './PulseIcons'
import { usePulseData, usePulseSettings } from '../../hooks/usePulseData'
import { getPulsePlugin } from '../../lib/pulsePlugins'
import { supabase } from '../../lib/supabase'
import YouTubePulsePage from './YouTubePulsePage'
import CyclePage from '../Cycle/CyclePage'
import { IconFlower } from '../Icons'
import { usePendingTrustedInvites } from '../../hooks/usePendingTrustedInvites'
import DeKUTHubCard from './DeKUTHubCard'
import RoomFinder from './RoomFinder'
import FresherMode from './FresherMode'
import AskCurry from './AskCurry'
import EmailSetupGuide from './EmailSetupGuide'
import ContactsPage from './ContactsPage'
import MattchatToolsCard from './MattchatToolsCard'
import ScientificCalculator from './ScientificCalculator'
import PulseMusicCard from './Music/PulseMusicCard'
import DekutCateringAdmin from './DekutCateringAdmin'
import DekutKnowledgeAdmin from './DekutKnowledgeAdmin'


 
function LaunchTile({ icon, title, subtitle, onClick, wide, tint, badge }) {
  return (
    <button
      className="pulse-tile"
      onClick={onClick}
      style={{
        gridColumn: wide ? 'span 2' : 'span 1',
        position: 'relative', width: '100%', boxSizing: 'border-box',
        display: 'flex', flexDirection: wide ? 'row' : 'column',
        alignItems: wide ? 'center' : 'flex-start',
        justifyContent: wide ? 'flex-start' : 'space-between',
        gap: 12, minHeight: wide ? 84 : 118, padding: 14, borderRadius: 20,
        background: tint
          ? `linear-gradient(135deg, ${tint}, var(--bg-surface-2) 75%)`
          : 'var(--bg-surface-2)',
        border: '1px solid var(--border)',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'inherit',
      }}
    >
      {icon}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
      </div>
      {badge}
    </button>
  )
}

function IconBox({ background, children }) {
  return (
    <div style={{ width: 40, height: 40, borderRadius: 12, background, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </div>
  )
}

function PulseLaunchGrid({ onOpenShorts, onOpenYouTube, onOpenCycle, cycleInvites }) {
  return (
    <>
      <style>{`
        .pulse-tile { transition: transform 0.15s ease; }
        .pulse-tile:active { transform: scale(0.97); }
        @media (prefers-reduced-motion: reduce) {
          .pulse-tile { transition: none; }
          .pulse-tile:active { transform: none; }
        }
      `}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <LaunchTile
          wide
          tint="rgba(254,44,85,0.16)"
          onClick={onOpenShorts}
          title="Shorts"
          subtitle="Swipe through trending videos"
          icon={
            <IconBox background="linear-gradient(135deg,#fe2c55,#25f4ee)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" />
              </svg>
            </IconBox>
          }
        />
        <LaunchTile
          onClick={onOpenYouTube}
          title="YouTube"
          subtitle="Search and browse"
          icon={<AppIcon.youtube size={40} />}
        />
        <LaunchTile
          onClick={onOpenCycle}
          title="Cycle Care"
          subtitle="Private wellness tracking"
          icon={
            <IconBox background="linear-gradient(135deg,#a78bfa,#6c63ff)">
              <IconFlower size={18} style={{ color: '#fff' }} />
            </IconBox>
          }
          badge={cycleInvites > 0 && (
            <span style={{
              position: 'absolute', top: 10, right: 10, background: '#ef4444', color: '#fff',
              borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {cycleInvites > 9 ? '9+' : cycleInvites}
            </span>
          )}
        />
      </div>
    </>
  )
}
function HeaderMenu({ items }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        aria-label="More options"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        style={{
          width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontFamily: 'inherit',
          background: open ? 'rgba(167,139,250,0.15)' : 'var(--bg-surface-2)',
          border: '1px solid var(--border)', color: 'var(--text-primary)',
          fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ⋯
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: 'absolute', right: 0, top: 40, zIndex: 41, minWidth: 210, overflow: 'hidden',
              background: 'var(--bg-surface-1, #14141f)', border: '1px solid var(--border)',
              borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            }}
          >
            {items.map(({ id, icon, label, onClick }) => (
              <button
                key={id}
                onClick={() => { setOpen(false); onClick() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px',
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'left',
                }}
              >
                <span style={{ width: 20, textAlign: 'center' }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
export default function PulsePage({
  session, userId, profile, conversations, unreadCounts, getConvoName, getOtherUserId,
  onOpenConversation, onSelectVideo, aiSummary, onOpenShorts,
  onFullscreenChange, onAskCurry,
}) {

  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showYouTubePulse, setShowYouTubePulse] = useState(false)
  const [showCycle, setShowCycle] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
 const [dekutView, setDekutView] = useState(null)
const [dekutRouteContext, setDekutRouteContext] = useState(null)    
  const { privacyMode, setPrivacyMode } = usePulseSettings(userId)
  const { items, loading, error, reload } = usePulseData(session, { conversations, unreadCounts, getConvoName })
  const birthday = useBirthday(userId, profile)
  const { count: pendingCycleInvites } = usePendingTrustedInvites(userId)

   
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

  const handleOpenTool = (toolId) => {
    if (toolId === 'scientific-calculator') setShowCalculator(true)
  }
 
 const handleExplainWithCurry = ({ expression, result }) => {
  onAskCurry?.(`Explain how to calculate ${expression} = ${result}, step by step, in simple language.`)
  setShowCalculator(false)
}
  const filtered = useMemo(() => {
    let list = items
    if (filter === 'priority') list = list.filter((i) => i.importance === 'high' || i.importance === 'critical')
    else if (filter === 'unread') list = list.filter((i) => i.count > 0)
    else if (filter !== 'all') list = list.filter((i) => i.app === filter)

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
 useEffect(() => {
    onFullscreenChange?.(dekutView !== null)
    return () => onFullscreenChange?.(false)
  }, [dekutView, onFullscreenChange])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
       <h2 style={{
  fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em',
  display: 'flex', alignItems: 'center', gap: 8,
  backgroundImage: 'linear-gradient(135deg, #fff 10%, #a78bfa 55%, #22d3ee 100%)',
  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
}}>
  Pulse
  <span aria-hidden="true" style={{ position: 'relative', width: 9, height: 9, flexShrink: 0 }}>
    <span style={{
      position: 'absolute', inset: 0, borderRadius: '50%',
      background: '#a78bfa', animation: 'pulseDotPing 2s cubic-bezier(0,0,0.2,1) infinite',
    }} />
    <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#a78bfa' }} />
  </span>
</h2>
<style>{`
  @keyframes pulseDotPing {
    0% { transform: scale(1); opacity: 0.7; }
    70%, 100% { transform: scale(2.4); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    h2 span[aria-hidden="true"] span:first-child { animation: none !important; }
  }
`}</style>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {birthday.hasBirthday && birthday.isBirthdayToday && (
            <button
              onClick={birthday.reopen}
              title="Revisit your birthday card"
              aria-label="Revisit your birthday card"
              style={{
                background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#c4b5fd',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.5 5 5.5.8-4 4 1 5.5L12 15l-5 2.3 1-5.5-4-4 5.5-.8z" /></svg>
            </button>
          )}

          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            aria-pressed={privacyMode}
            aria-label="Privacy mode"
            title={privacyMode ? 'Privacy mode is on — tap to turn off' : 'Turn on Privacy Mode'}
            style={{
              width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: privacyMode ? 'rgba(74,222,128,0.12)' : 'var(--bg-surface-2)',
              border: `1px solid ${privacyMode ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
            }}
          >
            {privacyMode ? '🔒' : '🔓'}
          </button>

          {profile?.is_admin && (
            <HeaderMenu
              items={[
                { id: 'kb', icon: '📚', label: 'Curry Knowledge Base', onClick: () => setDekutView('knowledge-admin') },
                { id: 'catering', icon: '🍛', label: 'Catering Admin', onClick: () => setDekutView('catering-admin') },
              ]}
            />
          )}
        </div>
      </div>

      {/* ── PERSONALIZED HIERARCHY ── */}
      {!birthday.hasBirthday && <BirthdayCard onSave={birthday.saveBirthday} />}

      <PulseSummaryCard name={profile?.username} items={items} loading={loading} aiSummary={aiSummary} />
<PulseLaunchGrid
  onOpenShorts={onOpenShorts}
  onOpenYouTube={() => setShowYouTubePulse(true)}
  onOpenCycle={() => setShowCycle(true)}
  cycleInvites={pendingCycleInvites}
/>
     {favoriteTeam ? (
  <TeamSection
    userId={userId}
    teamId={favoriteTeam}
    onChangeTeam={(id) => setTeamOverride(id)}
    session={session}
    onSelectVideo={onSelectVideo}
  />
) : (
        <div style={{ borderRadius: 18, padding: 16, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
          <TeamPicker onSelect={selectTeam} />
        </div>
      )}

      <BibleCard />
     <DeKUTHubCard onNavigate={(route, service) => {
  setDekutRouteContext(service?.id === 'campus-map' ? { initialTab: 'map' } : null)
  setDekutView(route)
}} />

      {/* ── MATTCHAT TOOLS ── */}
<MattchatToolsCard onOpenTool={handleOpenTool} />
<PulseMusicCard onFullscreenChange={onFullscreenChange} />

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

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
            Nothing here right now.
          </div>
        )}

        {filtered.map((item) => (
          <PulseActivityCard
            key={item.id}
            item={item}
            privacyMode={privacyMode}
            onOpen={handleOpen}
            onMarkRead={() => {}}
          />
        ))}
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
        <CyclePage
          userId={userId}
          conversations={conversations}
          getConvoName={getConvoName}
          getOtherUserId={getOtherUserId}
          onClose={() => setShowCycle(false)}
          onOpenConversation={(targetUserId, prefillMessage) => {
            setShowCycle(false)
            onOpenConversation?.(targetUserId, prefillMessage)
          }}
        />
      )}

      {showCalculator && (
        <ScientificCalculator
          userId={userId}
          onClose={() => setShowCalculator(false)}
          onExplainWithCurry={handleExplainWithCurry}
        />
      )}

      {dekutView === 'catering-admin' && profile?.is_admin && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg-surface-1, #0f0f1a)', overflowY: 'auto', padding: 16 }}>
          <DekutCateringAdmin onClose={() => setDekutView(null)} />
        </div>
      )}

      {dekutView === 'knowledge-admin' && profile?.is_admin && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg-surface-1, #0f0f1a)', overflowY: 'auto', padding: 16 }}>
          <DekutKnowledgeAdmin onClose={() => setDekutView(null)} />
        </div>
      )}

      {dekutView === 'room-finder' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg-surface-1, #0f0f1a)', overflowY: 'auto', padding: 16 }}>
          <RoomFinder
            onClose={() => { setDekutView(null); setDekutRouteContext(null) }}
            userId={userId}
            isAdmin={profile?.is_admin}
            originLocationId={dekutRouteContext?.originLocationId}
            destinationLocationId={dekutRouteContext?.destinationLocationId}
            initialTab={dekutRouteContext?.initialTab}
          />
        </div>
      )}

      {dekutView === 'fresher-mode' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg-surface-1, #0f0f1a)', overflowY: 'auto', padding: 16 }}>
          <FresherMode onNavigate={(route) => setDekutView(route)} onClose={() => setDekutView(null)} />
        </div>
      )}

      {dekutView === 'faq' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg-surface-1, #0f0f1a)', overflowY: 'auto', padding: 16 }}>
          <AskCurry
            userId={userId}
            onNavigate={(route, svc, routeContext) => {
              setDekutRouteContext(routeContext || null)
              setDekutView(route)
            }}
            onClose={() => setDekutView(null)}
          />
        </div>
      )}

      {dekutView === 'email-setup' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg-surface-1, #0f0f1a)', overflowY: 'auto', padding: 16 }}>
          <EmailSetupGuide onNavigate={(route) => setDekutView(route)} onClose={() => setDekutView(null)} />
        </div>
      )}

      {dekutView === 'contacts' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg-surface-1, #0f0f1a)', overflowY: 'auto', padding: 16 }}>
          <ContactsPage onClose={() => setDekutView(null)} />
        </div>
      )}

      {birthday.shouldShowExperience && (
        <BirthdayExperience profile={profile} onClose={birthday.dismiss} />
      )}
    </div>
  )
}
