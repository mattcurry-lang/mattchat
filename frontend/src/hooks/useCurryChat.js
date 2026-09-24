// src/hooks/useCurryChat.js
//
// Chat state for "Ask Curry". Messages carry an `action` (from the tool
// registry — e.g. OPEN_STUDENT_PORTAL, SHOW_ROUTE, CONFIRM_REQUIRED)
// alongside `sources`, and confirmAction() lets the UI approve a
// consequential action (e.g. filing a support ticket) Curry proposed
// but didn't execute yet.
//
// NEW: editUserMessage() and regenerateLast() — the ChatGPT-style
// "edit a past message" and "try again" patterns. Both work the same
// way: truncate local state back to (and including, for edit) the
// target user message, then re-run the backend call as a fresh turn
// with history built from what's left. Nothing is deleted server-side
// (dekut_curry_messages keeps the original log) — this only changes
// what's shown and what's sent as context going forward.

import { useCallback, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const CONVERSATION_KEY = 'mattchat:dekut:curry-conversation-id'
const GUEST_KEY_STORAGE = 'mattchat:dekut:curry-guest-key'

function getGuestKey() {
  let key = localStorage.getItem(GUEST_KEY_STORAGE) // localStorage, not sessionStorage — persists across app restarts
  if (!key) {
    key = crypto.randomUUID()
    localStorage.setItem(GUEST_KEY_STORAGE, key)
  }
  return key
}
function getConversationId() {
  let id = sessionStorage.getItem(CONVERSATION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(CONVERSATION_KEY, id)
  }
  return id
}

const HISTORY_WINDOW = 8

export function useCurryChat({ userId } = {}) {
  const [messages, setMessages] = useState([]) // { id, role, text, sources?, action?, error?, confirmed?, edited? }
  const [sending, setSending] = useState(false)
  const conversationIdRef = useRef(getConversationId())
  const guestKeyRef = useRef(getGuestKey())
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const invoke = useCallback(async (body) => {
    const { data, error } = await supabase.functions.invoke('dekut-curry', { body })
    if (error) throw error
    return data
  }, [])

  // Shared by sendMessage / editUserMessage / regenerateLast: run one
  // model turn against `historyBase` (already-trimmed prior turns) and
  // append the assistant reply, or an inline error bubble on failure.
  const runTurn = useCallback(async (userText, historyBase) => {
    const history = historyBase.slice(-HISTORY_WINDOW).map((m) => ({ role: m.role, message: m.text }))
    try {
      const data = await invoke({
        conversation_id: conversationIdRef.current,
        user_id: userId ?? null,
        guest_key: guestKeyRef.current,
        message: userText,
        history,
      })
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: data.response, sources: data.sources || [], action: data.action || null },
      ])
      return data.response
    } catch (err) {
      console.error('Curry runTurn failed:', err)
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: "Something went wrong reaching Curry. Please try again in a moment.", error: true },
      ])
      return null
    }
  }, [userId, invoke])

  // Returns the assistant's reply text (or null on failure) — text-mode
  // callers (button click, Enter key) ignore the return value; voice
  // mode uses it to know what to speak next.
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return null

    const userMsg = { id: crypto.randomUUID(), role: 'user', text: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)
    try {
      return await runTurn(trimmed, messagesRef.current)
    } finally {
      setSending(false)
    }
  }, [sending, runTurn])

  // ChatGPT-style edit: rewrite a past user message and re-run from
  // there, discarding everything that came after it (both older
  // assistant replies to that turn and any later turns) since they no
  // longer reflect what was actually asked.
  const editUserMessage = useCallback(async (messageId, newText) => {
    const trimmed = newText.trim()
    if (!trimmed || sending) return null
    const idx = messagesRef.current.findIndex((m) => m.id === messageId)
    if (idx === -1 || messagesRef.current[idx].role !== 'user') return null

    const before = messagesRef.current.slice(0, idx)
    const editedMsg = { ...messagesRef.current[idx], text: trimmed, edited: true }
    setMessages([...before, editedMsg])
    setSending(true)
    try {
      return await runTurn(trimmed, before)
    } finally {
      setSending(false)
    }
  }, [sending, runTurn])

  // ChatGPT-style regenerate: re-run the most recent user turn, dropping
  // whatever Curry said last time and replacing it with a fresh reply.
  const regenerateLast = useCallback(async () => {
    if (sending) return null
    const current = messagesRef.current
    let lastUserIdx = -1
    for (let i = current.length - 1; i >= 0; i--) {
      if (current[i].role === 'user') { lastUserIdx = i; break }
    }
    if (lastUserIdx === -1) return null

    const userText = current[lastUserIdx].text
    const before = current.slice(0, lastUserIdx)
    setMessages(current.slice(0, lastUserIdx + 1)) // keep the user turn, drop the old reply (+ anything after)
    setSending(true)
    try {
      return await runTurn(userText, before)
    } finally {
      setSending(false)
    }
  }, [sending, runTurn])

  // Approves a CONFIRM_REQUIRED action attached to a specific message —
  // e.g. the student tapping "Yes, submit it" under a proposed support
  // ticket. Marks that message confirmed so its button doesn't fire twice.
  // For card-driven requests (tapping the menu, submitting the contact
  // form) — these hit the backend's model-free `intent` path, not the
  // chat path. userTextSummary is optional plain-text logged as what
  // the student "said" (e.g. "2 × Chapati, 1 × Beef from Mess A"), so
  // history/logs read naturally even though nothing was typed.
  // sourceMessageId: the message whose card triggered this — gets
  // marked confirmed so the card (menu/details form) doesn't stay live
  // and re-submittable after the student's already acted on it.
  const sendIntent = useCallback(async (intentPayload, userTextSummary, sourceMessageId) => {
    if (sending) return
    setSending(true)
    if (userTextSummary) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: userTextSummary }])
    }
    try {
      const data = await invoke({
        conversation_id: conversationIdRef.current,
        user_id: userId ?? null,
        guest_key: guestKeyRef.current,
        user_text: userTextSummary ?? null,
        ...intentPayload,
      })
      setMessages((prev) => [
        ...prev.map((m) => (sourceMessageId && m.id === sourceMessageId ? { ...m, confirmed: true } : m)),
        { id: crypto.randomUUID(), role: 'assistant', text: data.response, sources: data.sources || [], action: data.action || null },
      ])
      return data.response
    } catch (err) {
      console.error('Curry sendIntent failed:', err)
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: "Something went wrong reaching Curry. Please try again in a moment.", error: true },
      ])
      return null
    } finally {
      setSending(false)
    }
  }, [sending, userId, invoke])

  const confirmAction = useCallback(async (messageId, action) => {
    setSending(true)
    try {
      const data = await invoke({
        conversation_id: conversationIdRef.current,
        user_id: userId ?? null,
        guest_key: guestKeyRef.current,
        confirm_tool: action.tool,
        confirm_args: action.args,
      })
      setMessages((prev) => [
        ...prev.map((m) => (m.id === messageId ? { ...m, confirmed: true } : m)),
        { id: crypto.randomUUID(), role: 'assistant', text: data.response, sources: data.sources || [], action: data.action || null },
      ])
      return data.response
    } catch (err) {
      console.error('Curry confirmAction failed:', err)
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: "That didn't go through — please try again.", error: true },
      ])
      return null
    } finally {
      setSending(false)
    }
  }, [userId, invoke])

  // Declining a proposed action never touches the backend — nothing was
  // submitted, so there's nothing to tell the server about.
  const declineAction = useCallback((messageId) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, confirmed: true, declined: true } : m)))
  }, [])

  const resetConversation = useCallback(() => {
    sessionStorage.removeItem(CONVERSATION_KEY)
    conversationIdRef.current = getConversationId()
    setMessages([])
  }, [])

  return {
    messages, sending,
    sendMessage, sendIntent, confirmAction, declineAction, resetConversation,
    editUserMessage, regenerateLast,
  }
}
