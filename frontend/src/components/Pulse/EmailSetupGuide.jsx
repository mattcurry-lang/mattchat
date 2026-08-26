// src/components/Pulse/EmailSetupGuide.jsx
//
// "Set Up Your DeKUT University Email" (spec section 12). Renders the
// step content from src/data/dekutEmailSetup.js — this component owns no
// copy of its own, so updating the guide only ever means editing that
// data file (or, per spec section 16, an admin editing it later).
//
// Mounted as the target of the 'email-setup' internal service.

import React, { useState } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import { EMAIL_SETUP_STEPS, EMAIL_SETUP_HELP } from '../../data/dekutEmailSetup'
import { getContactById } from '../../data/dekutContacts'
import { DEKUT_CATEGORIES, getServiceById } from '../../data/dekutServices'
import { useDekutUsage } from '../../hooks/useDekutUsage'
import { openDekutService } from '../../utils/dekutOpenService'

function StepRow({ step, index, isLast }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: ICON_GRADIENTS.cpu,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12.5, fontWeight: 800, color: '#fff',
        }}>
          {index + 1}
        </div>
        {!isLast && <div style={{ flex: 1, width: 2, background: 'var(--border)', marginTop: 4, minHeight: 20 }} />}
      </div>
      <div style={{ paddingBottom: isLast ? 0 : 18, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 3 }}>
          {step.title}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.55 }}>
          {step.content}
        </div>
      </div>
    </div>
  )
}

// onNavigate: forwarded to internal service actions used in the help footer.
// onClose: renders a close button when present (mounted full-screen).
export default function EmailSetupGuide({ onNavigate, onClose }) {
  const usage = useDekutUsage('dekut')
  const helpContact = getContactById(EMAIL_SETUP_HELP.contactId)
  const portalService = getServiceById('student-portal', DEKUT_CATEGORIES)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true">📧</span> Set Up Your DeKUT Email
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 420 }}>
            Your student email runs on Google Workspace. Here's how to activate it.
          </div>
        </div>
        {typeof onClose === 'function' && (
          <button
            onClick={onClose}
            aria-label="Close Email Setup Guide"
            style={{
              background: 'var(--bg-surface-1, rgba(0,0,0,0.06))', border: '1px solid var(--border)',
              borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <DekutIcon type="x" size={16} color="var(--text-primary)" strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div style={{
        marginTop: 18, borderRadius: 16, padding: 16,
        background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
      }}>
        {EMAIL_SETUP_STEPS.map((step, i) => (
          <StepRow key={step.id} step={step} index={i} isLast={i === EMAIL_SETUP_STEPS.length - 1} />
        ))}
      </div>

      <div style={{
        marginTop: 14, borderRadius: 14, border: '1px dashed var(--border)',
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: ICON_GRADIENTS.cpu, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <DekutIcon type="cpu" size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>Need Help?</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {EMAIL_SETUP_HELP.note}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {helpContact?.email && (
          <a
            href={`mailto:${helpContact.email}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, color: '#a78bfa', textDecoration: 'none',
              border: '1px solid var(--border)', borderRadius: 999, padding: '7px 13px',
            }}
          >
            Email {helpContact.name} <DekutIcon type="externalLink" size={12} color="#a78bfa" strokeWidth={2} />
          </a>
        )}
        {portalService && (
          <button
            onClick={() => openDekutService(portalService, { usage, onNavigate })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'none', fontFamily: 'inherit', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 999, padding: '7px 13px',
            }}
          >
            Open Student Portal <DekutIcon type="externalLink" size={12} color="var(--text-primary)" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  )
}
