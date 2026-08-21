import React, { useState } from 'react'
import { IconX, IconFlower, IconUsers, IconLock } from '../Icons'
import { completeCycleOnboarding } from '../../lib/cycle'

export default function CycleOnboarding({ userId, onComplete, onClose }) {
  const [step, setStep] = useState(0) // 0 = intro, 1 = last period, 2 = cycle length
  const [lastPeriodStart, setLastPeriodStart] = useState('')
  const [dontKnow, setDontKnow] = useState(false)
  const [averageCycleLength, setAverageCycleLength] = useState(28)
  const [saving, setSaving] = useState(false)

  const finish = async () => {
    setSaving(true)
    try {
      await completeCycleOnboarding(userId, {
        lastPeriodStart: dontKnow ? null : (lastPeriodStart || null),
        averageCycleLength,
        averagePeriodLength: 5,
      })
      onComplete()
    } catch (e) {
      console.error('completeCycleOnboarding failed:', e)
      alert('Could not save your cycle info — please try again.')
    }
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 700,
      background: 'linear-gradient(160deg, #1b1730 0%, #14121f 60%)',
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconX size={15} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px 60px', maxWidth: 420, margin: '0 auto', width: '100%' }}>

        {step === 0 && (
          <div style={{ textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.25), rgba(108,99,255,0.15))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(167,139,250,0.3)',
            }}>
              <IconFlower size={30} style={{ color: '#c4b5fd' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
              Your cycle. Your privacy.<br />Your choice.
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 32 }}>
              Track periods, symptoms, and moods. Get gentle reminders. Understand your patterns.
              Everything stays private unless you choose to share it.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', marginBottom: 32 }}>
              <FeatureRow icon={<IconLock size={16} />} text="Private by default — nobody sees your data unless you allow it" />
              <FeatureRow icon={<IconUsers size={16} />} text='Optionally share select info with up to two "Trusted People"' />
              <FeatureRow icon={<IconFlower size={16} />} text="Estimates, never guarantees — this isn't a diagnostic tool" />
            </div>

            <button className="btn-primary" style={{ width: '100%', padding: 14, fontSize: 14.5 }} onClick={() => setStep(1)}>
              Get started →
            </button>
          </div>
        )}

        {step === 1 && (
          <div style={{ width: '100%', animation: 'fadeIn 0.4s ease' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              Let's get to know your cycle 🌸
            </h2>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
              When did your last period start?
            </p>

            <input
              type="date"
              value={lastPeriodStart}
              onChange={e => { setLastPeriodStart(e.target.value); setDontKnow(false) }}
              max={new Date().toISOString().slice(0, 10)}
              disabled={dontKnow}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(167,139,250,0.3)',
                background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14.5, fontFamily: 'inherit',
                marginBottom: 14, opacity: dontKnow ? 0.4 : 1,
              }}
            />

            <button
              onClick={() => setDontKnow(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, background: dontKnow ? 'rgba(167,139,250,0.15)' : 'none',
                border: `1px solid ${dontKnow ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 12, padding: '10px 14px', width: '100%', color: dontKnow ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 28,
              }}
            >
              I don't know my last period
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep(0)}>Back</button>
              <button
                className="btn-primary" style={{ flex: 2 }}
                onClick={() => setStep(2)}
                disabled={!dontKnow && !lastPeriodStart}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ width: '100%', animation: 'fadeIn 0.4s ease' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              About how long is your cycle?
            </h2>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
              A typical cycle runs 21–35 days. You can refine this anytime as we learn your pattern.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 32 }}>
              <button
                onClick={() => setAverageCycleLength(v => Math.max(21, v - 1))}
                style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 18, cursor: 'pointer' }}
              >−</button>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', minWidth: 70, textAlign: 'center', fontFamily: 'var(--font-display)' }}>
                {averageCycleLength}
              </div>
              <button
                onClick={() => setAverageCycleLength(v => Math.min(35, v + 1))}
                style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 18, cursor: 'pointer' }}
              >+</button>
            </div>
            <div style={{ textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>days</div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
              <button className="btn-primary" style={{ flex: 2 }} onClick={finish} disabled={saving}>
                {saving ? 'Setting up…' : 'Start tracking →'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  )
}

function FeatureRow({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px' }}>
      <span style={{ color: '#c4b5fd', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{text}</span>
    </div>
  )
}
