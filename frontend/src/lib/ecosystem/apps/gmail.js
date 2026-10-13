import { registerEcosystemApp } from '../registry'

// Same id as the Pulse plugin ('gmail'). Emits are derived from the
// unread counts the pulse-data function already returns.
registerEcosystemApp({
  id: 'gmail',
  name: 'Gmail',
  description: 'Your email',
  firstParty: true,
  emits: [
    { type: 'email.unread_increased', label: 'New email arrives', fields: ['account', 'count', 'delta'] },
  ],
  actions: [],
})
