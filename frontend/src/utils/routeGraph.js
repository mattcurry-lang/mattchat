// src/utils/routeGraph.js
//
// Shortest-path over the DeKUT location graph (dekut_locations +
// dekut_location_edges). Plain Dijkstra — the graph is small (campus-
// scale, admin-curated) so there's no need for anything fancier like A*.
//
// NOTE: this same algorithm is intentionally duplicated (not imported)
// inside supabase/functions/dekut-curry/index.ts, since Deno edge
// functions and the Vite/CRA frontend don't share a module graph. If
// you change the algorithm here, mirror the change there too.

export function buildAdjacency(edges) {
  const adjacency = new Map() // locationId -> [{ to, weight }]
  for (const edge of edges) {
    if (!adjacency.has(edge.location_a_id)) adjacency.set(edge.location_a_id, [])
    if (!adjacency.has(edge.location_b_id)) adjacency.set(edge.location_b_id, [])
    adjacency.get(edge.location_a_id).push({ to: edge.location_b_id, weight: edge.weight })
    adjacency.get(edge.location_b_id).push({ to: edge.location_a_id, weight: edge.weight })
  }
  return adjacency
}

// Returns { path: [locationId, ...], totalWeight } or null if there's no
// connecting path (e.g. the two locations aren't linked by any admin-
// drawn edges yet).
export function findShortestPath(edges, fromId, toId) {
  if (fromId === toId) return { path: [fromId], totalWeight: 0 }

  const adjacency = buildAdjacency(edges)
  const dist = new Map([[fromId, 0]])
  const prev = new Map()
  const visited = new Set()
  const queue = new Set([fromId])

  while (queue.size > 0) {
    let current = null
    let currentDist = Infinity
    for (const id of queue) {
      const d = dist.get(id) ?? Infinity
      if (d < currentDist) { current = id; currentDist = d }
    }
    if (current === null) break
    queue.delete(current)
    visited.add(current)

    if (current === toId) break

    for (const { to, weight } of adjacency.get(current) || []) {
      if (visited.has(to)) continue
      const alt = currentDist + weight
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt)
        prev.set(to, current)
        queue.add(to)
      }
    }
  }

  if (!dist.has(toId)) return null

  const path = [toId]
  let step = toId
  while (prev.has(step)) {
    step = prev.get(step)
    path.unshift(step)
  }
  return { path, totalWeight: dist.get(toId) }
}
