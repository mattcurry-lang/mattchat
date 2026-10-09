import React, { useMemo } from 'react'
import Avatar from './Avatar'
import { computeReplyTimeLabel } from '../lib/supabase'
import { themeById, themeGradient, themeBanner } from '../lib/profileThemes'
import { IconX, IconClock, IconSparkle, IconMessageSquare, IconVerified } from './Icons'

// AVATAR_CATEGORIES lives here too so ProfileCard and setup flows agree
// on the same label/emoji set.
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
  extras,             // optional: usePublicProfiles(...).get(targetProfile.id) — live theme, bio, status, note
}) {
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

  if (!targetProfile) return null

  const theme = themeById(extras?.theme)
  const bio = extras?.bio || targetProfile.bio
  const hasStatus = !!(extras?.statusEmoji || extras?.statusText)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={e => e.stopPropagation()}
        style={{ alignItems: 'center', textAlign: 'center', maxWidth: 380 }}
      >
        {/* themed banner, with the close button on top of it */}
        <div style={{ position: 'relative', width: '100%' }}>
          <div
            style={{
              height: 78, borderRadius: 14,
              backgroundImage: themeBanner(extras?.theme),
              backgroundSize: '14px 14px, auto',
            }}
          />
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.3)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
            }}
            aria-label="Close"
          >
            <IconX size={15} />
          </button>
        </div>

        <div
          style={{
            marginTop: -48, borderRadius: '50%', padding: 3, background: themeGradient(theme),
            boxShadow: '0 0 0 4px var(--bg-surface-1, #14141f)', display: 'inline-block',
          }}
        >
          <Avatar name={targetProfile.username} photoUrl={targetProfile.avatar_url} size={90} />
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {targetProfile.username}
          {targetProfile.is_admin && <IconVerified size={16} />}
        </div>

        {hasStatus && (
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, maxWidth: '100%',
              padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 650,
              color: 'var(--text-primary)', background: 'var(--brand-soft)', border: '1px solid rgba(108,99,255,0.2)',
            }}
          >
            <span>{extras.statusEmoji || '💭'}</span>
            {extras.statusText && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extras.statusText}</span>
            )}
          </div>
        )}

        {extras?.note && (
          <div
            style={{
              marginTop: 8, maxWidth: '100%', padding: '8px 12px', borderRadius: 12, fontSize: 13,
              color: 'var(--text-primary)', background: 'var(--bg-surface-2, rgba(255,255,255,0.05))',
              border: '1px solid var(--border, rgba(255,255,255,0.1))', wordBreak: 'break-word',
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>Note</div>
            {extras.note}
          </div>
        )}

        {bio && (
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, padding: '0 8px', marginTop: 8 }}>
            {bio}
          </div>
        )}

        {targetProfile.organization && (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>
            {targetProfile.organization}
          </div>
        )}

        {targetProfile.currently_studying && (
          <div style={{
            marginTop: 6, background: 'var(--brand-soft)', border: '1px solid rgba(108,99,255,0.2)',
            borderRadius: 10, padding: '8px 12px', width: '100%', textAlign: 'left',
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Currently studying
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginTop: 2 }}>
              {targetProfile.currently_studying}
            </div>
          </div>
        )}

        {replyLabel && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <IconClock size={12} /> {replyLabel}
          </div>
        )}

        {shared.length > 0 && (
          <div style={{ width: '100%', marginTop: 8, textAlign: 'left' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Shared interests
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {shared.map(interest => (
                <span
                  key={interest}
                  style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-soft)',
                    border: '1px solid rgba(108,99,255,0.2)', borderRadius: 'var(--r-full)', padding: '4px 10px',
                  }}
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {!isSelf && onMessageContact && (
          <button
            className="btn-primary"
            style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={messageContact}
          >
            <IconMessageSquare size={14} /> Message {targetProfile.username}
          </button>
        )}
        {onAskCurry && (
          <button
            className="btn-primary"
            style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={askCurry}
          >
            <IconSparkle size={14} /> Ask Curry about {targetProfile.username}
          </button>
        )}
      </div>
    </div>
  )
}
