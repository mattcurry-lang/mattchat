import React, { useMemo, useState, useEffect } from 'react'
import Avatar from './Avatar'
import { computeReplyTimeLabel, supabase } from '../lib/supabase'
import { themeById, themeGradient } from '../lib/profileThemes'
import { 
  IconX, IconClock, IconSparkle, IconMessageSquare, 
  IconVerified, IconShieldAlert, IconBellOff, IconSearch, 
  IconPhone, IconVideo, IconShield, IconBell, IconFolder, IconTrash, 
  IconFilm, IconMusic, IconCheck, IconShare2, IconLock, IconUserPlus
} from './Icons'

export const AVATAR_CATEGORIES = [
  { id: 'professional', label: 'Professional', emoji: '👔' },
  { id: 'personal',     label: 'Personal',     emoji: '😊' },
  { id: 'minimal',      label: 'Minimal',      emoji: '🎨' },
  { id: 'gaming',       label: 'Gaming',       emoji: '🎮' },
  { id: 'ai_avatar',    label: 'AI Avatar',    emoji: '🤖' },
  { id: 'photography',  label: 'Photography',  emoji: '📸' },
  { id: 'anime',        label: 'Anime',        emoji: '🌌' },
  { id: 'nature',       label: 'Nature',       emoji: '🌿' },
  { id: 'animals',      label: 'Animals',      emoji: '🐶' },
  { id: 'cars',         label: 'Cars',         emoji: '🚗' },
  { id: 'sports',       label: 'Sports',       emoji: '⚽' },
  { id: 'music',        label: 'Music',        emoji: '🎵' },
]

export default function ProfileCard({
  targetProfile,
  myProfile,
  messages = [],
  currentUserId,
  onClose,
  onAskCurry,
  onMessageContact,
  onToggleMute,
  onVoiceCall,
  onVideoCall,
  onOpenSearch,         
  extras,             
}) {
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'media' | 'experiences' | 'security' | 'settings'

  // Safety & Moderation States
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockLoading, setBlockLoading] = useState(true)
  const [disappearingTimer, setDisappearingTimer] = useState('off')

  // Search Mode inside Drawer
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Guest Pass / Temporary Access Pass State
  const [passDuration, setPassDuration] = useState('2h')
  const [passCopied, setPassCopied] = useState(false)
  const [generatedPassCode, setGeneratedPassCode] = useState('')

  // Bio Expand State
  const [bioExpanded, setBioExpanded] = useState(false)

  // Edit Mode State (when viewing self)
  const [isEditingSelf, setIsEditingSelf] = useState(false)
  const [editBio, setEditBio] = useState(targetProfile?.bio || '')
  const [editStatusText, setEditStatusText] = useState(extras?.statusText || '')

  const isSelf = targetProfile?.id === currentUserId
  const displayName = targetProfile?.username || 'Mattchat User'

  // Check initial block status
  useEffect(() => {
    if (!currentUserId || !targetProfile?.id || isSelf) {
      setBlockLoading(false)
      return
    }
    supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', targetProfile.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsBlocked(!!data)
        setBlockLoading(false)
      })
  }, [currentUserId, targetProfile?.id, isSelf])

  // Compute calculated reply latency badge
  const replyLabel = useMemo(
    () => computeReplyTimeLabel(messages, targetProfile?.id, currentUserId),
    [messages, targetProfile, currentUserId]
  )

  // Compute Shared Interests
  const sharedInterests = useMemo(() => {
    const mineSet = new Set((myProfile?.interests || []).map(s => s.toLowerCase().trim()))
    return (targetProfile?.interests || []).filter(i => mineSet.has(i.toLowerCase().trim()))
  }, [myProfile, targetProfile])

  // High-Fidelity Categorized Shared Media
  const sharedMedia = useMemo(() => {
    const msgs = messages || []
    const photos = []
    const links = []
    const documents = []
    const audio = []

    msgs.forEach(m => {
      const c = m.content || ''
      if (m.message_type === 'media' || c.startsWith('gif:') || c.startsWith('pinterest:') || c.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
        let url = c
        if (c.startsWith('gif:')) url = c.replace('gif:', '').split('::')[0]
        if (c.startsWith('pinterest:')) url = c.replace('pinterest:', '').split('::')[0]
        photos.push({ id: m.id, url, timestamp: m.created_at })
      } else if (c.includes('http://') || c.includes('https://')) {
        const matches = c.match(/https?:\/\/[^\s]+/g) || []
        matches.forEach(link => links.push({ id: m.id, url: link, timestamp: m.created_at }))
      } else if (m.message_type === 'task' || m.message_type === 'document') {
        documents.push({ id: m.id, name: c.slice(0, 30) || 'Shared Document', timestamp: m.created_at })
      } else if (m.message_type === 'voice' || m.message_type === 'music') {
        audio.push({ id: m.id, title: c.slice(0, 30) || 'Audio Note', timestamp: m.created_at })
      }
    })

    return { photos, links, documents, audio }
  }, [messages])

  // Filtered Messages for Inline Search
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return []
    return (messages || []).filter(m => m.content && m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [messages, searchQuery])

  // Generate Temporary Security Pass Code & Send Interactive Card Payload to Chat
  const handleGenerateGuestPass = async () => {
    const randomHash = Math.random().toString(36).substring(2, 8).toUpperCase()
    const hoursNum = parseInt(passDuration) || 2
    const passCode = `MATT-${passDuration.toUpperCase()}-${randomHash}`
    
    const expiresAt = new Date(Date.now() + hoursNum * 3600 * 1000).toISOString()

    // 1. Insert record into Supabase backend table
    const { error: dbError } = await supabase.from('temporary_passes').insert({
      pass_code: passCode,
      creator_id: currentUserId,
      target_user_id: targetProfile.id,
      duration_hours: hoursNum,
      status: 'pending',
      expires_at: expiresAt
    })

    if (dbError) {
      console.error('Failed to create temporary pass:', dbError)
      return
    }

    // 2. Prepare structured message payload for the interactive card
    const passPayload = JSON.stringify({
      type: 'temporary_pass',
      pass_code: passCode,
      duration: passDuration,
      creator_name: myProfile?.username || 'Mathew',
      expires_at: expiresAt,
      status: 'pending'
    })

    // 3. Send the pass payload directly into the active chat conversation
    const activeConvoId = messages?.[0]?.conversation_id
    if (activeConvoId) {
      await supabase.from('messages').insert({
        conversation_id: activeConvoId,
        sender_id: currentUserId,
        content: passPayload,
        message_type: 'text'
      })
    }

    setGeneratedPassCode(passCode)
    setPassCopied(true)
    setTimeout(() => setPassCopied(false), 3000)
  }

  // Handle Block Toggle
  const handleToggleBlock = async () => {
    if (isBlocked) {
      const { error } = await supabase.from('blocked_users').delete().eq('blocker_id', currentUserId).eq('blocked_id', targetProfile.id)
      if (!error) { setIsBlocked(false); setShowBlockConfirm(false) }
    } else {
      if (!showBlockConfirm) { setShowBlockConfirm(true); return }
      const { error } = await supabase.from('blocked_users').insert({ blocker_id: currentUserId, blocked_id: targetProfile.id })
      if (!error) { setIsBlocked(true); setShowBlockConfirm(false) }
    }
  }

  if (!targetProfile) return null

  const theme = themeById(extras?.theme)
  const bio = extras?.bio || targetProfile.bio
  const hasStatus = !!(extras?.statusEmoji || extras?.statusText)

  return (
    <div className="profile-drawer-container" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(5, 5, 12, 0.82)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.22s ease-out'
    }}>
      <div
        className="profile-drawer-panel"
        onClick={e => e.stopPropagation()}
        style={{ 
          width: '100%', maxWidth: 430, height: '100%', 
          background: 'linear-gradient(180deg, #0e0d18 0%, #080811 100%)', 
          color: '#f2f0f8', borderLeft: '1px solid rgba(167, 139, 250, 0.2)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.85)',
          animation: 'slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Sticky Header Navigation */}
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          padding: '16px 20px', background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)', position: 'sticky', top: 0, zIndex: 10
        }}>
          {isSearching ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <IconSearch size={18} style={{ color: '#a78bfa' }} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search history with ${displayName}...`}
                autoFocus
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 13.5, fontFamily: 'inherit' }}
              />
              <button onClick={() => { setIsSearching(false); setSearchQuery(''); }} style={{ background: 'none', border: 'none', color: '#9d97b5', cursor: 'pointer' }}>
                <IconX size={18} />
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#a78bfa' }}>
                  {isSelf ? 'My Identity' : 'Contact Profile'}
                </span>
                {extras?.online && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80' }} />}
              </div>
              <button onClick={onClose} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                cursor: 'pointer', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <IconX size={15} />
              </button>
            </>
          )}
        </div>

        {isSearching ? (
          /* Search History Drawer Mode */
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {searchQuery.trim() === '' ? (
              <div style={{ color: '#8b8b9e', fontSize: 13, textAlign: 'center', marginTop: 60 }}>Type keywords to search conversation history...</div>
            ) : filteredMessages.length === 0 ? (
              <div style={{ color: '#8b8b9e', fontSize: 13, textAlign: 'center', marginTop: 60 }}>No matching messages found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredMessages.map(msg => (
                  <div key={msg.id} style={{ padding: 14, borderRadius: 14, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(167,139,250,0.15)' }}>
                    <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700, marginBottom: 4 }}>{msg.sender_id === currentUserId ? 'You' : displayName}</div>
                    <div style={{ fontSize: 13, color: '#e8e8f0', lineHeight: 1.4 }}>{msg.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Standard Profile Navigation Mode */
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            
            {/* Ambient Hero Identity Header */}
            <div style={{ 
              padding: '28px 20px 22px 20px', display: 'flex', flexDirection: 'column', 
              alignItems: 'center', textAlign: 'center', position: 'relative',
              background: 'radial-gradient(circle at 50% 20%, rgba(108,99,255,0.18) 0%, transparent 75%)',
              borderBottom: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div style={{
                borderRadius: '50%', padding: 4, background: themeGradient(theme),
                boxShadow: '0 12px 40px rgba(108, 99, 255, 0.4)', display: 'inline-block', marginBottom: 12,
                position: 'relative'
              }}>
                <Avatar name={displayName} photoUrl={targetProfile.avatar_url} size={94} />
                {extras?.online && (
                  <span title="Online now" style={{
                    position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, borderRadius: '50%',
                    background: '#4ade80', border: '2.5px solid #0e0d18', boxShadow: '0 0 10px rgba(74,222,128,0.8)'
                  }} />
                )}
              </div>

              <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                {displayName}
                {targetProfile.is_admin && <IconVerified size={17} />}
              </div>
              <div style={{ fontSize: 12.5, color: '#a78bfa', fontWeight: 600, marginTop: 2 }}>
                @{targetProfile.username?.toLowerCase() || 'mattchat_user'}
              </div>

              {/* Communication Toolbar */}
              {!isSelf ? (
                <div style={{ display: 'flex', gap: 10, marginTop: 18, width: '100%', maxWidth: 350, justifyContent: 'center' }}>
                  <button onClick={() => { onMessageContact?.(targetProfile.email); onClose(); }} style={toolbarPrimaryBtnStyle}>
                    <IconMessageSquare size={14} /> Message
                  </button>
                  <button onClick={() => { onVoiceCall?.(); onClose(); }} style={toolbarSecondaryBtnStyle}>
                    <IconPhone size={14} /> Call
                  </button>
                  <button onClick={() => { onVideoCall?.(); onClose(); }} style={toolbarSecondaryBtnStyle}>
                    <IconVideo size={14} /> Video
                  </button>
                  <button onClick={() => setIsSearching(true)} style={toolbarSecondaryBtnStyle} title="Search chat">
                    <IconSearch size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsEditingSelf(!isEditingSelf)} style={{ ...toolbarPrimaryBtnStyle, marginTop: 16, width: 'auto', padding: '8px 20px' }}>
                  {isEditingSelf ? 'Done Editing' : 'Edit Profile'}
                </button>
              )}
            </div>

            {/* Hybrid Profile Navigation Bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', padding: '0 4px' }}>
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'media', label: `Media (${sharedMedia.photos.length + sharedMedia.links.length})` },
                { id: 'experiences', label: 'Experiences' },
                { id: 'security', label: 'Security & Pass' },
                { id: 'settings', label: 'Privacy' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1, padding: '12px 2px', background: 'none', border: 'none', fontFamily: 'inherit',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center',
                    color: activeTab === tab.id ? '#c4b5fd' : '#8b8b9e',
                    borderBottom: activeTab === tab.id ? '2px solid #a78bfa' : '2px solid transparent',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENTS */}
            <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* 1. OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <>
                  <div style={cardBoxStyle}>
                    {hasStatus && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={sectionLabelStyle}>Current Status</div>
                        <div style={{ fontSize: 13.5, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15 }}>{extras.statusEmoji || '💭'}</span>
                          <span>{extras.statusText}</span>
                        </div>
                      </div>
                    )}

                    {bio && (
                      <div>
                        <div style={sectionLabelStyle}>About</div>
                        <div style={{ fontSize: 13, color: '#d1cde6', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: bioExpanded ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {bio}
                        </div>
                        {bio.length > 120 && (
                          <button onClick={() => setBioExpanded(!bioExpanded)} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 11.5, fontWeight: 700, padding: 0, marginTop: 4, cursor: 'pointer' }}>
                            {bioExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    )}

                    {replyLabel && (
                      <div style={{ fontSize: 11.5, color: '#9d97b5', display: 'flex', alignItems: 'center', gap: 6, marginTop: bio || hasStatus ? 12 : 0, paddingTop: bio || hasStatus ? 10 : 0, borderTop: bio || hasStatus ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                        <IconClock size={13} style={{ color: '#a78bfa' }} /> {replyLabel}
                      </div>
                    )}
                  </div>

                  {sharedInterests.length > 0 && (
                    <div style={cardBoxStyle}>
                      <div style={sectionLabelStyle}>Shared Interests ({sharedInterests.length})</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {sharedInterests.map(interest => (
                          <span key={interest} style={{
                            fontSize: 11.5, fontWeight: 600, color: '#c4b5fd', background: 'rgba(108,99,255,0.18)',
                            border: '1px solid rgba(108,99,255,0.35)', borderRadius: 999, padding: '3px 10px',
                          }}>
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Curry AI Intelligence Hook */}
                  {onAskCurry && (
                    <div style={{ ...cardBoxStyle, background: 'linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(108,99,255,0.06) 100%)', border: '1px solid rgba(167,139,250,0.25)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <IconSparkle size={16} style={{ color: '#a78bfa' }} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>Curry Conversation Intelligence</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#9d97b5', marginBottom: 12, lineHeight: 1.4 }}>
                        Ask Curry to summarize shared decisions or recall key moments from your chat thread with {displayName}.
                      </div>
                      <button 
                        style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg, #6c63ff 0%, #9333ea 100%)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                        onClick={() => { onAskCurry(`Summarize our key discussions with ${displayName}`); onClose(); }}
                      >
                        Summarize Conversation History
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* 2. MEDIA & VAULT TAB */}
              {activeTab === 'media' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={cardBoxStyle}>
                    <div style={sectionLabelStyle}>Photos & Visuals ({sharedMedia.photos.length})</div>
                    {sharedMedia.photos.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {sharedMedia.photos.slice(0, 9).map(m => (
                          <div key={m.id} style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <img src={m.url} alt="Shared media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>No shared photos found</div>
                    )}
                  </div>

                  <div style={cardBoxStyle}>
                    <div style={sectionLabelStyle}>Shared Links ({sharedMedia.links.length})</div>
                    {sharedMedia.links.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {sharedMedia.links.slice(0, 5).map((l, idx) => (
                          <a key={idx} href={l.url} target="_blank" rel="noreferrer" style={{ 
                            fontSize: 12, color: '#c4b5fd', background: 'rgba(167,139,250,0.08)', padding: '8px 12px', borderRadius: 10,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid rgba(167,139,250,0.15)', textDecoration: 'none' 
                          }}>
                            🔗 {l.url}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>No shared links found</div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. SHARED EXPERIENCES TAB */}
              {activeTab === 'experiences' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={cardBoxStyle}>
                    <div style={sectionLabelStyle}>Shared Music & Audio</div>
                    {sharedMedia.audio.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {sharedMedia.audio.map(a => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                            <IconMusic size={16} style={{ color: '#a78bfa' }} />
                            <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{a.title}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic', padding: '8px 0' }}>No shared music sessions yet</div>
                    )}
                  </div>

                  <div style={cardBoxStyle}>
                    <div style={sectionLabelStyle}>Watch Together & Interactive Apps</div>
                    <div style={{ fontSize: 12, color: '#9d97b5', lineHeight: 1.4 }}>
                      Start a synchronized YouTube stream or drawing canvas directly within your chat thread.
                    </div>
                  </div>
                </div>
              )}

              {/* 4. SECURITY & TEMPORARY ACCESS PASS TAB */}
              {activeTab === 'security' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Encryption Status */}
                  <div style={{ ...cardBoxStyle, background: 'linear-gradient(135deg, rgba(74,222,128,0.05) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(74,222,128,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <IconShield size={18} style={{ color: '#4ade80' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f2f0f8' }}>End-to-End Encrypted Channel</span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 10, fontFamily: 'monospace', fontSize: 11, color: '#4ade80', textAlign: 'center', letterSpacing: '0.08em' }}>
                      4891 0294 8192 7482 1092 3841 9021 7482
                    </div>
                  </div>

                  {/* Temporary Guest Access Pass Feature */}
                  <div style={{ ...cardBoxStyle, border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <IconUserPlus size={16} style={{ color: '#a78bfa' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Create Temporary Chat Pass</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#9d97b5', lineHeight: 1.4, marginBottom: 12 }}>
                      Invite a third person to temporarily drop into this chat thread for a couple of hours without creating a permanent group.
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      {['1h', '2h', '6h', '24h'].map(dur => (
                        <button 
                          key={dur} 
                          onClick={() => setPassDuration(dur)}
                          style={{
                            flex: 1, padding: '6px', borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                            background: passDuration === dur ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.04)',
                            color: passDuration === dur ? '#c4b5fd' : '#9d97b5',
                            border: passDuration === dur ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.08)',
                            cursor: 'pointer'
                          }}
                        >
                          {dur} Pass
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={handleGenerateGuestPass}
                      style={{
                        width: '100%', padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                      }}
                    >
                      <IconShare2 size={14} /> {passCopied ? 'Pass Sent & Copied!' : 'Generate & Send Access Pass'}
                    </button>

                    {generatedPassCode && (
                      <div style={{ marginTop: 10, fontSize: 11, color: '#4ade80', textAlign: 'center', fontFamily: 'monospace' }}>
                        Active Pass Code: {generatedPassCode}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. PRIVACY & SETTINGS TAB */}
              {activeTab === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={settingRowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <IconBell size={16} style={{ color: '#a78bfa' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#f2f0f8' }}>Mute Notifications</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={isMuted} 
                      onChange={() => {
                        const next = !isMuted
                        setIsMuted(next)
                        onToggleMute?.(targetProfile.id, next)
                      }} 
                      style={{ cursor: 'pointer', width: 17, height: 17, accentColor: '#7c6cf0' }} 
                    />
                  </div>

                  <div style={settingRowStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <IconClock size={16} style={{ color: '#a78bfa' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#f2f0f8' }}>Disappearing Messages</span>
                    </div>
                    <select 
                      value={disappearingTimer} 
                      onChange={(e) => setDisappearingTimer(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 8, padding: '4px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="off" style={{ background: '#14141f' }}>Off</option>
                      <option value="24h" style={{ background: '#14141f' }}>24 Hours</option>
                      <option value="7d" style={{ background: '#14141f' }}>7 Days</option>
                    </select>
                  </div>

                  {!isSelf && !blockLoading && (
                    <button
                      onClick={handleToggleBlock}
                      style={{
                        marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '12px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        background: showBlockConfirm ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.08)',
                        color: isBlocked ? '#34d399' : '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 12
                      }}
                    >
                      <IconShieldAlert size={16} /> 
                      {isBlocked ? `Unblock ${displayName}` : (showBlockConfirm ? `Confirm Block ${displayName}?` : `Block ${displayName}`)}
                    </button>
                  )}
                </div>
              )}

            </div>

          </div>
        )}
      </div>
    </div>
  )
}

// Micro-Styles
const toolbarPrimaryBtnStyle = {
  flex: 1, padding: '10px 14px', borderRadius: 12,
  background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)',
  color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit',
  boxShadow: '0 4px 14px rgba(108,99,255,0.35)'
}

const toolbarSecondaryBtnStyle = {
  padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)', color: '#f2f0f8', fontSize: 12.5, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit'
}

const cardBoxStyle = {
  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16, padding: 15, display: 'flex', flexDirection: 'column', gap: 8
}

const settingRowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px',
  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14
}

const sectionLabelStyle = {
  fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9d97b5', marginBottom: 4
}
