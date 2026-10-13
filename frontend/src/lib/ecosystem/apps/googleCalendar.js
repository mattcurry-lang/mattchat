import { registerEcosystemApp } from '../registry'

// Same id as the Pulse plugin ('google_calendar'). The push action maps to
// pushTaskToCalendar() / the calendar-actions edge function.
registerEcosystemApp({
  id: 'google_calendar',
  name: 'Google Calendar',
  description: 'Your schedule',
  firstParty: true,
  emits: [],
  actions: [
    { id: 'calendar.push_task', label: 'Add a task to your calendar',
      params: [{ key: 'taskId', label: 'Task', required: true }] },
  ],
})
