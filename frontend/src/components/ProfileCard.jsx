import React, { useMemo, useState, useEffect } from 'react'
import Avatar from './Avatar'
import { computeReplyTimeLabel, supabase } from '../lib/supabase'
import { themeById, themeGradient, themeBanner } from '../lib/profileThemes'
import { 
  IconX, IconClock, IconSparkle, IconMessageSquare, 
  IconVerified, IconShieldAlert, IconBellOff, IconSearch, IconPhone, IconVideo 
} from './Icons'

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
  extras,            
}) {
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockLoading, setBlockLoading] = useState(true)

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

        {/* Search Results Mode */}
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
          /* Normal Profile View Mode */
          <div style={{ flex: 1, overflowY: 'auto' }}>
            
            {/* Hero Section */}
            <div style={{ 
              padding: '28px 20px 20px 20px', display: 'flex', flexDirection: 'column', 
              alignItems: 'center', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div style={{
                borderRadius: '50%', padding: 4, background: themeGradient(theme),
                boxShadow: '0 8px 32px rgba(108, 99, 255, 0.3)', display: 'inline-block', marginBottom: 14
              }}>
                <Avatar name={displayName} photoUrl={targetProfile.avatar_url} size={110} />
              </div>

              <div style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                {displayName}
                {targetProfile.is_admin && <IconVerified size={18} />}
              </div>
              <div style={{ fontSize: 13, color: '#8b8b9e', marginTop: 4 }}>
                {targetProfile.email || '@' + displayName.toLowerCase()}
              </div>

              {/* Action Toolbar */}
              {!isSelf && (
                <div style={{ 
                  display: 'flex', gap: 16, marginTop: 20, width: '100%', justifyContent: 'center'
                }}>
                  <button 
                    onClick={() => { onVoiceCall?.(); onClose(); }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(108,99,255,0.12)',
                      border: '1px solid rgba(108,99,255,0.25)', color: '#a78bfa', fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer'
                    }}
                  >
                    <IconPhone size={16} /> Audio
                  </button>
                  <button 
                    onClick={() => { onVideoCall?.(); onClose(); }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(108,99,255,0.12)',
                      border: '1px solid rgba(108,99,255,0.25)', color: '#a78bfa', fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer'
                    }}
                  >
                    <IconVideo size={16} /> Video
                  </button>
                  <button 
                    onClick={() => setIsSearching(true)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 12, background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)', color: '#f2f0f8', fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer'
                    }}
                  >
                    <IconSearch size={16} /> Search
                  </button>
                </div>
              )}
            </div>

            {/* Status / Bio */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {hasStatus && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Status</div>
                  <div style={{ fontSize: 14, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{extras.statusEmoji || '💭'}</span>
                    <span>{extras.statusText}</span>
                  </div>
                </div>
              )}

              {bio && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8b8b9e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>About</div>
                  <div style={{ fontSize: 13.5, color: '#d1cde6', lineHeight: 1.5 }}>{bio}</div>
                </div>
              )}

              {replyLabel && (
                <div style={{ fontSize: 12, color: '#8b8b9e', display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <IconClock size={13} /> {replyLabel}
                </div>
              )}
            </div>

            {/* Shared Interests */}
            {shared.length > 0 && (
              <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8b8b9e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Shared Interests ({shared.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {shared.map(interest => (
                    <span
                      key={interest}
                      style={{
                        fontSize: 12, fontWeight: 600, color: '#a78bfa', background: 'rgba(108,99,255,0.15)',
                        border: '1px solid rgba(108,99,255,0.3)', borderRadius: 999, padding: '4px 12px',
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
              <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  style={{ 
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 12,
                    background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(108,99,255,0.35)'
                  }}
                  onClick={() => {
                    onAskCurry(`Tell me about my conversations with ${displayName}`)
                    onClose()
                  }}
                >
                  <IconSparkle size={16} /> Ask Curry about {displayName}
                </button>
              </div>
            )}

            {/* Danger / Moderation Zone */}
            {!isSelf && !blockLoading && (
              <div style={{ padding: '12px 10px' }}>
                <button
                  onClick={() => {
                    setIsMuted(!isMuted)
                    onToggleMute?.(targetProfile.id, !isMuted)
                  }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                    background: 'transparent', color: isMuted ? '#f87171' : '#d1cde6',
                    border: 'none', borderRadius: 10, textAlign: 'left',
                  }}
                >
                  <IconBellOff size={16} /> {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                </button>

                <button
                  onClick={handleToggleBlock}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                    background: showBlockConfirm ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                    color: isBlocked ? '#34d399' : '#ef4444', border: 'none', borderRadius: 10, textAlign: 'left',
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
  )
}
