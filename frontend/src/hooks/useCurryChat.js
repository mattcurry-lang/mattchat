// src/hooks/useCurryChat.js
//
// Chat state for "Ask Curry". Phase 3: adds sendIntent() — a structured,
// model-free channel the cards use to talk to the edge function.
//
// Why it exists: ordering food used to require the language model to
// rebuild the whole order (mess + items + quantities + name + phone) out
// of chat history on every turn, which is exactly where it kept failing.
// Now the menu card sends real item ids straight to the backend, which
// prices and stages the order itself. The model is never in the loop for
// the parts that must be exact.
//
// Message shape: { id, role, text, sources?, action?, error?, confirmed? }

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
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const conversationIdRef = useRef(getConversationId())

  const invoke = useCallback(async (body) => {
    const { data, error } = await supabase.functions.invoke('dekut-curry', { body })
    if (error) throw error
    return data
  }, [])

  const pushAssistant = useCallback((data) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.response,
        sources: data.sources || [],
        action: data.action || null,
      },
    ])
  }, [])

  const pushError = useCallback((text) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', text, error: true }])
  }, [])

  // Returns the assistant's reply text (or null on failure) — text-mode
  // callers ignore it; voice mode uses it to know what to speak.
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return null

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: trimmed }])
    setSending(true)

    const history = messages.slice(-8).map((m) => ({ role: m.role, message: m.text }))

    try {
      const data = await invoke({
        conversation_id: conversationIdRef.current,
        user_id: userId ?? null,
        message: trimmed,
        history,
      })
      pushAssistant(data)
      return data.response
    } catch (err) {
      console.error('Curry sendMessage failed:', err)
      pushError('I lost the connection there. Try that again in a moment.')
      return null
    } finally {
      setSending(false)
    }
  }, [messages, sending, userId, invoke, pushAssistant, pushError])

  // Structured, model-free request from a card:
  //   sendIntent({ intent: 'catering_draft', draft }, { userText: 'Order 2 × Chapati' })
  //
  // `userText` is optional and cosmetic — it drops the student's tap into
  // the transcript so the thread still reads like a conversation.
  // `replaceMessageId` marks the originating card as spent.
  const sendIntent = useCallback(async (payload, { userText, replaceMessageId } = {}) => {
    if (sending) return null
    if (userText) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: userText }])
    }
    if (replaceMessageId) {
      setMessages((prev) => prev.map((m) => (m.id === replaceMessageId ? { ...m, confirmed: true } : m)))
    }
    setSending(true)
    try {
      const data = await invoke({
        conversation_id: conversationIdRef.current,
        user_id: userId ?? null,
        user_text: userText ?? null,
        ...payload,
      })
      pushAssistant(data)
      return data.response
    } catch (err) {
      console.error('Curry sendIntent failed:', err)
      pushError("That didn't reach the kitchen. Try again in a moment.")
      return null
    } finally {
      setSending(false)
    }
  }, [sending, userId, invoke, pushAssistant, pushError])

  // Approves a CONFIRM_REQUIRED / CATERING_CONFIRM_REQUIRED action on a
  // specific message. The card is marked spent before the request goes
  // out, so a double tap can never place two orders.
  const confirmAction = useCallback(async (messageId, action) => {
    if (sending) return
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, confirmed: true } : m)))
    setSending(true)
    try {
      const data = await invoke({
        conversation_id: conversationIdRef.current,
        user_id: userId ?? null,
        confirm_tool: action.tool,
        confirm_args: action.args,
      })
      pushAssistant(data)
    } catch (err) {
      console.error('Curry confirmAction failed:', err)
      // Nothing was placed, so give the button back.
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, confirmed: false } : m)))
      pushError("That didn't go through, and nothing was ordered. Try confirming again.")
    } finally {
      setSending(false)
    }
  }, [sending, userId, invoke, pushAssistant, pushError])

  // Declining never touches the backend — nothing was submitted.
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
