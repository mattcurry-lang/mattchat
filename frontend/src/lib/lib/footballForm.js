// Derives a W/D/L form strip from already-fetched recent fixtures —
// no extra API call needed.
export function computeForm(recentFixtures, teamShortName) {
  return recentFixtures.slice(0, 5).reverse().map(f => {
    const teamScore = f.isHome ? f.homeScore : f.awayScore
    const oppScore = f.isHome ? f.awayScore : f.homeScore
    if (teamScore == null || oppScore == null) return null
    if (teamScore > oppScore) return 'W'
    if (teamScore < oppScore) return 'L'
    return 'D'
  }).filter(Boolean)
}
