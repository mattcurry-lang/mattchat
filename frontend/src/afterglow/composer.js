// afterglow/composer.js
// Mirrors CURRY_TRIGGER in ChatPage.js, so the button turns into Curry in
// exactly the cases where sending would actually go to Curry.
const CURRY_TRIGGER = /^hey\s+curry[,:]?\s*/i

/**
 * What the capsule's action button should be:
 *   'mic'   – nothing typed: tap to record a voice note
 *   'send'  – a normal message
 *   'curry' – the message is addressed to Curry (or you're in Curry's own chat)
 */
export function composerMode(text, { alwaysCurry = false } = {}) {
  const t = (text || '').trim()
  if (!t) return 'mic'
  if (alwaysCurry || CURRY_TRIGGER.test(t)) return 'curry'
  return 'send'
}
