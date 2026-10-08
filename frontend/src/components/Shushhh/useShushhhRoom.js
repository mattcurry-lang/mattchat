import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Lets other parts of the app (e.g. ProfileMenuSheet back handler) know Shushhh owns history right now.
export const shushhhBusy = { current: false }

export const inboxTopic = (uid) => `shushhh:inbox:${uid}`
export const makeRoomTopic = (a, b) => `shushhh:room:${a}:${b}:${crypto.randomUUID()}`
export const parseRoomTopic = (t) => {
  const [ns, kind, a, b, nonce] = String(t).split(':')
  return ns === 'shushhh' && kind === 'room' && a && b && nonce ? { a, b, nonce } : null
}

// Private channels need the current JWT on the realtime socket.
export async function ensureRealtimeAuth() {
  try {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) supabase.realtime.setAuth(data.session.access_token)
  } catch { /* non-fatal */ }
}

function subscribeOnce(ch, ms = 7000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    ch.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') { clearTimeout(t); resolve() }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(t)
        reject(new Error(`${status}${err?.message ? ': ' + err.message : ''}`))
      }
    })
  })
}

// One channel to the recipient's inbox, reused for every invite retry.
export async function openInviter(to) {
  await ensureRealtimeAuth()
  const ch = supabase.channel(inboxTopic(to), { config: { private: true } })
  try {
    await subscribeOnce(ch)
  } catch (e) {
    supabase.removeChannel(ch)
    throw e
  }
  return {
    send: (payload) => ch.send({ type: 'broadcast', event: 'invite', payload }),
    close: () => supabase.removeChannel(ch),
  }
}

// People you share a 1:1 chat with (conversations with exactly 2 members).
export async function loadChatContacts(me) {
  const { data: mine, error: e1 } = await supabase
    .from('conversation_members').select('conversation_id').eq('user_id', me)
  if (e1) throw e1
  const convIds = [...new Set((mine || []).map((r) => r.conversation_id))].slice(0, 300)
  if (!convIds.length) return []

  const { data: members, error: e2 } = await supabase
    .from('conversation_members').select('conversation_id, user_id').in('conversation_id', convIds)
  if (e2) throw e2

  const byConv = {}
  ;(members || []).forEach((m) => { (byConv[m.conversation_id] ||= []).push(m.user_id) })
  const peerIds = new Set()
  Object.values(byConv).forEach((users) => {
    if (users.length === 2) { const other = users.find((u) => u !== me); if (other) peerIds.add(other) }
  })
  if (!peerIds.size) return []

  const { data: profs, error: e3 } = await supabase
    .from('profiles').select('id, username, avatar_url').in('id', [...peerIds])
  if (e3) throw e3
  return (profs || [])
    .filter((p) => p.username && p.username.toLowerCase() !== 'curry') // the AI can't join a live room
    .sort((a, b) => a.username.localeCompare(b.username))
}

// ---- rooms ----
// Kept outside React so a StrictMode remount reuses the channel instead of killing it.
const live = new Map() // topic -> { ch, timer }

function closeRoom(topic, me) {
  const e = live.get(topic)
  if (!e) return
  live.delete(topic)
  clearTimeout(e.timer)
  Promise.resolve(e.ch.send({ type: 'broadcast', event: 'left', payload: { from: me } }))
    .catch(() => {})
    .finally(() => supabase.removeChannel(e.ch))
}

export function useShushhhRoom({ topic, me, peerId, active }) {
  const [messages, setMessages] = useState([])
  const [peerHere, setPeerHere] = useState(false)
  const [peerLeft, setPeerLeft] = useState(false)
  const [conn, setConn] = useState('connecting') // connecting | ready | error
  const [error, setError] = useState('')
  const chRef = useRef(null)

  useEffect(() => {
    if (!active || !topic || !peerId) return undefined

    let entry = live.get(topic)
    if (entry) {
      clearTimeout(entry.timer)
      entry.timer = null
      if (entry.ch.state === 'joined') setConn('ready')
    } else {
      setConn('connecting'); setError('')
      const ch = supabase.channel(topic, {
        config: { private: true, broadcast: { self: false, ack: true }, presence: { key: me } },
      })
      entry = { ch, timer: null }
      live.set(topic, entry)

      ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
        if (!payload || payload.from !== peerId || typeof payload.text !== 'string') return
        setMessages((m) => [...m, { id: String(payload.id), from: peerId, text: payload.text.slice(0, 2000), ts: Date.now() }])
      })
        .on('broadcast', { event: 'left' }, ({ payload }) => { if (payload?.from === peerId) setPeerLeft(true) })
        .on('presence', { event: 'sync' }, () => setPeerHere(Boolean(ch.presenceState()[peerId]?.length)))

      ensureRealtimeAuth().then(() => {
        if (live.get(topic)?.ch !== ch) return
        ch.subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED') { await ch.track({ at: Date.now() }); setConn('ready') }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConn('error')
            setError(`${status}${err?.message ? ': ' + err.message : ''}`)
            console.warn('[Shushhh] room', status, err?.message || '')
          }
        })
      })
    }
    chRef.current = entry.ch

    const onHide = () => closeRoom(topic, me)
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      setMessages([]); setPeerHere(false); setPeerLeft(false) // wipe immediately
      chRef.current = null
      entry.timer = setTimeout(() => closeRoom(topic, me), 100) // deferred so a remount can reuse it
    }
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

  return { messages, peerHere, peerLeft, conn, error, send }
}
