import React, { useState, useEffect } from 'react'
import { IconX } from '../Icons'
import { getDailyLog, upsertDailyLog } from '../../lib/cycle'

const MOODS = ['Great', 'Good', 'Okay', 'Low', 'Irritated', 'Emotional', 'Anxious']
const ENERGY = ['Very low', 'Low', 'Medium', 'High', 'Very high']
const FLOWS = ['None', 'Spotting', 'Light', 'Medium', 'Heavy']
const SLEEP = ['Poor', 'Okay', 'Good', 'Excellent']
const SYMPTOMS = ['Cramps', 'Headache', 'Bloating', 'Back pain', 'Acne', 'Nausea', 'Breast tenderness', 'Cravings', 'Fatigue', 'Other']

const slug = (s) => s.toLowerCase().replace(/\s+/g, '_')

export default function CycleCheckin({ userId, dateStr, onSaved, onClose }) {
  const [mood, setMood] = useState(null)
  const [energy, setEnergy] = useState(null)
  const [pain, setPain] = useState(0)
  const [flow, setFlow] = useState(null)
  const [sleep, setSleep] = useState(null)
  const [symptoms, setSymptoms] = useState([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    getDailyLog(userId, dateStr).then(log => {
      if (cancelled || !log) { setLoading(false); return }
      setMood(log.mood); setEnergy(log.energy); setPain(log.pain ?? 0)
      setFlow(log.flow); setSleep(log.sleep); setSymptoms(log.symptoms || [])
      setNotes(log.notes || '')
      setLoading(false)
    }).catch(() => setLoading(false))
    return () => { cancelled = true }
  }, [userId, dateStr])

  const toggleSymptom = (s) => {
    const key = slug(s)
    setSymptoms(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])
  }

  const save = async () => {
    setSaving(true)
    try {
      await upsertDailyLog(userId, dateStr, {
        mood: mood ? slug(mood) : null,
        energy: energy ? slug(energy) : null,
        pain,
        flow: flow ? slug(flow) : null,
        sleep: sleep ? slug(sleep) : null,
        symptoms,
        notes: notes.trim() || null,
      })
      setSaved(true)
      onSaved?.()
      setTimeout(onClose, 700) // brief success beat, per "gentle success animation after logging"
    } catch (e) {
      console.error('save daily log failed:', e)
      alert('Could not save your check-in — please try again.')
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto',
          background: 'linear-gradient(160deg, #1e1a35 0%, #17152a 100%)',
          borderRadius: '24px 24px 0 0', padding: '18px 20px calc(24px + env(safe-area-inset-bottom,0px))',
          animation: 'panelUp 0.28s cubic-bezier(0.34,1.56,0.64,1)', border: '1px solid rgba(167,139,250,0.15)', borderBottom: 'none',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.2)', margin: '0 auto 16px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>How are you feeling today?</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{dateStr}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', cursor: 'pointer', flexShrink: 0 }}><IconX size={13} /></button>
        </div>

        {saved ? (
          <div style={{ textAlign: 'center', padding: '30px 0', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🌸</div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#c4b5fd' }}>Saved</div>
          </div>
        ) : loading ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <ChipSection title="Mood" options={MOODS} value={mood} onChange={setMood} />
            <ChipSection title="Energy" options={ENERGY} value={energy} onChange={setEnergy} />

            <div>
              <SectionLabel>Pain</SectionLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range" min="0" max="10" value={pain}
                  onChange={e => setPain(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#a78bfa' }}
                />
                <div style={{ width: 28, textAlign: 'center', fontWeight: 800, color: '#c4b5fd', fontSize: 15 }}>{pain}</div>
              </div>
            </div>

            <ChipSection title="Flow" options={FLOWS} value={flow} onChange={setFlow} />
            <ChipSection title="Sleep" options={SLEEP} value={sleep} onChange={setSleep} />

            <div>
              <SectionLabel>Symptoms</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SYMPTOMS.map(s => (
                  <Chip key={s} active={symptoms.includes(slug(s))} onClick={() => toggleSymptom(s)}>{s}</Chip>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Private notes</SectionLabel>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Just for you…"
                rows={3}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, padding: '10px 12px', color: '#fff', fontSize: 13.5, fontFamily: 'inherit', resize: 'none', outline: 'none',
                }}
              />
            </div>

            <button className="btn-primary" style={{ padding: 14, fontSize: 14.5, borderRadius: 16 }} onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save check-in'}
            </button>
          </div>
        )}

        <style>{`@keyframes fadeIn { from { opacity:0; transform: scale(0.95);} to {opacity:1; transform:none;} }`}</style>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{children}</div>
}

function ChipSection({ title, options, value, onChange }) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => (
          <Chip key={o} active={value === slug(o)} onClick={() => onChange(slug(o))}>{o}</Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${active ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.12)'}`,
        background: active ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : 'rgba(255,255,255,0.05)',
        color: active ? '#fff' : 'rgba(255,255,255,0.65)',
        transition: 'all 0.15s cubic-bezier(0.34,1.56,0.64,1)',
        transform: active ? 'scale(1.03)' : 'scale(1)',
      }}
    >
      {children}
    </button>
  )
}
