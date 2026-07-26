import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logShortsInteraction } from '../../lib/shortsSupabase'

export default function StartConversationModal({ video, conversations, getConvoName, currentUserId, onClose }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const filtered = conversations.filter(c => getConvoName(c).toLowerCase().includes(search.toLowerCase()))

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const send = async () => {
    if (selected.size === 0 || sending) return
    setSending(true)
    const shortContent = `short:${video.videoId}::${video.title}::${video.thumbnailUrl}::${video.channelTitle}`
    try {
      await Promise.all(Array.from(selected).map(async (convoId) => {
        if (message.trim()) {
          await supabase.from('messages').insert({ conversation_id: convoId, sender_id: currentUserId, content: message.trim(), message_type: 'text' })
        }
        await supabase.from('messages').insert({ conversation_id: convoId, sender_id: currentUserId, content: shortContent, message_type: 'text' })
        await supabase.from('conversations').update({ updated_at: new Date().toISOString(), last_message: '📱 Short' }).eq('id', convoId)
      }))
      logShortsInteraction(currentUserId, video, 0, { shared: true })
      setSent(true)
      setTimeout(onClose, 900)
    } catch (e) {
      console.error('StartConversationModal send failed:', e)
    }
    setSending(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxHeight: '78vh', background: 'rgba(20,20,32,0.92)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24, border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', animation: 'sheetUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 4, margin: '10px auto 4px' }} />
        <div style={{ padding: '8px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0 }}>Send to</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '14px 20px 8px' }}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats…" autoFocus
            style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '9px 12px', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '38vh' }}>
          {filtered.map((c) => {
            const isSelected = selected.has(c.id)
            return (
              <button
                key={c.id} onClick={() => toggleSelect(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                  background: isSelected ? 'rgba(102,126,234,0.18)' : 'none', border: 'none', padding: '10px 10px',
                  borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, color: '#fff', textAlign: 'left',
                }}
              >
                {getConvoName(c)}
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${isSelected ? '#a78bfa' : 'rgba(255,255,255,0.3)'}`,
                  background: isSelected ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0,
                }}>{isSelected ? '✓' : ''}</span>
              </button>
            )
          })}
        </div>

        <div style={{ padding: '10px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a message (optional)…"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
          />
          <button
            onClick={send} disabled={selected.size === 0 || sending}
            style={{
              background: sent ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#667eea,#764ba2)',
              border: 'none', borderRadius: 14, color: '#fff', fontSize: 13.5, fontWeight: 800, padding: '13px', cursor: 'pointer',
              fontFamily: 'inherit', opacity: selected.size === 0 ? 0.4 : 1, transition: 'all 0.2s',
            }}
          >
            {sent ? 'Sent ✓' : sending ? 'Sending…' : `Send${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>
      <style>{`@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  )
}
