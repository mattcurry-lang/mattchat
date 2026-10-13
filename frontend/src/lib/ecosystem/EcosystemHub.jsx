// src/components/Ecosystem/EcosystemHub.jsx
// The Mattchat Ecosystem screen: see, build and control how your apps work together.
//
// Props:
//   userId          current user's id (required)
//   conversations   [{ id, name }]  chats a flow may post into (no Curry AI)
//   onClose         () => void
//   onOpenLauncher  () => void      optional: opens the plain app launcher

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Z } from '../../lib/zLayers'
import { subscribeToChannel } from '../../lib/realtimeManager'
import {
  getAllEcosystemApps, getEcosystemApp, getEventDefinition, getActionDefinition,
  listAllEvents, listAllActions, describeScopes,
  getConnections, connectApp, disconnectApp,
  listFlows, createFlow, setFlowEnabled, deleteFlow, listRuns,
} from '../../lib/ecosystem'

const APP_COLORS = { mattchat: '#7c3aed', tasks: '#0ea5e9', gmail: '#ea4335', google_calendar: '#1a73e8' }
const appColor = (id) => APP_COLORS[id] || '#6c6585'

// Suggested automations. Tapping "Turn on" creates a normal flow the user can edit or delete.
const TEMPLATES = [
  {
    id: 'cal', title: 'Confirmed tasks go to my calendar',
    desc: 'When you confirm a task, it is added to Google Calendar.',
    triggerEvent: 'task.confirmed', actionType: 'calendar.push_task', actionParams: { taskId: '{{taskId}}' },
  },
  {
    id: 'announce-confirmed', title: 'Tell a chat when I confirm a task',
    desc: 'Posts a short note in the chat you choose.',
    triggerEvent: 'task.confirmed', actionType: 'message.send', needsChat: true,
    actionParams: { text: '🤖 Task confirmed: {{title}}' },
  },
  {
    id: 'announce-done', title: 'Tell a chat when I finish a task',
    desc: 'Posts a short note in the chat you choose.',
    triggerEvent: 'task.completed', actionType: 'message.send', needsChat: true,
    actionParams: { text: '🤖 Done: {{title}}' },
  },
]

// ── helpers ──────────────────────────────────────────────
function timeAgo(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function describeRun(run) {
  const err = run.error || ''
  const [code, detail] = err.split(':')
  const appName = (id) => getEcosystemApp(id)?.name || id
  if (run.status === 'ok') return { tone: 'ok', text: 'Done' }
  if (run.status === 'running') return { tone: 'info', text: 'Running…' }
  if (run.status === 'skipped') {
    if (code === 'app_not_connected') return { tone: 'warn', text: `Skipped: ${appName(detail)} isn’t connected` }
    if (code === 'loop_guard') return { tone: 'warn', text: 'Skipped: it would have replied to the chat that triggered it' }
    if (code === 'rate_limited') return { tone: 'warn', text: 'Paused: too many runs this hour' }
    return { tone: 'warn', text: 'Skipped' }
  }
  if (code === 'missing_param') return { tone: 'bad', text: `Couldn’t run: missing ${detail}` }
  return { tone: 'bad', text: `Failed${err ? `: ${err}` : ''}`.slice(0, 120) }
}

function flowSummary(flow) {
  const t = getEventDefinition(flow.trigger_event)
  const a = getActionDefinition(flow.action_type)
  const when = t ? `${t.app.name}: ${t.event.label}` : flow.trigger_event
  const then = a ? `${a.app.name}: ${a.action.label}` : flow.action_type
  return { when, then }
}

function Switch({ on, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      className={`eh-switch${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

function AppDot({ id, size = 36 }) {
  const app = getEcosystemApp(id)
  return (
    <span className="eh-dot" style={{ width: size, height: size, background: appColor(id), fontSize: size * 0.44 }}>
      {(app?.name || id).slice(0, 1)}
    </span>
  )
}

// ── main component ───────────────────────────────────────
export default function EcosystemHub({ userId, conversations = [], onClose, onOpenLauncher }) {
  const [tab, setTab] = useState('flows')
  const [flows, setFlows] = useState([])
  const [connections, setConnections] = useState([])
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [builder, setBuilder] = useState(false)
  const [consent, setConsent] = useState(null)      // { spec, apps, lines }
  const [pickChat, setPickChat] = useState(null)    // { template }
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const connected = useMemo(
    () => new Set(['mattchat', ...connections.filter((c) => c.status === 'active').map((c) => c.app_id)]),
    [connections]
  )
  const chatName = useCallback((id) => conversations.find((c) => c.id === id)?.name || 'a chat', [conversations])

  const refresh = useCallback(async () => {
    const [f, c, r] = await Promise.all([
      listFlows(userId).catch(() => []),
      getConnections(userId),
      listRuns(40).catch(() => []),
    ])
    setFlows(f); setConnections(c); setRuns(r); setLoading(false)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  // Live updates while the Hub is open: runs appear as the engine works.
  useEffect(() => {
    if (!userId) return undefined
    let t
    const unsub = subscribeToChannel(
      `eco-runs:${userId}`,
      (channel, emit) => channel.on('postgres_changes', { event: '*', schema: 'public', table: 'eco_flow_runs' }, () => emit('change')),
      { onEvent: () => { clearTimeout(t); t = setTimeout(refresh, 400) } }
    )
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); unsub(); window.removeEventListener('keydown', onKey) }
  }, [userId, refresh, onClose])

  useEffect(() => { if (!notice) return undefined; const t = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(t) }, [notice])

  const lastRunByFlow = useMemo(() => {
    const m = {}
    runs.forEach((r) => { if (r.flow_id && !m[r.flow_id]) m[r.flow_id] = r })
    return m
  }, [runs])

  // ── creating a flow, always through a consent step ─────
  const requestFlow = useCallback((spec) => {
    const trig = getEventDefinition(spec.triggerEvent)
    const act = getActionDefinition(spec.actionType)
    if (!trig || !act) { setNotice('That automation uses an app that isn’t available.'); return }

    const missing = [...new Set([trig.app.id, act.app.id])].filter((id) => !connected.has(id))
    const lines = []
    if (missing.includes(trig.app.id)) lines.push(`${trig.app.name} will tell Mattchat when: ${trig.event.label.toLowerCase()}`)
    if (missing.includes(act.app.id)) lines.push(`${act.app.name} will be asked to: ${act.action.label.toLowerCase()}`)
    const sends = act.action.id === 'message.send'
    if (sends) lines.push(`Mattchat will send a message from your account to ${chatName(spec.actionParams.conversationId)}`)

    if (!missing.length && !sends) { commit(spec, []); return }
    setConsent({ spec, apps: missing, lines })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, chatName])

  async function commit(spec, appsToConnect) {
    setBusy(true)
    try {
      for (const id of appsToConnect) {
        const ok = await connectApp(userId, id)
        if (!ok) throw new Error(`Couldn’t connect ${getEcosystemApp(id)?.name || id}`)
      }
      const trig = getEventDefinition(spec.triggerEvent)
      const act = getActionDefinition(spec.actionType)
      await createFlow(userId, {
        name: spec.name || `${trig.event.label} → ${act.action.label}`,
        triggerEvent: spec.triggerEvent,
        triggerFilter: spec.triggerFilter || {},
        actionType: spec.actionType,
        actionParams: spec.actionParams,
      })
      setConsent(null); setBuilder(false); setPickChat(null)
      setNotice('Flow is on')
      await refresh()
    } catch (e) {
      setNotice(e?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const turnOnTemplate = (tpl, conversationId) => {
    requestFlow({
      name: tpl.title, triggerEvent: tpl.triggerEvent, actionType: tpl.actionType,
      actionParams: conversationId ? { ...tpl.actionParams, conversationId } : tpl.actionParams,
    })
  }

  const toggleFlow = async (flow, enabled) => {
    setFlows((fs) => fs.map((f) => (f.id === flow.id ? { ...f, enabled } : f)))
    try { await setFlowEnabled(flow.id, enabled) } catch (e) { setNotice('Couldn’t update that flow'); refresh() }
  }
  const removeFlow = async (flow) => {
    if (!window.confirm(`Delete “${flow.name}”?`)) return
    try { await deleteFlow(flow.id); await refresh() } catch (e) { setNotice('Couldn’t delete that flow') }
  }
  const toggleApp = async (app, on) => {
    if (!on && !window.confirm(`Disconnect ${app.name}? Flows that use it will pause until you reconnect.`)) return
    const ok = on ? await connectApp(userId, app.id) : await disconnectApp(userId, app.id)
    if (!ok) setNotice('Couldn’t update that app')
    await refresh()
  }

  const usedTemplateIds = new Set(flows.map((f) => `${f.trigger_event}|${f.action_type}`))
  const suggestions = TEMPLATES.filter((t) => !usedTemplateIds.has(`${t.triggerEvent}|${t.actionType}`) || t.needsChat)

  return (
    <div className="eh-root" style={{ zIndex: Z.panel }} role="dialog" aria-label="Ecosystem">
      <style>{CSS}</style>

      <header className="eh-header">
        <button type="button" className="eh-back" onClick={onClose} aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div>
          <h1 className="eh-title">Ecosystem</h1>
          <p className="eh-sub">Your apps, working together.</p>
        </div>
      </header>

      <nav className="eh-tabs" aria-label="Sections">
        {[['flows', 'Flows'], ['apps', 'Apps'], ['activity', 'Activity']].map(([id, label]) => (
          <button key={id} type="button" className={`eh-tab${tab === id ? ' is-on' : ''}`} onClick={() => { setTab(id); if (id === 'activity') refresh() }} aria-pressed={tab === id}>
            {label}
          </button>
        ))}
      </nav>

      <main className="eh-scroll">
        {loading && <p className="eh-muted">Loading…</p>}

        {/* ───────── FLOWS ───────── */}
        {!loading && tab === 'flows' && (
          <>
            {suggestions.length > 0 && (
              <section>
                <h2 className="eh-h2">Suggested</h2>
                <ul className="eh-list">
                  {suggestions.map((t) => {
                    const trig = getEventDefinition(t.triggerEvent); const act = getActionDefinition(t.actionType)
                    return (
                      <li key={t.id} className="eh-card">
                        <div className="eh-apps">
                          <AppDot id={trig?.app.id} size={30} /><span className="eh-arrow">→</span><AppDot id={act?.app.id} size={30} />
                        </div>
                        <div className="eh-grow">
                          <div className="eh-name">{t.title}</div>
                          <div className="eh-muted">{t.desc}</div>
                        </div>
                        <button type="button" className="eh-btn" disabled={busy}
                          onClick={() => (t.needsChat ? setPickChat({ template: t }) : turnOnTemplate(t))}>
                          Turn on
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <section>
              <div className="eh-row">
                <h2 className="eh-h2">Your flows</h2>
                <button type="button" className="eh-link" onClick={() => setBuilder(true)}>+ New flow</button>
              </div>
              {flows.length === 0 ? (
                <p className="eh-empty">No flows yet. Turn on a suggestion above, or build your own.</p>
              ) : (
                <ul className="eh-list">
                  {flows.map((f) => {
                    const { when, then } = flowSummary(f)
                    const last = lastRunByFlow[f.id]
                    const lr = last ? describeRun(last) : null
                    return (
                      <li key={f.id} className={`eh-card eh-col${f.enabled ? '' : ' is-off'}`}>
                        <div className="eh-row">
                          <div className="eh-name eh-grow">{f.name}</div>
                          <Switch on={f.enabled} label={`${f.name} on or off`} onChange={(v) => toggleFlow(f, v)} />
                        </div>
                        <div className="eh-muted"><b>When</b> {when}</div>
                        <div className="eh-muted"><b>Then</b> {then}{f.action_params?.conversationId ? ` in ${chatName(f.action_params.conversationId)}` : ''}</div>
                        <div className="eh-row">
                          <span className={`eh-chip ${lr ? `t-${lr.tone}` : 't-idle'}`}>{lr ? `${lr.text} · ${timeAgo(last.created_at)}` : 'Hasn’t run yet'}</span>
                          <button type="button" className="eh-link eh-danger" onClick={() => removeFlow(f)}>Delete</button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {/* ───────── APPS ───────── */}
        {!loading && tab === 'apps' && (
          <section>
            <h2 className="eh-h2">Apps in your ecosystem</h2>
            <p className="eh-muted eh-pad">An app can only take part in flows after you connect it. You choose what it may do, and you can disconnect it any time.</p>
            <ul className="eh-list">
              {getAllEcosystemApps().map((app) => {
                const on = connected.has(app.id)
                const always = app.id === 'mattchat'
                return (
                  <li key={app.id} className="eh-card eh-col">
                    <div className="eh-row">
                      <AppDot id={app.id} />
                      <div className="eh-grow">
                        <div className="eh-name">{app.name}</div>
                        <div className="eh-muted">{app.description}</div>
                      </div>
                      {always ? <span className="eh-chip t-ok">Always on</span>
                        : <Switch on={on} label={`${app.name} connected`} onChange={(v) => toggleApp(app, v)} />}
                    </div>
                    <ul className="eh-scopes">
                      {describeScopes(app.id).map((line) => <li key={line}>{line}</li>)}
                      {describeScopes(app.id).length === 0 && <li>Nothing to share yet</li>}
                    </ul>
                  </li>
                )
              })}
            </ul>
            {onOpenLauncher && (
              <button type="button" className="eh-btn eh-wide eh-ghost" onClick={onOpenLauncher}>Browse the app launcher (TikTok, Instagram and more)</button>
            )}
          </section>
        )}

        {/* ───────── ACTIVITY ───────── */}
        {!loading && tab === 'activity' && (
          <section>
            <div className="eh-row">
              <h2 className="eh-h2">Recent activity</h2>
              <button type="button" className="eh-link" onClick={refresh}>Refresh</button>
            </div>
            {runs.length === 0 ? (
              <p className="eh-empty">Nothing yet. When a flow runs, you’ll see exactly what it did here.</p>
            ) : (
              <ul className="eh-list">
                {runs.map((r) => {
                  const d = describeRun(r)
                  return (
                    <li key={r.id} className="eh-card eh-col">
                      <div className="eh-row">
                        <div className="eh-name eh-grow">{r.flow?.name || 'Flow'}</div>
                        <span className="eh-muted">{timeAgo(r.created_at)}</span>
                      </div>
                      <span className={`eh-chip t-${d.tone}`}>{d.text}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
      </main>

      {notice && <div className="eh-toast" role="status">{notice}</div>}

      {/* ───────── choose a chat (templates that post a message) ───────── */}
      {pickChat && (
        <Sheet title="Which chat?" onClose={() => setPickChat(null)}>
          {conversations.length === 0 ? <p className="eh-muted">You don’t have any chats yet.</p> : (
            <ul className="eh-list">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button type="button" className="eh-pick" onClick={() => { const t = pickChat.template; setPickChat(null); turnOnTemplate(t, c.id) }}>{c.name}</button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}

      {/* ───────── consent ───────── */}
      {consent && (
        <Sheet title="Allow this flow?" onClose={() => !busy && setConsent(null)}>
          <p className="eh-muted">To run, this flow will:</p>
          <ul className="eh-scopes eh-big">
            {consent.lines.map((l) => <li key={l}>{l}</li>)}
          </ul>
          <p className="eh-muted">You can turn the flow off, or disconnect any app, at any time.</p>
          <div className="eh-actions">
            <button type="button" className="eh-btn eh-ghost" disabled={busy} onClick={() => setConsent(null)}>Cancel</button>
            <button type="button" className="eh-btn" disabled={busy} onClick={() => commit(consent.spec, consent.apps)}>{busy ? 'Turning on…' : 'Allow and turn on'}</button>
          </div>
        </Sheet>
      )}

      {/* ───────── builder ───────── */}
      {builder && (
        <Builder conversations={conversations} onClose={() => setBuilder(false)} onSubmit={requestFlow} />
      )}
    </div>
  )
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="eh-overlay" onClick={onClose}>
      <div className="eh-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="eh-row"><h2 className="eh-h2 eh-flush">{title}</h2><button type="button" className="eh-link" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  )
}

// ── flow builder: "When ___ then ___" ────────────────────
function Builder({ conversations, onClose, onSubmit }) {
  const events = useMemo(() => listAllEvents(), [])
  const actions = useMemo(() => listAllActions(), [])
  const [trigger, setTrigger] = useState(events[0]?.event.type || '')
  const [action, setAction] = useState(actions[0]?.action.id || '')
  const [name, setName] = useState('')
  const [values, setValues] = useState({ text: '🤖 ' })
  const [error, setError] = useState('')

  const trig = getEventDefinition(trigger)
  const act = getActionDefinition(action)
  const fields = trig?.event.fields || []
  const needsTask = act?.action.params.some((p) => p.key === 'taskId')
  const taskMismatch = needsTask && !fields.includes('taskId')
  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }))

  const submit = () => {
    setError('')
    if (!trig || !act) return setError('Pick a trigger and an action.')
    if (taskMismatch) return setError('That action needs a task, but the trigger isn’t about a task.')
    const actionParams = {}
    for (const p of act.action.params) {
      const v = p.key === 'taskId' ? '{{taskId}}' : (values[p.key] || '').trim()
      if (p.required && !v) return setError(`Please fill in: ${p.label}`)
      if (v) actionParams[p.key] = v
    }
    onSubmit({ name: name.trim(), triggerEvent: trigger, actionType: action, actionParams })
  }

  return (
    <Sheet title="New flow" onClose={onClose}>
      <label className="eh-label">Name (optional)
        <input className="eh-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Fees to calendar" />
      </label>
      <label className="eh-label">When this happens
        <select className="eh-input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          {events.map(({ app, event }) => <option key={event.type} value={event.type}>{app.name}: {event.label}</option>)}
        </select>
      </label>
      <label className="eh-label">Do this
        <select className="eh-input" value={action} onChange={(e) => setAction(e.target.value)}>
          {actions.map(({ app, action: a }) => <option key={a.id} value={a.id}>{app.name}: {a.label}</option>)}
        </select>
      </label>

      {act?.action.params.map((p) => {
        if (p.key === 'taskId') return <p key={p.key} className="eh-muted">{taskMismatch ? 'This action needs a task, but this trigger isn’t about a task. Pick a task trigger.' : 'Uses the task that triggered the flow.'}</p>
        if (p.key === 'conversationId') {
          return (
            <label key={p.key} className="eh-label">{p.label}
              <select className="eh-input" value={values.conversationId || ''} onChange={(e) => set('conversationId', e.target.value)}>
                <option value="">Choose a chat…</option>
                {conversations.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )
        }
        const long = p.key === 'text'
        return (
          <div key={p.key} className="eh-label">{p.label}
            {long
              ? <textarea className="eh-input" rows={3} value={values[p.key] || ''} onChange={(e) => set(p.key, e.target.value)} maxLength={500} />
              : <input className="eh-input" value={values[p.key] || ''} onChange={(e) => set(p.key, e.target.value)} />}
            {fields.length > 0 && (
              <div className="eh-chips">
                {fields.map((f) => <button key={f} type="button" className="eh-chipbtn" onClick={() => set(p.key, `${values[p.key] || ''}{{${f}}}`)}>+ {f}</button>)}
              </div>
            )}
          </div>
        )
      })}

      {error && <p className="eh-error" role="alert">{error}</p>}
      <div className="eh-actions">
        <button type="button" className="eh-btn eh-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="eh-btn" disabled={taskMismatch} onClick={submit}>Continue</button>
      </div>
    </Sheet>
  )
}

const CSS = `
.eh-root{
  --bg:#faf8ff; --surface:#ffffff; --ink:#1b1530; --muted:#6c6585; --line:#e7e2f3;
  --accent:#7c3aed; --accent-ink:#ffffff; --chip:#efeafb; --ok:#15803d; --warn:#b45309; --bad:#b91c1c;
  position:fixed; inset:0; display:flex; flex-direction:column; background:var(--bg); color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  padding-top:env(safe-area-inset-top,0px);
}
@media (prefers-color-scheme:dark){
  .eh-root{--bg:#120e1f; --surface:#1c1730; --ink:#f2eefc; --muted:#a39bc0; --line:#2c2545; --accent:#a78bfa; --accent-ink:#17102b; --chip:#241d3b; --ok:#4ade80; --warn:#fbbf24; --bad:#f87171}
}
.eh-root *{box-sizing:border-box}
.eh-header{display:flex; align-items:center; gap:12px; padding:14px 16px 6px}
.eh-back{width:40px; height:40px; border-radius:50%; border:0; background:var(--chip); color:var(--ink); display:grid; place-items:center; cursor:pointer}
.eh-title{margin:0; font-size:26px; line-height:1.1; font-weight:750; letter-spacing:-0.02em}
.eh-sub{margin:3px 0 0; font-size:13.5px; color:var(--muted)}
.eh-tabs{display:flex; gap:8px; padding:10px 16px 6px}
.eh-tab{flex:1; height:38px; border-radius:12px; border:0; background:var(--chip); color:var(--ink); font-size:14px; font-weight:600; cursor:pointer}
.eh-tab.is-on{background:var(--accent); color:var(--accent-ink)}
.eh-scroll{flex:1; overflow-y:auto; padding:4px 16px calc(32px + env(safe-area-inset-bottom,0px))}
.eh-h2{margin:18px 0 10px; font-size:15px; font-weight:700; color:var(--muted)}
.eh-flush{margin:0}
.eh-list{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px}
.eh-card{display:flex; align-items:center; gap:12px; padding:12px; border-radius:16px; background:var(--surface); border:1px solid var(--line)}
.eh-card.eh-col{flex-direction:column; align-items:stretch; gap:6px}
.eh-card.is-off{opacity:.6}
.eh-apps{display:flex; align-items:center; gap:4px; flex:none}
.eh-arrow{color:var(--muted); font-size:14px}
.eh-dot{border-radius:50%; display:inline-grid; place-items:center; color:#fff; font-weight:750; flex:none}
.eh-grow{flex:1; min-width:0}
.eh-row{display:flex; align-items:center; gap:10px; justify-content:space-between}
.eh-name{font-size:15px; font-weight:650}
.eh-muted{font-size:13px; color:var(--muted); line-height:1.45}
.eh-pad{margin:0 2px 12px}
.eh-empty{margin:8px 2px 0; color:var(--muted); font-size:14px; line-height:1.5}
.eh-btn{flex:none; height:38px; padding:0 16px; border-radius:999px; border:0; background:var(--accent); color:var(--accent-ink); font-size:14px; font-weight:650; cursor:pointer}
.eh-btn:disabled{opacity:.5; cursor:default}
.eh-ghost{background:var(--chip); color:var(--ink)}
.eh-wide{width:100%; margin-top:14px; height:44px}
.eh-link{border:0; background:transparent; color:var(--accent); font-size:14px; font-weight:650; cursor:pointer; padding:6px 2px}
.eh-danger{color:var(--bad)}
.eh-chip{display:inline-block; align-self:flex-start; padding:4px 10px; border-radius:999px; font-size:12.5px; font-weight:600; background:var(--chip); color:var(--muted)}
.eh-chip.t-ok{color:var(--ok)} .eh-chip.t-warn{color:var(--warn)} .eh-chip.t-bad{color:var(--bad)} .eh-chip.t-info{color:var(--accent)}
.eh-switch{flex:none; width:46px; height:28px; border-radius:999px; border:0; background:var(--line); padding:3px; cursor:pointer; transition:background .15s}
.eh-switch span{display:block; width:22px; height:22px; border-radius:50%; background:#fff; transition:transform .15s}
.eh-switch.is-on{background:var(--accent)} .eh-switch.is-on span{transform:translateX(18px)}
.eh-scopes{margin:2px 0 0; padding-left:18px; color:var(--muted); font-size:13px; line-height:1.5}
.eh-big{font-size:14.5px; color:var(--ink); margin:8px 0 12px}
.eh-overlay{position:absolute; inset:0; background:rgba(10,6,20,.55); display:flex; align-items:flex-end; justify-content:center}
.eh-sheet{width:min(560px,100%); max-height:88%; overflow-y:auto; background:var(--bg); border-radius:22px 22px 0 0; padding:16px 16px calc(20px + env(safe-area-inset-bottom,0px)); border:1px solid var(--line)}
.eh-actions{display:flex; gap:10px; justify-content:flex-end; margin-top:14px}
.eh-label{display:block; margin-top:12px; font-size:13px; font-weight:650; color:var(--muted)}
.eh-input{display:block; width:100%; margin-top:6px; padding:11px 12px; border-radius:12px; border:1px solid var(--line); background:var(--surface); color:var(--ink); font:inherit; font-size:16px}
.eh-input:focus{outline:2px solid var(--accent); outline-offset:1px}
.eh-chips{display:flex; gap:6px; flex-wrap:wrap; margin-top:8px}
.eh-chipbtn{border:0; border-radius:999px; padding:5px 10px; background:var(--chip); color:var(--ink); font-size:12.5px; cursor:pointer}
.eh-pick{width:100%; text-align:left; padding:13px 14px; border-radius:14px; border:1px solid var(--line); background:var(--surface); color:var(--ink); font-size:15px; cursor:pointer}
.eh-error{margin:10px 0 0; color:var(--bad); font-size:13.5px}
.eh-toast{position:absolute; left:50%; bottom:calc(24px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); background:var(--ink); color:var(--bg); padding:10px 16px; border-radius:999px; font-size:14px; font-weight:600; max-width:90%}
.eh-btn:focus-visible,.eh-tab:focus-visible,.eh-back:focus-visible,.eh-switch:focus-visible,.eh-link:focus-visible,.eh-pick:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
@media (prefers-reduced-motion:reduce){.eh-switch,.eh-switch span{transition:none}}
`
