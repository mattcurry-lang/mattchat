// src/components/Pulse/ContactsPage.jsx
//
// "Who Can Help Me?" (spec section 15). Real DeKUT contacts only — see
// src/data/dekutContacts.js for sourcing and the never-invent rule.
//
// FIX 1: the Call/Email buttons had lost their opening <a tags (a paste
// corruption from the Supabase dashboard editor — same class of bug
// mentioned elsewhere in this build), which would have failed to compile.
// FIX 2: hardcoded contrast-safe colors — same dark-overlay text-visibility
// bug as RoomFinder.jsx / SuggestLocationForm.jsx.

import React from 'react'
import { DekutIcon } from './dekutIcons'
import { getContactsByCategory } from '../../data/dekutContacts'

const TEXT_PRIMARY = '#f5f5fa'
const TEXT_SECONDARY = 'rgba(245,245,250,0.6)'
const BORDER = 'rgba(245,245,250,0.16)'
const SURFACE = 'rgba(245,245,250,0.06)'

function ContactRow({ contact }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: 14, padding: '12px 14px',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: TEXT_PRIMARY }}>{contact.name}</div>
        {contact.description && (
          <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginTop: 2, lineHeight: 1.4 }}>
            {contact.description}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {contact.phone && (
          <a
            href={`tel:${contact.phone.replace(/\s+/g, '')}`}
            aria-label={`Call ${contact.name}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11.5, fontWeight: 700, color: TEXT_PRIMARY,
              padding: '6px 10px', borderRadius: 10,
              background: SURFACE, border: `1px solid ${BORDER}`,
              textDecoration: 'none',
            }}
          >
            Call
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            aria-label={`Email ${contact.name}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11.5, fontWeight: 700, color: TEXT_PRIMARY,
              padding: '6px 10px', borderRadius: 10,
              background: SURFACE, border: `1px solid ${BORDER}`,
              textDecoration: 'none',
            }}
          >
            Email
          </a>
        )}
      </div>
    </div>
  )
}

// onClose: renders a close button when present (mounted full-screen).
export default function ContactsPage({ onClose }) {
  const groups = getContactsByCategory()
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: TEXT_PRIMARY }}>📞 Who Can Help Me?</div>
          <div style={{ fontSize: 12.5, color: TEXT_SECONDARY, marginTop: 4 }}>
            Verified DeKUT contacts.
          </div>
        </div>
        {typeof onClose === 'function' && (
          <button
            onClick={onClose}
            aria-label="Close Contacts"
            style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <DekutIcon type="x" size={16} color={TEXT_PRIMARY} strokeWidth={2.2} />
          </button>
        )}
      </div>
      {groups.map((group) => (
        <div key={group.id} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 10 }}>
            {group.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {group.contacts.map((c) => <ContactRow key={c.id} contact={c} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
