// src/components/Ecosystem/EcosystemHub.jsx
// The Mattchat Ecosystem screen: see, build and control how your apps work together.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Z } from '../../lib/zLayers'
import { subscribeToChannel } from '../../lib/realtimeManager'
import {
  getAllEcosystemApps, getEcosystemApp, getEventDefinition, getActionDefinition,
  listAllEvents, listAllActions, describeScopes,
  getConnections, connectApp, disconnectApp,
  listFlows, createFlow, setFlowEnabled, deleteFlow, listRuns, parseSenderFilter,
  loadSignals, buildSuggestions, flowsNeedingAttention, loadDismissed, dismissSuggestion, MIN_FAILED_RUNS,
} from '../../lib/ecosystem'

const APP_COLORS = { mattchat: '#7c3aed', tasks: '#0ea5e9', gmail: '#ea4335', google_calendar: '#1a73e8' }
const appColor = (id) => APP_COLORS[id] || '#6c6585'

// Suggested automations presented in clean human terms.
const TEMPLATES = [
  {
    id: 'cal', title: 'Sync Confirmed Tasks to Calendar',
    desc: 'When you confirm a task, it is automatically added to Google Calendar.',
    triggerEvent: 'task.confirmed', actionType: 'calendar.push_task', actionParams: { taskId: '{{taskId}}' },
  },
  {
    id: 'share-card', title: 'Share Tasks as an Interactive Card',
    desc: 'Posts a task card in a chosen chat with an easy calendar add button.',
    triggerEvent: 'task.confirmed', actionType: 'card.send_task', needsChat: true,
    actionParams: { title: '{{title}}', dueDate: '{{dueDate}}' },
  },
  {
    id: 'auto-add', title: 'Import Task Cards from Chat',
    desc: 'When task cards are shared in chat, save them directly to your pending list.',
    triggerEvent: 'card.received', actionType: 'task.create', needsChat: true, filterChat: true,
    actionParams: { title: '{{title}}', dueDate: '{{dueDate}}', messageId: '{{messageId}}', senderName: '{{senderName}}' },
  },
  {
    id: 'email-task', title: 'Turn Emails into Pending Tasks',
    desc: 'New emails from a chosen sender or domain turn into pending tasks for your review.',
    triggerEvent: 'email.received', actionType: 'task.from_email', needsSender: true,
    actionParams: { title: '{{subject}}', emailId: '{{emailId}}', senderName: '{{senderName}}' },
  },
  {
    id: 'announce-done', title: 'Notify Chat on Task Completion',
    desc: 'Automatically post a short status update in your chosen chat when a task is done.',
    triggerEvent: 'task.completed', actionType: 'message.send', needsChat: true,
    actionParams: { text: '🤖 Done: {{title}}' },
  },
]

// ── helpers ──────────────────────────────────────────────
function senderLabel(filter) {
  return filter?.senderEmail || filter?.senderDomain || ''
}

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
  if (run.status === 'ok') return { tone: 'ok', text: 'Success' }
  if (run.status === 'running') return { tone: 'info', text: 'Running…' }
  if (run.status === 'skipped') {
    if (code === 'app_not_connected') return { tone: 'warn', text: `Paused (${appName(detail)} disconnected)` }
    if (code === 'loop_guard') return { tone: 'warn', text: 'Skipped (loop prevention)' }
    if (code === 'rate_limited') return { tone: 'warn', text: 'Paused (rate limit reached)' }
    return { tone: 'warn', text: 'Skipped' }
  }
  if (code === 'missing_param') return { tone: 'bad', text: `Missing data: ${detail}` }
  return { tone: 'bad', text: `Failed${err ? `: ${err}` : ''}`.slice(0, 100) }
}

function AppDot({ id, size = 32 }) {
  const app = getEcosystemApp(id)
  return (
    <span className="eh-dot" style={{ width: size, height: size, background: appColor(id), fontSize: size * 0.44 }}>
      {(app?.name || id).slice(0, 1).toUpperCase()}
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
  const [consent, setConsent] = useState(null)
  const [pickChat, setPickChat] = useState(null)
  const [pickSender, setPickSender] = useState(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const connected = useMemo(
    () => new Set(['mattchat', ...connections.filter((c) => c.status === 'active').map((c) => c.app_id)]),
    [connections]
  )
  const chatName = useCallback((id) => conversations.find((c) => c.id === id)?.name || 'Selected Chat', [conversations])

  const refresh = useCallback(async () => {
    const [f, c, r] = await Promise.all([
      listFlows(userId).catch(() => []),
      getConnections(userId),
      listRuns(40).catch(() => []),
    ])
    setFlows(f); setConnections(c); setRuns(r); setLoading(false)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  const [signals, setSignals] = useState(null)
  const [dismissed, setDismissed] = useState(() => loadDismissed(userId))
  useEffect(() => {
    let live = true
    loadSignals(userId).then((sg) => { if (live) setSignals(sg) }).catch(() => {})
    return () => { live = false }
  }, [userId])

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

  const requestFlow = (spec) => {
    const trig = getEventDefinition(spec.triggerEvent)
    const act = getActionDefinition(spec.actionType)
    if (!trig || !act) { setNotice('This automation uses an unavailable app.'); return }

    const missing = [...new Set([trig.app.id, act.app.id])].filter((id) => !connected.has(id))
    const lines = []
    if (missing.includes(trig.app.id)) lines.push(`Connect ${trig.app.name} to detect: ${trig.event.label.toLowerCase()}`)
    if (missing.includes(act.app.id)) lines.push(`Connect ${act.app.name} to execute: ${act.action.label.toLowerCase()}`)
    const sends = ['message.send', 'card.send_task'].includes(act.action.id)
    if (sends) lines.push(`Send messages/cards to: ${chatName(spec.actionParams.conversationId)}`)
    const adds = act.action.id === 'task.create'
    if (adds) lines.push(`Import task cards from ${chatName(spec.triggerFilter?.conversationId)} as pending review`)

    const emailTasks = act.action.id === 'task.from_email'
    const from = senderLabel(spec.triggerFilter)
    if (emailTasks) lines.push(`Create pending tasks from emails sent by: ${from}`)

    if (!missing.length && !sends && !adds && !emailTasks) { commit(spec, []); return }
    setConsent({ spec, apps: missing, lines })
  }

  async function commit(spec, appsToConnect) {
    setBusy(true)
    try {
      for (const id of appsToConnect) {
        const ok = await connectApp(userId, id)
        if (!ok) throw new Error(`Could not connect ${getEcosystemApp(id)?.name || id}`)
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
      setConsent(null); setBuilder(false); setPickChat(null); setPickSender(null)
      setNotice('Automation is now active')
      await refresh()
    } catch (e) {
      setNotice(e?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const turnOnTemplate = (tpl, conversationId, senderFilter) => {
    requestFlow({
      name: tpl.title, triggerEvent: tpl.triggerEvent, actionType: tpl.actionType,
      triggerFilter: senderFilter || (tpl.filterChat && conversationId ? { conversationId } : {}),
      actionParams: !tpl.filterChat && conversationId ? { ...tpl.actionParams, conversationId } : tpl.actionParams,
    })
  }

  const toggleFlow = async (flow, enabled) => {
    setFlows((fs) => fs.map((f) => (f.id === flow.id ? { ...f, enabled } : f)))
    try { await setFlowEnabled(flow.id, enabled) } catch { setNotice('Could not update automation'); refresh() }
  }

  const removeFlow = async (flow) => {
    if (!window.confirm(`Delete automation "${flow.name}"?`)) return
    try { await deleteFlow(flow.id); await refresh() } catch { setNotice('Could not delete automation') }
  }

  const toggleApp = async (app, on) => {
    if (!on && !window.confirm(`Disconnect ${app.name}? Automations using it will pause.`)) return
    const ok = on ? await connectApp(userId, app.id) : await disconnectApp(userId, app.id)
    if (!ok) setNotice('Could not update app connection')
    await refresh()
  }

  const usedTemplateIds = new Set(flows.map((f) => `${f.trigger_event}|${f.action_type}`))
  const personal = signals ? buildSuggestions({ signals, flows, conversations }).filter((sg) => !dismissed.has(sg.id)) : []
  const attention = flowsNeedingAttention(flows, runs)
  const personalTemplateIds = new Set(personal.map((sg) => sg.templateId))
  const suggestions = TEMPLATES.filter((t) => (!usedTemplateIds.has(`${t.triggerEvent}|${t.actionType}`) || t.needsChat) && !personalTemplateIds.has(t.id))

  return (
    <div className="eh-root" style={{ zIndex: Z.panel }} role="dialog" aria-label="Ecosystem Hub">
      <style>{CSS}</style>

      {/* Simplified Header */}
      <header className="eh-header">
        <button type="button" className="eh-back" onClick={onClose} aria-label="Back">
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="eh-header-text">
          <h1 className="eh-title">App Connections & Automations</h1>
          <p className="eh-sub">Make your tasks, calendar, and chats work together effortlessly.</p>
        </div>
      </header>

      {/* Clean Tab Selector */}
      <nav className="eh-tabs" aria-label="Sections">
        {[
          ['flows', `Automations ${flows.length > 0 ? `(${flows.length})` : ''}`],
          ['apps', `Connected Apps (${connected.size})`],
          ['activity', 'Activity Log']
        ].map(([id, label]) => (
          <button key={id} type="button" className={`eh-tab${tab === id ? ' is-on' : ''}`} onClick={() => { setTab(id); if (id === 'activity') refresh() }}>
            {label}
          </button>
        ))}
      </nav>

      <main className="eh-scroll">
        {loading && <div className="eh-loading-box">Loading your ecosystem…</div>}

        {/* ───────── AUTOMATIONS TAB ───────── */}
        {!loading && tab === 'flows' && (
          <div className="eh-stack">
            {/* Attention Alert */}
            {attention.length > 0 && (
              <section className="eh-box eh-box-alert">
                <h2 className="eh-h2-alert">⚠️ Automations Needing Attention</h2>
                <div className="eh-list">
                  {attention.map(({ flow, lastRun }) => (
                    <div key={flow.id} className="eh-subcard">
                      <div>
                        <strong>{flow.name}</strong>
                        <p className="eh-muted">Failed {MIN_FAILED_RUNS} times. Last error: {describeRun(lastRun).text}</p>
                      </div>
                      <div className="eh-row-gap">
                        <button type="button" className="eh-link" onClick={() => setTab('activity')}>View logs</button>
                        <button type="button" className="eh-link eh-danger" onClick={() => toggleFlow(flow, false)}>Disable</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Smart Suggestions */}
            {personal.length > 0 && (
              <section className="eh-section-block">
                <h2 className="eh-h2">Suggested For You</h2>
                <div className="eh-list">
                  {personal.map((sg) => (
                    <div key={sg.id} className="eh-card eh-card-highlight">
                      <div className="eh-grow">
                        <div className="eh-name">{sg.title}</div>
                        <div className="eh-muted">{sg.reason}</div>
                      </div>
                      <div className="eh-row-gap">
                        <button type="button" className="eh-link" onClick={() => setDismissed(dismissSuggestion(userId, sg.id))}>Dismiss</button>
                        <button type="button" className="eh-btn" disabled={busy} onClick={() => turnOnTemplate(TEMPLATES.find((t) => t.id === sg.templateId), sg.conversationId)}>
                          Turn On
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Active Flows List */}
            <section className="eh-section-block">
              <div className="eh-row">
                <h2 className="eh-h2">Active Automations</h2>
                <button type="button" className="eh-btn-outline" onClick={() => setBuilder(true)}>+ Custom Flow</button>
              </div>

              {flows.length === 0 ? (
                <div className="eh-empty-card">
                  <p>No active automations yet. Enable a quick recipe below or build your own.</p>
                </div>
              ) : (
                <div className="eh-list">
                  {flows.map((f) => {
                    const trig = getEventDefinition(f.trigger_event)
                    const act = getActionDefinition(f.action_type)
                    const last = lastRunByFlow[f.id]
                    const lr = last ? describeRun(last) : null
                    return (
                      <div key={f.id} className={`eh-card eh-col ${f.enabled ? '' : 'is-off'}`}>
                        <div className="eh-row">
                          <span className="eh-name">{f.name}</span>
                          <Switch on={f.enabled} label={`Toggle ${f.name}`} onChange={(v) => toggleFlow(f, v)} />
                        </div>
                        
                        {/* Clear Visual Flow Line */}
                        <div className="eh-flow-path">
                          <span className="eh-pill"><AppDot id={trig?.app.id} size={20} /> {trig?.app.name}: {trig?.event.label}</span>
                          <span className="eh-flow-arrow">➔</span>
                          <span className="eh-pill"><AppDot id={act?.app.id} size={20} /> {act?.app.name}: {act?.action.label}</span>
                        </div>

                        <div className="eh-row eh-footer-row">
                          <span className={`eh-chip ${lr ? `t-${lr.tone}` : 't-idle'}`}>
                            {lr ? `${lr.text} · ${timeAgo(last.created_at)}` : 'Ready & waiting'}
                          </span>
                          <button type="button" className="eh-link eh-danger" onClick={() => removeFlow(f)}>Delete</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Ready-Made Recipes */}
            {suggestions.length > 0 && (
              <section className="eh-section-block">
                <h2 className="eh-h2">Quick Ready-Made Recipes</h2>
                <div className="eh-list">
                  {suggestions.map((t) => {
                    const trig = getEventDefinition(t.triggerEvent)
                    const act = getActionDefinition(t.actionType)
                    return (
                      <div key={t.id} className="eh-card">
                        <div className="eh-apps-group">
                          <AppDot id={trig?.app.id} size={28} />
                          <span className="eh-flow-arrow">➔</span>
                          <AppDot id={act?.app.id} size={28} />
                        </div>
                        <div className="eh-grow">
                          <div className="eh-name">{t.title}</div>
                          <div className="eh-muted">{t.desc}</div>
                        </div>
                        <button type="button" className="eh-btn" disabled={busy}
                          onClick={() => (t.needsSender ? setPickSender({ template: t }) : t.needsChat ? setPickChat({ template: t }) : turnOnTemplate(t))}>
                          Turn On
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ───────── APPS TAB ───────── */}
        {!loading && tab === 'apps' && (
          <section className="eh-section-block">
            <h2 className="eh-h2">Available Apps</h2>
            <p className="eh-subtext">Connect your accounts securely. You maintain full control and can disconnect any app instantly.</p>
            <div className="eh-list">
              {getAllEcosystemApps().map((app) => {
                const on = connected.has(app.id)
                const always = app.id === 'mattchat'
                return (
                  <div key={app.id} className="eh-card eh-col">
                    <div className="eh-row">
                      <div className="eh-row-gap">
                        <AppDot id={app.id} size={40} />
                        <div>
                          <div className="eh-name">{app.name}</div>
                          <div className="eh-muted">{app.description}</div>
                        </div>
                      </div>
                      {always ? <span className="eh-chip t-ok">Always Connected</span>
                        : <Switch on={on} label={`Connect ${app.name}`} onChange={(v) => toggleApp(app, v)} />}
                    </div>
                    <ul className="eh-scopes-clean">
                      {describeScopes(app.id).map((line) => <li key={line}>✓ {line}</li>)}
                      {describeScopes(app.id).length === 0 && <li>Core system integration</li>}
                    </ul>
                  </div>
                )
              })}
            </div>
            {onOpenLauncher && (
              <button type="button" className="eh-btn eh-wide eh-ghost" onClick={onOpenLauncher}>Browse App Launcher (TikTok, Instagram & More)</button>
            )}
          </section>
        )}

        {/* ───────── ACTIVITY TAB ───────── */}
        {!loading && tab === 'activity' && (
          <section className="eh-section-block">
            <div className="eh-row">
              <h2 className="eh-h2">Recent Automation Runs</h2>
              <button type="button" className="eh-link" onClick={refresh}>Refresh Logs</button>
            </div>
            {runs.length === 0 ? (
              <div className="eh-empty-card">
                <p>No activity recorded yet. When your automations execute, you'll see a clear log here.</p>
              </div>
            ) : (
              <ul className="eh-list">
                {runs.map((r) => {
                  const d = describeRun(r)
                  return (
                    <li key={r.id} className="eh-card eh-col">
                      <div className="eh-row">
                        <span className="eh-name">{r.flow?.name || 'Automation Flow'}</span>
                        <span className="eh-muted">{timeAgo(r.created_at)}</span>
                      </div>
                      <span className={`eh-chip ${`t-${d.tone}`}`}>{d.text}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
      </main>

      {notice && <div className="eh-toast" role="status">{notice}</div>}

      {/* Target Chat Selector Sheet */}
      {pickChat && (
        <Sheet title="Select Target Chat" onClose={() => setPickChat(null)}>
          {conversations.length === 0 ? <p className="eh-muted">No chats available.</p> : (
            <ul className="eh-list">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button type="button" className="eh-pick" onClick={() => { const t = pickChat.template; setPickChat(null); turnOnTemplate(t, c.id) }}>💬 {c.name}</button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}

      {/* Sender Picker Sheet */}
      {pickSender && (
        <SenderSheet onClose={() => setPickSender(null)}
          onPick={(filter) => { const t = pickSender.template; setPickSender(null); turnOnTemplate(t, null, filter) }} />
      )}

      {/* Consent Sheet */}
      {consent && (
        <Sheet title="Review Permissions" onClose={() => !busy && setConsent(null)}>
          <p className="eh-muted">To run this automation safely, it requires:</p>
          <ul className="eh-scopes eh-big">
            {consent.lines.map((l) => <li key={l}>• {l}</li>)}
          </ul>
          <p className="eh-muted">You can disable this or disconnect apps anytime.</p>
          <div className="eh-actions">
            <button type="button" className="eh-btn eh-ghost" disabled={busy} onClick={() => setConsent(null)}>Cancel</button>
            <button type="button" className="eh-btn" disabled={busy} onClick={() => commit(consent.spec, consent.apps)}>{busy ? 'Enabling…' : 'Approve & Turn On'}</button>
          </div>
        </Sheet>
      )}

      {/* Custom Flow Builder Sheet */}
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

function SenderSheet({ onClose, onPick }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const submit = () => {
    const filter = parseSenderFilter(value)
    if (!filter) return setError('Enter a valid email like igs@dkut.ac.ke or domain like dkut.ac.ke.')
    onPick(filter)
  }
  return (
    <Sheet title="Filter by Sender" onClose={onClose}>
      <p className="eh-muted">Only incoming emails from this address or domain will trigger tasks.</p>
      <input className="eh-input" aria-label="Sender or domain" placeholder="igs@dkut.ac.ke or dkut.ac.ke" value={value}
        onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} autoFocus />
      {error && <p className="eh-error" role="alert">{error}</p>}
      <div className="eh-actions">
        <button type="button" className="eh-btn eh-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="eh-btn" onClick={submit}>Continue</button>
      </div>
    </Sheet>
  )
}

function Builder({ conversations, onClose, onSubmit }) {
  const events = useMemo(() => listAllEvents(), [])
  const actions = useMemo(() => listAllActions(), [])
  const [trigger, setTrigger] = useState(events[0]?.event.type || '')
  const [action, setAction] = useState(actions[0]?.action.id || '')
  const [name, setName] = useState('')
  const [values, setValues] = useState({ text: '🤖 ' })
  const [filterChat, setFilterChat] = useState('')
  const [senderText, setSenderText] = useState('')
  const [error, setError] = useState('')

  const trig = getEventDefinition(trigger)
  const act = getActionDefinition(action)
  const fields = trig?.event.fields || []
  const needsTask = act?.action.params.some((p) => p.key === 'taskId')
  const taskMismatch = needsTask && !fields.includes('taskId')
  const canFilterChat = fields.includes('conversationId')
  const mustFilterChat = trigger === 'card.received' && action === 'task.create'
  const needsSender = fields.includes('senderEmail')
  const autoKeys = (act?.action.params || []).filter((p) => !['taskId', 'conversationId', 'text'].includes(p.key) && fields.includes(p.key)).map((p) => p.key)
  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }))

  const submit = () => {
    setError('')
    if (!trig || !act) return setError('Select a trigger and an action.')
    if (taskMismatch) return setError('Selected action requires a task-related trigger.')
    if (mustFilterChat && !filterChat) return setError('Choose a chat for task card ingestion.')
    const senderFilter = needsSender ? parseSenderFilter(senderText) : null
    if (needsSender && !senderFilter) return setError('Provide a valid email address or domain.')
    const actionParams = {}
    for (const p of act.action.params) {
      const v = p.key === 'taskId' ? '{{taskId}}' : autoKeys.includes(p.key) ? `{{${p.key}}}` : (values[p.key] || '').trim()
      if (p.required && !v) return setError(`Field required: ${p.label}`)
      if (v) actionParams[p.key] = v
    }
    onSubmit({ name: name.trim(), triggerEvent: trigger, triggerFilter: senderFilter || (canFilterChat && filterChat ? { conversationId: filterChat } : {}), actionType: action, actionParams })
  }

  return (
    <Sheet title="Create Custom Flow" onClose={onClose}>
      <label className="eh-label">Automation Name (Optional)
        <input className="eh-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Important emails to tasks" />
      </label>
      <label className="eh-label">When this happens (Trigger)
        <select className="eh-input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          {events.map(({ app, event }) => <option key={event.type} value={event.type}>{app.name}: {event.label}</option>)}
        </select>
      </label>
      {needsSender && (
        <label className="eh-label">Filter Emails by Sender
          <input className="eh-input" value={senderText} placeholder="igs@dkut.ac.ke or dkut.ac.ke" onChange={(e) => setSenderText(e.target.value)} />
        </label>
      )}
      {canFilterChat && (
        <label className="eh-label">{mustFilterChat ? 'Restricted to Chat' : 'Restricted to Chat (Optional)'}
          <select className="eh-input" value={filterChat} onChange={(e) => setFilterChat(e.target.value)}>
            <option value="">{mustFilterChat ? 'Select chat…' : 'Any chat'}</option>
            {conversations.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      <label className="eh-label">Automatically do this (Action)
        <select className="eh-input" value={action} onChange={(e) => setAction(e.target.value)}>
          {actions.map(({ app, action: a }) => <option key={a.id} value={a.id}>{app.name}: {a.label}</option>)}
        </select>
      </label>

      {act?.action.params.map((p) => {
        if (autoKeys.includes(p.key)) return null
        if (p.key === 'taskId') return <p key={p.key} className="eh-muted">{taskMismatch ? 'Action requires a task trigger source.' : 'Automatically uses the triggering task.'}</p>
        if (p.key === 'conversationId') {
          return (
            <label key={p.key} className="eh-label">{p.label}
              <select className="eh-input" value={values.conversationId || ''} onChange={(e) => set('conversationId', e.target.value)}>
                <option value="">Select chat…</option>
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
          </div>
        )
      })}

      {error && <p className="eh-error" role="alert">{error}</p>}
      <div className="eh-actions">
        <button type="button" className="eh-btn eh-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="eh-btn" disabled={taskMismatch} onClick={submit}>Save Automation</button>
      </div>
    </Sheet>
  )
}

const CSS = `
.eh-root{
  --bg:#f8fafc; --surface:#ffffff; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0;
  --accent:#7c3aed; --accent-ink:#ffffff; --chip:#f1f5f9; --ok:#16a34a; --warn:#d97706; --bad:#dc2626;
  position:fixed; inset:0; display:flex; flex-direction:column; background:var(--bg); color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  padding-top:env(safe-area-inset-top,0px); z-index:1000;
}
@media (prefers-color-scheme:dark){
  .eh-root{--bg:#090d16; --surface:#111827; --ink:#f9fafb; --muted:#9ca3af; --line:#1f2937; --accent:#8b5cf6; --accent-ink:#ffffff; --chip:#1f2937; --ok:#4ade80; --warn:#fbbf24; --bad:#f87171}
}
.eh-root *{box-sizing:border-box}
.eh-header{display:flex; align-items:center; gap:14px; padding:16px 20px 12px; background:var(--surface); border-bottom:1px solid var(--line)}
.eh-back{width:36px; height:36px; border-radius:50%; border:0; background:var(--chip); color:var(--ink); display:grid; place-items:center; cursor:pointer}
.eh-title{margin:0; font-size:18px; line-height:1.2; font-weight:700}
.eh-sub{margin:2px 0 0; font-size:13px; color:var(--muted)}
.eh-tabs{display:flex; gap:6px; padding:12px 20px; background:var(--surface); border-bottom:1px solid var(--line)}
.eh-tab{flex:1; height:36px; border-radius:8px; border:0; background:var(--chip); color:var(--muted); font-size:13px; font-weight:600; cursor:pointer}
.eh-tab.is-on{background:var(--accent); color:var(--accent-ink)}
.eh-scroll{flex:1; overflow-y:auto; padding:20px; max-width:800px; width:100%; margin:0 auto}
.eh-stack{display:flex; flex-direction:column; gap:24px}
.eh-section-block{display:flex; flex-direction:column; gap:12px}
.eh-h2{margin:0; font-size:15px; font-weight:700; color:var(--ink)}
.eh-flush{margin:0}
.eh-list{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:12px}
.eh-card{display:flex; align-items:center; gap:14px; padding:16px; border-radius:12px; background:var(--surface); border:1px solid var(--line); box-shadow:0 1px 2px rgba(0,0,0,0.02)}
.eh-card.eh-col{flex-direction:column; align-items:stretch; gap:10px}
.eh-card.is-off{opacity:.55}
.eh-card-highlight{border-color:var(--accent); background:linear-gradient(to right, var(--surface), var(--chip))}
.eh-box-alert{background:rgba(220,38,38,0.05); border:1px solid rgba(220,38,38,0.2); padding:16px; border-radius:12px}
.eh-h2-alert{color:var(--bad); font-size:14px; font-weight:700; margin:0 0 10px}
.eh-subcard{display:flex; justify-content:space-between; align-items:center; background:var(--surface); padding:12px; border-radius:8px; border:1px solid var(--line)}
.eh-empty-card{padding:24px; text-align:center; background:var(--surface); border:1px dashed var(--line); border-radius:12px; color:var(--muted); font-size:14px}
.eh-apps-group{display:flex; align-items:center; gap:6px; flex:none}
.eh-flow-path{display:flex; align-items:center; gap:8px; flex-wrap:wrap; background:var(--bg); padding:8px 12px; border-radius:8px; border:1px solid var(--line)}
.eh-flow-arrow{color:var(--muted); font-weight:bold; font-size:13px}
.eh-pill{display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; color:var(--ink)}
.eh-dot{border-radius:6px; display:inline-grid; place-items:center; color:#fff; font-weight:700; flex:none}
.eh-grow{flex:1; min-width:0}
.eh-row{display:flex; align-items:center; gap:12px; justify-content:space-between}
.eh-row-gap{display:flex; align-items:center; gap:12px}
.eh-footer-row{border-top:1px solid var(--line); padding-top:8px; margin-top:2px}
.eh-name{font-size:14.5px; font-weight:650; color:var(--ink)}
.eh-muted{font-size:13px; color:var(--muted); line-height:1.4}
.eh-subtext{font-size:13px; color:var(--muted); margin:4px 0 0}
.eh-btn{flex:none; height:36px; padding:0 16px; border-radius:8px; border:0; background:var(--accent); color:var(--accent-ink); font-size:13.5px; font-weight:650; cursor:pointer}
.eh-btn-outline{border:1px solid var(--line); border-radius:8px; padding:6px 12px; background:var(--surface); color:var(--ink); font-size:13px; font-weight:600; cursor:pointer}
.eh-btn:disabled{opacity:.5; cursor:default}
.eh-ghost{background:var(--chip); color:var(--ink)}
.eh-wide{width:100%; margin-top:10px; height:42px}
.eh-link{border:0; background:transparent; color:var(--accent); font-size:13.5px; font-weight:650; cursor:pointer; padding:4px 0}
.eh-danger{color:var(--bad)}
.eh-chip{display:inline-block; align-self:flex-start; padding:3px 10px; border-radius:6px; font-size:12px; font-weight:600; background:var(--chip); color:var(--muted)}
.eh-chip.t-ok{background:rgba(22,163,74,0.1); color:var(--ok)} 
.eh-chip.t-warn{background:rgba(217,119,6,0.1); color:var(--warn)} 
.eh-chip.t-bad{background:rgba(220,38,38,0.1); color:var(--bad)} 
.eh-chip.t-info{background:rgba(124,58,237,0.1); color:var(--accent)}
.eh-switch{flex:none; width:44px; height:24px; border-radius:999px; border:0; background:var(--line); padding:2px; cursor:pointer; transition:background .15s}
.eh-switch span{display:block; width:20px; height:20px; border-radius:50%; background:#fff; transition:transform .15s; box-shadow:0 1px 3px rgba(0,0,0,0.1)}
.eh-switch.is-on{background:var(--accent)} .eh-switch.is-on span{transform:translateX(20px)}
.eh-scopes-clean{margin:6px 0 0; padding-left:0; list-style:none; color:var(--muted); font-size:12.5px; display:flex; flex-direction:column; gap:3px}
.eh-big{font-size:14px; color:var(--ink); margin:8px 0 12px; line-height:1.5}
.eh-overlay{position:fixed; inset:0; background:rgba(15,23,42,0.6); display:flex; align-items:flex-end; justify-content:center; z-index:1100}
.eh-sheet{width:min(520px,100%); max-height:85%; overflow-y:auto; background:var(--surface); border-radius:20px 20px 0 0; padding:20px 20px calc(24px + env(safe-area-inset-bottom,0px)); border:1px solid var(--line); box-shadow:0 -10px 25px rgba(0,0,0,0.05)}
.eh-actions{display:flex; gap:10px; justify-content:flex-end; margin-top:16px}
.eh-label{display:block; margin-top:14px; font-size:13px; font-weight:650; color:var(--muted)}
.eh-input{display:block; width:100%; margin-top:6px; padding:10px 12px; border-radius:10px; border:1px solid var(--line); background:var(--bg); color:var(--ink); font:inherit; font-size:15px}
.eh-input:focus{outline:2px solid var(--accent); outline-offset:1px}
.eh-pick{width:100%; text-align:left; padding:12px 14px; border-radius:10px; border:1px solid var(--line); background:var(--surface); color:var(--ink); font-size:14.5px; font-weight:500; cursor:pointer}
.eh-error{margin:8px 0 0; color:var(--bad); font-size:13px}
.eh-toast{position:fixed; left:50%; bottom:calc(24px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); background:var(--ink); color:var(--bg); padding:10px 18px; border-radius:999px; font-size:13.5px; font-weight:600; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1); z-index:1200}
@media (prefers-reduced-motion:reduce){.eh-switch,.eh-switch span{transition:none}}
`
