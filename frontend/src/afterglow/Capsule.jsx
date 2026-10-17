import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { composerMode } from './composer'
import { IconPlus, IconMic, IconSend, IconSparkle } from '../components/Icons'
import './afterglow-composer.css'

const SPRING = { type: 'spring', stiffness: 460, damping: 34 }

/**
 * The capsule: one floating, rounded input.
 *   +        opens the tray (media, draw, poll, task, schedule, YouTube, Curry)
 *   field    the real <textarea> from ChatPage, passed in untouched
 *   emoji    the existing emoji / sticker / GIF picker, passed in untouched
 *   button   morphs: mic → send → Curry, depending on what you've typed
 * While recording, the voice recorder takes over the whole capsule.
 *
 * Everything with behaviour is passed in, so ChatPage's logic (typing
 * indicators, drafts, Enter-to-send, Curry triggers) is unchanged.
 */
export default function Capsule({
  hue = 258, text = '', busy = false, recording = false, alwaysCurry = false,
  field, emojiSlot, recorderSlot, trayItems = [], onSend, onMic,
}) {
  const [trayOpen, setTrayOpen] = useState(false)
  const mode = composerMode(text, { alwaysCurry })

  useEffect(() => {
    if (!trayOpen) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setTrayOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [trayOpen])

  // starting a recording or sending closes the tray
  useEffect(() => { if (recording) setTrayOpen(false) }, [recording])

  const act = () => (mode === 'mic' ? onMic?.() : onSend?.())
  const label = mode === 'mic' ? 'Record a voice note' : mode === 'curry' ? 'Ask Curry' : 'Send'

  return (
    <div className="ag-capsule" style={{ '--ag-h': hue }}>
      <AnimatePresence>
        {trayOpen && !recording && (
          <>
            <div className="ag-tray-scrim" onClick={() => setTrayOpen(false)} />
            <motion.div
              className="ag-tray" role="menu"
              initial={{ opacity: 0, y: 14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={SPRING}
            >
              {trayItems.map((it, i) => (
                <motion.button
                  key={it.id} role="menuitem" className={`ag-tile${it.active ? ' on' : ''}`}
                  style={{ '--tile-h': (hue + i * 38) % 360 }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING, delay: 0.03 * i }}
                  onClick={() => { setTrayOpen(false); it.onClick() }}
                >
                  <span className="ag-tile-ico">{it.icon}</span>
                  <span className="ag-tile-label">{it.label}</span>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="ag-capsule-glass" aria-hidden="true" />
      <div className="ag-capsule-row">
        {recording ? (
          <div className="ag-recorder">{recorderSlot}</div>
        ) : (
          <>
            <motion.button
              className="ag-plus" aria-label="Open tools" aria-expanded={trayOpen}
              animate={{ rotate: trayOpen ? 45 : 0 }} whileTap={{ scale: 0.88 }} transition={SPRING}
              onClick={() => setTrayOpen((v) => !v)}
            >
              <IconPlus size={20} />
            </motion.button>

            <div className="ag-field">{field}</div>
            {emojiSlot}

            <button
              className={`ag-act-btn ag-mode-${mode}`} aria-label={label} title={label}
              disabled={busy && mode !== 'mic'} onClick={act}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={mode} className="ag-act-ico"
                  initial={{ opacity: 0, scale: 0.4, rotate: -80 }} animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.4, rotate: 80 }} transition={{ duration: 0.16 }}
                >
                  {mode === 'mic' ? <IconMic size={20} /> : mode === 'curry' ? <IconSparkle size={20} /> : <IconSend size={19} />}
                </motion.span>
              </AnimatePresence>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
