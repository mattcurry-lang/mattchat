// Pure helpers for "press or tap N times quickly" shortcuts. No React, no DOM globals, so they are easy to test.

// Counts quick repeats. hit() returns true on the Nth hit inside the allowed gap, then starts over.
export function createTapCounter({ count = 3, gapMs = 700, now = () => Date.now() } = {}) {
  let n = 0
  let last = 0
  return {
    hit() {
      const t = now()
      n = n > 0 && t - last <= gapMs ? n + 1 : 1
      last = t
      if (n >= count) { n = 0; return true }
      return false
    },
    reset() { n = 0; last = 0 },
  }
}

const INTERACTIVE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY', 'OPTION', 'VIDEO', 'AUDIO'])
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, summary, [contenteditable="true"], [role="button"], [role="link"], [role="textbox"], [role="menuitem"], [role="switch"], [role="dialog"]'

// True when pressing Enter on this element already does something (types, sends, activates a button),
// so a shortcut must stay out of the way.
export function isInteractiveTarget(el) {
  if (!el || !el.tagName) return false
  if (INTERACTIVE_TAGS.has(el.tagName)) return true
  if (el.isContentEditable) return true
  return Boolean(el.closest && el.closest(INTERACTIVE_SELECTOR))
}
