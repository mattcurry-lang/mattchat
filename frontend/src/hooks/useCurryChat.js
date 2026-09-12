// src/hooks/useCurryChat.js
//
// Chat state for "Ask Curry" (DeKUT Hub's AI assistant — Phase 1: RAG
// knowledge base + chat only, no tools/navigation yet). Talks to the
// `dekut-curry` edge function, which is a separate instance from the
// main curry-ai assistant elsewhere in Mattchat.

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
  const [messages, setMessages] = useState([]) // { id, role: 'user'|'assistant', text, sources?, error? }
  const [sending, setSending] = useState(false)
  const conversationIdRef = useRef(getConversationId())

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    const userMsg = { id: crypto.randomUUID(), role: 'user', text: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)

    // Short-term memory: send recent turns so Curry can resolve things
    // like "how long will it take?" referring to the previous answer.
    const history = messages.slice(-8).map((m) => ({ role: m.role, message: m.text }))

    try {
      const { data, error } = await supabase.functions.invoke('dekut-curry', {
        body: {
          conversation_id: conversationIdRef.current,
          user_id: userId ?? null,
          message: trimmed,
          history,
        },
      })
      if (error) throw error

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: data.response, sources: data.sources || [] },
      ])
    } catch (err) {
      console.error('Curry sendMessage failed:', err)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: "Something went wrong reaching Curry. Please try again in a moment.",
          error: true,
        },
      ])
    } finally {
      setSending(false)
    }
  }, [messages, sending, userId])

  const resetConversation = useCallback(() => {
    sessionStorage.removeItem(CONVERSATION_KEY)
    conversationIdRef.current = getConversationId()
    setMessages([])
  }, [])

  return { messages, sending, sendMessage, resetConversation }
}
