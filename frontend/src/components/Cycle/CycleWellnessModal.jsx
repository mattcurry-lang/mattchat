// ...append to the existing lib/cycleWellness.js, after PHASE_RECOMMENDATIONS

// Extra detail for the food/drink detail card — prep idea, serving idea,
// alternative item ids. Falls back to generic copy for anything without
// an entry (movement/self-care items mostly don't need this level of detail).
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
export default CycleWellnessModal;
