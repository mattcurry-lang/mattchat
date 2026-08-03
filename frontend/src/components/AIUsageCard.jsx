import React, { useState, useEffect, useCallback } from 'react'
import { getAiQuota, changeAiPlan } from '../lib/supabase'

const PLAN_LABELS = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' }

const SELF_SERVE_PLANS = [
  { id: 'free', name: 'Free', price: '$0', limit: '1M tokens/mo', tagline: 'Good for casual use' },
  { id: 'pro', name: 'Pro', price: 'Free for now', limit: '10M tokens/mo', tagline: '10x the monthly quota' },
]

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function formatResetDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

function UpgradeModal({ currentPlan, onClose, onChanged }) {
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState(null)

  const handlePick = async (planId) => {
    if (planId === currentPlan || switching) return
    setSwitching(true)
    setError(null)
    try {
      await changeAiPlan(planId)
      await onChanged()
      onClose()
    } catch (e) {
      console.error('changeAiPlan failed:', e)
      setError(e.message || 'Something went wrong switching plans.')
      setSwitching(false)
    }
  }

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={m.modal} onClick={(e) => e.stopPropagation()}>
        <div style={m.header}>
          <div style={m.title}>Choose your plan</div>
          <button style={m.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={m.plansRow}>
          {SELF_SERVE_PLANS.map((p) => {
            const isCurrent = p.id === currentPlan
            return (
              <button
                key={p.id}
                style={{ ...m.planCard, ...(isCurrent ? m.planCardActive : {}) }}
                onClick={() => handlePick(p.id)}
                disabled={switching || isCurrent}
              >
                {isCurrent && <div style={m.currentBadge}>Current plan</div>}
                <div style={m.planName}>{p.name}</div>
                <div style={m.planPrice}>{p.price}</div>
                <div style={m.planLimit}>{p.limit}</div>
                <div style={m.planTagline}>{p.tagline}</div>
                {!isCurrent && (
                  <div style={m.switchLabel}>{switching ? 'Switching…' : 'Switch to this plan'}</div>
                )}
              </button>
            )
          })}
        </div>

        {error && <div style={m.error}>{error}</div>}

        <div style={m.note}>No payment collected — this switches your quota tier directly.</div>
      </div>
    </div>
  )
}

export default function AIUsageCard({ userId }) {
  const [quota, setQuota] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getAiQuota(userId)
      setQuota(data)
      setError(null)
    } catch (e) {
      console.error('AIUsageCard: failed to load quota:', e)
      setError("Couldn't load your usage right now.")
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div style={s.card}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Loading usage…</div>
      </div>
    )
  }

  if (error || !quota) {
    return (
      <div style={s.card}>
        <div style={{ fontSize: 12.5, color: '#f87171' }}>{error || 'Something went wrong.'}</div>
        <button onClick={load} style={s.retryBtn}>Retry</button>
      </div>
    )
  }

  const pct = quota.monthlyLimit > 0 ? Math.min(100, (quota.tokensUsed / quota.monthlyLimit) * 100) : 0
  const isWarning = pct >= 80 && pct < 100
  const isBlocked = pct >= 100

  const barColor = isBlocked
    ? 'linear-gradient(135deg,#f87171,#ef4444)'
    : isWarning
      ? 'linear-gradient(135deg,#fbbf24,#f59e0b)'
      : 'linear-gradient(135deg,#667eea,#764ba2)'

  return (
    <div style={s.card}>
      <div style={s.headerRow}>
        <div>
          <div style={s.title}>AI Usage</div>
          <div style={s.planBadge}>{PLAN_LABELS[quota.plan] || quota.plan} Plan</div>
        </div>
        <div style={s.remainingWrap}>
          <div style={s.remainingNumber}>{formatTokens(quota.remainingTokens)}</div>
          <div style={s.remainingLabel}>tokens left</div>
        </div>
      </div>

      <div style={s.barTrack}>
        <div style={{ ...s.barFill, width: `${pct}%`, background: barColor }} />
      </div>

      <div style={s.statsRow}>
        <span>{formatTokens(quota.tokensUsed)} used</span>
        <span>{formatTokens(quota.monthlyLimit)} monthly limit</span>
      </div>

      {isWarning && (
        <div style={s.warningBanner}>
          ⚠️ You've used {Math.round(pct)}% of your monthly AI quota. Consider upgrading if you're close to your limit often.
        </div>
      )}

      {isBlocked && (
        <div style={s.blockedBanner}>
          🚫 You've reached your monthly AI limit. Curry AI is paused until your quota resets on <strong>{formatResetDate(quota.resetDate)}</strong>, or you can upgrade your plan for more tokens right away.
        </div>
      )}

      <div style={s.footerRow}>
        <span style={s.footerLabel}>Next reset</span>
        <span style={s.footerValue}>{formatResetDate(quota.resetDate)}</span>
      </div>

      {quota.plan !== 'enterprise' && (
        <button style={s.upgradeBtn} onClick={() => setShowUpgradeModal(true)}>
          ✨ Upgrade Plan
        </button>
      )}

      {showUpgradeModal && (
        <UpgradeModal
          currentPlan={quota.plan}
          onClose={() => setShowUpgradeModal(false)}
          onChanged={load}
        />
      )}
    </div>
  )
}

const s = {
  card: {
    background: 'var(--bg-surface-2, #1b1930)',
    border: '1px solid var(--border, rgba(255,255,255,0.08))',
    borderRadius: 16,
    padding: '18px 18px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 14,
    fontWeight: 800,
    color: 'var(--text-primary, #fff)',
  },
  planBadge: {
    display: 'inline-block',
    marginTop: 4,
    fontSize: 10.5,
    fontWeight: 700,
    color: '#c4b5fd',
    background: 'rgba(167,139,250,0.12)',
    border: '1px solid rgba(167,139,250,0.3)',
    borderRadius: 20,
    padding: '2px 9px',
  },
  remainingWrap: { textAlign: 'right' },
  remainingNumber: {
    fontSize: 20,
    fontWeight: 800,
    color: '#c4b5fd',
    lineHeight: 1.1,
  },
  remainingLabel: {
    fontSize: 10.5,
    color: 'var(--text-muted, #9ca3af)',
    fontWeight: 600,
  },
  barTrack: {
    width: '100%',
    height: 10,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 20,
    transition: 'width 0.4s ease',
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11.5,
    color: 'var(--text-muted, #9ca3af)',
    fontWeight: 600,
  },
  warningBanner: {
    fontSize: 11.5,
    color: '#fbbf24',
    background: 'rgba(251,191,36,0.1)',
    border: '1px solid rgba(251,191,36,0.25)',
    borderRadius: 10,
    padding: '8px 11px',
    lineHeight: 1.5,
  },
  blockedBanner: {
    fontSize: 11.5,
    color: '#f87171',
    background: 'rgba(248,113,113,0.1)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: 10,
    padding: '8px 11px',
    lineHeight: 1.5,
  },
  footerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11.5,
    paddingTop: 4,
    borderTop: '1px solid var(--border, rgba(255,255,255,0.06))',
  },
  footerLabel: { color: 'var(--text-muted, #9ca3af)', fontWeight: 600 },
  footerValue: { color: 'var(--text-primary, #fff)', fontWeight: 700 },
  retryBtn: {
    marginTop: 8,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border, rgba(255,255,255,0.1))',
    borderRadius: 10,
    color: 'var(--text-primary, #fff)',
    fontSize: 11.5,
    fontWeight: 700,
    padding: '6px 12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
  },
  upgradeBtn: {
    background: 'linear-gradient(135deg,#667eea,#764ba2)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 12.5,
    fontWeight: 700,
    padding: '10px 14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}

const m = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: 'var(--bg-surface-2, #1b1930)',
    border: '1px solid var(--border, rgba(255,255,255,0.1))',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 460,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text-primary, #fff)',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border, rgba(255,255,255,0.1))',
    borderRadius: 8,
    color: 'var(--text-primary, #fff)',
    width: 28,
    height: 28,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
  },
  plansRow: {
    display: 'flex',
    gap: 10,
  },
  planCard: {
    flex: 1,
    position: 'relative',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border, rgba(255,255,255,0.1))',
    borderRadius: 14,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  planCardActive: {
    border: '1px solid #a78bfa',
    background: 'rgba(167,139,250,0.1)',
    cursor: 'default',
  },
  currentBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    fontSize: 9,
    fontWeight: 700,
    color: '#c4b5fd',
    background: 'rgba(167,139,250,0.15)',
    border: '1px solid rgba(167,139,250,0.3)',
    borderRadius: 20,
    padding: '2px 7px',
  },
  planName: {
    fontSize: 14,
    fontWeight: 800,
    color: 'var(--text-primary, #fff)',
  },
  planPrice: {
    fontSize: 12,
    fontWeight: 700,
    color: '#c4b5fd',
  },
  planLimit: {
    fontSize: 11,
    color: 'var(--text-muted, #9ca3af)',
    fontWeight: 600,
  },
  planTagline: {
    fontSize: 10.5,
    color: 'var(--text-muted, #9ca3af)',
  },
  switchLabel: {
    marginTop: 6,
    fontSize: 10.5,
    fontWeight: 700,
    color: '#a78bfa',
  },
  error: {
    fontSize: 11.5,
    color: '#f87171',
    background: 'rgba(248,113,113,0.1)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: 10,
    padding: '8px 11px',
  },
  note: {
    fontSize: 10.5,
    color: 'var(--text-muted, #9ca3af)',
    textAlign: 'center',
  },
}
