// lib/partnerSupport.js
// Content for the partner-facing support card. Framed around
// "how to be supportive" and "what she might appreciate right now" —
// deliberately NOT mood-policing ("what not to do to avoid upsetting
// her"). Generic, respectful, and based on phase/status only — never
// on her private mood/symptom logs, which partners never see anyway.

export const PARTNER_PHASE_TIPS = {
  menstrual: {
    headline: 'She may appreciate lower-key plans right now.',
    tips: [
      'A low-pressure evening (takeout, a show, staying in) can be a nice option.',
      'Offering a warm drink or checking if she wants anything is a small, thoughtful gesture.',
      'Some people like extra rest during this time — no need to make plans that require a lot of energy.',
    ],
  },
  follicular: {
    headline: 'Energy may be picking up for her.',
    tips: [
      'This can be a good window for more active plans if she\'s up for it.',
      'A nice time to make plans together for the days ahead.',
    ],
  },
  ovulation: {
    headline: 'This is an estimated window, not a guarantee.',
    tips: [
      'Nothing specific needed here — just business as usual.',
      'A good time for social plans if you both feel like it.',
    ],
  },
  luteal: {
    headline: 'Her period may be approaching in the next few days.',
    tips: [
      'Checking in with a simple "how are you feeling?" goes a long way.',
      'Some people appreciate a bit more patience or quiet time in this window — everyone\'s different.',
      'A small thoughtful gesture (see below) can be a nice way to show you\'re thinking of her.',
    ],
  },
  // Fallback for Level 2 (Support tier) — no phase data available,
  // just the "approaching period" boolean.
  approaching: {
    headline: 'Her period may be approaching.',
    tips: [
      'A simple check-in — "need anything?" — is always a good move.',
      'No need to guess at specifics; just being present and attentive helps.',
    ],
  },
  generic: {
    headline: 'Thanks for being someone she trusts.',
    tips: [
      'Being attentive and asking what she needs is always appreciated, any time of the cycle.',
    ],
  },
}

// Comfort/gift ideas — reframed for the PARTNER to go get, not for
// her to eat herself. Each has a suggested place-search category so
// the "find nearby" button knows what to search for.
export const GIFT_IDEAS = {
  menstrual: [
    { id: 'heating_pad', emoji: '🔥', label: 'A heating pad', note: 'Comforting for cramps.', searchCategory: 'pharmacy' },
    { id: 'chocolate', emoji: '🍫', label: 'Her favorite chocolate', note: 'A small treat goes a long way.', searchCategory: 'grocery or convenience store' },
    { id: 'flowers', emoji: '💐', label: 'Flowers', note: 'A classic, thoughtful gesture.', searchCategory: 'florist' },
    { id: 'tea', emoji: '🫖', label: 'Ginger or herbal tea', note: 'Warm and comforting.', searchCategory: 'grocery store' },
    { id: 'painkillers', emoji: '💊', label: 'Pain relief (check what she prefers)', note: 'Worth asking first — everyone has a preference.', searchCategory: 'pharmacy' },
  ],
  luteal: [
    { id: 'snack', emoji: '🍿', label: 'Her favorite snack', note: 'Simple and appreciated.', searchCategory: 'grocery store' },
    { id: 'flowers', emoji: '💐', label: 'Flowers', note: 'A thoughtful surprise.', searchCategory: 'florist' },
    { id: 'takeout', emoji: '🍽', label: 'Order her favorite food', note: 'One less thing for her to think about.', searchCategory: 'restaurant' },
  ],
  generic: [
    { id: 'flowers', emoji: '💐', label: 'Flowers', note: 'Never a bad idea.', searchCategory: 'florist' },
    { id: 'snack', emoji: '🍫', label: 'A treat she likes', note: 'Small gestures count.', searchCategory: 'grocery store' },
  ],
}
 
const PHASE_RING_FRACTION = {
  menstrual: 0.05,
  follicular: 0.35,
  ovulation: 0.65,
  luteal: 0.85,
}

function daysUntil(dateStr) {
  try {
    const target = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    target.setHours(0, 0, 0, 0)
    return Math.round((target - today) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

// status: the object returned by getSharedCycleStatus (already scoped
// to whatever permission level/fields she's enabled). Returns null if
// there's nothing shareable to visualize.
export function getPartnerRingProps(status) {
  if (!status?.available) return null

  if (status.phase) {
    const fraction = PHASE_RING_FRACTION[status.phase] ?? 0.5
    const label = status.phase.charAt(0).toUpperCase() + status.phase.slice(1)
    let subLabel = `${label} phase`
    if (status.estimatedNextPeriod) {
      const d = daysUntil(status.estimatedNextPeriod)
      if (d !== null) subLabel = d <= 0 ? 'Period may have started' : `~${d} day${d === 1 ? '' : 's'} until estimated period`
    }
    return { progressFraction: fraction, dayLabel: label, subLabel }
  }

  if (status.estimatedNextPeriod) {
    const d = daysUntil(status.estimatedNextPeriod)
    if (d === null) return null
    const assumedCycleLength = 28 // no exact cycle length is shared, so this is a rough visual only
    const fraction = Math.max(0, Math.min(1, 1 - d / assumedCycleLength))
    return {
      progressFraction: fraction,
      dayLabel: '🌸',
      subLabel: d <= 0 ? 'Period may have started' : `~${d} day${d === 1 ? '' : 's'} until estimated period`,
    }
  }

  return null
}
export function getPartnerTips(phase) {
  if (phase && PARTNER_PHASE_TIPS[phase]) return PARTNER_PHASE_TIPS[phase]
  return PARTNER_PHASE_TIPS.generic
}

export function getApproachingTips() {
  return PARTNER_PHASE_TIPS.approaching
}

export function getGiftIdeas(phase) {
  if (phase && GIFT_IDEAS[phase]) return GIFT_IDEAS[phase]
  return GIFT_IDEAS.generic
}
