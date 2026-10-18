import { registerEcosystemApp } from '../registry'

// Backed by the ai_tasks table (AI-generated from email/documents + manual).
registerEcosystemApp({
  id: 'tasks',
  name: 'Tasks',
  description: 'Your tasks and deadlines',
  firstParty: true,
  emits: [
    { type: 'task.created', label: 'A new task is created', fields: ['taskId', 'title', 'dueDate'] },
    { type: 'task.confirmed', label: 'A task is confirmed', fields: ['taskId', 'title', 'dueDate'] },
    { type: 'task.completed', label: 'A task is completed', fields: ['taskId', 'title'] },
  ],
  actions: [
    { id: 'task.confirm', label: 'Confirm a task', params: [{ key: 'taskId', label: 'Task', required: true }] },
    { id: 'task.complete', label: 'Mark a task complete', params: [{ key: 'taskId', label: 'Task', required: true }] },
    { id: 'task.create', label: 'Add a task to my list (for me to confirm)',
      params: [
        { key: 'title', label: 'Task title', required: true },
        { key: 'dueDate', label: 'Due date (optional)' },
        { key: 'messageId', label: 'Source card (prevents duplicates)' },
        { key: 'senderName', label: 'Shared by' },
      ] },
  ],
})
