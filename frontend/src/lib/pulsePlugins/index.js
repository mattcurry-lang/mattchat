// Every plugin registers itself on import (see each file for its
// registerPulsePlugin(...) call) — this file's only job is to make
// sure that import actually happens.
//
// TO ADD A NEW INTEGRATION (YouTube, Google Drive, Calendar, Spotify,
// Dropbox, OneDrive, etc.):
//   1. Create src/lib/pulsePlugins/<service>.js following the shape
//      documented in registry.js.
//   2. Add one import line below.
//   3. If it needs data from the server, add its payload under a
//      matching key in the pulse-data edge function's response —
//      that's the only other place that needs to know it exists.
// Nothing in usePulseData.js, PulsePage.js, or PulseActivityCard.js
// needs to change.

import './mattchat'
import './gmail'
import './instagram'
import './googleDrive'
import './googleCalendar'

export { registerPulsePlugin, getPulsePlugin, getAllPulsePlugins } from './registry'
