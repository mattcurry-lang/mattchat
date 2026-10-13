// src/lib/ecosystem/index.js
// Importing this file registers every first-party app manifest.
//
// TO ADD AN APP: create src/lib/ecosystem/apps/<app>.js that calls
// registerEcosystemApp({...}) and add one import line below.

import './apps/mattchat'
import './apps/tasks'
import './apps/gmail'
import './apps/googleCalendar'

import * as registry from './registry'
import * as bus from './bus'

export * from './registry'
export * from './bus'

// Optional console access for testing. Enable once with:
//   localStorage.setItem('eco_debug', '1')   then reload
// Everything still goes through the signed-in user's own permissions.
if (typeof window !== 'undefined') {
  try {
    if (window.localStorage.getItem('eco_debug') === '1') window.__eco = { ...registry, ...bus }
  } catch { /* storage unavailable */ }
}
