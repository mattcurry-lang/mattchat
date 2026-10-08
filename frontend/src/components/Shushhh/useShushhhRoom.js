import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase' // <- adjust to your client path

// Lets other parts of the app (e.g. ProfileMenuSheet back handler) know Shushhh owns history right now.
export const shushhhBusy = { current: false }

export const inboxTopic = (uid) => `shushhh:inbox:${uid}`
export const makeRoomTopic = (a, b) => `shushhh:room:${a}:${b}:${crypto.randomUUID()}`
export const parseRoomTopic = (t) => {
  const [ns, kind, a, b, nonce] = String(t).split(':')
  return ns === 'shushhh' && kind === 'room' && a && b && nonce ? { a, b, nonce } : null
}

function subscribeOnce(ch, ms = 6000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    ch.subscribe((s) => {
      if (s === 'SUBSCRIBED') { clearTimeout(t); resolve() }
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { clearTimeout(t); reject(new Error(s)) }
    })
  })
}

export async function sendInvite({ to, topic, from }) {
  const ch = supabase.channel(inboxTopic(to), { config: { private: true } })
  try {
    await subscribeOnce(ch)
    const r = await ch.send({ type: 'broadcast', event: 'invite', payload: { topic, from } })
    return r === 'ok'
  } catch {
    return false
  } finally {
    supabase.removeChannel(ch)
  }
}

export function useShushhhRoom({ topic, me, peerId, active }) {
  const [messages, setMessages] = useState([])
  const [peerHere, setPeerHere] = useState(false)
  const [peerLeft, setPeerLeft] = useState(false)
  const [conn, setConn] = useState('connecting') // connecting | ready | error
  const chRef = useRef(null)

  useEffect(() => {
    if (!active || !topic || !peerId) return undefined
    let closed = false
    setConn('connecting')

    const ch = supabase.channel(topic, {
      config: { private: true, broadcast: { self: false, ack: true }, presence: { key: me } },
    })
    chRef.current = ch

    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      if (!payload || payload.from !== peerId || typeof payload.text !== 'string') return
      setMessages((m) => [...m, { id: String(payload.id), from: peerId, text: payload.text.slice(0, 2000), ts: Date.now() }])
    })
      .on('broadcast', { event: 'left' }, ({ payload }) => { if (payload?.from === peerId) setPeerLeft(true) })
      .on('presence', { event: 'sync' }, () => setPeerHere(Boolean(ch.presenceState()[peerId]?.length)))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') { await ch.track({ at: Date.now() }); setConn('ready') }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConn('error')
      })

    const teardown = () => {
      if (closed) return
      closed = true
      chRef.current = null
      Promise.resolve(ch.send({ type: 'broadcast', event: 'left', payload: { from: me } }))
        .catch(() => {})
        .finally(() => supabase.removeChannel(ch))
      setMessages([]); setPeerHere(false); setPeerLeft(false)
    }
    window.addEventListener('pagehide', teardown)
    return () => { window.removeEventListener('pagehide', teardown); teardown() }
  }, [active, topic, me, peerId])

  const send = useCallback(async (text) => {
    const ch = chRef.current
    const t = (text || '').trim()
    if (!ch || !t) return
    const id = crypto.randomUUID()
    setMessages((m) => [...m, { id, from: me, text: t, ts: Date.now(), state: 'sending' }])
    let res = 'error'
    try { res = await ch.send({ type: 'broadcast', event: 'msg', payload: { id, from: me, text: t } }) } catch { /* noop */ }
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, state: res === 'ok' ? 'sent' : 'failed' } : x)))
  }, [me])

  return { messages, peerHere, peerLeft, conn, send }
}
