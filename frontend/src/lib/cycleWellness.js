// lib/cycleWellness.js
// Pure content/logic — no DB calls. Phase-keyed wellness copy plus the
// two dynamic cards on the dashboard: "Today for you" and the daily
// rotating "little thing". Kept separate from cycleMath.js since that
// file computes dates/phases, this one just maps phase -> copy.

export const PHASE_COPY = {
  menstrual: {
    headline: 'Slow down and take care of yourself.',
    tone: 'Your period is here. Rest and comfort can go a long way today.',
  },
  follicular: {
    headline: 'Energy may be building.',
    tone: "Some people notice more energy and motivation during this part of their cycle.",
  },
  ovulation: {
    headline: "You're around your estimated ovulation window.",
    tone: 'This is an estimate, not a guarantee — everyone\'s cycle varies.',
  },
  luteal: {
    headline: 'Your period may be approaching.',
    tone: "Some people notice lower energy or more sensitivity in this phase. Take things a little slower if that's what feels good.",
  },
}

// key -> { icon, foods, drinks, selfCare, movement } — each item is
// { id, label, emoji, blurb }. Kept short; the detail card in Phase 2
// will carry the fuller "why/how to prepare" copy per item id.
export const PHASE_RECOMMENDATIONS = {
  menstrual: {
    foods: [
      { id: 'spinach', emoji: '🥬', label: 'Spinach', blurb: 'Rich in iron and other nutrients.' },
      { id: 'dark_chocolate', emoji: '🍫', label: 'Dark chocolate', blurb: 'A small treat some people reach for during their period.' },
      { id: 'salmon', emoji: '🐟', label: 'Salmon', blurb: 'A source of protein and omega-3s.' },
      { id: 'ginger_tea', emoji: '🫖', label: 'Ginger tea', blurb: 'Warm and comforting — some people enjoy this around their period.' },
    ],
    drinks: [
      { id: 'water', emoji: '💧', label: 'Water', blurb: 'Staying hydrated can be a nourishing habit any day.' },
      { id: 'herbal_tea', emoji: '🍵', label: 'Herbal tea', blurb: 'A warm, calming option for winding down.' },
    ],
    selfCare: [
      { id: 'heat_pad', emoji: '🔥', label: 'Warmth', blurb: 'A heating pad or warm bath may feel comforting.' },
      { id: 'early_rest', emoji: '😴', label: 'Extra rest', blurb: 'Giving yourself permission to rest can be a nourishing option.' },
    ],
    movement: [
      { id: 'gentle_walk', emoji: '🚶', label: 'Gentle walk', blurb: 'Light movement, at whatever pace feels good.' },
      { id: 'stretching', emoji: '🧘', label: 'Stretching', blurb: 'A few minutes of stretching can feel good on lower-energy days.' },
    ],
  },
  follicular: {
    foods: [
      { id: 'eggs', emoji: '🥚', label: 'Eggs', blurb: 'A versatile source of protein.' },
      { id: 'citrus', emoji: '🍊', label: 'Citrus fruit', blurb: 'A bright, refreshing option many people enjoy.' },
      { id: 'quinoa', emoji: '🌾', label: 'Quinoa', blurb: 'A balanced option to fuel a more active day.' },
    ],
    drinks: [
      { id: 'water', emoji: '💧', label: 'Water', blurb: 'Good to keep close as energy picks up.' },
      { id: 'green_tea', emoji: '🍵', label: 'Green tea', blurb: 'A lighter pick-me-up some people enjoy.' },
    ],
    selfCare: [
      { id: 'journaling', emoji: '📝', label: 'Journaling', blurb: 'A nice time to jot down ideas or plans.' },
    ],
    movement: [
      { id: 'strength', emoji: '🏋️', label: 'Strength training', blurb: 'Some people notice more energy for this in the follicular phase.' },
      { id: 'dance', emoji: '💃', label: 'Something fun', blurb: 'Movement you actually enjoy counts too.' },
    ],
  },
  ovulation: {
    foods: [
      { id: 'avocado', emoji: '🥑', label: 'Avocado', blurb: 'A nourishing, versatile option.' },
      { id: 'berries', emoji: '🫐', label: 'Berries', blurb: 'A light, refreshing snack idea.' },
    ],
    drinks: [
      { id: 'water', emoji: '💧', label: 'Water', blurb: 'Always a good baseline.' },
    ],
    selfCare: [
      { id: 'social_time', emoji: '💗', label: 'Time with people you enjoy', blurb: 'Some people feel more social during this window.' },
    ],
    movement: [
      { id: 'cardio', emoji: '🏃', label: 'Cardio', blurb: 'A window some people find good for higher-intensity movement.' },
    ],
  },
  luteal: {
    foods: [
      { id: 'banana', emoji: '🍌', label: 'Banana', blurb: 'Provides potassium and is an easy energy-rich snack.' },
      { id: 'spinach', emoji: '🥬', label: 'Spinach', blurb: 'Rich in iron and other nutrients.' },
      { id: 'salmon', emoji: '🐟', label: 'Salmon', blurb: 'A source of protein and omega-3s.' },
      { id: 'avocado', emoji: '🥑', label: 'Avocado', blurb: 'A nourishing, versatile option.' },
      { id: 'dark_chocolate', emoji: '🍫', label: 'Dark chocolate', blurb: 'A small treat some people crave around this time.' },
    ],
    drinks: [
      { id: 'water', emoji: '💧', label: 'Water', blurb: 'Staying hydrated can be a nourishing habit.' },
      { id: 'ginger_tea', emoji: '🫖', label: 'Ginger tea', blurb: 'Warm and comforting for some people this time of month.' },
    ],
    selfCare: [
      { id: 'sleep', emoji: '😴', label: 'Extra sleep', blurb: 'Some people notice they want more rest in the late luteal phase.' },
      { id: 'quiet_time', emoji: '🧘', label: 'Quiet time', blurb: 'A few quiet minutes for yourself.' },
    ],
    movement: [
      { id: 'gentle_walk', emoji: '🚶', label: 'Gentle walk', blurb: 'Light movement, at whatever pace feels good.' },
      { id: 'yoga', emoji: '🧘‍♀️', label: 'Yoga', blurb: 'A lower-intensity option some people prefer in this phase.' },
    ],
  },
}
 
export const ITEM_DETAILS = {
  banana: { prep: 'Eat as-is, or slice into oats or yogurt.', serving: 'One medium banana.', alternatives: ['citrus', 'berries'] },
  spinach: { prep: 'Toss into a warm bowl, omelet, or smoothie.', serving: 'A handful, raw or lightly cooked.', alternatives: ['avocado'] },
  salmon: { prep: 'Bake or pan-sear with a little olive oil and lemon.', serving: 'A palm-sized portion.', alternatives: ['eggs', 'quinoa'] },
  avocado: { prep: 'Mash onto toast, or slice into a bowl.', serving: 'Half an avocado.', alternatives: ['spinach', 'salmon'] },
  dark_chocolate: { prep: 'Enjoy a square or two on its own.', serving: 'A small piece (70%+ cacao).', alternatives: ['banana'] },
  ginger_tea: { prep: 'Steep fresh or ground ginger in hot water for 5–10 minutes.', serving: 'One warm mug.', alternatives: ['herbal_tea', 'green_tea'] },
  herbal_tea: { prep: 'Steep your preferred blend for a few minutes.', serving: 'One warm mug.', alternatives: ['ginger_tea'] },
  green_tea: { prep: 'Steep briefly — a minute or two — to avoid bitterness.', serving: 'One cup.', alternatives: ['herbal_tea'] },
  water: { prep: 'Keep a bottle nearby as a gentle reminder.', serving: 'Throughout the day.', alternatives: [] },
  eggs: { prep: 'Scramble, boil, or fry — whatever you feel like.', serving: 'One or two eggs.', alternatives: ['salmon'] },
  citrus: { prep: 'Eat whole, or add segments to a salad.', serving: 'One piece of fruit.', alternatives: ['berries', 'banana'] },
  quinoa: { prep: 'Cook like rice, then add veggies or protein.', serving: 'About a cup, cooked.', alternatives: ['salmon'] },
  berries: { prep: 'Rinse and eat fresh, or add to yogurt.', serving: 'A small handful.', alternatives: ['citrus'] },
}

// Rotates a simple food-based "meal plan" for the current phase — pulls
// from PHASE_RECOMMENDATIONS.foods, no external data needed.
export function getMealSuggestions(phase, seed = 0) {
  const foods = (PHASE_RECOMMENDATIONS[phase] || PHASE_RECOMMENDATIONS.follicular).foods
  if (!foods.length) return null
  const pick = (offset) => foods[(seed + offset) % foods.length]
  return {
    breakfast: pick(0),
    lunch: pick(1),
    snack: pick(2),
    dinner: pick(3),
  }
}
const LITTLE_THINGS = [
  { emoji: '🌸', text: 'Take a few minutes to stretch.' },
  { emoji: '🥤', text: 'Keep water nearby today.' },
  { emoji: '🍌', text: 'Try a potassium-rich snack.' },
  { emoji: '🧘', text: 'Take five quiet minutes for yourself.' },
  { emoji: '💗', text: 'Check in with how you\'re feeling.' },
  { emoji: '😴', text: 'Consider going to bed a little earlier tonight.' },
  { emoji: '🚶', text: 'A short walk can be a nice reset.' },
]

// Deterministic per-day pick so it doesn't change on every re-render —
// same date always yields the same "little thing" for that user.
export function getTodaysLittleThing(dateStr) {
  const seed = dateStr.split('-').reduce((acc, n) => acc + parseInt(n, 10), 0)
  return LITTLE_THINGS[seed % LITTLE_THINGS.length]
}

// Symptom frequency map is optional — pass recentDailyLogs (array of
// daily_logs rows) to get a pattern-aware line when there's enough
// history; otherwise falls back to generic phase copy.
export function getTodayForYou(phase, recentDailyLogs = []) {
  const copy = PHASE_COPY[phase] || PHASE_COPY.follicular

  if (recentDailyLogs.length >= 3) {
    const symptomCounts = {}
    recentDailyLogs.forEach(log => {
      ;(log.symptoms || []).forEach(s => { symptomCounts[s] = (symptomCounts[s] || 0) + 1 })
    })
    const topSymptom = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1])[0]
    if (topSymptom && topSymptom[1] >= 2) {
      return {
        headline: copy.headline,
        body: `You've logged ${topSymptom[0].toLowerCase()} a few times around this part of your cycle. Want some ideas for today?`,
        showIdeaButtons: true,
      }
    }
  }

  return { headline: copy.headline, body: copy.tone, showIdeaButtons: true }
}
