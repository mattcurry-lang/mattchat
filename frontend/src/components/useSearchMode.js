import { useState, useEffect } from 'react'

const MOBILE_QUERY = '(max-width: 639px)' // same breakpoint the app's CSS uses to hide the right-hand pane

export function useIsMobile() {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches
  const [m, setM] = useState(get)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia(MOBILE_QUERY)
    const on = () => setM(mq.matches)
    on()
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on)
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on) }
  }, [])
  return m
}

/**
 * WhatsApp-style full-screen search on phones.
 *
 * While `active`, <html> gets data-ag-search="on" and the CSS (commandbar-extra.css) turns the sidebar into a
 * panel pinned to the VISIBLE part of the screen: the logo, stories, bottom nav and floating buttons step aside,
 * and the results fill whatever the keyboard leaves free.
 *
 * The visible area is measured with the Visual Viewport API instead of trusting CSS units, because browsers
 * disagree about the keyboard: Chrome on Android (with interactive-widget=resizes-content, as in your
 * index.html) shrinks the page; iPhone Safari does not, and scrolls the page instead.
 * `panelOn` also hides the chat list underneath, so an answer or weather card gets the whole screen.
 */
export function useSearchMode(active, panelOn) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined
    const root = document.documentElement
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    root.dataset.agSearch = 'on'
    const apply = () => {
      root.style.setProperty('--ag-vv-h', `${Math.round(vv ? vv.height : window.innerHeight)}px`)
      root.style.setProperty('--ag-vv-top', `${Math.round(vv ? vv.offsetTop : 0)}px`)
    }
    apply()
    if (vv) { vv.addEventListener('resize', apply); vv.addEventListener('scroll', apply) }
    window.addEventListener('resize', apply)
    return () => {
      if (vv) { vv.removeEventListener('resize', apply); vv.removeEventListener('scroll', apply) }
      window.removeEventListener('resize', apply)
      delete root.dataset.agSearch
      delete root.dataset.agPanel
      root.style.removeProperty('--ag-vv-h')
      root.style.removeProperty('--ag-vv-top')
    }
  }, [active])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (active && panelOn) root.dataset.agPanel = 'on'; else delete root.dataset.agPanel
  }, [active, panelOn])
}
