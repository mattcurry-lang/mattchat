import { registerEcosystemApp } from '../registry'

// Same id as the Pulse plugin ('gmail'). Events come from a database trigger on
// the emails table (see 006_email_received.sql), so they work when the app is closed.
registerEcosystemApp({
  id: 'gmail',
  name: 'Gmail',
  description: 'Your email',
  firstParty: true,
  emits: [
    { type: 'email.received', label: 'A new email arrives (sender and subject only)',
      fields: ['sender', 'senderName', 'senderEmail', 'senderDomain', 'subject', 'emailId'] },
  ],
  actions: [],
})
