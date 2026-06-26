import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ScheduledMessagesList({ conversationId, currentUserId, onClose }) {
  const [scheduled, setScheduled] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetchScheduled()
    const sub = supabase
      .channel(`scheduled:${conversationId}:${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_messages',
        filter: `conversation_id=eq.${conversationId}` }, () => fetchScheduled())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [conversationId, currentUserId])

  async function fetchScheduled() {
    const { data } = await supabase
      .from('scheduled_messages').select('*')
      .eq('conversation_id', conversationId)
      .eq('sender_id', currentUserId)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true })
    setScheduled(data || [])
    setLoading(false)
  }

  async function cancel(id) {
    await supabase.from('scheduled_messages')
      .update({ status: 'cancelled' }).eq('id', id).eq('sender_id', currentUserId)
  }

  function formatTime(iso) {
    const d = new Date(iso), now = new Date()
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === now.toDateString()) return `Today at ${time}`
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${time}`
  }

  function timeUntil(iso) {
    const diff = new Date(iso) - new Date()
    if (diff < 0) return 'Sending...'
    const mins = Math.floor(diff / 60000), hours = Math.floor(mins / 60), days = Math.floor(hours / 24)
    if (days > 0)  return `in ${days}d ${hours % 24}h`
    if (hours > 0) return `in ${hours}h ${mins % 60}m`
    return `in ${mins}m`
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxHeight: '70vh' }}>
        <div className="modal-header">
          <span className="modal-title">🕐 Scheduled Messages</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Loading...</div>
        ) : scheduled.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
            No scheduled messages in this chat.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {scheduled.map(msg => (
              <div key={msg.id} className="scheduled-item">
                <div className="scheduled-content">{msg.content}</div>
                <div className="scheduled-meta">
                  <span className="scheduled-time">{formatTime(msg.scheduled_for)}</span>
                  <span className="scheduled-countdown">{timeUntil(msg.scheduled_for)}</span>
                </div>
                <button className="scheduled-cancel" onClick={() => cancel(msg.id)}>Cancel</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
