import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // ALWAYS handle OPTIONS first — before anything else
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: cors })
  }

  // Wrap everything in try/catch so CORS headers are ALWAYS returned
  try {
    const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY')
    const DAILY_BASE    = 'https://api.daily.co/v1'

    if (!DAILY_API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: 'DAILY_API_KEY secret is not set in Supabase Edge Function secrets' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Verify auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const { conversationId, callType } = await req.json()

    // Create Daily room
    const roomRes = await fetch(`${DAILY_BASE}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          exp: Math.floor(Date.now() / 1000) + 3600,
          enable_chat: false,
          enable_knocking: false,
          start_video_off: callType === 'audio',
          start_audio_off: false,
          max_participants: 2,
        },
      }),
    })

    const room = await roomRes.json()
    console.log('Daily room response:', JSON.stringify(room))

    if (!room.name) {
      return new Response(
        JSON.stringify({ ok: false, error: `Daily room creation failed: ${JSON.stringify(room)}` }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Create meeting token
    const tokenRes = await fetch(`${DAILY_BASE}/meeting-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: room.name,
          user_name: user.id,
          exp: Math.floor(Date.now() / 1000) + 3600,
          is_owner: true,
        },
      }),
    })
    const tokenData = await tokenRes.json()
    console.log('Daily token response:', JSON.stringify(tokenData))

    // Store call in Supabase
    const { error: insertErr } = await supabase.from('active_calls').insert({
      conversation_id: conversationId,
      room_name: room.name,
      room_url: room.url,
      call_type: callType,
      initiated_by: user.id,
      status: 'ringing',
    })

    if (insertErr) {
      console.error('Insert error:', insertErr)
      return new Response(
        JSON.stringify({ ok: false, error: `DB insert failed: ${insertErr.message}` }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, roomUrl: room.url, roomName: room.name, token: tokenData.token || null }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Unhandled error:', err)
    // Always return CORS headers even on crash
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
