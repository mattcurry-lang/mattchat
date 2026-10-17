import { registerEcosystemApp } from '../registry'

registerEcosystemApp({
  id: 'mattchat',
  name: 'Mattchat',
  description: 'Your conversations',
  firstParty: true,
  emits: [
    { type: 'message.received', label: 'A new message arrives', fields: ['conversationId', 'senderName', 'preview'] },
  ],
  actions: [
    { id: 'message.send', label: 'Send a message in a conversation',
      params: [
        { key: 'conversationId', label: 'Conversation', required: true },
        { key: 'text', label: 'Message', required: true },
      ] },
    { id: 'card.send_task', label: 'Share a task card in a conversation',
      params: [
        { key: 'conversationId', label: 'Conversation', required: true },
        { key: 'title', label: 'Task title', required: true },
        { key: 'dueDate', label: 'Due date (optional)' },
      ] },
  ],
})
