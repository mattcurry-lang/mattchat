// src/components/Pulse/DekutFAQ.jsx
//
// "Ask DeKUT" — spec §10/§11: a knowledge-base-backed FAQ, not a free-form
// AI chat. Every answer here comes from src/data/dekutFAQ.js, which is
// sourced from DeKUT's own public pages. This component never generates
// its own answers, so there's nothing here that can hallucinate a
// procedure — it can only show what's in the knowledge base or say it
// doesn't know yet.
//
// Mounted as the target of the 'faq' internal service (see
// dekutServices.js) — same full-screen overlay pattern as RoomFinder.

import React, { useMemo, useState } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import { DEKUT_FAQ, FAQ_CATEGORIES, searchFAQ } from '../../data/dekutFAQ'
import { DEKUT_CATEGORIES, getServiceById } from '../../data/dekutServices'
import { useDekutUsage } from '../../hooks/useDekutUsage'
import { openDekutService } from '../../utils/dekutOpenService'

function FAQAction({ action, onNavigate, usage }) {
  if (!action || action.type === 'none') return null

  if (action.type === 'mailto') {
    return (
      <a
        href={`mailto:${action.email}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 700, color: '#a78bfa',
          textDecoration: 'none', marginTop: 10,
        }}
      >
        {action.label} <DekutIcon type="externalLink" size={12} color="#a78bfa" strokeWidth={2} />
      </a>
    )
  }

  if (action.type === 'service') {
    const service = getServiceById(action.serviceId, DEKUT_CATEGORIES)
    if (!service) return null
    return (
      <button
        onClick={() => openDekutService(service, { usage, onNavigate })}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', padding: 0, marginTop: 10,
          fontSize: 12, fontWeight: 700, color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {action.label}
        <DekutIcon
          type={service.type === 'internal' ? 'chevronRight' : 'externalLink'}
          size={12} color="#a78bfa" strokeWidth={2}
        />
      </button>
    )
  }

  return null
}

function FAQItem({ item, expanded, onToggle, onNavigate, usage }) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 14,
      background: 'var(--bg-surface-2)', overflow: 'hidden',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          background: 'none', border: 'none', padding: '13px 14px', cursor: 'pointer',
          textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{item.question}</span>
        <span style={{
          flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 160ms ease',
        }}>
          <DekutIcon type="chevronRight" size={14} color="var(--text-secondary)" strokeWidth={2.2} />
        </span>
      </button>
      {expanded && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {item.answer}
          </div>
          <FAQAction action={item.action} onNavigate={onNavigate} usage={usage} />
        </div>
      )}
    </div>
  )
}

// onNavigate: forwarded to internal service actions (e.g. tapping the
// Room Finder action here routes the same way it does from DeKUTHubCard).
// onClose: renders a close button when present (mounted full-screen).
export default function DekutFAQ({ onNavigate, onClose }) {
  const usage = useDekutUsage('dekut')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  const results = useMemo(() => searchFAQ(query, category, DEKUT_FAQ), [query, category])

  const categoryChips = [{ id: 'all', label: 'All' }, ...Object.entries(FAQ_CATEGORIES).map(([id, label]) => ({ id, label }))]

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true">🤖</span> Ask DeKUT
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 420 }}>
            Answers sourced from official DeKUT info. If it's not verified, we'll say so and point you to the right office.
          </div>
        </div>
        {typeof onClose === 'function' && (
          <button
            onClick={onClose}
            aria-label="Close Ask DeKUT"
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
        display: 'flex', alignItems: 'center', gap: 8,
        border: '1px solid var(--border)', borderRadius: 12, padding: '9px 12px',
        background: 'var(--bg-surface-1, rgba(0,0,0,0.03))', margin: '16px 0 10px',
      }}>
        <DekutIcon type="search" size={16} color="var(--text-secondary)" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about email, fees, registration, rooms..."
          autoFocus
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13.5, color: 'var(--text-primary)', width: '100%', fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {categoryChips.map((c) => {
          const active = category === c.id
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              style={{
                fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                borderRadius: 999, padding: '6px 12px',
                border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
                background: active ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : 'transparent',
                color: active ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', padding: '10px 2px' }}>
            No matches. Try a different word, or reach out below.
          </div>
        ) : (
          results.map((item) => (
            <FAQItem
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onNavigate={onNavigate}
              usage={usage}
            />
          ))
        )}
      </div>

      <div style={{
        marginTop: 18, borderRadius: 14, border: '1px dashed var(--border)',
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: ICON_GRADIENTS.cpu, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <DekutIcon type="cpu" size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>Don't see your question?</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>We won't guess — contact ICT directly.</div>
        </div>
        <a
          href="mailto:studentadmin@dkut.ac.ke"
          style={{ fontSize: 11.5, fontWeight: 700, color: '#a78bfa', textDecoration: 'none', flexShrink: 0 }}
        >
          Email ICT
        </a>
      </div>
    </div>
  )
}
