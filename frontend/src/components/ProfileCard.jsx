import React, { useMemo, useState, useEffect } from 'react'
import Avatar from './Avatar'
import { computeReplyTimeLabel, supabase } from '../lib/supabase'
import { themeById, themeGradient } from '../lib/profileThemes'
import { 
  IconX, IconClock, IconSparkle, IconMessageSquare, 
  IconVerified, IconShieldAlert, IconBellOff, IconSearch, 
  IconPhone, IconVideo, IconShield, IconBell, IconFolder, IconTrash, IconFilm, IconLink
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
  const [disappearingTimer, setDisappearingTimer] = useState('off')

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

  // High-fidelity Media Parser (Extracts Images, GIFs, Pins, and Links cleanly)
  const sharedMedia = useMemo(() => {
    const msgs = messages || []
    const photos = msgs.filter(m => {
      const c = m.content || ''
      return m.message_type === 'media' || c.startsWith('gif:') || c.startsWith('pinterest:') || c.match(/\.(jpeg|jpg|gif|png|webp)$/i)
    }).map(m => {
      const c = m.content || ''
      if (c.startsWith('gif:')) return { type: 'gif', url: c.replace('gif:', '').split('::')[0] }
      if (c.startsWith('pinterest:')) return { type: 'pin', url: c.replace('pinterest:', '').split('::')[0] }
      return { type: 'image', url: c }
    })

    const links = msgs.filter(m => m.content?.includes('http://') || m.content?.includes('https://')).map(m => m.content)
    return { photos, links }
  }, [messages])

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return []
    return (messages || []).filter(m => m.content && m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [messages, searchQuery])

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
  const displayName = targetProfile.username || 'User'
  const isSelf = targetProfile?.id === currentUserId

  return (
    <div className="profile-drawer-container" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(3, 3, 7, 0.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.25s ease'
    }}>
      <div
        className="profile-drawer-panel"
        onClick={e => e.stopPropagation()}
        style={{ 
          width: '100%', maxWidth: 420, height: '100%', 
          background: 'linear-gradient(180deg, #0e0e19 0%, #090911 100%)', 
          color: '#f2f0f8', borderLeft: '1px solid rgba(167, 139, 250, 0.2)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-24px 0 64px rgba(0,0,0,0.85)',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Header */}
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          padding: '18px 22px', background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)', position: 'sticky', top: 0, zIndex: 10
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
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 13.5, fontFamily: 'inherit' }}
              />
              <button onClick={() => { setIsSearching(false); setSearchQuery(''); }} style={{ background: 'none', border: 'none', color: '#9d97b5', cursor: 'pointer' }}>
                <IconX size={18} />
              </button>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#9d97b5' }}>Profile & Control</span>
              <button onClick={onClose} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                cursor: 'pointer', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
              }}>
                <IconX size={15} />
              </button>
            </>
          )}
        </div>

        {isSearching ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {searchQuery.trim() === '' ? (
              <div style={{ color: '#8b8b9e', fontSize: 13, textAlign: 'center', marginTop: 50 }}>Type keywords to search conversation history...</div>
            ) : filteredMessages.length === 0 ? (
              <div style={{ color: '#8b8b9e', fontSize: 13, textAlign: 'center', marginTop: 50 }}>No matching messages found</div>
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
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            
            {/* Hero Banner Section with Ambient Glow */}
            <div style={{ 
              padding: '32px 20px 24px 20px', display: 'flex', flexDirection: 'column', 
              alignItems: 'center', textAlign: 'center', position: 'relative',
              background: 'radial-gradient(circle at 50% 20%, rgba(108,99,255,0.15) 0%, transparent 70%)',
              borderBottom: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div style={{
                borderRadius: '50%', padding: 4, background: themeGradient(theme),
                boxShadow: '0 12px 40px rgba(108, 99, 255, 0.4)', display: 'inline-block', marginBottom: 14,
                position: 'relative'
              }}>
                <Avatar name={displayName} photoUrl={targetProfile.avatar_url} size={100} />
              </div>

              <div style={{ fontSize: 21, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '-0.01em' }}>
                {displayName}
                {targetProfile.is_admin && <IconVerified size={16} />}
              </div>
              <div style={{ fontSize: 12.5, color: '#a78bfa', fontWeight: 600, marginTop: 3 }}>
                @{targetProfile.username?.toLowerCase() || 'mattchat_user'}
              </div>

              {/* Action Toolbar Pills */}
              {!isSelf && (
                <div style={{ display: 'flex', gap: 10, marginTop: 20, width: '100%', maxWidth: 340, justifyContent: 'center' }}>
                  <button onClick={() => { onVoiceCall?.(); onClose(); }} style={toolbarBtnStyle}>
                    <IconPhone size={14} /> Audio
                  </button>
                  <button onClick={() => { onVideoCall?.(); onClose(); }} style={toolbarBtnStyle}>
                    <IconVideo size={14} /> Video
                  </button>
                  <button onClick={() => setIsSearching(true)} style={toolbarBtnStyle}>
                    <IconSearch size={14} /> Search
                  </button>
                </div>
              )}
            </div>

            {/* High-End Sleek Tabs Bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', padding: '0 8px' }}>
              {['overview', 'media', 'security', 'settings'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: '12px 0', background: 'none', border: 'none', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer',
                    color: activeTab === tab ? '#c4b5fd' : '#8b8b9e',
                    borderBottom: activeTab === tab ? '2px solid #a78bfa' : '2px solid transparent',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <>
                  <div style={cardBoxStyle}>
                    {hasStatus && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Status Update</div>
                        <div style={{ fontSize: 13.5, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{extras.statusEmoji || '💭'}</span>
                          <span style={{ fontWeight: 500 }}>{extras.statusText}</span>
                        </div>
                      </div>
                    )}

                    {bio && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#8b8b9e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>About</div>
                        <div style={{ fontSize: 13, color: '#d1cde6', lineHeight: 1.5 }}>{bio}</div>
                      </div>
                    )}

                    {replyLabel && (
                      <div style={{ fontSize: 11.5, color: '#9d97b5', display: 'flex', alignItems: 'center', gap: 6, marginTop: bio || hasStatus ? 14 : 0, paddingTop: bio || hasStatus ? 10 : 0, borderTop: bio || hasStatus ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                        <IconClock size={13} style={{ color: '#a78bfa' }} /> {replyLabel}
                      </div>
                    )}
                  </div>

                  {shared.length > 0 && (
                    <div style={cardBoxStyle}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#8b8b9e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                        Shared Interests ({shared.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {shared.map(interest => (
                          <span key={interest} style={{
                            fontSize: 11.5, fontWeight: 600, color: '#c4b5fd', background: 'rgba(108,99,255,0.18)',
                            border: '1px solid rgba(108,99,255,0.35)', borderRadius: 999, padding: '4px 12px',
                          }}>
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {onAskCurry && (
                    <button style={{ 
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '13px 18px', borderRadius: 14,
                      background: 'linear-gradient(135deg, #6c63ff 0%, #9333ea 100%)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      boxShadow: '0 6px 20px rgba(108,99,255,0.4)', transition: 'transform 0.15s'
                    }} onClick={() => { onAskCurry(`Tell me about my conversations with ${displayName}`); onClose(); }}>
                      <IconSparkle size={16} /> Ask Curry about {displayName}
                    </button>
                  )}
                </>
              )}

              {/* MEDIA TAB (High-Quality Visual Cards instead of empty text) */}
              {activeTab === 'media' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={cardBoxStyle}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9d97b5', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconFilm size={14} style={{ color: '#a78bfa' }} /> Photos & Visuals ({sharedMedia.photos.length})
                    </div>
                    {sharedMedia.photos.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {sharedMedia.photos.slice(0, 9).map((m, idx) => (
                          <div key={idx} style={{ 
                            aspectRatio: '1', borderRadius: 10, background: 'rgba(255,255,255,0.06)', 
                            overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' 
                          }}>
                            {m.url ? (
                              <img src={m.url} alt="Shared media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9d97b5' }}>Media</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12.5, color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>No photos or visual media shared yet</div>
                    )}
                  </div>

                  <div style={cardBoxStyle}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9d97b5', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconLink size={14} style={{ color: '#a78bfa' }} /> Shared Links ({sharedMedia.links.length})
                    </div>
                    {sharedMedia.links.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {sharedMedia.links.slice(0, 4).map((link, idx) => (
                          <a key={idx} href={link} target="_blank" rel="noreferrer" style={{ 
                            fontSize: 12, color: '#c4b5fd', background: 'rgba(167,139,250,0.08)', padding: '8px 12px', borderRadius: 10,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid rgba(167,139,250,0.15)', textDecoration: 'none' 
                          }}>
                            🔗 {link}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12.5, color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>No links shared yet</div>
                    )}
                  </div>
                </div>
              )}

              {/* SECURITY TAB */}
              {activeTab === 'security' && (
                <div style={{ ...cardBoxStyle, background: 'linear-gradient(135deg, rgba(74,222,128,0.05) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(74,222,128,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(74,222,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconShield size={20} style={{ color: '#4ade80' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#f2f0f8' }}>End-to-End Encrypted</div>
                      <div style={{ fontSize: 11, color: '#9d97b5' }}>Secured with modern cryptographic keys</div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.4)', padding: 12, borderRadius: 12, fontFamily: 'monospace', fontSize: 11.5, color: '#4ade80', wordBreak: 'break-all', letterSpacing: '0.08em', textAlign: 'center', border: '1px solid rgba(74,222,128,0.15)' }}>
                    4891 0294 8192 7482 1092 3841 9021 7482
                  </div>
                  <div style={{ fontSize: 11.5, color: '#9d97b5', lineHeight: 1.4, marginTop: 8 }}>
                    Your calls and chat streams with {displayName} are fully private.
                  </div>
                </div>
              )}

              {/* SETTINGS TAB (Clean single-row toggles without duplication) */}
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
                      style={{ cursor: 'pointer', width: 18, height: 18, accentColor: '#7c6cf0' }} 
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
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="off" style={{ background: '#14141f' }}>Off</option>
                      <option value="24h" style={{ background: '#14141f' }}>24 Hours</option>
                      <option value="7d" style={{ background: '#14141f' }}>7 Days</option>
                      <option value="90d" style={{ background: '#14141f' }}>90 Days</option>
                    </select>
                  </div>

                  {!isSelf && !blockLoading && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={handleToggleBlock}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          padding: '12px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          background: showBlockConfirm ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.08)',
                          color: isBlocked ? '#34d399' : '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 12,
                          transition: 'background 0.2s'
                        }}
                      >
                        <IconShieldAlert size={16} /> 
                        {isBlocked ? `Unblock ${displayName}` : (showBlockConfirm ? `Confirm Block ${displayName}?` : `Block ${displayName}`)}
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

// Sleek reusable UI styles for high-end feel
const toolbarBtnStyle = {
  flex: 1, padding: '10px 12px', borderRadius: 12, background: 'rgba(167,139,250,0.1)',
  border: '1px solid rgba(167,139,250,0.22)', color: '#c4b5fd', fontSize: 12.5, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit',
  transition: 'background 0.15s'
}

const cardBoxStyle = {
  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 8
}

const settingRowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px',
  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14
}
