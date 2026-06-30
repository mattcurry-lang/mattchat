import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Quick-pick emojis shown on hover (WhatsApp style)
const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '🙏', '👍']

// Full reaction picker emojis
const ALL_REACTION_EMOJIS = [
  '❤️','😂','😮','😢','🙏','👍','👎','🔥','🎉','😍',
  '😭','😡','🤯','😎','🥳','💯','✅','🫶','💀','🤌',
  '👏','🫡','💪','🤝','😏','🥺','😴','🤔','🫠','⚡',
]

// ── Hook: load & subscribe to reactions for a message ────────
export function useReactions(messageId, currentUserId) {
  const [reactions, setReactions] = useState([]) // [{emoji, count, users, iMine}]

  const load = useCallback(async () => {
    if (!messageId) return
    const { data } = await supabase
      .from('message_reactions')
      .select('emoji, user_id')
      .eq('message_id', messageId)

    if (!data) return

    // Group by emoji
    const grouped = {}
    data.forEach(({ emoji, user_id }) => {
      if (!grouped[emoji]) grouped[emoji] = { emoji, count: 0, users: [], iMine: false }
      grouped[emoji].count++
      grouped[emoji].users.push(user_id)
      if (user_id === currentUserId) grouped[emoji].iMine = true
    })
    setReactions(Object.values(grouped))
  }, [messageId, currentUserId])

  useEffect(() => {
    load()

    const channel = supabase
      .channel(`reactions:${messageId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_reactions',
        filter: `message_id=eq.${messageId}`,
      }, load)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [messageId, load])

  const toggleReaction = useCallback(async (emoji) => {
    const existing = reactions.find(r => r.emoji === emoji && r.iMine)
    if (existing) {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji)
    } else {
      await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: currentUserId, emoji })
    }
    await load()
  }, [messageId, currentUserId, reactions, load])

  return { reactions, toggleReaction }
}

// ── Quick reaction bar (appears on hover) ────────────────────
function QuickReactionBar({ onSelect, onMore, isMe }) {
  return (
    <div style={{
      position: 'absolute',
      [isMe ? 'left' : 'right']: '100%',
      bottom: 0,
      marginLeft: isMe ? 0 : 8,
      marginRight: isMe ? 8 : 0,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: '#2a2a3e',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 24,
      padding: '4px 6px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      zIndex: 50,
      animation: 'reactionBarIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      whiteSpace: 'nowrap',
    }}>
      <style>{`
        @keyframes reactionBarIn {
          from { opacity: 0; transform: scale(0.8) translateY(4px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes reactionPopIn {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
        .quick-emoji-btn:hover {
          transform: scale(1.35) translateY(-3px) !important;
          background: rgba(99,102,241,0.2) !important;
        }
      `}</style>

      {QUICK_EMOJIS.map((emoji, i) => (
        <button
          key={emoji}
          className="quick-emoji-btn"
          onClick={() => onSelect(emoji)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 22, padding: '2px 3px', borderRadius: '50%',
            transition: 'all 0.15s cubic-bezier(0.34,1.56,0.64,1)',
            animationDelay: `${i * 0.03}s`,
            animation: 'reactionBarIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}
          title={emoji}
        >
          {emoji}
        </button>
      ))}

      {/* + button for full picker */}
      <button
        onClick={onMore}
        style={{
          background: 'rgba(255,255,255,0.08)', border: 'none',
          borderRadius: '50%', width: 28, height: 28,
          cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
          fontSize: 14, fontWeight: 700, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.3)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
        title="More reactions"
      >
        +
      </button>
    </div>
  )
}

// ── Full reaction picker (shown when + is clicked) ────────────
function FullReactionPicker({ onSelect, onClose, isMe }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        [isMe ? 'right' : 'left']: 0,
        bottom: 'calc(100% + 8px)',
        background: '#2a2a3e',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16,
        padding: 10,
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 4,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 100,
        animation: 'reactionBarIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        minWidth: 220,
      }}
    >
      {ALL_REACTION_EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 24, padding: '4px', borderRadius: 8,
            transition: 'all 0.12s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; e.currentTarget.style.transform = 'scale(1.25)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.transform = 'none' }}
          title={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

// ── Reaction chips shown below a message ─────────────────────
function ReactionChips({ reactions, onToggle, currentUserId }) {
  if (!reactions || reactions.length === 0) return null

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4,
    }}>
      {reactions.map(({ emoji, count, iMine }) => (
        <button
          key={emoji}
          onClick={() => onToggle(emoji)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: iMine
              ? 'rgba(99,102,241,0.25)'
              : 'rgba(255,255,255,0.08)',
            border: `1px solid ${iMine ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 20, padding: '3px 8px',
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
            animation: 'reactionPopIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08)'
            e.currentTarget.style.background = iMine ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.14)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.background = iMine ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)'
          }}
          title={iMine ? 'Click to remove' : 'Click to react'}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: iMine ? '#a78bfa' : 'rgba(255,255,255,0.6)',
          }}>{count}</span>
        </button>
      ))}
    </div>
  )
}

// ── Main: wrap any message bubble with reaction support ───────
export function ReactableMessage({ messageId, currentUserId, isMe, children }) {
  const [hovered, setHovered]       = useState(false)
  const [showBar, setShowBar]       = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const hoverTimer = useRef(null)
  const wrapRef = useRef(null)

  const { reactions, toggleReaction } = useReactions(messageId, currentUserId)

  const handleMouseEnter = () => {
    clearTimeout(hoverTimer.current)
    setHovered(true)
    hoverTimer.current = setTimeout(() => setShowBar(true), 200)
  }

  const handleMouseLeave = () => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => {
      setHovered(false)
      if (!showPicker) setShowBar(false)
    }, 300)
  }

  const handleReactionSelect = async (emoji) => {
    await toggleReaction(emoji)
    setShowBar(false)
    setShowPicker(false)
  }

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Quick bar on hover */}
      {showBar && !showPicker && (
        <QuickReactionBar
          isMe={isMe}
          onSelect={handleReactionSelect}
          onMore={() => { setShowPicker(true); setShowBar(false) }}
        />
      )}

      {/* Full picker */}
      {showPicker && (
        <FullReactionPicker
          isMe={isMe}
          onSelect={handleReactionSelect}
          onClose={() => { setShowPicker(false) }}
        />
      )}

      {/* Message content */}
      <div style={{ opacity: hovered ? 0.92 : 1, transition: 'opacity 0.1s' }}>
        {children}
      </div>

      {/* Reaction chips */}
      <ReactionChips
        reactions={reactions}
        onToggle={toggleReaction}
        currentUserId={currentUserId}
      />
    </div>
  )
}
