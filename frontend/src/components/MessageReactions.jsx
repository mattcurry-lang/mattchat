import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '🙏', '👍']

const ALL_REACTION_EMOJIS = [
  '❤️','😂','😮','😢','🙏','👍','👎','🔥','🎉','😍',
  '😭','😡','🤯','😎','🥳','💯','✅','🫶','💀','🤌',
  '👏','🫡','💪','🤝','😏','🥺','😴','🤔','🫠','⚡',
]

// FIX (this pass): the previous version already fixed the worse bug —
// one channel per MESSAGE was exhausting Supabase's concurrent
// connection limit. It hand-rolled its own per-conversation channel
// sharing (reactionChannels/reactionListeners maps) to solve that.
//
// This pass replaces that hand-rolled sharing with the same shared
// realtime manager every other hook now goes through, so reactions get
// the same reconnect-with-backoff + resync-on-reconnect behavior for
// free, instead of a bespoke mechanism with none of that.
//
// TODO: like message_reads, `message_reactions` has no conversation_id
// column, so the underlying postgres_changes subscription is still
// unfiltered at the table level (every reaction change on the whole
// platform reaches every open conversation's channel — cheap per-event
// since it's a single boolean check against local message ids, but
// still more traffic than necessary). Same real fix as noted in
// useMessageStatus: a denormalized conversation_id column, or
// RLS-authorized Realtime once that's available.

export function useReactions(messageId, currentUserId, conversationId) {
  const [reactions, setReactions] = useState([])

  const load = useCallback(async () => {
    if (!messageId || messageId.startsWith?.('temp-')) return
    const { data } = await supabase
      .from('message_reactions')
      .select('emoji, user_id')
      .eq('message_id', messageId)
    if (!data) return
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
    if (!conversationId) return

    const unsubscribe = subscribeToChannel(
      `reactions:${conversationId}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_reactions',
      }, (payload) => emit('change', payload)),
      {
        onEvent: (type, payload) => {
          const changedMessageId = payload.new?.message_id || payload.old?.message_id
          if (changedMessageId === messageId) load()
        },
        onResync: load,
      }
    )
    return unsubscribe
  }, [messageId, conversationId, load])

  const toggleReaction = useCallback(async (emoji) => {
    const existing = reactions.find(r => r.emoji === emoji && r.iMine)
    if (existing) {
      await supabase.from('message_reactions').delete()
        .eq('message_id', messageId).eq('user_id', currentUserId).eq('emoji', emoji)
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: currentUserId, emoji })
    }
    await load()
  }, [messageId, currentUserId, reactions, load])

  return { reactions, toggleReaction }
}

// Kept as a no-op export so ChatPage's existing cleanup call
// (`removeReactionChannel(activeConvo.id)`) doesn't need to change.
// The shared manager now tears the channel down automatically the
// moment its last subscriber (the last mounted message in that
// conversation) unsubscribes — there's no longer a separate handle
// that needs an explicit close.
export function removeReactionChannel(conversationId) {}

// Quick bar that appears on hover
function QuickReactionBar({ onSelect, onMore, isMe }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      [isMe ? 'right' : 'left']: 0,
      marginBottom: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.1)',
      borderRadius: 24,
      padding: '4px 7px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      zIndex: 50,
      animation: 'reactionBarIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
      whiteSpace: 'nowrap',
    }}>
      <style>{`
        @keyframes reactionBarIn {
          from { opacity: 0; transform: scale(0.8) translateY(4px); }
          to   { opacity: 1; transform: none; }
        }
        .quick-emoji-btn:hover {
          transform: scale(1.4) translateY(-3px) !important;
        }
      `}</style>
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          className="quick-emoji-btn"
          onClick={() => onSelect(emoji)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 22, padding: '2px 3px', borderRadius: '50%',
            transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}
          title={emoji}
        >
          {emoji}
        </button>
      ))}
      <button
        onClick={onMore}
        style={{
          background: '#f0f2f5', border: 'none',
          borderRadius: '50%', width: 27, height: 27,
          cursor: 'pointer', color: '#54656f',
          fontSize: 14, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s', flexShrink: 0,
        }}
        title="More reactions"
      >
        +
      </button>
    </div>
  )
}

// Full picker
function FullReactionPicker({ onSelect, onClose, isMe }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute',
      bottom: 'calc(100% + 4px)',
      [isMe ? 'right' : 'left']: 0,
      background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.1)',
      borderRadius: 16,
      padding: 10,
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 4,
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      zIndex: 100,
      animation: 'reactionBarIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      minWidth: 220,
    }}>
      {ALL_REACTION_EMOJIS.map(emoji => (
        <button key={emoji} onClick={() => { onSelect(emoji); onClose() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 23, padding: '4px', borderRadius: 8, transition: 'all 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f0f4ff'; e.currentTarget.style.transform = 'scale(1.25)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.transform = 'none' }}
          title={emoji}
        >{emoji}</button>
      ))}
    </div>
  )
}

// Main wrapper
export function ReactableMessage({ messageId, currentUserId, isMe, conversationId, children }) {
  const [hovered, setHovered]       = useState(false)
  const [showBar, setShowBar]       = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const hoverTimer = useRef(null)
  const { reactions, toggleReaction } = useReactions(messageId, currentUserId, conversationId)

  const handleMouseEnter = () => {
    clearTimeout(hoverTimer.current)
    setHovered(true)
    hoverTimer.current = setTimeout(() => setShowBar(true), 180)
  }

  const handleMouseLeave = () => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => {
      setHovered(false)
      if (!showPicker) setShowBar(false)
    }, 280)
  }

  const handleReactionSelect = async (emoji) => {
    await toggleReaction(emoji)
    setShowBar(false)
    setShowPicker(false)
  }

  return (
    <div
     style={{ position: 'relative', display: 'inline-block', maxWidth: '82%' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showBar && !showPicker && (
        <QuickReactionBar isMe={isMe} onSelect={handleReactionSelect} onMore={() => { setShowPicker(true); setShowBar(false) }} />
      )}

      {showPicker && (
        <FullReactionPicker isMe={isMe} onSelect={handleReactionSelect} onClose={() => setShowPicker(false)} />
      )}

      {children}

      {reactions.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          marginTop: -4,
          paddingTop: 0,
          justifyContent: isMe ? 'flex-end' : 'flex-start',
          paddingLeft: isMe ? 0 : 4,
          paddingRight: isMe ? 4 : 0,
        }}>
          {reactions.map(({ emoji, count, iMine }) => (
            <button
              key={emoji}
              onClick={() => toggleReaction(emoji)}
              className={`reaction-chip${iMine ? ' mine' : ''}`}
              title={iMine ? 'Click to remove' : 'Click to react'}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
              <span className="reaction-chip-count">{count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
