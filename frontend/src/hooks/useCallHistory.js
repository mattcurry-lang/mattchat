import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Reuses the `conversations` list you already loaded (via useConversations)
// to attach the other member's profile without a second round trip.
export function useCallHistory(userId, conversations) {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId || !conversations || conversations.length === 0) { setCalls([]); setLoading(false); return }
    const convoIds = conversations.map(c => c.id)
    const { data, error } = await supabase
      .from('active_calls')
      .select('*')
      .in('conversation_id', convoIds)
      .in('status', ['ended', 'missed', 'declined'])
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) { console.error('load call history failed:', error); setLoading(false); return }

    const convoById = Object.fromEntries(conversations.map(c => [c.id, c]))
    const rows = (data || []).map(call => {
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
  }, [userId, conversations])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('call-history-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_calls' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId, load])

  return { calls, loading, reload: load }
}
