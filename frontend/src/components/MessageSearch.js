import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { format, isToday, isYesterday } from 'date-fns';

function highlight(text, query) {
  if (!query.trim() || typeof text !== 'string') return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={styles.highlight}>{part}</mark>
      : part
  );
}

function formatTime(iso) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday ' + format(d, 'h:mm a');
  return format(d, 'MMM d, h:mm a');
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'text', label: '💬 Text' },
  { value: 'voice', label: '🎙️ Voice' },
  { value: 'poll', label: '📊 Poll' },
  { value: 'task', label: '✅ Task' },
];

export default function MessageSearch({ conversationId, currentUserId, otherUserName, onScrollTo, onClose }) {
  const [query, setQuery] = useState('');
  const [sender, setSender] = useState('all');
  const [msgType, setMsgType] = useState('all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    // Run search whenever filters change, even with no query
    debounceRef.current = setTimeout(() => runSearch(), 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, sender, msgType]);

  async function runSearch() {
    setLoading(true);
    setSearched(true);

    try {
      // Build query without profiles join to avoid FK issues
      let q = supabase
        .from('messages')
        .select('id, content, message_type, sender_id, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (query.trim()) q = q.ilike('content', `%${query.trim()}%`);
      if (sender === 'me') q = q.eq('sender_id', currentUserId);
      if (sender === 'them') q = q.neq('sender_id', currentUserId);
      if (msgType !== 'all') q = q.eq('message_type', msgType);

      const { data, error } = await q;

      if (error) {
        console.error('Search error:', error);
        setResults([]);
      } else {
        setResults(data || []);
      }
    } catch (err) {
      console.error('Search exception:', err);
      setResults([]);
    }

    setLoading(false);
  }

  function getTypeLabel(type) {
    if (type === 'voice') return '🎙️ Voice note';
    if (type === 'poll') return '📊 Poll';
    if (type === 'task') return '✅ Task list';
    return null;
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.title}>🔍 Search Messages</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <input
          ref={inputRef}
          style={styles.input}
          placeholder="Search for a message..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div style={styles.filters}>
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>From</span>
            <div style={styles.pills}>
              {[
                { value: 'all', label: 'Everyone' },
                { value: 'me', label: 'Me' },
                { value: 'them', label: otherUserName || 'Them' },
              ].map(opt => (
                <button
                  key={opt.value}
                  style={{ ...styles.pill, ...(sender === opt.value ? styles.pillActive : {}) }}
                  onClick={() => setSender(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Type</span>
            <div style={styles.pills}>
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  style={{ ...styles.pill, ...(msgType === opt.value ? styles.pillActive : {}) }}
                  onClick={() => setMsgType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.results}>
          {loading && <div style={styles.status}>Searching...</div>}

          {!loading && searched && results.length === 0 && (
            <div style={styles.status}>No messages found.</div>
          )}

          {!loading && !searched && (
            <div style={styles.status}>Type to search, or pick a filter above.</div>
          )}

          {!loading && results.map(msg => (
            <button
              key={msg.id}
              style={styles.resultItem}
              onClick={() => { onScrollTo(msg.id); onClose(); }}
            >
              <div style={styles.resultMeta}>
                <span style={styles.resultSender}>
                  {msg.sender_id === currentUserId ? 'You' : otherUserName || 'Them'}
                </span>
                <span style={styles.resultTime}>{formatTime(msg.created_at)}</span>
              </div>
              <div style={styles.resultContent}>
                {getTypeLabel(msg.message_type)
                  ? <span style={styles.typeTag}>{getTypeLabel(msg.message_type)}</span>
                  : highlight(msg.content, query)
                }
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    zIndex: 1000, paddingTop: 60,
  },
  panel: {
    background: '#1e1e2e', borderRadius: 16, padding: 20,
    width: '100%', maxWidth: 480, maxHeight: '80vh',
    display: 'flex', flexDirection: 'column', gap: 14,
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: 700, color: '#fff' },
  closeBtn: {
    background: 'none', border: 'none', color: '#888',
    fontSize: 18, cursor: 'pointer', padding: '0 4px',
  },
  input: {
    background: '#2a2a3e', border: '1px solid #3a3a4e', borderRadius: 10,
    color: '#fff', fontSize: 15, padding: '10px 14px',
    outline: 'none', fontFamily: 'inherit',
  },
  filters: { display: 'flex', flexDirection: 'column', gap: 10 },
  filterGroup: { display: 'flex', alignItems: 'center', gap: 10 },
  filterLabel: { fontSize: 12, color: '#888', fontWeight: 600, width: 36, flexShrink: 0 },
  pills: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  pill: {
    background: '#2a2a3e', border: '1px solid #3a3a4e', borderRadius: 20,
    color: '#a0aec0', fontSize: 12, padding: '4px 12px', cursor: 'pointer',
    transition: 'all 0.15s',
  },
  pillActive: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    border: '1px solid #667eea', color: '#fff',
  },
  results: {
    overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, flex: 1,
  },
  status: { color: '#888', fontSize: 14, textAlign: 'center', padding: '20px 0' },
  resultItem: {
    background: '#2a2a3e', border: 'none', borderRadius: 10,
    padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: 4,
    borderLeft: '3px solid #667eea',
  },
  resultMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  resultSender: { fontSize: 12, fontWeight: 700, color: '#667eea' },
  resultTime: { fontSize: 11, color: '#666' },
  resultContent: { fontSize: 14, color: '#e2e8f0', lineHeight: 1.4 },
  typeTag: {
    fontSize: 12, color: '#a0aec0',
    background: 'rgba(102,126,234,0.15)', borderRadius: 6, padding: '2px 8px',
  },
  highlight: {
    background: 'rgba(102,126,234,0.4)', color: '#fff',
    borderRadius: 3, padding: '0 2px',
  },
};
