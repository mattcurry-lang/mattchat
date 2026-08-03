import React, { useState, useEffect, useCallback } from 'react'
import { getAiQuota, startCheckout, openBillingPortal, changeAiPlan } from '../lib/supabase'

const PLAN_LABELS = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' }

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

function UpgradeModal({ onClose }) {
  const [interval, setInterval_] = useState('annual') // default to the better deal
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubscribe = async () => {
    setLoading(true)
    setError(null)
    try {
      const { url } = await startCheckout(interval)
      window.location.href = url
    } catch (e) {
      console.error('startCheckout failed:', e)
      setError(e.message || 'Something went wrong starting checkout.')
      setLoading(false)
    }
  }

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={m.modal} onClick={(e) => e.stopPropagation()}>
        <div style={m.header}>
          <div style={m.title}>Upgrade to Pro</div>
          <button style={m.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={m.proSummary}>
          <div style={m.proHeadline}>Effectively unlimited Curry AI</div>
          <div style={m.proSub}>No more watching a token bar — just chat.</div>
        </div>

        <div style={m.intervalToggle}>
          <button
            style={{ ...m.intervalBtn, ...(interval === 'monthly' ? m.intervalBtnActive : {}) }}
            onClick={() => setInterval_('monthly')}
          >
            <div style={m.intervalPrice}>$9.99<span style={m.intervalUnit}>/mo</span></div>
            <div style={m.intervalLabel}>Monthly</div>
          </button>
          <button
            style={{ ...m.intervalBtn, ...(interval === 'annual' ? m.intervalBtnActive : {}) }}
            onClick={() => setInterval_('annual')}
          >
            <div style={m.savingsBadge}>2 months free</div>
            <div style={m.intervalPrice}>$99.90<span style={m.intervalUnit}>/yr</span></div>
            <div style={m.intervalLabel}>Annual</div>
          </button>
        </div>

        {error && <div style={m.error}>{error}</div>}

        <button style={m.subscribeBtn} onClick={handleSubscribe} disabled={loading}>
          {loading ? 'Redirecting to checkout…' : `Continue — $${interval === 'monthly' ? '9.99/mo' : '99.90/yr'}`}
        </button>

        <div style={m.note}>Secure checkout via Stripe. Cancel anytime.</div>
      </div>
    </div>
  )
}

export default function AIUsageCard({ userId }) {
  const [quota, setQuota] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [downgrading, setDowngrading] = useState(false)

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

  const handleManageBilling = async () => {
    setPortalLoading(true)
    try {
      const { url } = await openBillingPortal()
      window.location.href = url
    } catch (e) {
      console.error('openBillingPortal failed:', e)
      setPortalLoading(false)
    }
  }

  const handleDowngrade = async () => {
    if (!window.confirm('Cancel Pro and go back to the Free plan?')) return
    setDowngrading(true)
    try {
      await changeAiPlan('free')
      await load()
    } catch (e) {
      console.error('changeAiPlan(free) failed:', e)
    }
    setDowngrading(false)
  }

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

  const isPro = quota.plan === 'pro' || quota.plan === 'enterprise'
  const pct = quota.monthlyLimit > 0 ? Math.min(100, (quota.tokensUsed / quota.monthlyLimit) * 100) : 0
  const isWarning = !isPro && pct >= 80 && pct < 100
  const isBlocked = !isPro && pct >= 100

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
          {isPro ? (
            <div style={s.unlimitedBadge}>∞ Unlimited</div>
          ) : (
            <>
              <div style={s.remainingNumber}>{formatTokens(quota.remainingTokens)}</div>
              <div style={s.remainingLabel}>tokens left</div>
            </>
          )}
        </div>
      </div>

      {!isPro && (
        <>
          <div style={s.barTrack}>
            <div style={{ ...s.barFill, width: `${pct}%`, background: barColor }} />
          </div>
          <div style={s.statsRow}>
            <span>{formatTokens(quota.tokensUsed)} used</span>
            <span>{formatTokens(quota.monthlyLimit)} monthly limit</span>
          </div>
        </>
      )}

      {isWarning && (
        <div style={s.warningBanner}>
          ⚠️ You've used {Math.round(pct)}% of your monthly AI quota. Upgrade to Pro for unlimited usage.
        </div>
      )}

      {isBlocked && (
        <div style={s.blockedBanner}>
          🚫 You've reached your monthly AI limit. Curry AI is paused until your quota resets on <strong>{formatResetDate(quota.resetDate)}</strong>, or upgrade to Pro for unlimited usage right away.
        </div>
      )}

      <div style={s.footerRow}>
        <span style={s.footerLabel}>{isPro ? 'Billed' : 'Next reset'}</span>
        <span style={s.footerValue}>{isPro ? (quota.billingInterval === 'annual' ? 'Annually' : 'Monthly') : formatResetDate(quota.resetDate)}</span>
      </div>

      {!isPro && (
        <button style={s.upgradeBtn} onClick={() => setShowUpgradeModal(true)}>
          ✨ Upgrade to Pro — Unlimited
        </button>
      )}

      {quota.plan === 'pro' && (
        <div style={s.proActions}>
          <button style={s.manageBtn} onClick={handleManageBilling} disabled={portalLoading}>
            {portalLoading ? 'Opening…' : 'Manage billing'}
          </button>
          <button style={s.downgradeBtn} onClick={handleDowngrade} disabled={downgrading}>
            {downgrading ? 'Cancelling…' : 'Cancel Pro'}
          </button>
        </div>
      )}

      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
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
  unlimitedBadge: {
    fontSize: 16,
    fontWeight: 800,
    color: '#34d399',
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
  proActions: {
    display: 'flex',
    gap: 8,
  },
  manageBtn: {
    flex: 1,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border, rgba(255,255,255,0.1))',
    borderRadius: 10,
    color: 'var(--text-primary, #fff)',
    fontSize: 11.5,
    fontWeight: 700,
    padding: '9px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  downgradeBtn: {
    background: 'transparent',
    border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 10,
    color: '#f87171',
    fontSize: 11.5,
    fontWeight: 700,
    padding: '9px 10px',
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
    maxWidth: 420,
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
  proSummary: {
    background: 'rgba(167,139,250,0.08)',
    border: '1px solid rgba(167,139,250,0.2)',
    borderRadius: 12,
    padding: '12px 14px',
    textAlign: 'center',
  },
  proHeadline: {
    fontSize: 14,
    fontWeight: 800,
    color: '#c4b5fd',
  },
  proSub: {
    fontSize: 11.5,
    color: 'var(--text-muted, #9ca3af)',
    marginTop: 2,
  },
  intervalToggle: {
    display: 'flex',
    gap: 10,
  },
  intervalBtn: {
    flex: 1,
    position: 'relative',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border, rgba(255,255,255,0.1))',
    borderRadius: 14,
    padding: '16px 10px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  intervalBtnActive: {
    border: '1px solid #a78bfa',
    background: 'rgba(167,139,250,0.1)',
  },
  savingsBadge: {
    position: 'absolute',
    top: -9,
    fontSize: 9,
    fontWeight: 700,
    color: '#34d399',
    background: 'rgba(52,211,153,0.15)',
    border: '1px solid rgba(52,211,153,0.3)',
    borderRadius: 20,
    padding: '2px 8px',
  },
  intervalPrice: {
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--text-primary, #fff)',
  },
  intervalUnit: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted, #9ca3af)',
  },
  intervalLabel: {
    fontSize: 11,
    color: 'var(--text-muted, #9ca3af)',
    fontWeight: 600,
  },
  subscribeBtn: {
    background: 'linear-gradient(135deg,#667eea,#764ba2)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    padding: '12px 14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
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
