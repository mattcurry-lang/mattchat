import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ShushhhExperience from './ShushhhExperience'
import { ensureRealtimeAuth, inboxTopic, parseRoomTopic, shushhhBusy } from './useShushhhRoom'

// Module-level so a StrictMode remount reuses the same channel.
let inbox = null // { me, ch, timer, onInvite }

export default function ShushhhInviteListener({ me }) {
  const [incoming, setIncoming] = useState(null)
  const handled = useRef(new Set())

  useEffect(() => {
    if (!me) return undefined

    if (inbox && inbox.me === me) {
      clearTimeout(inbox.timer)
      inbox.timer = null
    } else {
      if (inbox) { supabase.removeChannel(inbox.ch); inbox = null }
      const ch = supabase.channel(inboxTopic(me), { config: { private: true, broadcast: { self: false } } })
      const entry = { me, ch, timer: null, onInvite: null }
      inbox = entry
      ch.on('broadcast', { event: 'invite' }, (msg) => entry.onInvite?.(msg.payload))
      ensureRealtimeAuth().then(() => {
        if (inbox !== entry) return
        ch.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') console.info('[Shushhh] inbox ready')
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[Shushhh] inbox', status, err?.message || '')
        })
      })
    }

    const cur = inbox
    cur.onInvite = (payload) => {
      const p = parseRoomTopic(payload?.topic)
      if (!p || p.b !== me || p.a !== payload.from) return
      if (handled.current.has(payload.topic) || shushhhBusy.current) return
      console.info('[Shushhh] invite received')
      handled.current.add(payload.topic)
      setIncoming({ topic: payload.topic, fromId: payload.from })
    }

    return () => {
      cur.onInvite = null
      cur.timer = setTimeout(() => {
        if (inbox === cur) { supabase.removeChannel(cur.ch); inbox = null }
      }, 150)
    }
  }, [me])

  return incoming
    ? <ShushhhExperience key={incoming.topic} me={me} incoming={incoming} onClose={() => setIncoming(null)} />
    : null
}
