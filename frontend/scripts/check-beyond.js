#!/usr/bin/env node
// scripts/check-beyond.js
//
// "Is BEYOND installed correctly?" Run from your frontend folder (next to package.json):
//
//   node scripts/check-beyond.js
//
// It reads your files (never changes them) and tells you exactly what is missing or
// out of date, and what to do about it.

const fs = require('fs')
const path = require('path')

const root = process.cwd()
const rd = (rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8') } catch { return null } }
const exists = (rel) => fs.existsSync(path.join(root, rel))

const EXPECTED_VERSION = '0.5.0'
let problems = 0
const ok = (m) => console.log(`  ✓ ${m}`)
const bad = (m, fix) => { problems++; console.log(`  ✗ ${m}${fix ? `\n      → ${fix}` : ''}`) }
const warn = (m) => console.log(`  ! ${m}`)
const section = (t) => console.log(`\n${t}`)

if (!exists('package.json')) {
  console.error('Run this from your frontend folder (the one that contains package.json).')
  process.exit(2)
}

/* 1. files, and whether each is the NEW version */
section('1. BEYOND files in src/beyond')
const files = [
  ['src/beyond/version.js', null],
  ['src/beyond/useBeyond.js', 'consumePop'],
  ['src/beyond/motion.js', null],
  ['src/beyond/BeyondPortal.jsx', 'CinemaEnv'],
  ['src/beyond/LiveShareBar.jsx', null],
  ['src/beyond/BatteryCard.jsx', 'problemText'],
  ['src/beyond/useLiveShare.js', 'useMyBatteryShare'],
  ['src/beyond/useMyBatteryShare.js', null],
  ['src/beyond/useContactLocation.js', 'classifyDbError'],
  ['src/beyond/useContactBattery.js', 'classifyDbError'],
  ['src/beyond/environments/WorldEnv.jsx', 'useContactBattery'],
  ['src/beyond/environments/CinemaEnv.jsx', 'tonightsPick'],
  ['src/beyond/environments/mapStyle.js', null],
  ['src/beyond/services/locationFreshness.js', null],
  ['src/beyond/services/liveLocation.js', null],
  ['src/beyond/services/batteryStatus.js', null],
  ['src/beyond/services/dbProblem.js', null],
  ['src/beyond/services/tmdb.js', 'bad_key'],
]
for (const [f, marker] of files) {
  const src = rd(f)
  if (src === null) bad(`${f} is missing`, 'copy it from the bundle (src/beyond/…)')
  else if (marker && !src.includes(marker)) bad(`${f} is an OLD version`, 'overwrite it with the one from the bundle')
  else ok(f)
}
const ver = (rd('src/beyond/version.js') || '').match(/BEYOND_VERSION = '([^']+)'/)
if (ver && ver[1] !== EXPECTED_VERSION) bad(`BEYOND version is ${ver[1]}, expected ${EXPECTED_VERSION}`, 'copy the whole src/beyond folder again')
else if (ver) ok(`version ${ver[1]}`)

/* 2. package.json */
section('2. package.json')
let pkg = {}
try { pkg = JSON.parse(rd('package.json')) } catch { bad('package.json is not valid JSON') }
if (pkg.dependencies && pkg.dependencies['maplibre-gl']) ok(`maplibre-gl ${pkg.dependencies['maplibre-gl']}`)
else bad('maplibre-gl is not in dependencies', 'npm install maplibre-gl@4.7.1')
for (const k of ['prestart', 'prebuild']) {
  if (pkg.scripts && /copy-maplibre-worker/.test(pkg.scripts[k] || '')) ok(`script "${k}"`)
  else bad(`script "${k}" is missing`, `add  "${k}": "node scripts/copy-maplibre-worker.js"  to "scripts"`)
}
if (exists('scripts/copy-maplibre-worker.js')) ok('scripts/copy-maplibre-worker.js')
else bad('scripts/copy-maplibre-worker.js is missing', 'it must be in THIS folder\'s scripts/, next to package.json (not the repo root)')
if (!exists('public/maplibre-gl-csp-worker.js')) warn('public/maplibre-gl-csp-worker.js not there yet (created automatically by npm start / npm run build)')
else ok('public/maplibre-gl-csp-worker.js')

/* 3. ChatPage */
section('3. ChatPage.jsx')
const chat = rd('src/pages/ChatPage.jsx')
if (chat === null) bad('src/pages/ChatPage.jsx not found')
else {
  const need = [
    ['imports useBeyond', "from '../beyond/useBeyond'"],
    ['imports useLiveShare', "from '../beyond/useLiveShare'"],
    ['imports BeyondPortal', "from '../beyond/BeyondPortal'"],
    ['imports LiveShareBar', "from '../beyond/LiveShareBar'"],
    ['chatAreaRef declared', 'const chatAreaRef = useRef(null)'],
    ['useBeyond called', 'useBeyond('],
    ['useLiveShare called', 'useLiveShare(userId)'],
    ['system Back handled', 'consumePop'],
    ['chat-area has the ref', 'ref={chatAreaRef}'],
    ['header button', '<BeyondGlyph'],
    ['portal rendered', '<BeyondPortal'],
    ['portal gets ctx', /ctx=\{\{\s*conversationId/],
    ['portal gets the contact id', /contact=\{\{[\s\S]{0,40}id: otherUserId/],
    ['live-share bar', '<LiveShareBar'],
    ['location sheet can offer live sharing', 'allowLiveLocation='],
    ['live share starts from the sheet', 'opts.liveMinutes'],
    ['reply swipe is right-only', 'dxRef'],
  ]
  let missing = 0
  for (const [label, m] of need) {
    const has = m instanceof RegExp ? m.test(chat) : chat.includes(m)
    if (has) ok(label); else { missing++; bad(label) }
  }
  if (missing) console.log('      → run:  node scripts/wire-beyond.js src/pages/ChatPage.jsx src/components/media/MediaAttachmentFlow.jsx')
}

/* 4. media files */
section('4. Location sheet')
const media = rd('src/components/media/MediaAttachmentFlow.jsx')
if (media === null) bad('src/components/media/MediaAttachmentFlow.jsx not found')
else if (media.includes('allowLiveLocation') && media.includes('allowLive={allowLiveLocation}')) ok('MediaAttachmentFlow passes live-sharing options')
else bad('MediaAttachmentFlow does not pass live-sharing options', 'run the wire-beyond.js command above (with both file paths)')
const modal = rd('src/components/media/LocationShareModal.jsx')
if (modal === null) bad('src/components/media/LocationShareModal.jsx not found')
else if (modal.includes('allowLive')) ok('LocationShareModal offers "share live"')
else bad('LocationShareModal is the OLD one', 'overwrite it with replace/LocationShareModal.jsx from the bundle')

console.log(problems
  ? `\n${problems} problem${problems === 1 ? '' : 's'} found. Fix the lines marked ✗ and run this again.\n`
  : '\nAll good. BEYOND is installed.\n\nIf something still misbehaves, the database or the movie service is the likely cause:\n  • run supabase/beyond-all.sql in the Supabase SQL editor\n  • deploy the beyond-tmdb function and set TMDB_READ_TOKEN\n')
process.exit(problems ? 1 : 0)
