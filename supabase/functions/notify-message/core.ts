// The logic of the new-message push sender, with everything outside it (database, push service) injected,
// so it can be tested without a network. index.ts wires the real thing.

export type MessageRecord = {
  id: string
  conversation_id: string
  sender_id: string | null
  content: string | null
  message_type?: string | null
}

export type Plan = { deliver: boolean; preview: boolean; reason: string | null }
export type Sub = { endpoint: string; p256dh: string; auth: string; user_id: string }
export type SendResult = { ok: boolean; gone?: boolean }

export interface Deps {
  getConversation(id: string): Promise<{ is_group: boolean | null; name: string | null } | null>
  getMemberIds(conversationId: string): Promise<string[]>
  getUsername(userId: string): Promise<string | null>
  /** notification_plan() in the database. Return null if it failed: the sender then fails open. */
  getPlan(args: { recipient: string; conversationId: string; text: string; senderId: string }): Promise<Plan | null>
  getSubscriptions(userIds: string[]): Promise<Sub[]>
  send(sub: Sub, payload: string): Promise<SendResult>
  removeSubscription(endpoint: string): Promise<void>
  log(event: Record<string, unknown>): void
}

export type Options = { dryRun?: boolean; maxPreviewChars?: number; concurrency?: number }

export type Summary = {
  skipped?: string
  dryRun: boolean
  recipients: number
  quiet: Record<string, number>
  sent: number
  failed: number
  removed: number
}

const GENERIC = { title: 'Mattchat', body: 'New message' }

// What a message looks like in a notification. Mirrors the chat list preview in the app.
export function previewText(record: Pick<MessageRecord, 'content' | 'message_type'>, maxChars = 120): string {
  const type = record.message_type || 'text'
  const content = (record.content || '').trim()

  const byType: Record<string, string> = {
    voice: '🎤 Voice message', media: '📎 Attachment', poll: '📊 Poll', task: '✅ Task', location: '📍 Location',
    contact: '👤 Contact', music: '🎵 Song', short: '📹 Short', moment: '✨ Moment', eco_card: '🧩 Shared a card',
  }
  if (byType[type]) return byType[type]

  if (content.startsWith('sticker:')) return `${content.replace('sticker:', '').split(':')[0] || '😊'} Sticker`
  if (content.startsWith('gif:')) return 'GIF'
  if (content.startsWith('pinterest:')) return '📌 Pin'
  if (content.startsWith('drawing:')) return '🎨 Drawing'
  if (content.startsWith('partner_nudge:')) return '💗 Sent with care'
  if (content.startsWith('status_reply:')) return 'Replied to your status'
  if (content.startsWith('short:')) return '📹 Short'

  const oneLine = content.replace(/\s+/g, ' ')
  if (!oneLine) return 'New message'
  return oneLine.length > maxChars ? `${oneLine.slice(0, maxChars - 1).trimEnd()}…` : oneLine
}

// Calls are announced by their own notifications, and Curry's replies are not messages from a person.
export function shouldSkipMessage(record: MessageRecord): string | null {
  if (!record.sender_id) return 'no sender'
  if (record.message_type === 'curry') return 'curry message'
  const c = record.content || ''
  if (c.startsWith('call_log:') || c.startsWith('missed_call:')) return 'call log'
  return null
}

export function buildPayload(args: {
  plan: Plan
  record: MessageRecord
  senderName: string | null
  conversation: { is_group: boolean | null; name: string | null } | null
  maxChars?: number
}): string {
  const { plan, record, senderName, conversation, maxChars } = args
  let shown = GENERIC
  if (plan.preview) {
    const text = previewText(record, maxChars)
    shown = conversation?.is_group
      ? { title: conversation.name || 'Group chat', body: `${senderName || 'Someone'}: ${text}` }
      : { title: senderName || 'New message', body: text }
  }
  return JSON.stringify({
    ...shown,
    tag: record.conversation_id,
    data: { type: 'message', conversationId: record.conversation_id, messageId: record.id, url: '/' },
  })
}

async function inChunks<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn))
}

export async function handleNewMessage(deps: Deps, record: MessageRecord, options: Options = {}): Promise<Summary> {
  const dryRun = !!options.dryRun
  const summary: Summary = { dryRun, recipients: 0, quiet: {}, sent: 0, failed: 0, removed: 0 }

  const skip = shouldSkipMessage(record)
  if (skip) return { ...summary, skipped: skip }

  const senderId = record.sender_id as string
  const members = await deps.getMemberIds(record.conversation_id)
  const recipients = [...new Set(members)].filter((id) => id !== senderId)
  summary.recipients = recipients.length
  if (recipients.length === 0) return summary

  const [conversation, senderName] = await Promise.all([deps.getConversation(record.conversation_id), deps.getUsername(senderId)])

  // 1. ask the database, per person, whether and how to notify them
  const plans = new Map<string, Plan>()
  await inChunks(recipients, options.concurrency ?? 10, async (recipient) => {
    let plan: Plan | null = null
    try {
      plan = await deps.getPlan({ recipient, conversationId: record.conversation_id, text: record.content || '', senderId })
    } catch { plan = null }
    // if the rules could not be read, send as normal: a bug must never silence real messages
    plans.set(recipient, plan ?? { deliver: true, preview: true, reason: null })
  })

  const toNotify: string[] = []
  for (const recipient of recipients) {
    const plan = plans.get(recipient) as Plan
    if (plan.deliver) toNotify.push(recipient)
    else summary.quiet[plan.reason || 'quiet'] = (summary.quiet[plan.reason || 'quiet'] || 0) + 1
  }
  if (toNotify.length === 0) return summary

  // 2. send to every device of everyone who should be notified
  const subs = await deps.getSubscriptions(toNotify)
  await inChunks(subs, options.concurrency ?? 10, async (sub) => {
    const plan = plans.get(sub.user_id) as Plan
    const payload = buildPayload({ plan, record, senderName, conversation, maxChars: options.maxPreviewChars })
    if (dryRun) {
      // log the decision, never the message text
      deps.log({ dryRun: true, recipient: sub.user_id, preview: plan.preview, would: 'send' })
      summary.sent += 1
      return
    }
    try {
      const result = await deps.send(sub, payload)
      if (result.ok) summary.sent += 1
      else if (result.gone) { await deps.removeSubscription(sub.endpoint); summary.removed += 1 }
      else summary.failed += 1
    } catch {
      summary.failed += 1
    }
  })

  return summary
}
