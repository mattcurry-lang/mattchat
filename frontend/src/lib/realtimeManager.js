import { supabase } from './supabase'

/**
 * Centralized realtime manager.
 *
 * Supabase already multiplexes every channel over a single WebSocket —
 * the problem in this codebase wasn't a second socket per hook, it was:
 *
 *   1. Multiple hooks independently opening their OWN channel for
 *      overlapping data. Messages in particular had three separate
 *      subscriptions (useChat, useGlobalDelivery, useUnreadCounts),
 *      and useMessageStatus tore down and rebuilt a whole channel
 *      every time you switched conversations.
 *   2. Several channels subscribing to a table with NO filter at all
 *      (useStatuses, useCallHistory, useConversations' list channel),
 *      so every client reloaded its state on every OTHER user's
 *      activity anywhere on the platform.
 *   3. No shared reconnect/resync handling — if the socket dropped,
 *      each hook's channel went stale with no way to know it needed
 *      to refetch.
 *
 * This module fixes all three: one shared channel per logical topic
 * (deduped across every subscriber, regardless of how many components
 * ask for it), an explicit postgres_changes filter wherever the
 * schema allows one, and a single reconnect-with-backoff + resync
 * pathway every hook gets for free just by going through here.
 */

const registry = new Map()
let subCounter = 0

function openChannel(channelKey, buildChannel) {
  const entry = registry.get(channelKey)
  if (!entry) return

  const emit = (type, payload) => {
    entry.subs.forEach((sub) => {
      try { sub.onEvent?.(type, payload) }
      catch (e) { console.error(`[realtime:${channelKey}] handler error:`, e) }
    })
  }

  const channel = buildChannel(supabase.channel(channelKey), emit)
  entry.channel = channel

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      const wasReconnect = entry.retries > 0
      entry.retries = 0
      entry.status = 'subscribed'
      if (wasReconnect) {
        // Events that fired while we were disconnected are gone —
        // this is the hook's cue to refetch its own state.
        entry.subs.forEach((sub) => {
          try { sub.onResync?.() }
          catch (e) { console.error(`[realtime:${channelKey}] resync error:`, e) }
        })
      }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      entry.status = 'error'
      scheduleReconnect(channelKey, buildChannel)
    } else if (status === 'CLOSED') {
      entry.status = 'closed'
    }
  })
}

function scheduleReconnect(channelKey, buildChannel) {
  const entry = registry.get(channelKey)
  if (!entry || entry.subs.size === 0) return // nobody's listening — let it die, don't loop forever
  entry.retries += 1
  // Capped exponential backoff so a prolonged outage doesn't turn into
  // a reconnect-hammering loop against Supabase.
  const delay = Math.min(1000 * 2 ** entry.retries, 15000)
  entry.reconnectTimer = setTimeout(() => {
    const current = registry.get(channelKey)
    if (!current || current.subs.size === 0) return
    try { supabase.removeChannel(current.channel) } catch {}
    openChannel(channelKey, buildChannel)
  }, delay)
}

/**
 * subscribeToChannel(channelKey, buildChannel, { onEvent, onResync })
 *
 * - channelKey: stable string identifying the shared channel, e.g.
 *   `messages:${conversationId}` or `unread:${userId}:${idsKey}`.
 *   Every caller using the same key shares ONE underlying supabase
 *   channel — this is what eliminates duplicate subscriptions.
 * - buildChannel(rawChannel, emit): attach `.on(...)` listeners to
 *   rawChannel, calling `emit(type, payload)` inside each. Runs only
 *   ONCE per channelKey no matter how many subscribers come and go,
 *   so postgres_changes listeners never get registered twice for the
 *   same topic.
 * - onEvent(type, payload): fires for every event this topic emits.
 * - onResync(): fires once, after the channel recovers from a drop.
 *
 * Returns an unsubscribe function. The underlying channel tears down
 * automatically once its last subscriber unsubscribes.
 */
export function subscribeToChannel(channelKey, buildChannel, { onEvent, onResync } = {}) {
  let entry = registry.get(channelKey)
  if (!entry) {
    entry = { channel: null, subs: new Map(), retries: 0, status: 'connecting', reconnectTimer: null }
    registry.set(channelKey, entry)
    openChannel(channelKey, buildChannel)
  }

  const subId = ++subCounter
  entry.subs.set(subId, { onEvent, onResync })

  return () => {
    const current = registry.get(channelKey)
    if (!current) return
    current.subs.delete(subId)
    if (current.subs.size === 0) {
      clearTimeout(current.reconnectTimer)
      try { supabase.removeChannel(current.channel) } catch {}
      registry.delete(channelKey)
    }
  }
}

/** Raw channel handle for a topic that's already subscribed — used for
 * one-off sends (e.g. typing broadcasts), not for attaching new
 * listeners. Returns null if nothing's subscribed yet. */
export function getChannel(channelKey) {
  return registry.get(channelKey)?.channel || null
}
