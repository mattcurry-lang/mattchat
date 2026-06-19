const express = require('express')
const multer = require('multer')
const { simpleParser } = require('mailparser')
const { createClient } = require('@supabase/supabase-js')

const router = express.Router()
const upload = multer()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * POST /webhook/inbound-email
 * Handles inbound email from SendGrid Inbound Parse
 * Set your SendGrid inbound parse webhook to: https://yourdomain.com/webhook/inbound-email
 */
router.post('/inbound-email', upload.any(), async (req, res) => {
  try {
    const rawEmail = req.body.email
    const parsed = rawEmail ? await simpleParser(rawEmail) : null

    const to = (parsed?.to?.value?.[0]?.address || req.body.to || '').toLowerCase()
    const from = parsed?.from?.value?.[0]?.address || req.body.from || ''
    const fromName = parsed?.from?.value?.[0]?.name || from
    let body = parsed?.text || req.body.text || ''

    // Strip quoted reply chains
    body = body.split(/^On .+ wrote:/m)[0].trim()
    body = body.split(/^-{3,}/m)[0].trim()

    if (!body || !to || !from) {
      return res.status(200).send('OK')
    }

    // to address format: matt+username@yourdomain.com
    const toUsernameMatch = to.match(/matt\+(.+?)@/)
    if (!toUsernameMatch) return res.status(200).send('OK')

    const toUsername = toUsernameMatch[1]

    // Resolve recipient profile
    const { data: toProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', toUsername)
      .single()

    if (!toProfile) return res.status(200).send('OK')

    // Resolve or create sender profile
    let { data: fromProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', from)
      .single()

    if (!fromProfile) {
      // Create a guest profile for the external sender
      const { data: newUser } = await supabase.auth.admin.createUser({
        email: from,
        email_confirm: true,
        user_metadata: { username: fromName || from.split('@')[0], is_external: true }
      })
      if (newUser?.user) {
        fromProfile = { id: newUser.user.id }
      } else {
        return res.status(200).send('OK')
      }
    }

    // Find or create conversation
    const { data: existingMembers } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .in('user_id', [fromProfile.id, toProfile.id])

    const convoIds = existingMembers?.map(m => m.conversation_id) || []
    let conversationId = null

    for (const cid of [...new Set(convoIds)]) {
      const { data: members } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', cid)

      const ids = members.map(m => m.user_id)
      if (ids.includes(fromProfile.id) && ids.includes(toProfile.id) && ids.length === 2) {
        conversationId = cid
        break
      }
    }

    if (!conversationId) {
      const { data: newConvo } = await supabase
        .from('conversations')
        .insert({ is_group: false, updated_at: new Date().toISOString() })
        .select()
        .single()

      conversationId = newConvo.id
      await supabase.from('conversation_members').insert([
        { conversation_id: conversationId, user_id: fromProfile.id },
        { conversation_id: conversationId, user_id: toProfile.id }
      ])
    }

    // Insert message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: fromProfile.id,
      content: body,
      is_email: true
    })

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString(), last_message: body.slice(0, 100) })
      .eq('id', conversationId)

    res.status(200).send('OK')
  } catch (err) {
    console.error('Inbound email error:', err)
    res.status(200).send('OK') // Always 200 to prevent retries
  }
})

module.exports = router
