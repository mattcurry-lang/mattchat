import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PinnedBar({ conversationId, onScrollTo }) {
  const [pinned, setPinned] = useState([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!conversationId) return
    fetchPinned()
  }, [conversationId])

  const fetchPinned = async () => {
    const { data } = await supabase
      .from('pinned_messages')
      .select('*, messages(id, content, message_type, profiles(username))')
      .eq('conversation_id', conversationId)
      .order('pinned_at', { ascending: false })
    setPinned(data || [])
  }

  const unpin = async (pinnedId, e) => {
    e.stopPropagation()
    await supabase.from('pinned_messages').delete().eq('id', pinnedId)
    fetchPinned()
  }

  if (pinned.length === 0) return null

  return (
    <div style={{
      borderBottom: '0.5px solid #d3e8f7',
      background: '#f0f8ff',
      padding: expanded ? '8px 12px' : '6px 12px',
    }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{ fontSize: 14 }}>📌</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#3B82C4', flex: 1 }}>
          {pinned.length} pinned message{pinned.length > 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: 11, color: '#6b8aa3' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pinned.map(p => (
            <div
              key={p.id}
              onClick={() => onScrollTo(p.message_id)}
              style={{
                background: 'white', borderRadius: 8, padding: '6px 10px',
                border: '0.5px solid #d3e8f7', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#3B82C4', fontWeight: 500, marginBottom: 2 }}>
                  {p.messages?.profiles?.username || 'Unknown'}
                </div>
                <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.messages?.message_type === 'voice' ? '🎙️ Voice note'
                    : p.messages?.message_type === 'poll' ? '📊 Poll'
                    : p.messages?.message_type === 'task' ? '✅ Task list'
                    : p.messages?.content}
                </div>
              </div>
              <button
                onClick={e => unpin(p.id, e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af', padding: '2px 4px' }}
                title="Unpin"
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
