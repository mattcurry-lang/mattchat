import React, { useMemo, useState } from 'react'
import Avatar from './Avatar'
import { computeReplyTimeLabel } from '../lib/supabase'
import { themeById, themeGradient, themeBanner } from '../lib/profileThemes'
import { 
  IconX, IconClock, IconSparkle, IconMessageSquare, 
  IconVerified, IconShieldAlert, IconBellOff, IconSearch, IconFilm, IconFolder 
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
  onBlockUser,       // Supabase block handler
  onToggleMute,      // Mute notification handler
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
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(8px)', background: 'rgba(0, 0, 0, 0.7)' }}>
      <div
        className="modal-panel"
        onClick={e => e.stopPropagation()}
        style={{ 
          alignItems: 'stretch', 
          textAlign: 'left', 
          maxWidth: 420, 
          width: '94%',
          maxHeight: '90vh', 
          overflowY: 'auto',
          borderRadius: 16,
          background: 'var(--bg-surface-1, #14141f)',
          border: '1px solid var(--border, rgba(255,255,255,0.12))',
          padding: 0,
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)'
        }}
      >
        {/* WhatsApp-Style Header Bar */}
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          padding: '14px 18px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
          background: 'var(--bg-surface-2, rgba(255,255,255,0.03))', position: 'sticky', top: 0, zIndex: 10
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Contact info</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            aria-label="Close"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Hero Section: Banner & Avatar */}
        <div style={{ position: 'relative', width: '100%' }}>
          <div
            style={{
              height: 100, 
              backgroundImage: themeBanner(extras?.theme),
              backgroundSize: '14px 14px, auto',
            }}
          />
          <div style={{ paddingLeft: 24, marginTop: -42, display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div
              style={{
                borderRadius: '50%', padding: 3, background: themeGradient(theme),
                boxShadow: '0 8px 20px rgba(0,0,0,0.5), 0 0 0 4px var(--bg-surface-1, #14141f)', display: 'inline-block',
              }}
            >
              <Avatar name={targetProfile.username} photoUrl={targetProfile.avatar_url} size={88} />
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Name & Verification */}
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {targetProfile.username}
              {targetProfile.is_admin && <IconVerified size={18} />}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {targetProfile.email || 'Mattchat Community Member'}
            </div>
          </div>

          {/* WhatsApp-Style Action Strip (Icon Buttons Row) */}
          {!isSelf && (
            <div style={{ 
              display: 'flex', justifyContent: 'space-around', alignItems: 'center', 
              padding: '12px 8px', background: 'var(--bg-surface-2, rgba(255,255,255,0.04))', 
              borderRadius: 14, border: '1px solid var(--border, rgba(255,255,255,0.06))' 
            }}>
              <button 
                onClick={messageContact}
                style={{ background: 'none', border: 'none', color: 'var(--brand)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconMessageSquare size={16} />
                </div>
                Message
              </button>

              <button 
                onClick={() => {
                  setIsMuted(!isMuted)
                  onToggleMute?.(targetProfile.id, !isMuted)
                }}
                style={{ background: 'none', border: 'none', color: isMuted ? '#ef4444' : 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-surface-3, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconBellOff size={16} />
                </div>
                {isMuted ? 'Muted' : 'Mute'}
              </button>

              <button 
                onClick={() => {
                  onMessageContact?.(targetProfile.username)
                  onClose()
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-surface-3, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconSearch size={16} />
                </div>
                Search
              </button>
            </div>
          )}

          {/* Status / About Section */}
          {hasStatus && (
            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--brand-soft)', border: '1px solid rgba(108,99,255,0.2)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Status</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{extras.statusEmoji || '💭'}</span>
                <span>{extras.statusText}</span>
              </div>
            </div>
          )}

          {/* Personal Note / Bio */}
          {(extras?.note || bio) && (
            <div style={{ padding: '10px 14px', borderRadius: 12, background: 'var(--bg-surface-2, rgba(255,255,255,0.04))', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>About & Bio</div>
              {extras?.note && <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{extras.note}</div>}
              {bio && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{bio}</div>}
            </div>
          )}

          {/* Organization & Studies */}
          {(targetProfile.organization || targetProfile.currently_studying) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {targetProfile.organization && (
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                  🏢 {targetProfile.organization}
                </div>
              )}
              {targetProfile.currently_studying && (
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                  🎓 Studying: {targetProfile.currently_studying}
                </div>
              )}
            </div>
          )}

          {/* Shared Interests & Reply Time */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {replyLabel && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconClock size={13} /> {replyLabel}
              </div>
            )}

            {shared.length > 0 && (
              <div>
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

          {/* Ask Curry AI Button */}
          {onAskCurry && (
            <button
              style={{ 
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 12,
                background: 'linear-gradient(135deg, #6c63ff 0%, #a855f7 100%)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(108,99,255,0.3)'
              }}
              onClick={askCurry}
            >
              <IconSparkle size={16} /> Ask Curry about {targetProfile.username}
            </button>
          )}

          {/* WhatsApp-Style Danger / Safety Zone (Block & Report) */}
          {!isSelf && (
            <div style={{ marginTop: 8, borderTop: '1px solid var(--border, rgba(255,255,255,0.08))', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={handleBlockAction}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 650, cursor: 'pointer',
                  background: showBlockConfirm ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                  color: '#ef4444', border: 'none', textAlign: 'left', transition: 'background 0.2s',
                }}
              >
                <IconShieldAlert size={16} /> 
                {showBlockConfirm ? `Confirm block ${targetProfile.username}?` : `Block ${targetProfile.username}`}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
