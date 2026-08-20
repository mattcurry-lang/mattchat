// src/lib/pulseHomeSections.js
// Registry for Pulse's personalized hierarchy, separate from the
// pulsePlugins registry (which is for connected-app activity items).
// A future section just registers here and PulsePage renders it in
// order — no more editing PulsePage.jsx per feature.
const sections = []

export function registerPulseHomeSection(section) {
  // section: { id, order, Component, isVisible(ctx) => bool }
  sections.push(section)
  sections.sort((a, b) => a.order - b.order)
}

export function getPulseHomeSections() {
  return sections
}
