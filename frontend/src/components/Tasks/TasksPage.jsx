import React, { useState } from 'react'
import { useTasks } from '../../hooks/useTasks'
import { confirmTask, dismissTask, completeTask, updateTask, findStudySpot, pushTaskToCalendar, geocodeLocation } from '../../lib/supabase'

const PRIORITY_COLOR = { urgent: '#ef4444', high: '#f59e0b', medium: '#a78bfa', low: '#6b7280' }

function RescheduleRow({ task, onDone }) {
  const [date, setDate] = useState(task.due_date || '')
  const [time, setTime] = useState(task.due_time || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await updateTask(task.id, { due_date: date || null, due_time: time || null })
      onDone()
    } catch (e) {
      console.error('Reschedule failed:', e)
    }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', color: 'var(--text-primary)', fontSize: 11.5, fontFamily: 'inherit' }}
      />
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', color: 'var(--text-primary)', fontSize: 11.5, fontFamily: 'inherit' }}
      />
      <button onClick={save} disabled={saving} style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
        {saving ? '…' : 'Save'}
      </button>
      <button onClick={onDone} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 11, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
        Cancel
      </button>
    </div>
  )
}

function IconCalendarSmall({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

function IconTagSmall({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41L11 3.83A2 2 0 0 0 9.59 3.17L4 3a1 1 0 0 0-1 1l.17 5.59a2 2 0 0 0 .66 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.82z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconMailSmall({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" />
    </svg>
  )
}

function TaskCard({ task, onConfirm, onDismiss, onComplete, onOpenSourceEmail, onPushToCalendar, onFindPlace }) {
  const isPending = task.status === 'pending'
  const [rescheduling, setRescheduling] = useState(false)
  const [pushingToCalendar, setPushingToCalendar] = useState(false)
  const [findingSpot, setFindingSpot] = useState(false)

  // Study-type categories get a library/cafe/coworking search; meeting-type
  // categories get a cafe/restaurant/coworking search. Anything else gets
  // no button at all — a receipt or OTP has nowhere to "go do it."
  const isSchedulable = ['assignment', 'exam', 'meeting', 'event', 'job_interview'].includes(task.category)
  const purpose = ['meeting', 'event', 'job_interview'].includes(task.category) ? 'meeting' : 'study'

  const handlePushToCalendar = async () => {
    setPushingToCalendar(true)
    await onPushToCalendar?.(task.id)
    setPushingToCalendar(false)
  }

  const handleFindPlace = async () => {
    setFindingSpot(true)
    await onFindPlace?.(task, purpose)
    setFindingSpot(false)
  }

  return (
    <div style={{
      background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{task.title}</div>
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: PRIORITY_COLOR[task.priority] || '#a78bfa',
          background: `${PRIORITY_COLOR[task.priority] || '#a78bfa'}22`, borderRadius: 20, padding: '2px 8px',
        }}>{task.priority?.toUpperCase()}</span>
      </div>

      {task.description && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{task.description}</div>}

      <div style={{ display: 'flex', gap: 10, fontSize: 11.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        {task.due_date && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconCalendarSmall /> {task.due_date}{task.due_time ? ` · ${task.due_time}` : ''}</span>}
        {task.category && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconTagSmall /> {task.category}</span>}
        {task.source === 'email' && task.emails && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconMailSmall /> from {task.emails.sender}</span>}
      </div>

      {task.checklist?.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
          {task.checklist.map((c, i) => <li key={i}>{c.label}</li>)}
        </ul>
      )}

      {task.status !== 'completed' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {task.calendar_event_id ? (
            <span style={{ fontSize: 10.5, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4 }}>✓ On Calendar</span>
          ) : (
            <button onClick={handlePushToCalendar} disabled={pushingToCalendar} style={btnStyle('transparent', true)}>
              {pushingToCalendar ? 'Adding…' : 'Add to Calendar'}
            </button>
          )}

          {isSchedulable && (
            <button onClick={handleFindPlace} disabled={findingSpot} style={btnStyle('transparent', true)}>
              {findingSpot ? 'Finding…' : purpose === 'meeting' ? '📍 Find a place to meet' : '📍 Find a place to study'}
            </button>
          )}
        </div>
      )}

      {rescheduling && <RescheduleRow task={task} onDone={() => setRescheduling(false)} />}

      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        {isPending ? (
          <>
            <button onClick={() => onConfirm(task.id)} style={btnStyle('#667eea')}>Confirm task</button>
            <button onClick={() => onDismiss(task.id)} style={btnStyle('transparent', true)}>Not relevant</button>
          </>
        ) : (
          <>
            {task.status !== 'completed' && (
              <button onClick={() => onComplete(task.id)} style={btnStyle('#22c55e')}>Mark complete</button>
            )}
            {task.status !== 'completed' && !rescheduling && (
              <button onClick={() => setRescheduling(true)} style={btnStyle('transparent', true)}>Reschedule</button>
            )}
            {task.source === 'email' && task.source_email_id && (
              <button onClick={() => onOpenSourceEmail(task)} style={btnStyle('transparent', true)}>View email</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StudySpotModal({ task, data, onClose }) {
  if (!data?.ok) {
    return (
      <div className="profile-menu-overlay" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface-1)', borderRadius: 16, padding: 20, width: 'min(360px,90vw)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{data?.error || 'Could not find a place right now.'}</div>
          <button onClick={onClose} style={{ marginTop: 12, ...btnStyle('#667eea') }}>Close</button>
        </div>
      </div>
    )
  }

  if (data.spots?.length === 0) {
    return (
      <div className="profile-menu-overlay" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface-1)', borderRadius: 16, padding: 20, width: 'min(360px,90vw)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{data.message || 'No spots found nearby.'}</div>
          <button onClick={onClose} style={{ marginTop: 12, ...btnStyle('#667eea') }}>Close</button>
        </div>
      </div>
    )
  }

  const { recommended, route, alternatives } = data
  const mins = route ? Math.round(route.durationSeconds / 60) : null

  return (
    <div className="profile-menu-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface-1)', borderRadius: 16, padding: 20, width: 'min(400px,92vw)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>For "{task.title}"</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{recommended.name}</div>
        <div style={{ fontSize: 11.5, color: '#a78bfa', fontWeight: 700 }}>{recommended.type}</div>
        {recommended.address && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{recommended.address}</div>}
        <div style={{ display: 'flex', gap: 10, fontSize: 12, flexWrap: 'wrap' }}>
          {recommended.openingHours && <span>🕐 {recommended.openingHours}</span>}
          {mins != null && (
            <span>🚶 {mins} min{route.estimated ? ' (estimated)' : ''} ({(route.distanceMeters / 1000).toFixed(1)} km)</span>
          )}
        </div>

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${recommended.lat},${recommended.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...btnStyle('#667eea'), textAlign: 'center', textDecoration: 'none' }}
        >
          Open path in Maps
        </a>

        {alternatives?.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Other options nearby</div>
            {alternatives.map((a, i) => (
              <div key={i} style={{ fontSize: 11.5, color: 'var(--text-secondary)', padding: '2px 0' }}>
                {a.name} <span style={{ color: 'var(--text-muted)' }}>· {a.type}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} style={btnStyle('transparent', true)}>Close</button>
      </div>
    </div>
  )
}

function btnStyle(bg, ghost = false) {
  return {
    background: ghost ? 'none' : bg, border: ghost ? '1px solid var(--border)' : 'none',
    borderRadius: 20, color: ghost ? 'var(--text-muted)' : '#fff', fontSize: 11.5, fontWeight: 700,
    padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
  }
}

export default function TasksPage({ userId, session }) {
  const { pendingConfirmation, active, completed, loading, reload } = useTasks(userId)
  const [studySpotResult, setStudySpotResult] = useState(null) // { task, data } | null

  const handle = (fn) => async (taskId) => { await fn(taskId); reload() }
  const onConfirm = handle(confirmTask)
  const onDismiss = handle(dismissTask)
  const onComplete = handle(completeTask)

  // Pushes a confirmed task onto the user's real Google Calendar via
  // calendar-actions. Surfaces a clear message if the account needs
  // to be reconnected with write access (old readonly-scope tokens).
  const onPushToCalendar = async (taskId) => {
    if (!session) {
      alert('Session not available — please refresh and try again.')
      return
    }
    try {
      const res = await pushTaskToCalendar(session, taskId)
      if (!res.ok) {
        alert(res.error || 'Could not add this to your calendar.')
        return
      }
      reload()
    } catch (e) {
      console.error('pushTaskToCalendar failed:', e)
      alert('Could not add this to your calendar.')
    }
  }

  // Asks for real location every time rather than guessing — tries
  // live browser geolocation first, and if that's denied/unavailable,
  // prompts the user to type a city/campus/address which gets geocoded
  // server-side via Nominatim. Never searches on a silently-assumed
  // location. purpose is 'study' (library/cafe/coworking/bookstore) or
  // 'meeting' (cafe/restaurant/coworking/community centre).
  const onFindPlace = async (task, purpose) => {
    if (!session) {
      setStudySpotResult({ task, data: { ok: false, error: 'Session not available — please refresh and try again.' } })
      return
    }

    let coords = null
    let permissionDenied = false

    if (navigator.geolocation) {
      coords = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => { permissionDenied = err.code === err.PERMISSION_DENIED; resolve(null) },
          { timeout: 8000, enableHighAccuracy: true }
        )
      })
    }

    if (!coords) {
      const manualAddress = window.prompt(
        permissionDenied
          ? 'Location access was denied. Type your city, campus, or address so I can search near you:'
          : "Couldn't get your location automatically. Type your city, campus, or address:"
      )
      if (!manualAddress || !manualAddress.trim()) return // user cancelled — don't search blind

      try {
        const geo = await geocodeLocation(session, manualAddress.trim())
        if (!geo.ok) {
          setStudySpotResult({ task, data: { ok: false, error: "Couldn't find that location — try being more specific." } })
          return
        }
        coords = { lat: geo.place.lat, lng: geo.place.lng }
      } catch (e) {
        console.error('geocodeLocation failed:', e)
        setStudySpotResult({ task, data: { ok: false, error: "Couldn't look up that location right now." } })
        return
      }
    }

    try {
      const result = await findStudySpot(session, { ...coords, purpose })
      setStudySpotResult({ task, data: result })
    } catch (e) {
      console.error('findStudySpot failed:', e)
      setStudySpotResult({ task, data: { ok: false, error: 'Could not reach the place finder right now.' } })
    }
  }

  const onOpenSourceEmail = (task) => {
    const email = task.emails
    alert(email ? `From: ${email.sender}\nSubject: ${email.subject}` : 'Original email not found.')
  }

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading tasks…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 16, maxWidth: 640, margin: '0 auto' }}>
      {pendingConfirmation.length > 0 && (
        <section>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24', marginBottom: 8 }}>
            Needs your confirmation ({pendingConfirmation.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingConfirmation.map(t => (
              <TaskCard
                key={t.id}
                task={t}
                onConfirm={onConfirm}
                onDismiss={onDismiss}
                onComplete={onComplete}
                onOpenSourceEmail={onOpenSourceEmail}
                onPushToCalendar={onPushToCalendar}
                onFindPlace={onFindPlace}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
          Active ({active.length})
        </h3>
        {active.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Nothing active — you're caught up.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {active.map(t => (
              <TaskCard
                key={t.id}
                task={t}
                onConfirm={onConfirm}
                onDismiss={onDismiss}
                onComplete={onComplete}
                onOpenSourceEmail={onOpenSourceEmail}
                onPushToCalendar={onPushToCalendar}
                onFindPlace={onFindPlace}
              />
            ))}
          </div>
        )}
      </section>

      {completed.length > 0 && (
        <section>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 8 }}>
            Completed ({completed.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {completed.map(t => (
              <TaskCard
                key={t.id}
                task={t}
                onConfirm={onConfirm}
                onDismiss={onDismiss}
                onComplete={onComplete}
                onOpenSourceEmail={onOpenSourceEmail}
                onPushToCalendar={onPushToCalendar}
                onFindPlace={onFindPlace}
              />
            ))}
          </div>
        </section>
      )}

      {studySpotResult && (
        <StudySpotModal
          task={studySpotResult.task}
          data={studySpotResult.data}
          onClose={() => setStudySpotResult(null)}
        />
      )}
    </div>
  )
}
