import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToChannel } from '../lib/realtimeManager'

// FIX: previously listened to ALL rows in `active_calls` unfiltered —
// every user's app reloaded its full call history on every OTHER
// user's call activity anywhere on the platform. Now filtered to this
// user's actual conversation ids, same as useGlobalDelivery/useUnreadCounts.
export function useCallHistory(userId, conversations) {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)

  const convoIds = (conversations || []).map(c => c.id)
  const idsKey = convoIds.slice().sort().join(',')

  const load = useCallback(async () => {
    if (!userId || !conversations || conversations.length === 0) { setCalls([]); setLoading(false); return }
    const { data: hidden } = await supabase.from('hidden_calls').select('call_id').eq('user_id', userId)
   const hiddenIds = new Set((hidden || []).map(h => h.call_id))
    const { data, error } = await supabase
      .from('active_calls')
      .select('*')
      .in('conversation_id', convoIds)
      .in('status', ['ended', 'missed', 'declined'])
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) { console.error('load call history failed:', error); setLoading(false); return }
    const convoById = Object.fromEntries(conversations.map(c => [c.id, c]))
    const rows = (data || []).filter(call => !hiddenIds.has(call.id)).map(call => {
      const convo = convoById[call.conversation_id]
      const other = convo?.conversation_members?.find(m => m.user_id !== userId)
      return {
        ...call,
        outgoing: call.initiated_by === userId,
        convoName: convo?.is_group ? convo.name : (other?.profiles?.username || other?.profiles?.email || 'Unknown'),
      }
    })
    setCalls(rows)
    setLoading(false)
  }, [userId, conversations, idsKey])

  const hideCall = useCallback(async (callId) => {
    if (!userId) return
    const { error } = await supabase.from('hidden_calls').upsert({ user_id: userId, call_id: callId })
    if (error) { console.error('hideCall failed:', error); return }
    setCalls(prev => prev.filter(c => c.id !== callId))
  }, [userId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!userId || !convoIds.length) return
    const unsubscribe = subscribeToChannel(
      `active_calls:${userId}:${idsKey}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'active_calls',
        filter: `conversation_id=in.(${convoIds.join(',')})`,
      }, (payload) => emit('change', payload)),
      { onEvent: load, onResync: load }
    )
    return unsubscribe
  }, [userId, idsKey, load])

return { calls, loading, reload: load, hideCall }
}
