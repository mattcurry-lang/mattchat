// src/lib/ecosystem/registry.js
// The Mattchat Ecosystem app registry.
//
// An app declares what it can SAY (events it emits) and what it can DO
// (actions other apps may trigger). That declaration is its manifest:
//
//   registerEcosystemApp({
//     id: 'tasks',                         // matches eco_app_connections.app_id
//     name: 'Tasks',
//     description: 'Your tasks and deadlines',
//     firstParty: true,
//     emits:   [{ type: 'task.confirmed', label: 'A task is confirmed', fields: ['taskId'] }],
//     actions: [{ id: 'task.complete', label: 'Mark a task complete',
//                 params: [{ key: 'taskId', label: 'Task', required: true }] }],
//   })
//
// Names use the same "noun.verb" shape the database enforces on
// eco_events.type and eco_flows.trigger_event / action_type.

const TYPE_RE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/
const APP_RE = /^[a-z0-9_-]{2,40}$/

const apps = new Map()

export function registerEcosystemApp(manifest) {
  const { id, name, emits = [], actions = [] } = manifest || {}

  if (!APP_RE.test(id || '')) throw new Error(`Ecosystem app id "${id}" is invalid`)
  if (!name) throw new Error(`Ecosystem app "${id}" needs a name`)

  const seenEmits = new Set()
  emits.forEach((e) => {
    if (!TYPE_RE.test(e?.type || '')) throw new Error(`"${id}": event type "${e?.type}" must look like noun.verb`)
    if (!e.label) throw new Error(`"${id}": event "${e.type}" needs a label`)
    if (seenEmits.has(e.type)) throw new Error(`"${id}": event "${e.type}" declared twice`)
    seenEmits.add(e.type)
    // Event types are one shared namespace, so two apps can't claim the same one.
    for (const other of apps.values()) {
      if (other.id !== id && other.emits.some((x) => x.type === e.type)) {
        throw new Error(`Event "${e.type}" is already emitted by "${other.id}"`)
      }
    }
  })

  const seenActions = new Set()
  actions.forEach((a) => {
    if (!TYPE_RE.test(a?.id || '')) throw new Error(`"${id}": action id "${a?.id}" must look like noun.verb`)
    if (!a.label) throw new Error(`"${id}": action "${a.id}" needs a label`)
    if (seenActions.has(a.id)) throw new Error(`"${id}": action "${a.id}" declared twice`)
    seenActions.add(a.id)
  })

  const normalized = Object.freeze({
    description: '',
    firstParty: false,
    ...manifest,
    emits: emits.map((e) => Object.freeze({ fields: [], ...e })),
    actions: actions.map((a) => Object.freeze({ params: [], ...a })),
    // Derived, never hand-written: exactly what the user is consenting to.
    scopes: [...emits.map((e) => `emit:${e.type}`), ...actions.map((a) => `act:${a.id}`)],
  })

  apps.set(id, normalized)
  return normalized
}

export function getEcosystemApp(id) {
  return apps.get(id)
}

export function getAllEcosystemApps() {
  return [...apps.values()]
}

// { app, event } for an event type, or undefined
export function getEventDefinition(type) {
  for (const app of apps.values()) {
    const event = app.emits.find((e) => e.type === type)
    if (event) return { app, event }
  }
  return undefined
}

// { app, action } for an action id, or undefined
export function getActionDefinition(actionId) {
  for (const app of apps.values()) {
    const action = app.actions.find((a) => a.id === actionId)
    if (action) return { app, action }
  }
  return undefined
}

export function listAllEvents() {
  return [...apps.values()].flatMap((app) => app.emits.map((event) => ({ app, event })))
}

export function listAllActions() {
  return [...apps.values()].flatMap((app) => app.actions.map((action) => ({ app, action })))
}

// Plain-language lines for the consent screen: what this app can say and do.
export function describeScopes(appId) {
  const app = apps.get(appId)
  if (!app) return []
  return [
    ...app.emits.map((e) => `Can tell your other apps when: ${e.label.toLowerCase()}`),
    ...app.actions.map((a) => `Can be asked to: ${a.label.toLowerCase()}`),
  ]
}
