import React, { useMemo, useState, useEffect } from 'react'
import Avatar from './Avatar'
import { computeReplyTimeLabel, supabase } from '../lib/supabase'
import { themeById, themeGradient, themeBanner } from '../lib/profileThemes'
import { 
  IconX, IconClock, IconSparkle, IconMessageSquare, 
  IconVerified, IconShieldAlert, IconBellOff, IconSearch, IconPhone, IconVideo 
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

function intersectInterests(mine, theirs) {
  const mineSet = new Set((mine || []).map(s => s.toLowerCase().trim()))
  return (theirs || []).filter(i => mineSet.has(i.toLowerCase().trim()))
}

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
  onOpenSearch,     // Triggers chat message search view
  extras,            
}) {
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockLoading, setBlockLoading] = useState(true)

  // Fetch true block status from Supabase when card opens
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

  const shared = useMemo(
    () => intersectInterests(myProfile?.interests, targetProfile?.interests),
    [myProfile, targetProfile]
  )

  const askCurry = () => {
    const name = targetProfile?.username || 'this person'
    onAskCurry(`Tell me about my conversations with ${name} — anything I should know or follow up on?`)
    onClose()
  }

  const isSelf = targetProfile?.id === currentUserId

  const handleToggleBlock = async () => {
    if (isBlocked) {
      // Unblock user in database
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', targetProfile.id)
      if (!error) {
        setIsBlocked(false)
        setShowBlockConfirm(false)
      } else {
        alert('Could not unblock user. Please try again.')
      }
    } else {
      if (!showBlockConfirm) {
        setShowBlockConfirm(true)
        return
      }
      // Block user in database
      const { error } = await supabase
        .from('blocked_users')
        .insert({ blocker_id: currentUserId, blocked_id: targetProfile.id })
      if (!error) {
        setIsBlocked(true)
        setShowBlockConfirm(false)
      } else {
        alert('Could not block user. Please try again.')
      }
    }
  }

  if (!targetProfile) return null

  const theme = themeById(extras?.theme)
  const bio = extras?.bio || targetProfile.bio
  const hasStatus = !!(extras?.statusEmoji || extras?.statusText)
  const displayName = targetProfile.username || 'User'

  return (
    <div 
      className="profile-drawer-container" 
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)',
        display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.2s ease'
      }}
    >
      <div
        className="profile-drawer-panel"
        onClick={e => e.stopPropagation()}
        style={{ 
          width: '100%', maxWidth: 400, height: '100%', 
          background: '#111b21', color: '#e9edef',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.6)',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* WhatsApp-Style Dark Header */}
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: 18, 
          padding: '16px 20px', background: '#202c33',
          color: '#e9edef', position: 'sticky', top: 0, zIndex: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#aebac1',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            aria-label="Close"
          >
            <IconX size={20} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#e9edef' }}>Contact info</span>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          
          {/* Hero Section: Avatar & Name Card */}
          <div style={{ 
            background: '#111b21', padding: '32px 20px 24px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            borderBottom: '10px solid #0b141a'
          }}>
            <div
              style={{
                borderRadius: '50%', padding: 4, background: themeGradient(theme),
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'inline-block', marginBottom: 16
              }}
            >
              <Avatar name={displayName} photoUrl={targetProfile.avatar_url} size={130} />
            </div>

            <div style={{ fontSize: 22, fontWeight: 700, color: '#e9edef', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {displayName}
              {targetProfile.is_admin && <IconVerified size={18} />}
            </div>
            <div style={{ fontSize: 13.5, color: '#8696a0', marginTop: 4 }}>
              {targetProfile.email || '@' + displayName.toLowerCase()}
            </div>

            {/* Functional Call & Search Toolbar */}
            {!isSelf && (
              <div style={{ 
                display: 'flex', gap: 28, marginTop: 22, justifyContent: 'center',
                padding: '12px 28px', background: '#202c33', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <button 
                  onClick={() => { onVoiceCall?.(); onClose(); }}
                  style={{ background: 'none', border: 'none', color: '#00a884', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  <IconPhone size={19} /> Audio
                </button>
                <button 
                  onClick={() => { onVideoCall?.(); onClose(); }}
                  style={{ background: 'none', border: 'none', color: '#00a884', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  <IconVideo size={19} /> Video
                </button>
                <button 
                  onClick={() => {
                    onOpenSearch?.()
                    onClose()
                  }}
                  style={{ background: 'none', border: 'none', color: '#00a884', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  <IconSearch size={19} /> Search
                </button>
              </div>
            )}
          </div>

          {/* About / Status Section */}
          <div style={{ padding: '16px 24px', borderBottom: '10px solid #0b141a', background: '#111b21' }}>
            {hasStatus && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#00a884', marginBottom: 4 }}>Status & Vibe</div>
                <div style={{ fontSize: 14, color: '#e9edef', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{extras.statusEmoji || '💭'}</span>
                  <span>{extras.statusText}</span>
                </div>
              </div>
            )}

            {bio && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#8696a0', marginBottom: 4 }}>About</div>
                <div style={{ fontSize: 14, color: '#e9edef', lineHeight: 1.5 }}>{bio}</div>
              </div>
            )}

            {targetProfile.currently_studying && (
              <div style={{ fontSize: 13.5, color: '#d1d7db', marginTop: 8 }}>
                🎓 Studying: <b style={{ color: '#e9edef' }}>{targetProfile.currently_studying}</b>
              </div>
            )}

            {replyLabel && (
              <div style={{ fontSize: 12.5, color: '#8696a0', display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <IconClock size={14} /> {replyLabel}
              </div>
            )}
          </div>

          {/* Shared Interests Section */}
          {shared.length > 0 && (
            <div style={{ padding: '16px 24px', borderBottom: '10px solid #0b141a', background: '#111b21' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8696a0', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Shared interests ({shared.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {shared.map(interest => (
                  <span
                    key={interest}
                    style={{
                      fontSize: 12, fontWeight: 600, color: '#00a884', background: 'rgba(0,168,132,0.12)',
                      border: '1px solid rgba(0,168,132,0.25)', borderRadius: 999, padding: '5px 12px',
                    }}
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Integration Section (Ask Curry) */}
          {onAskCurry && (
            <div style={{ padding: '16px 24px', borderBottom: '10px solid #0b141a', background: '#111b21' }}>
              <button
                style={{ 
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 18px', borderRadius: 14,
                  background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(108,99,255,0.35)'
                }}
                onClick={askCurry}
              >
                <IconSparkle size={17} /> Ask Curry about {displayName}
              </button>
            </div>
          )}

          {/* Safety & Settings Controls (Mute & Block/Unblock) */}
          {!isSelf && !blockLoading && (
            <div style={{ padding: '8px 0', background: '#111b21' }}>
              <button
                onClick={() => {
                  setIsMuted(!isMuted)
                  onToggleMute?.(targetProfile.id, !isMuted)
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  background: 'transparent', color: isMuted ? '#f87171' : '#e9edef',
                  border: 'none', textAlign: 'left', transition: 'background 0.15s',
                }}
              >
                <IconBellOff size={18} /> {isMuted ? 'Unmute notifications' : 'Mute notifications'}
              </button>

              <button
                onClick={handleToggleBlock}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  background: showBlockConfirm ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                  color: isBlocked ? '#34d399' : '#f87171', border: 'none', textAlign: 'left', transition: 'background 0.15s',
                }}
              >
                <IconShieldAlert size={18} /> 
                {isBlocked 
                  ? `Unblock ${displayName}` 
                  : (showBlockConfirm ? `Confirm block ${displayName}?` : `Block ${displayName}`)}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
