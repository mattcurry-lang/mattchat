// src/lib/ecosystem/flowEngine.js
// Runs automations. Called by useFlowRunner when an event arrives and when
// the app comes back online / into view (to catch up on anything missed).
//
// Safety rails, in order, for every run:
//   1. claim      one run per (flow, event) across tabs and devices
//   2. consent    the action's app must be connected (Mattchat always is)
//   3. loop guard a flow can't reply into the conversation that triggered it
//   4. rate limit at most 30 runs per flow per hour
//   5. params     required inputs must be present after templating

import { supabase } from '../supabase'
import { getConnections } from './bus'
import { getActionDefinition } from './registry'
import { getActionRunner } from './actions'

const MAX_RUNS_PER_HOUR = 30
const STALE_RUNNING_MS = 2 * 60 * 1000
const CATCH_UP_WINDOW_MS = 24 * 60 * 60 * 1000

// ── pure helpers ─────────────────────────────────────────
export function renderTemplate(value, payload) {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => (payload?.[k] == null ? '' : String(payload[k])))
  }
  if (Array.isArray(value)) return value.map((v) => renderTemplate(v, payload))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, renderTemplate(v, payload)]))
  }
  return value
}

// trigger_filter is a plain equality map: { conversationId: '...' }
export function matchesFilter(filter, payload) {
  return Object.entries(filter || {}).every(([k, v]) => String(payload?.[k] ?? '') === String(v))
}

// ── run bookkeeping ──────────────────────────────────────
async function claimRun(flowId, eventId) {
  const { data, error } = await supabase.from('eco_flow_runs')
    .insert({ flow_id: flowId, event_id: eventId, status: 'running' }).select('id').single()
  if (!error) return data.id
  if (error.code !== '23505') {
    console.error('[ecosystem] claim failed:', error.message)
    return null
  }
  // Already claimed. Only take over if that claim went stale (tab closed mid-run).
  const cutoff = new Date(Date.now() - STALE_RUNNING_MS).toISOString()
  const { data: taken } = await supabase.from('eco_flow_runs')
    .update({ created_at: new Date().toISOString() })
    .eq('flow_id', flowId).eq('event_id', eventId).eq('status', 'running').lt('created_at', cutoff)
    .select('id')
  return taken?.[0]?.id || null
}

async function finishRun(runId, status, error = null) {
  const { error: e } = await supabase.from('eco_flow_runs')
    .update({ status, error: error ? String(error).slice(0, 300) : null }).eq('id', runId)
  if (e) console.error('[ecosystem] could not record run result:', e.message)
  return status
}

async function loadConnected(userId) {
  const rows = await getConnections(userId)
  return new Set(rows.filter((r) => r.status === 'active').map((r) => r.app_id))
}

// ── one flow, one event ──────────────────────────────────
export async function runFlow(flow, event, ctx) {
  const runId = await claimRun(flow.id, event.id)
  if (!runId) return 'claimed_elsewhere'
  const finish = (status, err) => finishRun(runId, status, err)

  try {
    const def = getActionDefinition(flow.action_type)
    if (!def) return finish('error', 'unknown_action')

    if (def.app.id !== 'mattchat' && !ctx.connected?.has(def.app.id)) {
      return finish('skipped', `app_not_connected:${def.app.id}`)
    }

    const params = renderTemplate(flow.action_params, event.payload)

    if (
      flow.action_type === 'message.send' && event.type === 'message.received' &&
      String(params.conversationId) === String(event.payload?.conversationId)
    ) {
      return finish('skipped', 'loop_guard')
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase.from('eco_flow_runs')
      .select('id', { count: 'exact', head: true }).eq('flow_id', flow.id).gte('created_at', hourAgo)
    if ((count || 0) > MAX_RUNS_PER_HOUR) return finish('skipped', 'rate_limited')

    const missing = def.action.params.find((p) => p.required && !params[p.key])
    if (missing) return finish('error', `missing_param:${missing.key}`)

    const runner = getActionRunner(flow.action_type)
    if (!runner) return finish('error', 'no_runner')

    const result = await runner(params, ctx)
    if (result && (result.ok === false || result.error)) return finish('error', result.error || 'action_failed')
    return finish('ok')
  } catch (e) {
    return finish('error', e?.message || e)
  }
}

// ── entry points ─────────────────────────────────────────
export async function processEvent(event, ctx) {
  const { data: flows, error } = await supabase.from('eco_flows').select('*')
    .eq('user_id', ctx.userId).eq('enabled', true).eq('trigger_event', event.type)
  if (error) { console.error('[ecosystem] flow lookup failed:', error.message); return }

  const matching = (flows || []).filter((f) => matchesFilter(f.trigger_filter, event.payload))
  if (!matching.length) return

  const connected = await loadConnected(ctx.userId)
  for (const flow of matching) await runFlow(flow, event, { ...ctx, connected })
}

// Re-check the last 24h of events for anything that never got a run
// (app was closed, device was offline, a tab died mid-run).
export async function catchUp(ctx) {
  const since = new Date(Date.now() - CATCH_UP_WINDOW_MS).toISOString()
  const [{ data: flows }, { data: events }] = await Promise.all([
    supabase.from('eco_flows').select('*').eq('user_id', ctx.userId).eq('enabled', true),
    supabase.from('eco_events').select('*').eq('user_id', ctx.userId).gte('created_at', since)
      .order('created_at', { ascending: true }).limit(200),
  ])
  if (!flows?.length || !events?.length) return

  const { data: runs } = await supabase.from('eco_flow_runs')
    .select('flow_id, event_id, status, created_at').in('flow_id', flows.map((f) => f.id)).gte('created_at', since)

  const freshCutoff = Date.now() - STALE_RUNNING_MS
  const done = new Set(
    (runs || [])
      .filter((r) => r.status !== 'running' || new Date(r.created_at).getTime() > freshCutoff)
      .map((r) => `${r.flow_id}:${r.event_id}`)
  )

  const connected = await loadConnected(ctx.userId)
  for (const event of events) {
    for (const flow of flows) {
      if (flow.trigger_event !== event.type) continue
      if (new Date(event.created_at) < new Date(flow.created_at)) continue   // a new flow never replays old events
      if (!matchesFilter(flow.trigger_filter, event.payload)) continue
      if (done.has(`${flow.id}:${event.id}`)) continue
      await runFlow(flow, event, { ...ctx, connected })
    }
  }
}
