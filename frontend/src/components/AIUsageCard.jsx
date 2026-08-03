import React, { useState, useEffect, useCallback } from 'react'
import { getAiQuota } from '../lib/supabase'

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

export default function AIUsageCard({ userId }) {
  const [quota, setQuota] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

      {quota.plan === 'free' && (
        <button style={s.upgradeBtn}>✨ Upgrade Plan</button>
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
