// src/lib/ecosystem/emailTasks.js
// Turn an email (by its id) into a normal pending task, linked to the email so
// the Tasks screen shows "from <sender>" and its Open email button, exactly like
// tasks the scanner makes. RLS allows inserting only your own rows.

import { supabase } from '../supabase'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function createTaskFromEmail(userId, { title, emailId, senderName } = {}) {
  const cleanTitle = String(title ?? '').trim().slice(0, 140) || '(no subject)'
  const sourceEmailId = UUID.test(String(emailId ?? '')) ? String(emailId) : null

  if (sourceEmailId) {
    const { data, error } = await supabase.from('ai_tasks').select('id')
      .eq('user_id', userId).eq('source_email_id', sourceEmailId).limit(1)
    if (error) throw error
    if (data?.length) return { added: false, already: true }    // a task for this email already exists
  }

  const from = String(senderName ?? '').trim().slice(0, 80)
  const { error } = await supabase.from('ai_tasks').insert({
    user_id: userId,
    title: cleanTitle,
    description: from ? `Added by an Ecosystem flow from an email from ${from}` : 'Added by an Ecosystem flow',
    status: 'pending',                       // you confirm it yourself
    source: sourceEmailId ? 'email' : 'manual',
    source_email_id: sourceEmailId,
  })
  if (error) throw error
  return { added: true, already: false }
}
