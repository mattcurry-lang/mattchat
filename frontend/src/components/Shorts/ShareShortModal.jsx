import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ShareShortModal({ video, conversations, getConvoName, currentUserId, onClose, onShared }) {
  const [search, setSearch] = useState('')
  const [sentTo, setSentTo] = useState(new Set())

  const filtered = conversations.filter(c => getConvoName(c).toLowerCase().includes(search.toLowerCase()))

  const sendTo = async (convo) => {
    const content = `short:${video.videoId}::${video.title}::${video.thumbnailUrl}::${video.channelTitle}`
    await supabase.from('messages').insert({
      conversation_id: convo.id, sender_id: currentUserId, content, message_type: 'text',
    })
    await supabase.from('conversations').update({
      updated_at: new Date().toISOString(), last_message: '📱 Short',
    }).eq('id', convo.id)
    setSentTo(prev => new Set(prev).add(convo.id))
    onShared?.()
  }

  return (
    <div className="profile-menu-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-surface-1, #14141f)', borderRadius: 20, width: 'min(420px, 92vw)',
        maxHeight: '75vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)',
      }}>
        <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Share Short</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '14px 20px' }}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats…" autoFocus
            style={{ width: '100%', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map((c) => (
            <button
              key={c.id} onClick={() => sendTo(c)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                background: 'none', border: 'none', padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13.5, color: 'var(--text-primary)', textAlign: 'left',
              }}
            >
              {getConvoName(c)}
              {sentTo.has(c.id) && <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 700 }}>Sent ✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
