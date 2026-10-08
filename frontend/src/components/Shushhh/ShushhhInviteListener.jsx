import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase' // <- adjust
import ShushhhExperience from './ShushhhExperience'
import { inboxTopic, parseRoomTopic, shushhhBusy } from './useShushhhRoom'

export default function ShushhhInviteListener({ me }) {
  const [incoming, setIncoming] = useState(null)

  useEffect(() => {
    if (!me) return undefined
    const ch = supabase.channel(inboxTopic(me), { config: { private: true, broadcast: { self: false } } })
    ch.on('broadcast', { event: 'invite' }, ({ payload }) => {
      const p = parseRoomTopic(payload?.topic)
      if (!p || p.b !== me || p.a !== payload.from || shushhhBusy.current) return
      setIncoming({ topic: payload.topic, fromId: payload.from })
    }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [me])

  return incoming
    ? <ShushhhExperience key={incoming.topic} me={me} incoming={incoming} onClose={() => setIncoming(null)} />
    : null
}
