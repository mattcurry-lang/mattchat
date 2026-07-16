import React, { useMemo } from 'react'
import Avatar from './Avatar'
import { computeReplyTimeLabel } from '../lib/supabase'

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
  targetProfile,      // the person whose card this is
  myProfile,          // signed-in user's own profile (for shared interests)
  messages,           // optional — conversation messages, for reply-time calc
  currentUserId,
  onClose,
  onAskCurry,          // (question: string) => void — opens Curry with a prompt
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

  if (!targetProfile) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={e => e.stopPropagation()}
        style={{ alignItems: 'center', textAlign: 'center', maxWidth: 380 }}
      >
        <button
          onClick={onClose}
          style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: 4 }}
        >
          ✕
        </button>

        <Avatar name={targetProfile.username} photoUrl={targetProfile.avatar_url} size={96} />

        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>
          {targetProfile.username}
        </div>

        {targetProfile.bio && (
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, padding: '0 8px' }}>
            {targetProfile.bio}
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
            ⏱ {replyLabel}
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

        {onAskCurry && (
          <button
            className="btn-primary"
            style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={askCurry}
          >
            ✨ Ask Curry about {targetProfile.username}
          </button>
        )}
      </div>
    </div>
  )
}
