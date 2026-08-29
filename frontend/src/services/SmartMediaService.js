// SmartMediaService.js
// Frontend wrapper for the smart-media-action stub. Every action
// currently resolves to { ok:false, reason:'not_implemented' } — wiring
// a real feature later only touches the edge function + this file.

import { supabase } from '../lib/supabase'

export async function runSmartMediaAction(assetId, action) {
  const { data, error } = await supabase.functions.invoke('smart-media-action', {
    body: { assetId, action },
  })
  if (error) {
    console.error('[SmartMediaService] invoke failed:', error)
    return { ok: false, reason: 'invoke_failed' }
  }
  return data
}

export const SMART_MEDIA_ACTIONS = [
  { id: 'extract_text', label: 'Extract text', mediaTypes: ['image'] },
  { id: 'summarize', label: 'Summarize', mediaTypes: ['image', 'document'] },
  { id: 'describe_image', label: 'Describe this image', mediaTypes: ['image'] },
  { id: 'ask_curry', label: 'Ask Curry about this', mediaTypes: ['image', 'video', 'document'] },
]
