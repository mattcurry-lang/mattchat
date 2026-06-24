import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ScheduleMessageModal({ conversationId, senderId, onClose }) {
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Min datetime = now + 5 minutes
  const minDatetime = new Date(Date.now() + 5 * 60 * 1000);
  const minDate = minDatetime.toISOString().split('T')[0];
  const minTime = minDatetime.toTimeString().slice(0, 5);

  async function handleSchedule() {
    if (!content.trim()) return setError('Write a message first.');
    if (!date || !time) return setError('Pick a date and time.');

    const scheduledFor = new Date(`${date}T${time}`);
    if (scheduledFor <= new Date()) return setError('Must be at least 5 minutes from now.');

    setSending(true);
    setError('');

    const { error: err } = await supabase.from('scheduled_messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
    });

    setSending(false);
    if (err) return setError('Failed to schedule. Try again.');
    onClose(true); // true = success
  }

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose(false)}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.title}>🕐 Schedule Message</span>
          <button style={styles.closeBtn} onClick={() => onClose(false)}>✕</button>
        </div>

        <textarea
          style={styles.textarea}
          placeholder="Type your message..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          autoFocus
        />

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Date</label>
            <input
              type="date"
              style={styles.input}
              value={date}
              min={minDate}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Time</label>
            <input
              type="time"
              style={styles.input}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        {date && time && (
          <div style={styles.preview}>
            Will send: {new Date(`${date}T${time}`).toLocaleString([], {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })}
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <button
          style={{ ...styles.btn, opacity: sending ? 0.6 : 1 }}
          onClick={handleSchedule}
          disabled={sending}
        >
          {sending ? 'Scheduling...' : 'Schedule Message'}
        </button>
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
  modal: {
    background: '#1e1e2e', borderRadius: 16, padding: 20,
    width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14,
    boxShadow: '0 -4px 40px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: 700, color: '#fff' },
  closeBtn: {
    background: 'none', border: 'none', color: '#888', fontSize: 18,
    cursor: 'pointer', padding: '0 4px',
  },
  textarea: {
    background: '#2a2a3e', border: '1px solid #3a3a4e', borderRadius: 10,
    color: '#fff', fontSize: 15, padding: '10px 14px',
    resize: 'none', outline: 'none', fontFamily: 'inherit',
  },
  row: { display: 'flex', gap: 12 },
  field: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase' },
  input: {
    background: '#2a2a3e', border: '1px solid #3a3a4e', borderRadius: 8,
    color: '#fff', fontSize: 14, padding: '8px 10px', outline: 'none',
    colorScheme: 'dark',
  },
  preview: {
    fontSize: 13, color: '#a0aec0',
    background: '#2a2a3e', borderRadius: 8, padding: '8px 12px',
  },
  error: { fontSize: 13, color: '#fc8181' },
  btn: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', border: 'none', borderRadius: 10,
    padding: '12px', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', transition: 'opacity 0.2s',
  },
};
