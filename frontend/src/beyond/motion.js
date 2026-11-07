// src/beyond/motion.js
import { getSetting } from '../lib/appearanceStore'

// Your in-app "reduce motion" setting OR the device's accessibility setting.
export const prefersReducedMotion = () =>
  !!getSetting('reduceMotion') ||
  (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
