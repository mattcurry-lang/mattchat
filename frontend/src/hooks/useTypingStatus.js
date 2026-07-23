import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

const TYPING_TTL_MS = 4000 // > the 1500ms stop-typing timeout in ChatPage, so it doesn't blink between keystrokes

/**
 * useTypingStatus
 * Tracks who's typing, across every conversation the user is in, using
 * ONE realtime channel (this was already the pattern here — good
 * design, kept as-is). Now goes through the shared manager so a
 * dropped connection re-runs the catch-up query on reconnect instead
 * of leaving stale/missing typing state.
 *
 * Returns { [conversationId]: typingUserId }.
 */
export function useTypingStatus(userId, conversationIds) {
  const [typingMap, setTypingMap] = useState({})
  const idsKey = conversationIds.slice().sort().join(',')
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

  const catchUp = useCallback(() => {
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

  useEffect(() => { catchUp() }, [catchUp])

  useEffect(() => {
    if (!userId || !conversationIds.length) return
    const filter = `conversation_id=in.(${conversationIds.join(',')})`
    const unsubscribe = subscribeToChannel(
      `typing:${userId}:${idsKey}`,
      (channel, emit) => channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'typing_status', filter }, (p) => emit('insert', p))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'typing_status', filter }, (p) => emit('update', p))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'typing_status', filter }, (p) => emit('delete', p)),
      {
        onEvent: (type, payload) => {
          if (type === 'delete') { clearRow(payload.old.conversation_id); return }
          if (payload.new.user_id === userId) return
          setRow(payload.new.conversation_id, payload.new.user_id)
        },
        onResync: catchUp,
      }
    )
    return () => {
      unsubscribe()
      Object.values(timersRef.current).forEach(clearTimeout)
    }
  }, [userId, idsKey, setRow, clearRow, catchUp])

  return typingMap
}
