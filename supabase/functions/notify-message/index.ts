// supabase/functions/notify-message/index.ts
//
// Sends a web push for every new chat message, after asking the database (notification_plan) whether each
// person should be notified: do not disturb, Focus modes, quiet hours, mentions-only and message previews.
//
// Called by a Database Webhook on INSERT into public.messages. See README.md for setup.
//
// SAFE BY DEFAULT: unless the secret DRY_RUN is set to the word "false", nothing is sent. The function only logs
// what it WOULD do (never the message text), so you can check it against your existing sender first.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { handleNewMessage, type Deps, type MessageRecord, type Plan } from './core.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WEBHOOK_SECRET = Deno.env.get('NOTIFY_WEBHOOK_SECRET') ?? ''
const DRY_RUN = (Deno.env.get('DRY_RUN') ?? 'true').toLowerCase() !== 'false'

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

let vapidReady = false
if (!DRY_RUN && VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  vapidReady = true
}

const deps: Deps = {
  async getConversation(id) {
    const { data } = await admin.from('conversations').select('is_group, name').eq('id', id).maybeSingle()
    return data ?? null
  },
  async getMemberIds(conversationId) {
    const { data } = await admin.from('conversation_members').select('user_id').eq('conversation_id', conversationId)
    return (data ?? []).map((r: { user_id: string }) => r.user_id)
  },
  async getUsername(userId) {
    const { data } = await admin.from('profiles').select('username').eq('id', userId).maybeSingle()
    return data?.username ?? null
  },
  async getPlan({ recipient, conversationId, text, senderId }) {
    const { data, error } = await admin.rpc('notification_plan', {
      p_recipient: recipient, p_conversation: conversationId, p_text: text, p_sender: senderId,
    })
    if (error || !data) { console.error('notification_plan failed', error?.message); return null }
    return { deliver: data.deliver !== false, preview: data.preview !== false, reason: data.reason ?? null } as Plan
  },
  async getSubscriptions(userIds) {
    const { data } = await admin.from('push_subscriptions').select('user_id, endpoint, p256dh, auth').in('user_id', userIds)
    return data ?? []
  },
  async send(sub, payload) {
    if (!vapidReady) return { ok: false }
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600, urgency: 'high' })
      return { ok: true }
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      return { ok: false, gone: status === 404 || status === 410 } // 404/410: the device unsubscribed for good
    }
  },
  async removeSubscription(endpoint) {
    await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
  },
  log(event) { console.log(JSON.stringify(event)) },
}

// compare secrets without leaking their length or content through timing
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a), y = enc.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!WEBHOOK_SECRET || !safeEqual(req.headers.get('x-webhook-secret') ?? '', WEBHOOK_SECRET)) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: { type?: string; table?: string; record?: MessageRecord }
  try { body = await req.json() } catch { return json({ error: 'bad request' }, 400) }
  if (body.type !== 'INSERT' || body.table !== 'messages' || !body.record) return json({ skipped: 'not a new message' })

  try {
    const summary = await handleNewMessage(deps, body.record, { dryRun: DRY_RUN })
    console.log(JSON.stringify({ messageId: body.record.id, ...summary }))
    return json(summary)
  } catch (err) {
    console.error('notify-message failed', (err as Error).message)
    return json({ error: 'internal error' }, 500)
  }
})
