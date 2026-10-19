import React from 'react'
import GlowAvatar from './GlowAvatar'
import { IconSparkle } from '../components/Icons'
import './afterglow.css'

const CURRY_HUE = 268

/** Curry AI's row in the chat list, in the Afterglow style: always lit, never unread. */
export default function CurryRow({ active = false, onOpen }) {
  return (
    <div
      className={`contact ag-row ag-curry-row${active ? ' active' : ''}`}
      style={{ '--ag-h': CURRY_HUE, '--ag-w': 0.6 }}
      role="button" tabIndex={0}
      onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.() }}
    >
      <GlowAvatar size={46} hue={CURRY_HUE} warmth={0.6}
        inner={<div className="ag-curry-orb"><IconSparkle size={20} /></div>} />
      <div className="contact-info">
        <div className="contact-name ag-name ag-curry-name"><IconSparkle size={12} /> Curry AI</div>
        <div className="contact-preview">Your personal AI assistant</div>
      </div>
    </div>
  )
}
