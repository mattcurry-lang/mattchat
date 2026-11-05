import React, { useMemo, useState } from 'react'
import Avatar from './Avatar'
import { computeReplyTimeLabel } from '../lib/supabase'
import { themeById, themeGradient, themeBanner } from '../lib/profileThemes'
import { 
  IconX, IconClock, IconSparkle, IconMessageSquare, 
  IconVerified, IconShieldAlert, IconBellOff, IconSearch 
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
  onBlockUser,       // New handler for blocking
  onToggleMute,      // New handler for muting notifications
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
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(8px)', background: 'rgba(0, 0, 0, 0.65)' }}>
      <div
        className="modal-panel"
        onClick={e => e.stopPropagation()}
        style={{ 
          alignItems: 'center', 
          textAlign: 'center', 
          maxWidth: 410, 
          width: '92%',
          maxHeight: '88vh', 
          overflowY: 'auto',
          borderRadius: 20,
          background: 'var(--bg-surface-1, #14141f)',
          border: '1px solid var(--border, rgba(255,255,255,0.12))',
          paddingBottom: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}
      >
        {/* Themed Banner Header */}
        <div style={{ position: 'relative', width: '100%' }}>
          <div
            style={{
              height: 90, 
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              backgroundImage: themeBanner(extras?.theme),
              backgroundSize: '14px 14px, auto',
            }}
          />
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.4)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
              transition: 'background 0.2s',
            }}
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Avatar Ring */}
        <div
          style={{
            marginTop: -52, borderRadius: '50%', padding: 3.5, background: themeGradient(theme),
            boxShadow: '0 8px 20px rgba(0,0,0,0.4), 0 0 0 4px var(--bg-surface-1, #14141f)', display: 'inline-block',
          }}
        >
          <Avatar name={targetProfile.username} photoUrl={targetProfile.avatar_url} size={96} />
        </div>

        {/* Username & Verification */}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {targetProfile.username}
          {targetProfile.is_admin && <IconVerified size={18} />}
        </div>

        {/* Status Bubble */}
        {hasStatus && (
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, maxWidth: '90%',
              padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 650,
              color: 'var(--text-primary)', background: 'var(--brand-soft)', border: '1px solid rgba(108,99,255,0.25)',
            }}
          >
            <span>{extras.statusEmoji || '💭'}</span>
            {extras.statusText && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extras.statusText}</span>
            )}
          </div>
        )}

        {/* Personal Note */}
        {extras?.note && (
          <div
            style={{
              marginTop: 10, width: '90%', padding: '10px 14px', borderRadius: 12, fontSize: 13, textAlign: 'left',
              color: 'var(--text-primary)', background: 'var(--bg-surface-2, rgba(255,255,255,0.04))',
              border: '1px solid var(--border, rgba(255,255,255,0.08))', wordBreak: 'break-word',
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Personal Note</div>
            {extras.note}
          </div>
        )}

        {/* Bio */}
        {bio && (
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, padding: '0 16px', marginTop: 10 }}>
            {bio}
          </div>
        )}

        {/* Organization & Studies Meta */}
        {(targetProfile.organization || targetProfile.currently_studying) && (
          <div style={{ width: '90%', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {targetProfile.organization && (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                🏢 {targetProfile.organization}
              </div>
            )}
            {targetProfile.currently_studying && (
              <div style={{
                background: 'var(--brand-soft)', border: '1px solid rgba(108,99,255,0.2)',
                borderRadius: 12, padding: '10px 14px', textAlign: 'left',
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Currently studying
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginTop: 2 }}>
                  {targetProfile.currently_studying}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reply Time & Shared Interests */}
        <div style={{ width: '90%', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {replyLabel && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <IconClock size={13} /> {replyLabel}
            </div>
          )}

          {shared.length > 0 && (
            <div style={{ textAlign: 'left', marginTop: 4 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Shared interests ({shared.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {shared.map(interest => (
                  <span
                    key={interest}
                    style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-soft)',
                      border: '1px solid rgba(108,99,255,0.25)', borderRadius: 'var(--r-full)', padding: '4px 10px',
                    }}
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hybrid Quick-Action Toolbar (Mute / Notifications shortcut) */}
        {!isSelf && (
          <div style={{ width: '90%', marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              onClick={() => {
                setIsMuted(!isMuted)
                onToggleMute?.(targetProfile.id, !isMuted)
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 12px', borderRadius: 12, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
                background: isMuted ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface-2, rgba(255,255,255,0.06))',
                color: isMuted ? '#ef4444' : 'var(--text-primary)',
                border: isMuted ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border, rgba(255,255,255,0.1))',
              }}
            >
              <IconBellOff size={14} /> {isMuted ? 'Muted' : 'Mute Notifications'}
            </button>
            <button
              onClick={() => {
                onMessageContact?.(targetProfile.username)
                onClose()
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 12px', borderRadius: 12, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
                background: 'var(--bg-surface-2, rgba(255,255,255,0.06))',
                color: 'var(--text-primary)', border: '1px solid var(--border, rgba(255,255,255,0.1))',
              }}
            >
              <IconSearch size={14} /> Search Chat
            </button>
          </div>
        )}

        {/* Primary Actions (Message & Ask Curry) */}
        <div style={{ width: '90%', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!isSelf && onMessageContact && (
            <button
              className="btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 12 }}
              onClick={messageContact}
            >
              <IconMessageSquare size={16} /> Message {targetProfile.username}
            </button>
          )}
          {onAskCurry && (
            <button
              className="btn-primary"
              style={{ 
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 12,
                background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)',
              }}
              onClick={askCurry}
            >
              <IconSparkle size={16} /> Ask Curry about {targetProfile.username}
            </button>
          )}

          {/* Safety / Danger Zone (Block User) */}
          {!isSelf && (
            <div style={{ marginTop: 6, borderTop: '1px solid var(--border, rgba(255,255,255,0.08))', paddingTop: 10, width: '100%' }}>
              <button
                onClick={handleBlockAction}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 12px', borderRadius: 12, fontSize: 12.5, fontWeight: 650, cursor: 'pointer',
                  background: showBlockConfirm ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                  color: '#ef4444',
                  border: showBlockConfirm ? '1px solid #ef4444' : '1px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                <IconShieldAlert size={14} /> 
                {showBlockConfirm ? `Confirm Block ${targetProfile.username}?` : `Block ${targetProfile.username}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
