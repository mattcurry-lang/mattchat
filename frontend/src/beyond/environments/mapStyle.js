// src/beyond/environments/mapStyle.js
//
// Turns OpenFreeMap's stock "liberty" style into Beyond's midnight-purple map.
// It works from layer TYPE and id keywords rather than a hard-coded layer list,
// so a small upstream style change does not break it. If a layer is not
// recognised it is simply recoloured to the land tone.

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

const C = {
  void: '#07050d',
  land: '#0e0a1b',
  landAlt: '#130d25',
  water: '#0a1030',
  waterLine: '#1a2358',
  building: '#1a1233',
  road: '#2b2253',
  roadMajor: '#4a3d94',
  boundary: '#3a2f78',
  label: '#c9c1e8',
  halo: '#07050d',
}

const DROP_LAYER = /poi|housenumber|aeroway|ferry|airport/
const DROP_TYPE = new Set(['raster', 'hillshade', 'heatmap'])

export function darkenStyle(source) {
  const style = JSON.parse(JSON.stringify(source))
  style.layers = (style.layers || []).filter((l) => !DROP_TYPE.has(l.type) && !DROP_LAYER.test(l.id))

  for (const l of style.layers) {
    const id = l.id
    const paint = (l.paint = l.paint || {})
    switch (l.type) {
      case 'background':
        paint['background-color'] = C.void
        break
      case 'fill': {
        delete paint['fill-pattern']
        delete paint['fill-outline-color']
        paint['fill-opacity'] = 1
        if (/water/.test(id)) paint['fill-color'] = C.water
        else if (/building/.test(id)) paint['fill-color'] = C.building
        else if (/park|wood|forest|grass|landcover|green/.test(id)) paint['fill-color'] = C.landAlt
        else paint['fill-color'] = C.land
        break
      }
      case 'fill-extrusion':
        paint['fill-extrusion-color'] = C.building
        break
      case 'line': {
        delete paint['line-pattern']
        delete paint['line-gradient']
        if (/water/.test(id)) paint['line-color'] = C.waterLine
        else if (/boundary|admin/.test(id)) paint['line-color'] = C.boundary
        else if (/motorway|trunk|primary/.test(id)) paint['line-color'] = C.roadMajor
        else paint['line-color'] = C.road
        break
      }
      case 'symbol':
        paint['text-color'] = C.label
        paint['text-halo-color'] = C.halo
        paint['text-halo-width'] = 1.2
        paint['icon-opacity'] = 0.55
        break
      default:
        break
    }
  }
  return style
}

// A circle as GeoJSON, for the accuracy halo. radius in metres.
export function circlePolygon(lng, lat, radiusM, steps = 48) {
  const dLat = radiusM / 110574
  const dLng = radiusM / (111320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)))
  const ring = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} }
}

export const EMPTY_FC = { type: 'FeatureCollection', features: [] }
