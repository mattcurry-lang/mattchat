import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PollCreator({ conversationId, senderId, onSent, onCancel }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [allowsMultiple, setAllowsMultiple] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const updateOption = (i, val) => {
    const next = [...options]
    next[i] = val
    setOptions(next)
  }

  const addOption = () => {
    if (options.length < 6) setOptions([...options, ''])
  }

  const removeOption = (i) => {
    if (options.length <= 2) return
    setOptions(options.filter((_, idx) => idx !== i))
  }

  const canSend = question.trim() && options.filter(o => o.trim()).length >= 2

  const send = async () => {
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      const validOptions = options.map(o => o.trim()).filter(Boolean)

      // 1. insert poll
      const { data: poll, error: pollErr } = await supabase
        .from('polls')
        .insert({ conversation_id: conversationId, creator_id: senderId, question: question.trim(), allows_multiple: allowsMultiple })
        .select().single()
      if (pollErr) throw pollErr

      // 2. insert options
      const { error: optErr } = await supabase
        .from('poll_options')
        .insert(validOptions.map((text, i) => ({ poll_id: poll.id, text, position: i })))
      if (optErr) throw optErr

      // 3. insert message
      const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: `📊 Poll: ${question.trim()}`,
          message_type: 'poll',
          poll_id: poll.id,
        })
        .select().single()
      if (msgErr) throw msgErr

      // 4. update conversation preview
      await supabase.from('conversations')
        .update({ updated_at: new Date().toISOString(), last_message: `📊 Poll: ${question.trim()}` })
        .eq('id', conversationId)

      onSent && onSent(msg)
    } catch (err) {
      console.error(err)
      setError('Failed to create poll. Try again.')
      setSending(false)
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.title}>📊 New Poll</span>
        <button style={s.closeBtn} onClick={onCancel}>✕</button>
      </div>

      {error && <p style={s.error}>{error}</p>}

      <input
        style={s.questionInput}
        placeholder="Ask a question…"
        value={question}
        onChange={e => setQuestion(e.target.value)}
        maxLength={200}
        autoFocus
      />

      <div style={s.optionsLabel}>Options</div>
      {options.map((opt, i) => (
        <div key={i} style={s.optRow}>
          <input
            style={s.optInput}
            placeholder={`Option ${i + 1}`}
            value={opt}
            onChange={e => updateOption(i, e.target.value)}
            maxLength={100}
          />
          {options.length > 2 && (
            <button style={s.removeBtn} onClick={() => removeOption(i)}>✕</button>
          )}
        </div>
      ))}

      {options.length < 6 && (
        <button style={s.addOptBtn} onClick={addOption}>+ Add option</button>
      )}

      <label style={s.multiLabel}>
        <input
          type="checkbox"
          checked={allowsMultiple}
          onChange={e => setAllowsMultiple(e.target.checked)}
          style={{ marginRight: 8 }}
        />
        Allow multiple choices
      </label>

      <div style={s.footer}>
        <button style={s.cancelBtn} onClick={onCancel}>Cancel</button>
        <button
          style={{ ...s.sendBtn, opacity: canSend ? 1 : 0.4 }}
          onClick={send}
          disabled={!canSend || sending}
        >
          {sending ? 'Creating…' : 'Create Poll'}
        </button>
      </div>
    </div>
  )
}

const s = {
  wrap: {
    position: 'absolute', bottom: '100%', left: 0, right: 0,
    background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16, padding: 16, marginBottom: 8,
    boxShadow: '0 -4px 24px rgba(0,0,0,0.4)', zIndex: 100,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 15, fontWeight: 600, color: '#fff' },
  closeBtn: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  questionInput: {
    width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 14,
    outline: 'none', marginBottom: 12, boxSizing: 'border-box',
  },
  optionsLabel: { fontSize: 12, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
  optRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  optInput: {
    flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none',
  },
  removeBtn: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 14, flexShrink: 0 },
  addOptBtn: {
    background: 'none', border: '1px dashed rgba(124,111,247,0.4)',
    borderRadius: 8, color: '#7C6FF7', padding: '6px 12px',
    fontSize: 13, cursor: 'pointer', width: '100%', marginBottom: 12,
  },
  multiLabel: { display: 'flex', alignItems: 'center', fontSize: 13, color: '#aaa', marginBottom: 16, cursor: 'pointer' },
  footer: { display: 'flex', gap: 8 },
  cancelBtn: {
    flex: 1, background: 'rgba(255,255,255,0.06)', border: 'none',
    borderRadius: 10, padding: '10px', color: '#aaa', fontSize: 14, cursor: 'pointer',
  },
  sendBtn: {
    flex: 2, background: '#7C6FF7', border: 'none',
    borderRadius: 10, padding: '10px', color: '#fff', fontSize: 14,
    fontWeight: 600, cursor: 'pointer',
  },
  error: { color: '#ef4444', fontSize: 12, marginBottom: 8 },
}
