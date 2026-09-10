import { useTheme } from './useTheme'

/**
 * hooks/useMusicColors.js
 *
 * Music components were relying on var(--text-primary) etc., which
 * silently fails to resolve in some render paths (portals, overlays
 * mounted outside the themed root) and falls back to browser-default
 * black text — invisible against dark tiles regardless of which
 * theme is actually active. This hook computes real color values
 * from theme state directly, the same way MiniPlayer.jsx already
 * does successfully, so text is guaranteed visible everywhere.
 */
export function useMusicColors() {
  const { theme } = useTheme()
  const isDark = theme !== 'light'

  return {
    isDark,
    textPrimary: isDark ? '#f5f5f7' : '#18142a',
    textSecondary: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(24,20,42,0.75)',
    textMuted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(24,20,42,0.55)',
    surface1: isDark ? '#14121f' : '#f7f6fb',
    surface2: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(24,20,42,0.045)',
    border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(24,20,42,0.1)',
  }
}
