import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PinnedBar({ conversationId, onScrollTo }) {
  const [pinned, setPinned] = useState([])
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!conversationId) return
    let cancelled = false

    const load = async () => {
      const { data, error } = await supabase
        .from('pinned_messages')
        .select('id, message_id, messages(id, content, message_type)')
        .eq('conversation_id', conversationId)
        .order('pinned_at', { ascending: false })

      if (!cancelled && !error && data) {
        setPinned(data)
        setCurrent(0)
      }
    }

    load()
    return () => { cancelled = true }
  }, [conversationId])

  if (!pinned || pinned.length === 0) return null

  const item = pinned[current]
  const msg = item?.messages
  const preview = msg?.message_type === 'voice'
    ? '🎙️ Voice note'
    : msg?.message_type === 'poll'
    ? '📊 Poll'
    : msg?.message_type === 'task'
    ? '✅ Task list'
    : msg?.content || ''

  const handleClick = () => {
    if (onScrollTo && item?.message_id) onScrollTo(item.message_id)
  }

  const handlePrev = (e) => {
    e.stopPropagation()
    setCurrent(c => (c + 1) % pinned.length)
  }

  const handleUnpin = async (e) => {
    e.stopPropagation()
    await supabase.from('pinned_messages').delete().eq('id', item.id)
    setPinned(prev => prev.filter(p => p.id !== item.id))
    setCurrent(0)
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: '#f0f4ff',
        borderBottom: '1px solid #dde3f5',
        cursor: 'pointer',
        fontSize: 13,
        minHeight: 36,
      }}
    >
      <span style={{ fontSize: 15 }}>📌</span>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 10, color: '#7c83a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Pinned message {pinned.length > 1 ? `(${current + 1}/${pinned.length})` : ''}
        </div>
        <div style={{ color: '#2d3a5e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {preview}
        </div>
      </div>
      {pinned.length > 1 && (
        <button
          onClick={handlePrev}
          title="See previous pin"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#7c83a0', padding: '0 4px' }}
        >⟳</button>
      )}
      <button
        onClick={handleUnpin}
        title="Unpin"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#aab', padding: '0 4px' }}
      >✕</button>
    </div>
  )
}
