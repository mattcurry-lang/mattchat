// src/components/pickerLayout.js
// Where should the emoji panel go so it is always fully on screen?
// Pure function: give it the button's rectangle and the window size.

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi)

export function computePlacement({
  anchor,                 // { top, bottom, left, right } of the emoji button (viewport coordinates)
  viewport,               // { width, height } of the visible window
  preferredWidth = 380,
  maxHeight = 460,
  gap = 8,                // space between button and panel
  margin = 8,             // minimum space to the window edges
  sheetBelow = 520,       // narrower than this = full-width sheet
}) {
  const vw = viewport.width
  const vh = viewport.height
  const sheet = vw < sheetBelow

  const width = sheet ? Math.max(0, vw - margin * 2) : Math.min(preferredWidth, Math.max(0, vw - margin * 2))
  // Line the panel's right edge up with the button (it lives at the right end of the
  // composer), then slide it back inside the window if it would still stick out.
  const left = sheet ? margin : clamp(anchor.right - width, margin, Math.max(margin, vw - width - margin))

  const spaceAbove = anchor.top - gap - margin
  const spaceBelow = vh - anchor.bottom - gap - margin
  const above = spaceAbove >= Math.min(maxHeight, 320) || spaceAbove >= spaceBelow
  const space = above ? spaceAbove : spaceBelow
  const height = Math.max(160, Math.min(maxHeight, space))

  const originX = clamp(anchor.right - left - 18, 12, Math.max(12, width - 12))
  return {
    left,
    width,
    maxHeight: height,
    placement: above ? 'above' : 'below',
    sheet,
    // above: pin the panel's bottom edge just over the button; below: pin its top edge just under it
    ...(above ? { bottom: vh - anchor.top + gap } : { top: anchor.bottom + gap }),
    transformOrigin: `${originX}px ${above ? '100%' : '0%'}`,
  }
}
