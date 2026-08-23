// Pure date logic — no API calls. Derives matchday phase from data
// you're already fetching in the team bundle.
export function getMatchdayPhase(data) {
  if (!data) return null

  if (data.liveMatch) return 'live'

  const today = new Date().toDateString()

  if (data.nextMatch && new Date(data.nextMatch.utcDate).toDateString() === today) {
    return 'pre'
  }

  if (data.lastResult && new Date(data.lastResult.utcDate).toDateString() === today) {
    return 'post'
  }

  return null // not a matchday — render Pulse normally
}
