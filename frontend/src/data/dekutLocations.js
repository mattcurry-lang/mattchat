// src/data/dekutLocations.js
//
// Schema for DeKUT campus locations (rooms, offices, facilities). This is
// intentionally decoupled from dekutServices.js — services are external
// links / in-app feature entry points, locations are physical places on
// campus that Room Finder and (later) Campus Map search over.
//
// DEKUT_LOCATIONS starts empty on purpose. Per the DeKUT Hub spec: never
// invent coordinates, walking distances, opening hours or room numbers.
// This array is meant to be populated from real DeKUT ICT data (a CMS,
// a JSON export, a Supabase table — whatever the eventual source is).
// Until that exists, Room Finder will correctly show an empty state
// rather than fabricated rooms.
//
// Location shape:
// {
//   id: string                 unique, stable id
//   name: string                'RC18', 'Main Library', 'Finance Office'
//   category: string            one of LOCATION_CATEGORIES keys below
//   description: string | null
//   building: string | null
//   floor: string | null        e.g. 'Ground Floor' — free text, not a number
//   roomNumber: string | null
//   openingHours: string | null e.g. 'Mon–Fri, 8:00–17:00' — only if verified
//   services: string[] | null   e.g. ['Printing', 'Scanning']
//   landmarks: string[] | null  nearby landmarks, for wayfinding text
//   walkingDistance: string | null  e.g. '4 min walk' — only if ICT supplies it
//   coordinates: { lat: number, lng: number } | null  never invented
//   keywords: string[]          search aliases beyond name/roomNumber
// }

export const LOCATION_CATEGORIES = {
  'lecture-room': 'Lecture Room',
  laboratory: 'Laboratory',
  library: 'Library',
  office: 'Office',
  administration: 'Administration',
  finance: 'Finance',
  admissions: 'Admissions',
  'student-affairs': 'Student Affairs',
  'health-centre': 'Health Centre',
  hostel: 'Hostel',
  dining: 'Dining & Catering',
  sports: 'Sports Facility',
  printing: 'Printing',
  'wifi-hotspot': 'Wi-Fi Hotspot',
  other: 'Other',
}

// Real, verified DeKUT locations go here. Empty until ICT/an admin
// dashboard supplies data — see section 16/22 of the Hub spec.
export const DEKUT_LOCATIONS = []

// Obviously-fictional data for local UI development ONLY. Names are
// deliberately generic ("Sample ...") rather than real-looking DeKUT room
// codes, so this can never be mistaken for verified campus data if it
// leaks into a build. Import this in a dev harness / storybook — never
// wire it into the real app as a fallback for DEKUT_LOCATIONS.
export const DEV_SAMPLE_LOCATIONS = [
  {
    id: 'sample-lecture-hall',
    name: 'Sample Lecture Hall',
    category: 'lecture-room',
    description: 'Placeholder entry for local UI testing only — not a real DeKUT location.',
    building: 'Sample Block',
    floor: 'Ground Floor',
    roomNumber: 'SB01',
    openingHours: null,
    services: null,
    landmarks: ['Sample Courtyard'],
    walkingDistance: null,
    coordinates: null,
    keywords: ['sample', 'test', 'placeholder'],
    isSample: true,
  },
  {
    id: 'sample-library',
    name: 'Sample Library',
    category: 'library',
    description: 'Placeholder entry for local UI testing only — not a real DeKUT location.',
    building: 'Sample Block',
    floor: null,
    roomNumber: null,
    openingHours: null,
    services: ['Study Rooms'],
    landmarks: null,
    walkingDistance: null,
    coordinates: null,
    keywords: ['sample', 'test', 'placeholder'],
    isSample: true,
  },
]

function score(location, q) {
  const name = location.name.toLowerCase()
  const room = (location.roomNumber || '').toLowerCase()
  const building = (location.building || '').toLowerCase()
  const keywords = (location.keywords || []).map((k) => k.toLowerCase())

  if (room === q || name === q) return 100
  if (room.startsWith(q) || name.startsWith(q)) return 80
  if (keywords.includes(q)) return 70
  if (room.includes(q) || name.includes(q)) return 50
  if (building.includes(q)) return 30
  if (keywords.some((k) => k.includes(q))) return 20
  if ((location.description || '').toLowerCase().includes(q)) return 10
  return 0
}

export function searchLocations(query, locations = DEKUT_LOCATIONS) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return locations
    .map((loc) => ({ loc, score: score(loc, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.loc)
}
