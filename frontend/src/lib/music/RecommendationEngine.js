import { RadioEngine } from './RadioEngine'

/**
 * lib/music/RecommendationEngine.js
 *
 * Thin front door kept so existing screens (Up Next, the Hub) don't change. All the work is in
 * RadioEngine.js: it finds songs that are genuinely *like* the seed (not just the same artist),
 * keeps the artists varied, learns from skips, works offline from saved songs, and spends
 * almost no YouTube quota.
 *
 * Returns tracks that are either playable or placeholders `{ pending: true }` - both can be
 * queued and played; a placeholder is matched to a playable copy right before it plays.
 */
export const RecommendationEngine = {
  /** Songs like `seedTrack`. `excludeIds` = ids to leave out; `excludeTracks` = songs already queued. */
  async getSimilarTracks(seedTrack, excludeIds = new Set(), limit = 8, excludeTracks = []) {
    if (!seedTrack) return []
    try {
      return await RadioEngine.build({ seeds: [seedTrack], excludeIds, excludeTracks, limit })
    } catch {
      return []
    }
  },
}
