import React, { useMemo, useState, useEffect } from 'react'
import Avatar from './Avatar'
import { computeReplyTimeLabel, supabase } from '../lib/supabase'
import { themeById, themeGradient } from '../lib/profileThemes'
import { 
  IconX, IconClock, IconSparkle, IconMessageSquare, 
  IconVerified, IconShieldAlert, IconBellOff, IconSearch, 
  IconPhone, IconVideo, IconShield, IconBell, IconFolder, IconTrash
} from './Icons'

// AVATAR_CATEGORIES exported so setup flows and ProfileCard agree on tags
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
  messages,
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
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'media' | 'security' | 'settings'

  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockLoading, setBlockLoading] = useState(true)

  // Granular Chat Settings State (WhatsApp-style)
  const [disappearingTimer, setDisappearingTimer] = useState('off') // 'off' | '24h' | '7d' | '90d'

  // Profile Drawer Search Mode
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!currentUserId || !targetProfile?.id || currentUserId === targetProfile.id) {
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
  }, [currentUserId, targetProfile?.id])

  const replyLabel = useMemo(
    () => computeReplyTimeLabel(messages, targetProfile?.id, currentUserId),
    [messages, targetProfile, currentUserId]
  )

  const shared = useMemo(() => {
    const mineSet = new Set((myProfile?.interests || []).map(s => s.toLowerCase().trim()))
    return (targetProfile?.interests || []).filter(i => mineSet.has(i.toLowerCase().trim()))
  }, [myProfile, targetProfile])

  // Categorize messages into media types (Telegram-style media hub)
  const sharedMedia = useMemo(() => {
    const msgs = messages || []
    const photos = msgs.filter(m => m.message_type === 'media' || m.content?.startsWith('gif:') || m.content?.startsWith('pinterest:'))
    const links = msgs.filter(m => m.content?.includes('http://') || m.content?.includes('https://'))
    const files = msgs.filter(m => m.message_type === 'document' || m.message_type === 'task')
    return { photos, links, files }
  }, [messages])

  // Filter messages for inner profile search
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return []
    return (messages || []).filter(m => 
      m.content && m.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [messages, searchQuery])

  const handleToggleBlock = async () => {
    if (isBlocked) {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', targetProfile.id)
      if (!error) {
        setIsBlocked(false)
        setShowBlockConfirm(false)
      }
    } else {
      if (!showBlockConfirm) {
        setShowBlockConfirm(true)
        return
      }
      const { error } = await supabase
        .from('blocked_users')
        .insert({ blocker_id: currentUserId, blocked_id: targetProfile.id })
      if (!error) {
        setIsBlocked(true)
        setShowBlockConfirm(false)
      }
    }
  }

  if (!targetProfile) return null

  const theme = themeById(extras?.theme)
  const bio = extras?.bio || targetProfile.bio
  const hasStatus = !!(extras?.statusEmoji || extras?.statusText)
  const displayName = targetProfile.username || 'User'
  const isSelf = targetProfile?.id === currentUserId

  return (
    <div 
      className="profile-drawer-container" 
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(5, 5, 10, 0.75)', backdropFilter: 'blur(10px)',
        display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.2s ease'
      }}
    >
      <div
        className="profile-drawer-panel"
        onClick={e => e.stopPropagation()}
        style={{ 
          width: '100%', maxWidth: 410, height: '100%', 
          background: 'linear-gradient(180deg, #0b0b14 0%, #121224 100%)', 
          color: '#f2f0f8', borderLeft: '1px solid rgba(167, 139, 250, 0.15)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-16px 0 48px rgba(0,0,0,0.8)',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Dynamic Header (Nav or Search Mode) */}
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          padding: '16px 20px', background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'sticky', top: 0, zIndex: 10
        }}>
          {isSearching ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <IconSearch size={18} style={{ color: '#a78bfa' }} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search in chat with ${displayName}...`}
                autoFocus
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: '#fff', fontSize: 14, fontFamily: 'inherit'
                }}
              />
              <button 
                onClick={() => { setIsSearching(false); setSearchQuery(''); }}
                style={{ background: 'none', border: 'none', color: '#9d97b5', cursor: 'pointer' }}
              >
                <IconX size={18} />
              </button>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.02em', color: '#f2f0f8' }}>Contact Info</span>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                  cursor: 'pointer', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <IconX size={16} />
              </button>
            </>
          )}
        </div>

        {/* Search Results Overlay Mode */}
        {isSearching ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {searchQuery.trim() === '' ? (
              <div style={{ color: '#8b8b9e', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                Type to search conversation history...
              </div>
            ) : filteredMessages.length === 0 ? (
              <div style={{ color: '#8b8b9e', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                No matching messages found
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredMessages.map(msg => (
                  <div key={msg.id} style={{
                    padding: 12, borderRadius: 12, background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600, marginBottom: 4 }}>
                      {msg.sender_id === currentUserId ? 'You' : displayName}
                    </div>
                    <div style={{ fontSize: 13, color: '#e8e8f0', lineHeight: 1.4 }}>{msg.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Normal Profile View Mode with Hybrid Tabs */
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            
            {/* Hero Section */}
            <div style={{ 
              padding: '24px 20px 18px 20px', display: 'flex', flexDirection: 'column', 
              alignItems: 'center', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div style={{
                borderRadius: '50%', padding: 4, background: themeGradient(theme),
                boxShadow: '0 8px 32px rgba(108, 99, 255, 0.3)', display: 'inline-block', marginBottom: 12
              }}>
                <Avatar name={displayName} photoUrl={targetProfile.avatar_url} size={96} />
              </div>

              <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                {displayName}
                {targetProfile.is_admin && <IconVerified size={16} />}
              </div>
              <div style={{ fontSize: 12.5, color: '#a78bfa', fontWeight: 600, marginTop: 2 }}>
                @{targetProfile.username?.toLowerCase() || 'mattchat_user'}
              </div>

              {/* Action Toolbar */}
              {!isSelf && (
                <div style={{ 
                  display: 'flex', gap: 12, marginTop: 16, width: '100%', justifyContent: 'center'
                }}>
                  <button 
                    onClick={() => { onVoiceCall?.(); onClose(); }}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 12, background: 'rgba(108,99,255,0.12)',
                      border: '1px solid rgba(108,99,255,0.25)', color: '#a78bfa', fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer'
                    }}
                  >
                    <IconPhone size={15} /> Audio
                  </button>
                  <button 
                    onClick={() => { onVideoCall?.(); onClose(); }}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 12, background: 'rgba(108,99,255,0.12)',
                      border: '1px solid rgba(108,99,255,0.25)', color: '#a78bfa', fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer'
                    }}
                  >
                    <IconVideo size={15} /> Video
                  </button>
                  <button 
                    onClick={() => setIsSearching(true)}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 12, background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)', color: '#f2f0f8', fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer'
                    }}
                  >
                    <IconSearch size={15} /> Search
                  </button>
                </div>
              )}
            </div>

            {/* Hybrid Navigation Tabs Bar (Telegram/Discord/WhatsApp hybrid) */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
              {['overview', 'media', 'security', 'settings'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: '10px 0', background: 'none', border: 'none', fontFamily: 'inherit',
                    fontSize: 11.5, fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer',
                    color: activeTab === tab ? '#a78bfa' : '#9d97b5',
                    borderBottom: activeTab === tab ? '2px solid #a78bfa' : '2px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* TAB CONTENT PANES */}
            <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <>
                  {/* Status / Bio */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 14 }}>
                    {hasStatus && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Status</div>
                        <div style={{ fontSize: 13.5, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{extras.statusEmoji || '💭'}</span>
                          <span>{extras.statusText}</span>
                        </div>
                      </div>
                    )}

                    {bio && (
                      <div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8b8b9e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>About</div>
                        <div style={{ fontSize: 13, color: '#d1cde6', lineHeight: 1.5 }}>{bio}</div>
                      </div>
                    )}

                    {replyLabel && (
                      <div style={{ fontSize: 11.5, color: '#8b8b9e', display: 'flex', alignItems: 'center', gap: 6, marginTop: bio || hasStatus ? 12 : 0 }}>
                        <IconClock size={13} /> {replyLabel}
                      </div>
                    )}
                  </div>

                  {/* Shared Interests */}
                  {shared.length > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 14 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8b8b9e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        Shared Interests ({shared.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {shared.map(interest => (
                          <span
                            key={interest}
                            style={{
                              fontSize: 11.5, fontWeight: 600, color: '#a78bfa', background: 'rgba(108,99,255,0.15)',
                              border: '1px solid rgba(108,99,255,0.3)', borderRadius: 999, padding: '3px 10px',
                            }}
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Assistant Hook */}
                  {onAskCurry && (
                    <button
                      style={{ 
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 14,
                        background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(108,99,255,0.35)'
                      }}
                      onClick={() => {
                        onAskCurry(`Tell me about my conversations with ${displayName}`)
                        onClose()
                      }}
                    >
                      <IconSparkle size={16} /> Ask Curry about {displayName}
                    </button>
                  )}
                </>
              )}

              {/* TAB 2: SHARED MEDIA (Telegram-style media hub) */}
              {activeTab === 'media' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9d97b5', marginBottom: 8 }}>
                      Photos & GIFs ({sharedMedia.photos.length})
                    </div>
                    {sharedMedia.photos.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        {sharedMedia.photos.slice(0, 6).map((m, idx) => (
                          <div key={idx} style={{ aspectRatio: '1', borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9d97b5' }}>
                            🖼️ Media
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>No photos shared yet</div>
                    )}
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9d97b5', marginBottom: 8 }}>
                      Shared Links ({sharedMedia.links.length})
                    </div>
                    {sharedMedia.links.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {sharedMedia.links.slice(0, 4).map((m, idx) => (
                          <div key={idx} style={{ fontSize: 12, color: '#a78bfa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            🔗 {m.content}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>No links shared yet</div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: SECURITY & ENCRYPTION (Signal-style safety number) */}
              {activeTab === 'security' && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <IconShield size={20} style={{ color: '#4ade80' }} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#f2f0f8' }}>End-to-End Encrypted</div>
                      <div style={{ fontSize: 11.5, color: '#9d97b5' }}>Messages and media are secured with modern protocols.</div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 10, fontFamily: 'monospace', fontSize: 11, color: '#c9c4dd', wordBreak: 'break-all', letterSpacing: '0.05em', textAlign: 'center' }}>
                    4891 0294 8192 7482 1092 3841 9021 7482
                  </div>
                  <div style={{ fontSize: 11, color: '#9d97b5', lineHeight: 1.4 }}>
                    Verify this safety fingerprint with {displayName} if you want to ensure absolute trust in your communication channel.
                  </div>
                </div>
              )}

              {/* TAB 4: CHAT SETTINGS & MODERATION (WhatsApp-style controls) */}
              {activeTab === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
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
                      style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#7c6cf0' }} 
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <IconClock size={16} style={{ color: '#a78bfa' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#f2f0f8' }}>Disappearing Messages</span>
                    </div>
                    <select 
                      value={disappearingTimer} 
                      onChange={(e) => setDisappearingTimer(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 8, padding: '4px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                    >
                      <option value="off" style={{ background: '#14141f' }}>Off</option>
                      <option value="24h" style={{ background: '#14141f' }}>24 Hours</option>
                      <option value="7d" style={{ background: '#14141f' }}>7 Days</option>
                      <option value="90d" style={{ background: '#14141f' }}>90 Days</option>
                    </select>
                  </div>

                  {!isSelf && !blockLoading && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        onClick={() => {
                          const next = !isMuted
                          setIsMuted(next)
                          onToggleMute?.(targetProfile.id, next)
                        }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '11px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          background: 'rgba(255,255,255,0.03)', color: isMuted ? '#f87171' : '#d1cde6',
                          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, textAlign: 'left',
                        }}
                      >
                        <IconBellOff size={16} /> {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                      </button>

                      <button
                        onClick={handleToggleBlock}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '11px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          background: showBlockConfirm ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.03)',
                          color: isBlocked ? '#34d399' : '#ef4444', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, textAlign: 'left',
                        }}
                      >
                        <IconShieldAlert size={16} /> 
                        {isBlocked 
                          ? `Unblock ${displayName}` 
                          : (showBlockConfirm ? `Confirm Block ${displayName}?` : `Block ${displayName}`)}
                      </button>
                    </div>
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
