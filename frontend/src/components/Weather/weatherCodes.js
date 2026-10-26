// WMO weather interpretation codes, as returned by Open-Meteo's `weather_code`.
// [label, scene, icon]. "scene" drives the animated background, "icon" the glyph.
const T = {
  0: ['Clear sky', 'clear', 'sun'],
  1: ['Mainly clear', 'clear', 'sun'],
  2: ['Partly cloudy', 'partly', 'partly'],
  3: ['Overcast', 'cloudy', 'cloud'],
  45: ['Fog', 'fog', 'fog'],
  48: ['Freezing fog', 'fog', 'fog'],
  51: ['Light drizzle', 'drizzle', 'drizzle'],
  53: ['Drizzle', 'drizzle', 'drizzle'],
  55: ['Heavy drizzle', 'drizzle', 'drizzle'],
  56: ['Freezing drizzle', 'sleet', 'sleet'],
  57: ['Freezing drizzle', 'sleet', 'sleet'],
  61: ['Light rain', 'rain', 'rain'],
  63: ['Rain', 'rain', 'rain'],
  65: ['Heavy rain', 'heavyrain', 'heavyrain'],
  66: ['Freezing rain', 'sleet', 'sleet'],
  67: ['Freezing rain', 'sleet', 'sleet'],
  71: ['Light snow', 'snow', 'snow'],
  73: ['Snow', 'snow', 'snow'],
  75: ['Heavy snow', 'heavysnow', 'snow'],
  77: ['Snow grains', 'snow', 'snow'],
  80: ['Light showers', 'rain', 'rain'],
  81: ['Showers', 'rain', 'rain'],
  82: ['Violent showers', 'heavyrain', 'heavyrain'],
  85: ['Snow showers', 'snow', 'snow'],
  86: ['Heavy snow showers', 'heavysnow', 'snow'],
  95: ['Thunderstorm', 'storm', 'storm'],
  96: ['Thunderstorm with hail', 'storm', 'storm'],
  99: ['Severe thunderstorm with hail', 'storm', 'storm'],
}

export function describeCode(code, isDay = true) {
  const row = T[code]
  if (!row) return { code, label: 'Unknown', scene: 'cloudy', icon: 'cloud', isDay: !!isDay }
  const [label, scene, icon] = row
  // "Clear sky" at night reads better as "Clear night"
  const nightLabel = !isDay && (scene === 'clear') ? (code === 0 ? 'Clear night' : 'Mostly clear') : label
  return { code, label: isDay ? label : nightLabel, scene, icon, isDay: !!isDay }
}

export const isWet = (code) => [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)
export const isSnowy = (code) => [71, 73, 75, 77, 85, 86].includes(code)
export const isStormy = (code) => [95, 96, 99].includes(code)

// Sky gradients [top, bottom] per scene and time of day. Checked for white-text contrast in the tests.
export const SKIES = {
  'clear-day': ['#1a63d1', '#4aa3f0'], 'clear-night': ['#0a1236', '#1b2a6b'],
  'partly-day': ['#2368c4', '#5fa6e3'], 'partly-night': ['#101a40', '#28396f'],
  'cloudy-day': ['#44586f', '#6f859b'], 'cloudy-night': ['#1c2433', '#3a475c'],
  'fog-day': ['#5d6b79', '#8a97a4'], 'fog-night': ['#2a313b', '#4b5663'],
  'drizzle-day': ['#3a5675', '#6683a0'], 'drizzle-night': ['#182233', '#34465c'],
  'rain-day': ['#2f4863', '#58728d'], 'rain-night': ['#10192a', '#27384e'],
  'heavyrain-day': ['#243549', '#455b73'], 'heavyrain-night': ['#0a1019', '#1b2a3d'],
  'snow-day': ['#4f6b92', '#8aa4c7'], 'snow-night': ['#1e2a45', '#4b5f86'],
  'heavysnow-day': ['#43597d', '#7d96ba'], 'heavysnow-night': ['#18233b', '#3e5074'],
  'sleet-day': ['#41556f', '#6d8199'], 'sleet-night': ['#1a2436', '#3a4a62'],
  'storm-day': ['#1f2640', '#424b6c'], 'storm-night': ['#080b18', '#1a2038'],
}
export const skyFor = (scene, isDay) => SKIES[`${scene}-${isDay ? 'day' : 'night'}`] || SKIES['cloudy-day']
