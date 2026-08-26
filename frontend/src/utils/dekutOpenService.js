// src/utils/dekutOpenService.js
//
// Single place that decides what "opening" a DeKUT service means, so
// DeKUTHubCard and DekutServicesModal don't each carry their own copy of
// this branching logic.
//
// service.type === 'external' -> window.open(service.url)
// service.type === 'internal' -> onNavigate(service.route, service), so the
//   host app can route to an in-app view (Campus Map, Room Finder, Ask
//   DeKUT AI, Wi-Fi Finder, etc.) instead of leaving Mattchat. No service in
//   dekutServices.js is 'internal' yet — this exists so those Phase 1
//   features can be wired in later without touching this call site again.
//
// Usage:
//   openDekutService(service, { usage, onNavigate })

export function openDekutService(service, { usage, onNavigate } = {}) {
  if (!service) return

  usage?.recordUsage?.(service.id)

  if (service.type === 'internal') {
    if (typeof onNavigate === 'function') {
      onNavigate(service.route || service.id, service)
    } else if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        `[DeKUT] "${service.name}" is an internal service but no onNavigate handler was passed.`
      )
    }
    return
  }

  // Default / 'external': only real, verified URLs ever get here — pending
  // services are rendered non-clickable upstream (see ServiceCard's
  // `active` check), so this is a defensive no-op, not the primary guard.
  if (service.url) {
    window.open(service.url, '_blank', 'noopener,noreferrer')
  }
}
