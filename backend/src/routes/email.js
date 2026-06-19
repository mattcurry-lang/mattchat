const express = require('express')
const { sendEmailNotification } = require('../services/mailer')
const { createClient } = require('@supabase/supabase-js')

const router = express.Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * POST /email/send
 * Called by the frontend when a message is sent to an external/email-only user
 */
router.post('/send', async (req, res) => {
  try {
    const { conversationId, senderId, message } = req.body

    const { data: sender } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('id', senderId)
      .single()

    const { data: members } = await supabase
      .from('conversation_members')
      .select('user_id, profiles(email, username, is_external)')
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId)

    for (const member of members || []) {
      if (member.profiles?.is_external || member.profiles?.email) {
        await sendEmailNotification({
          toEmail: member.profiles.email,
          toName: member.profiles.username,
          fromUsername: sender.username,
          message,
          conversationId
        })
      }
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('Send email error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
