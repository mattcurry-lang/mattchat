const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl-csp-worker.js')
const dst = path.join(__dirname, '..', 'public', 'maplibre-gl-csp-worker.js')

if (!fs.existsSync(src)) {
  console.error('maplibre-gl is not installed. Run: npm install maplibre-gl@4.7.1')
  process.exit(1)
}
fs.mkdirSync(path.dirname(dst), { recursive: true })
fs.copyFileSync(src, dst)
console.log('Copied maplibre-gl-csp-worker.js to public/')
