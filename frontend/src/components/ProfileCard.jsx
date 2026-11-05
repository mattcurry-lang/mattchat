import React, { useMemo, useState } from 'react'
import Avatar from './Avatar'
import { computeReplyTimeLabel } from '../lib/supabase'
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
  onBlockUser,
  onToggleMute,
  onVoiceCall,
  onVideoCall,
  extras,            
}) {
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

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

  const messageContact = () => {
    onMessageContact?.(targetProfile.username)
    onClose()
  }

  const handleBlockAction = () => {
    if (!showBlockConfirm) {
      setShowBlockConfirm(true)
    } else {
      onBlockUser?.(targetProfile.id)
      onClose()
    }
  }

  if (!targetProfile) return null

  const theme = themeById(extras?.theme)
  const bio = extras?.bio || targetProfile.bio
  const hasStatus = !!(extras?.statusEmoji || extras?.statusText)

  return (
    <div 
      className="profile-drawer-container" 
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 0.2s ease'
      }}
    >
      <div
        className="profile-drawer-panel"
        onClick={e => e.stopPropagation()}
        style={{ 
          width: '100%', maxWidth: 380, height: '100%', 
          background: 'var(--bg-surface-1, #111b21)',
          borderLeft: '1px solid var(--border, rgba(255,255,255,0.08))',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflowY: 'auto'
        }}
      >
        {/* WhatsApp-Style Top Header */}
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: 20, 
          padding: '16px 20px', background: 'var(--bg-surface-2, #202c33)',
          color: 'var(--text-primary, #e9edef)', position: 'sticky', top: 0, zIndex: 10,
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'inherit',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            aria-label="Close"
          >
            <IconX size={20} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Contact info</span>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          
          {/* Hero Section: Avatar & Name Card */}
          <div style={{ 
            background: 'var(--bg-surface-1, #111b21)', padding: '28px 20px 20px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            borderBottom: '8px solid var(--bg-surface-2, #0b141a)'
          }}>
            <div
              style={{
                borderRadius: '50%', padding: 4, background: themeGradient(theme),
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'inline-block', marginBottom: 16
              }}
            >
              <Avatar name={targetProfile.username} photoUrl={targetProfile.avatar_url} size={130} />
            </div>

            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #e9edef)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {targetProfile.username}
              {targetProfile.is_admin && <IconVerified size={18} />}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-muted, #8696a0)', marginTop: 4 }}>
              {targetProfile.email || '@' + targetProfile.username.toLowerCase()}
            </div>

            {/* WhatsApp Action Buttons Toolbar */}
            {!isSelf && (
              <div style={{ 
                display: 'flex', gap: 24, marginTop: 20, justifyContent: 'center',
                padding: '10px 24px', background: 'rgba(255,255,255,0.03)', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <button 
                  onClick={() => onVoiceCall?.()}
                  style={{ background: 'none', border: 'none', color: 'var(--brand, #00a884)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                >
                  <IconPhone size={18} /> Audio
                </button>
                <button 
                  onClick={() => onVideoCall?.()}
                  style={{ background: 'none', border: 'none', color: 'var(--brand, #00a884)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                >
                  <IconVideo size={18} /> Video
                </button>
                <button 
                  onClick={() => {
                    onMessageContact?.(targetProfile.username)
                    onClose()
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--brand, #00a884)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                >
                  <IconSearch size={18} /> Search
                </button>
              </div>
            )}
          </div>

          {/* About / Status Section */}
          <div style={{ padding: '16px 24px', borderBottom: '8px solid var(--bg-surface-2, #0b141a)', background: 'var(--bg-surface-1, #111b21)' }}>
            {hasStatus && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand, #00a884)', marginBottom: 4 }}>Status & Vibe</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary, #e9edef)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{extras.statusEmoji || '💭'}</span>
                  <span>{extras.statusText}</span>
                </div>
              </div>
            )}

            {bio && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #8696a0)', marginBottom: 4 }}>About</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary, #e9edef)', lineHeight: 1.4 }}>{bio}</div>
              </div>
            )}

            {targetProfile.currently_studying && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary, #d1d7db)', marginTop: 8 }}>
                🎓 Studying: <b>{targetProfile.currently_studying}</b>
              </div>
            )}

            {replyLabel && (
              <div style={{ fontSize: 12, color: 'var(--text-muted, #8696a0)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <IconClock size={13} /> {replyLabel}
              </div>
            )}
          </div>

          {/* Shared Interests Section */}
          {shared.length > 0 && (
            <div style={{ padding: '16px 24px', borderBottom: '8px solid var(--bg-surface-2, #0b141a)', background: 'var(--bg-surface-1, #111b21)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #8696a0)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Shared interests ({shared.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {shared.map(interest => (
                  <span
                    key={interest}
                    style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--brand, #00a884)', background: 'rgba(0,168,132,0.1)',
                      border: '1px solid rgba(0,168,132,0.2)', borderRadius: 999, padding: '4px 12px',
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
            <div style={{ padding: '16px 24px', borderBottom: '8px solid var(--bg-surface-2, #0b141a)', background: 'var(--bg-surface-1, #111b21)' }}>
              <button
                style={{ 
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(108,99,255,0.3)'
                }}
                onClick={askCurry}
              >
                <IconSparkle size={16} /> Ask Curry about {targetProfile.username}
              </button>
            </div>
          )}

          {/* Safety & Settings Controls (Mute & Block) */}
          {!isSelf && (
            <div style={{ padding: '8px 0', background: 'var(--bg-surface-1, #111b21)' }}>
              <button
                onClick={() => {
                  setIsMuted(!isMuted)
                  onToggleMute?.(targetProfile.id, !isMuted)
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  background: 'transparent', color: isMuted ? '#f87171' : 'var(--text-primary, #e9edef)',
                  border: 'none', textAlign: 'left', transition: 'background 0.15s',
                }}
              >
                <IconBellOff size={18} /> {isMuted ? 'Unmute notifications' : 'Mute notifications'}
              </button>

              <button
                onClick={handleBlockAction}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  background: showBlockConfirm ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                  color: '#f87171', border: 'none', textAlign: 'left', transition: 'background 0.15s',
                }}
              >
                <IconShieldAlert size={18} /> 
                {showBlockConfirm ? `Confirm block ${targetProfile.username}?` : `Block ${targetProfile.username}`}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
