import { useCallback, useEffect, useMemo, useRef } from 'react'
import { shushhhBusy } from '../components/Shushhh/useShushhhRoom'
import { createTapCounter, isInteractiveTarget } from '../lib/shortcutDetect'

/*
 * Opens Shushhh without going through the profile page.
 *
 *   Desktop: press Enter three times quickly, while nothing is focused
 *            (not in a text box, not on a button or link, no dialog open).
 *   Mobile:  tap the Mattchat logo or name three times quickly.
 *            (Also works with three mouse clicks on desktop.)
 *
 * Why not the fingerprint sensor: browsers cannot see a finger resting on the sensor. The only fingerprint
 * API on the web is WebAuthn, which shows a verification prompt and reports pass or fail, with no touch events.
 *
 *   const { tripleTapProps } = useShushhhShortcut({ onTrigger: () => setShowShushhh(true), enabled: !showShushhh })
 *   <img src="/logo.png" {...tripleTapProps} />
 */

const REQUIRED = 3
const GAP_MS = 700

export default function useShushhhShortcut({ onTrigger, enabled = true }) {
  const triggerRef = useRef(onTrigger)
  triggerRef.current = onTrigger
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const keys = useRef(createTapCounter({ count: REQUIRED, gapMs: GAP_MS }))
  const taps = useRef(createTapCounter({ count: REQUIRED, gapMs: GAP_MS }))

  const fire = useCallback(() => {
    try { navigator.vibrate?.(25) } catch { /* not supported */ }
    triggerRef.current?.()
  }, [])

  // Desktop: Enter x3
  useEffect(() => {
    if (!enabled) return undefined
    const onKey = (e) => {
      if (e.key !== 'Enter') { keys.current.reset(); return }          // any other key breaks the sequence
      if (e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) { keys.current.reset(); return }
      if (shushhhBusy.current || isInteractiveTarget(e.target) || document.querySelector('[aria-modal="true"]')) {
        keys.current.reset(); return
      }
      if (keys.current.hit()) fire()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, fire])

  // Mobile: three quick taps on the logo
  const onTap = useCallback(() => {
    if (!enabledRef.current || shushhhBusy.current) return
    if (taps.current.hit()) fire()
  }, [fire])

  const tripleTapProps = useMemo(() => ({
    onClick: onTap,
    draggable: false,
    // no double-tap zoom delay, no text selection or tap flash on the secret spot
    style: { touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent' },
  }), [onTap])

  return { tripleTapProps }
}
