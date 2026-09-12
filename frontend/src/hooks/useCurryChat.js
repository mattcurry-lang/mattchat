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

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

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
    } catch (err) {
      console.error('Curry sendMessage failed:', err)
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: "Something went wrong reaching Curry. Please try again in a moment.", error: true },
      ])
    } finally {
      setSending(false)
    }
  }, [messages, sending, userId, invoke])

  // Approves a CONFIRM_REQUIRED action attached to a specific message —
  // e.g. the student tapping "Yes, submit it" under a proposed support
  // ticket. Marks that message confirmed so its button doesn't fire twice.
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

  return { messages, sending, sendMessage, confirmAction, declineAction, resetConversation }
}
