// src/lib/ecosystem/flows.js
// Create / list / switch / delete automations ("when X happens, do Y").

import { supabase } from '../supabase'
import { getEventDefinition, getActionDefinition } from './registry'

export async function listFlows(userId) {
  const { data, error } = await supabase.from('eco_flows').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Params may use {{field}} placeholders filled from the triggering event,
// e.g. { taskId: '{{taskId}}', text: 'Confirmed: {{title}}' }.
export async function createFlow(userId, { name, triggerEvent, triggerFilter = {}, actionType, actionParams = {}, createdBy = 'user' }) {
  const trigger = getEventDefinition(triggerEvent)
  if (!trigger) throw new Error(`Unknown trigger "${triggerEvent}"`)
  const action = getActionDefinition(actionType)
  if (!action) throw new Error(`Unknown action "${actionType}"`)
  const missing = action.action.params.filter((p) => p.required && !actionParams[p.key]).map((p) => p.key)
  if (missing.length) throw new Error(`Missing action parameter(s): ${missing.join(', ')}`)

  const { data, error } = await supabase.from('eco_flows').insert({
    user_id: userId,
    name,
    trigger_event: triggerEvent,
    trigger_filter: triggerFilter,
    action_app: action.app.id,
    action_type: actionType,
    action_params: actionParams,
    created_by: createdBy,
  }).select().single()
  if (error) throw error
  return data
}

export async function setFlowEnabled(flowId, enabled) {
  const { error } = await supabase.from('eco_flows').update({ enabled }).eq('id', flowId)
  if (error) throw error
}

export async function deleteFlow(flowId) {
  const { error } = await supabase.from('eco_flows').delete().eq('id', flowId)
  if (error) throw error
}

// Most recent automation runs for the user's flows (with the flow's name).
export async function listRuns(limit = 30) {
  const { data, error } = await supabase.from('eco_flow_runs')
    .select('id, status, error, created_at, event_id, flow:eco_flows(name, trigger_event, action_type)')
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data || []
}
