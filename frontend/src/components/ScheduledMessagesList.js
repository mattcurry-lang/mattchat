import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ScheduledMessagesList({ conversationId, currentUserId, onClose }) {
  const [scheduled, setScheduled] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScheduled();

    const sub = supabase
      .channel(`scheduled:${conversationId}:${currentUserId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'scheduled_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => fetchScheduled())
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [conversationId, currentUserId]);

  async function fetchScheduled() {
    const { data } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('sender_id', currentUserId)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true });

    setScheduled(data || []);
    setLoading(false);
  }

  async function cancelScheduled(id) {
    await supabase
      .from('scheduled_messages')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('sender_id', currentUserId);
  }

  function formatTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const isToday = d.toDateString() === now.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
  }

  function timeUntil(iso) {
    const diff = new Date(iso) - new Date();
    if (diff < 0) return 'Sending soon...';
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `in ${days}d ${hours % 24}h`;
    if (hours > 0) return `in ${hours}h ${mins % 60}m`;
    return `in ${mins}m`;
  }

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.title}>🕐 Scheduled Messages</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={styles.empty}>Loading...</div>
        ) : scheduled.length === 0 ? (
          <div style={styles.empty}>No scheduled messages in this chat.</div>
        ) : (
          <div style={styles.list}>
            {scheduled.map((msg) => (
              <div key={msg.id} style={styles.item}>
                <div style={styles.itemContent}>{msg.content}</div>
                <div style={styles.itemMeta}>
                  <span style={styles.time}>{formatTime(msg.scheduled_for)}</span>
                  <span style={styles.countdown}>{timeUntil(msg.scheduled_for)}</span>
                </div>
                <button
                  style={styles.cancelBtn}
                  onClick={() => cancelScheduled(msg.id)}
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 1000, padding: '0 0 20px',
  },
  panel: {
    background: '#1e1e2e', borderRadius: 16, padding: 20,
    width: '100%', maxWidth: 480,
    boxShadow: '0 -4px 40px rgba(0,0,0,0.4)',
    maxHeight: '70vh', display: 'flex', flexDirection: 'column', gap: 12,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: 700, color: '#fff' },
  closeBtn: {
    background: 'none', border: 'none', color: '#888',
    fontSize: 18, cursor: 'pointer', padding: '0 4px',
  },
  empty: { color: '#888', fontSize: 14, textAlign: 'center', padding: '20px 0' },
  list: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 },
  item: {
    background: '#2a2a3e', borderRadius: 12, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 6,
    borderLeft: '3px solid #667eea',
  },
  itemContent: { color: '#fff', fontSize: 14, lineHeight: 1.4 },
  itemMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontSize: 12, color: '#a0aec0' },
  countdown: {
    fontSize: 11, color: '#667eea', fontWeight: 700,
    background: 'rgba(102,126,234,0.15)', borderRadius: 6, padding: '2px 7px',
  },
  cancelBtn: {
    alignSelf: 'flex-start',
    background: 'none', border: '1px solid #fc8181', color: '#fc8181',
    borderRadius: 6, padding: '4px 10px', fontSize: 12,
    cursor: 'pointer', marginTop: 2,
  },
};
