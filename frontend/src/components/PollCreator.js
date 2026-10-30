import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './ChatCards.css'

const MIN_OPTIONS = 2
const MAX_OPTIONS = 6

const CloseIcon = () => (
  <svg className="cc-ico" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
)

const PlusIcon = () => (
  <svg className="cc-ico" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 3v10M3 8h10" />
  </svg>
)

export default function PollCreator({ conversationId, senderId, onSent, onCancel }) {
  const uid = useRef(0)
  const mk = (text = '') => ({ id: ++uid.current, text })

  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(() => [mk(), mk()])
  const [allowsMultiple, setAllowsMultiple] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  // focus management: set an id, the effect focuses that row once it exists
  const inputRefs = useRef({})
  const [focusId, setFocusId] = useState(null)
  useEffect(() => {
    if (focusId == null) return
    inputRefs.current[focusId]?.focus()
    setFocusId(null)
  }, [focusId])

  const updateOption = (id, text) =>
    setOptions(os => os.map(o => (o.id === id ? { ...o, text } : o)))

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return
    const o = mk()
    setOptions([...options, o])
    setFocusId(o.id)
  }

  const removeOption = (id) => {
    if (options.length <= MIN_OPTIONS) return
    setOptions(options.filter(o => o.id !== id))
  }

  const handleKeyDown = (e, i) => {
    const opt = options[i]
    if (e.key === 'Enter') {
      e.preventDefault()
      if (i < options.length - 1) setFocusId(options[i + 1].id)
      else if (opt.text.trim()) addOption()
    } else if (e.key === 'Backspace' && !opt.text && options.length > MIN_OPTIONS) {
      e.preventDefault()
      setFocusId(options[i > 0 ? i - 1 : 1].id)
      removeOption(opt.id)
    }
  }

  const canSend = question.trim() && options.filter(o => o.text.trim()).length >= 2

  const send = async () => {
    if (!canSend || sending) return
    setSending(true)
    setError(null)
    try {
      const validOptions = options.map(o => o.text.trim()).filter(Boolean)

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
      setError("Couldn't create the poll. Try again.")
      setSending(false)
    }
  }

  return (
    <div
      className="cc cc-sheet"
      role="dialog"
      aria-label="New poll"
      onKeyDown={e => { if (e.key === 'Escape') onCancel && onCancel() }}
    >
      <div className="cc-head">
        <span className="cc-head-title">New poll</span>
        <button type="button" className="cc-close" onClick={onCancel} aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      {error && <p className="cc-error" role="alert">{error}</p>}

      <input
        className="cc-main"
        placeholder="Ask a question"
        value={question}
        onChange={e => setQuestion(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            inputRefs.current[options[0].id]?.focus()
          }
        }}
        maxLength={200}
        autoFocus
      />

      <div className="cc-rows">
        {options.map((opt, i) => (
          <div key={opt.id} className="cc-row">
            {/* circle for pick-one, square for pick-many: previews how voting will look */}
            <span className={`cc-dot${allowsMultiple ? ' is-multi' : ''}`} />
            <input
              ref={el => { inputRefs.current[opt.id] = el }}
              className="cc-input"
              placeholder={`Option ${i + 1}`}
              value={opt.text}
              onChange={e => updateOption(opt.id, e.target.value)}
              onKeyDown={e => handleKeyDown(e, i)}
              maxLength={100}
            />
            {options.length > MIN_OPTIONS && (
              <button
                type="button"
                className="cc-rm"
                onClick={() => removeOption(opt.id)}
                aria-label="Remove option"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        ))}
      </div>

      {options.length < MAX_OPTIONS && (
        <button type="button" className="cc-add" onClick={addOption}>
          <PlusIcon /> Add option
        </button>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={allowsMultiple}
        className="cc-switch"
        onClick={() => setAllowsMultiple(v => !v)}
      >
        <span>Allow multiple answers</span>
        <span className="cc-track" />
      </button>

      <div className="cc-foot">
        <button type="button" className="cc-btn cc-btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="cc-btn cc-btn-primary"
          onClick={send}
          disabled={!canSend || sending}
        >
          {sending ? 'Creating…' : 'Create poll'}
        </button>
      </div>
    </div>
  )
}
