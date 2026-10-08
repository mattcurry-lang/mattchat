import { useSyncExternalStore } from 'react'
import '../styles/appearance.css'

/*
 * Client-side home for user settings.
 *
 *  - Applies appearance settings to <html> as data attributes (appearance.css does the styling)
 *  - Caches every setting in localStorage so the look is correct on the very first paint
 *  - Gives any component or handler a way to read a setting:
 *        getSetting('enterToSend')            // plain read, for event handlers
 *        const theme = useSetting('chatTheme') // reactive read, for components
 *        const { autoplay, autoLoad } = useMediaPolicy()
 *
 * The server copy (profiles / user_settings) is handled by useProfileSettings from step 1.
 * ProfileMenuSheetConnected keeps the two in sync.
 */

const STORAGE_KEY = 'mattchat:settings:v1'

const osPrefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Effective defaults. These are what the app really does when nothing is saved,
// and they are what the sheet should display.
export function getDefaults() {
  return {
    // privacy (stored now, enforced in step 4)
    lastSeen: 'contacts', photoVis: 'everyone', showOnline: true, readReceipts: true, typing: true, whoCanAdd: 'everyone',
    // messages
    disappearing: 'off', keepArchived: true,
    enterToSend: true, // Enter already sends today, so keep that as the default
    // appearance
    chatTheme: 'default', bubbleStyle: 'soft', fontSize: 'medium', autoplayMotion: true,
    reduceMotion: osPrefersReducedMotion(), // start from the device's accessibility setting
    // notifications (step 5)
    dnd: false, quietHours: 'off', previews: true, mentionsOnly: false,
    // data
    dataSaver: false, autoDownload: 'wifi',
    // account
    language: 'en',
  }
}

const DEFAULTS = getDefaults()
const KNOWN_KEYS = new Set(Object.keys(DEFAULTS))

function pickKnown(obj) {
  const out = {}
  for (const k of Object.keys(obj || {})) if (KNOWN_KEYS.has(k)) out[k] = obj[k]
  return out
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { owner: parsed.owner ?? null, values: { ...DEFAULTS, ...pickKnown(parsed.values) } }
    }
  } catch { /* private mode or corrupted cache: fall back to defaults */ }
  return { owner: null, values: { ...DEFAULTS } }
}

function applyToDocument(v) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.dataset.mcChatTheme = v.chatTheme
  el.dataset.mcBubble = v.bubbleStyle
  el.dataset.mcFontSize = v.fontSize
  el.dataset.mcReduceMotion = String(!!v.reduceMotion)
  // language is intentionally NOT applied to <html lang> yet: the UI text is still English,
  // and a wrong lang makes screen readers pronounce English with the wrong voice.
}

let state = load()
const listeners = new Set()

function commit() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
  applyToDocument(state.values)
  listeners.forEach((l) => l())
}

applyToDocument(state.values) // first paint uses the cached look

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }

export const getSetting = (key) => state.values[key]

export function setSettings(patch) {
  const next = pickKnown(patch)
  if (Object.keys(next).length === 0) return
  state = { ...state, values: { ...state.values, ...next } }
  commit()
}

// Called once the server copy has loaded. Server values win; anything the server doesn't have
// falls back to this device's cache (same account only), then to the defaults.
export function hydrate(owner, serverValues = {}) {
  const cached = state.owner === owner ? state.values : {}
  state = { owner, values: { ...DEFAULTS, ...cached, ...pickKnown(serverValues) } }
  commit()
}

export function useSetting(key) {
  return useSyncExternalStore(subscribe, () => state.values[key], () => DEFAULTS[key])
}

// ---- data saver / media policy ----
// navigator.connection exists in Chrome and Android browsers only. Where it is missing
// (Safari, Firefox) we cannot tell Wi-Fi from mobile data, so the default "Wi-Fi only"
// rule lets media load. Only an explicit Data saver turns auto-loading off there.
function subscribeConnection(cb) {
  const c = typeof navigator !== 'undefined' ? navigator.connection : undefined
  c?.addEventListener?.('change', cb)
  return () => c?.removeEventListener?.('change', cb)
}
const connectionSnapshot = () => {
  const c = typeof navigator !== 'undefined' ? navigator.connection : undefined
  return c ? `${c.type || ''}|${c.saveData ? 1 : 0}` : '|0'
}

export function useMediaPolicy() {
  const dataSaver = useSetting('dataSaver')
  const autoDownload = useSetting('autoDownload')
  const autoplayMotion = useSetting('autoplayMotion')
  const reduceMotion = useSetting('reduceMotion')
  const [type, osSave] = useSyncExternalStore(subscribeConnection, connectionSnapshot, () => '|0').split('|')

  const cellular = type === 'cellular'
  const unmetered = type === 'wifi' || type === 'ethernet'
  const saver = dataSaver || osSave === '1'

  let autoLoad
  if (autoDownload === 'never') autoLoad = false
  else if (autoDownload === 'both') autoLoad = !(saver && !unmetered)
  else autoLoad = !cellular && !(saver && !unmetered)

  return {
    autoLoad,                                          // load images and GIFs without a tap
    autoplay: autoplayMotion && !reduceMotion && autoLoad, // let animated content play on its own
  }
}
