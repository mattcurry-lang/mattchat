import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const TYPING_TTL_MS = 4000 // > the 1500ms stop-typing timeout in ChatPage, so it doesn't blink between keystrokes

/**
 * useTypingStatus
 * Tracks who's typing, across every conversation the user is in, using
 * ONE realtime channel (not one per conversation). Backed by the
 * typing_status table, which useChat's broadcastTyping keeps in sync.
 *
 * Returns { [conversationId]: typingUserId }.
 */
export function useTypingStatus(userId, conversationIds) {
  const [typingMap, setTypingMap] = useState({})
  const idsKey = conversationIds.join(',')
  const timersRef = useRef({})

  const setRow = useCallback((conversationId, typingUserId) => {
    setTypingMap(prev => ({ ...prev, [conversationId]: typingUserId }))
    clearTimeout(timersRef.current[conversationId])
    timersRef.current[conversationId] = setTimeout(() => {
      setTypingMap(prev => {
        if (prev[conversationId] !== typingUserId) return prev
        const next = { ...prev }
        delete next[conversationId]
        return next
      })
    }, TYPING_TTL_MS)
  }, [])

  const clearRow = useCallback((conversationId) => {
    clearTimeout(timersRef.current[conversationId])
    setTypingMap(prev => {
      if (!(conversationId in prev)) return prev
      const next = { ...prev }
      delete next[conversationId]
      return next
    })
  }, [])

  // Catch-up: pick up anyone already mid-typing when the app loads.
  useEffect(() => {
    if (!userId || !conversationIds.length) { setTypingMap({}); return }
    const cutoff = new Date(Date.now() - TYPING_TTL_MS).toISOString()
    supabase
      .from('typing_status')
      .select('conversation_id, user_id, updated_at')
      .in('conversation_id', conversationIds)
      .neq('user_id', userId)
      .gt('updated_at', cutoff)
      .then(({ data, error }) => {
        if (error) { console.error('[useTypingStatus] initial load failed:', error); return }
        ;(data || []).forEach(row => setRow(row.conversation_id, row.user_id))
      })
  }, [userId, idsKey, setRow])

  // Live updates, one channel total.
  useEffect(() => {
    if (!userId || !conversationIds.length) return
    const filter = `conversation_id=in.(${conversationIds.join(',')})`
    const channel = supabase
      .channel(`typing:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'typing_status', filter }, (payload) => {
        if (payload.new.user_id === userId) return
        setRow(payload.new.conversation_id, payload.new.user_id)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'typing_status', filter }, (payload) => {
        if (payload.new.user_id === userId) return
        setRow(payload.new.conversation_id, payload.new.user_id)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'typing_status', filter }, (payload) => {
        clearRow(payload.old.conversation_id)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      Object.values(timersRef.current).forEach(clearTimeout)
    }
  }, [userId, idsKey, setRow, clearRow])

  return typingMap
}
