// src/hooks/useCurryChat.js
//
// Chat state for "Ask Curry". Phase 2: messages now carry an `action`
// (from the tool registry — e.g. OPEN_STUDENT_PORTAL, SHOW_ROUTE,
// CONFIRM_REQUIRED) alongside `sources`, and confirmAction() lets the
// UI approve a consequential action (e.g. filing a support ticket)
// that Curry proposed but didn't execute yet.

import { useCallback, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const CONVERSATION_KEY = 'mattchat:dekut:curry-conversation-id'

function getConversationId() {
  let id = sessionStorage.getItem(CONVERSATION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(CONVERSATION_KEY, id)
  }
  return id
}

export function useCurryChat({ userId } = {}) {
  const [messages, setMessages] = useState([]) // { id, role, text, sources?, action?, error?, confirmed? }
  const [sending, setSending] = useState(false)
  const conversationIdRef = useRef(getConversationId())

  const invoke = useCallback(async (body) => {
    const { data, error } = await supabase.functions.invoke('dekut-curry', { body })
    if (error) throw error
    return data
  }, [])

  // Returns the assistant's reply text (or null on failure) — text-mode
  // callers (button click, Enter key) ignore the return value; voice
  // mode uses it to know what to speak next.
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return null

    const userMsg = { id: crypto.randomUUID(), role: 'user', text: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)

    const history = messages.slice(-8).map((m) => ({ role: m.role, message: m.text }))

    try {
      const data = await invoke({
        conversation_id: conversationIdRef.current,
        user_id: userId ?? null,
        message: trimmed,
        history,
      })
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: data.response, sources: data.sources || [], action: data.action || null },
      ])
      return data.response
    } catch (err) {
      console.error('Curry sendMessage failed:', err)
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: "Something went wrong reaching Curry. Please try again in a moment.", error: true },
      ])
      return null
    } finally {
      setSending(false)
    }
  }, [messages, sending, userId, invoke])

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
        confirm_tool: action.tool,
        confirm_args: action.args,
      })
      setMessages((prev) => [
        ...prev.map((m) => (m.id === messageId ? { ...m, confirmed: true } : m)),
        { id: crypto.randomUUID(), role: 'assistant', text: data.response, sources: data.sources || [], action: data.action || null },
      ])
    } catch (err) {
      console.error('Curry confirmAction failed:', err)
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: "That didn't go through — please try again.", error: true },
      ])
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

  return { messages, sending, sendMessage, sendIntent, confirmAction, declineAction, resetConversation }
}
