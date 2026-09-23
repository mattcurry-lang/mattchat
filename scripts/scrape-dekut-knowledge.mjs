// scripts/scrape-dekut-knowledge.mjs
//
// Crawls DeKUT's site (a curated seed list + sitemap discovery), extracts
// readable text, and sends new pages to dekut-knowledge-ingest as ACTIVE
// items — Curry serves these to students immediately, no review step.
// Skips URLs already ingested from a previous run.
//
// Run: node scripts/scrape-dekut-knowledge.mjs
// Requires env vars: SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
 
import { Agent } from 'undici'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

// DeKUT's TLS cert chain is missing its intermediate certificate — a real
// server misconfiguration. Scoped ONLY to dkut.ac.ke domains below; the
// Supabase calls (which carry admin credentials) keep full verification.
 
const insecureDekutDispatcher = new Agent({ connect: { rejectUnauthorized: false } })

const SEED_PAGES = [
  { url: 'https://www.dkut.ac.ke/index.php/admissions-and-records', category: 'services' },
  { url: 'https://registration.dkut.ac.ke/index.php/admission/joining', category: 'academic' },
  { url: 'https://registration.dkut.ac.ke/index.php/international/admission/rules', category: 'academic' },
  { url: 'https://www.dkut.ac.ke/index.php/about-dekut/administrative-units/directorate-of-ict', category: 'services' },
  { url: 'https://library.dkut.ac.ke/', category: 'academic' },
  { url: 'https://www.dkut.ac.ke/library/', category: 'academic' },
  { url: 'https://csit.dkut.ac.ke/staff-profiles/', category: 'academic' },
  { url: 'https://csit.dkut.ac.ke/about-us/', category: 'academic' },
  { url: 'https://cs.dkut.ac.ke/staff-profiles/', category: 'academic' },
  { url: 'https://cs.dkut.ac.ke/contact-us/', category: 'academic' },
  { url: 'https://nursing.dkut.ac.ke/staff-profiles/', category: 'academic' },
  { url: 'https://nursing.dkut.ac.ke/about-us/', category: 'academic' },
  { url: 'https://nursing.dkut.ac.ke/', category: 'academic' },
  
]

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeText(str) {
  return str
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
}

function extractTitle(html, fallback) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i)
  return match ? sanitizeText(match[1].trim().split('|')[0].trim()) : fallback
}

// Certificate Transparency logs record every HTTPS cert ever issued for
// a domain, including subdomains — so this finds sites like
// csit.dkut.ac.ke or cs.dkut.ac.ke that nothing on the main site links
// to, without hand-listing them. Free, no API key, no special tooling.
async function discoverSubdomains(rootDomain) {
  try {
    const res = await fetch(`https://crt.sh/?q=%25.${rootDomain}&output=json`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return []
    const rows = await res.json()
    const hosts = new Set()
    for (const row of rows) {
      // name_value can contain multiple names separated by newlines,
      // and wildcard entries like "*.dkut.ac.ke" — skip wildcards, keep
      // real hostnames only.
      for (const name of String(row.name_value || '').split('\n')) {
        const clean = name.trim().toLowerCase()
        if (clean.endsWith(rootDomain) && !clean.startsWith('*')) hosts.add(clean)
      }
    }
    // Skip infrastructure subdomains that are never content pages —
    // scraping these wastes time and never yields real knowledge.
    const skip = /^(mail|smtp|imap|pop|ns1?|ns2?|autodiscover|webmail|mx|vpn|cpanel|ftp|api|cdn)\./
    return [...hosts].filter((h) => !skip.test(h))
  } catch (err) {
    console.error(`Subdomain discovery failed: ${err.message}`)
    return []
  }
}
async function scrapePage({ url, category }) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
      dispatcher: insecureDekutDispatcher,
    })
    clearTimeout(timer)

    if (!res.ok) { console.error(`  ✗ ${url} → HTTP ${res.status}`); return null }
    const html = await res.text()
    const title = extractTitle(html, url)
    let content = sanitizeText(stripHtml(html))
    if (content.length > 2000) content = content.slice(0, 2000) + '…'
    if (content.length < 40) { console.error(`  ✗ ${url} → too little extractable text, skipping`); return null }

    return {
      title, content, category, source: url,
     authority: 'DeKUT Official Website',
      status: 'active',
    }
  } catch (err) {
    console.error(`  ✗ ${url} → ${err.message}${err.cause ? ` (cause: ${err.cause.code || err.cause.message})` : ''}`)
    return null
  }
}

async function discoverUrls(sitemapUrl, limit = 60) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(sitemapUrl, { dispatcher: insecureDekutDispatcher, signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return []
    const xml = await res.text()
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim())
    return urls
      .filter((u) => !/\.(pdf|jpg|jpeg|png|zip|docx?)$/i.test(u) && !/login|admin|wp-json/i.test(u))
      .slice(0, limit)
  } catch (err) {
    // Now shows the real reason instead of a bare "fetch failed" — DNS
    // failure (ENOTFOUND, meaning nothing is actually running there),
    // a timeout, or a refused connection are very different situations.
    console.error(`  ✗ ${sitemapUrl} → ${err.message}${err.cause ? ` (${err.cause.code || err.cause.message})` : ''}`)
    return []
  }
}

const CANDIDATE_SCHOOL_SUBDOMAINS = [
  'eng', 'engineering', 'business', 'sbe', 'science', 'sci',
  'nursing', 'son', 'agriculture', 'agric', 'built-environment',
  'environment', 'education', 'mechanical', 'civil', 'electrical',
]

async function probeSubdomain(host) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(`https://${host}/`, {
      method: 'HEAD', dispatcher: insecureDekutDispatcher, signal: controller.signal,
    })
    clearTimeout(timer)
    return res.status < 500 // any real response, even a 404, means something is there
  } catch {
    return false
  }
}

async function getAdminToken() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`Admin sign-in failed: ${data.error_description || data.msg || JSON.stringify(data)}`)
  }
  return data.access_token
}

// The admin's "writable by admins" policy is an ALL policy, which also
// covers SELECT — so an admin token can read every row regardless of
// status, not just active ones. Used purely to avoid re-ingesting the
// same URL twice across runs.
async function getExistingSources(accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/dekut_knowledge?select=source`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) { console.error('Could not fetch existing sources — proceeding without dedupe.'); return new Set() }
  const rows = await res.json()
  return new Set(rows.map((r) => r.source).filter(Boolean))
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, or ADMIN_PASSWORD env vars.')
    process.exit(1)
  }

  console.log('Signing in as admin…')
  const accessToken = await getAdminToken()

  console.log('Checking for already-ingested pages…')
  const existingSources = await getExistingSources(accessToken)
  console.log(`  ${existingSources.size} pages already in the knowledge base.`)
 
console.log('Discovering DeKUT subdomains…')
const ctSubdomains = await discoverSubdomains('dkut.ac.ke')
console.log(`  ${ctSubdomains.length} found via certificate logs.`)

console.log('Probing likely school subdomain names…')
const candidateHosts = CANDIDATE_SCHOOL_SUBDOMAINS.map((s) => `${s}.dkut.ac.ke`)
const probeResults = await Promise.all(candidateHosts.map(async (h) => ({ host: h, live: await probeSubdomain(h) })))
const guessedLive = probeResults.filter((r) => r.live).map((r) => r.host)
if (guessedLive.length > 0) console.log(`  Live: ${guessedLive.join(', ')}`)

const allHosts = [...new Set([...ctSubdomains, ...guessedLive])]
console.log(`Discovering pages across ${allHosts.length} hosts…`)
let discovered = []
for (const host of allHosts) {
  for (const sitemapUrl of [`https://${host}/sitemap.xml`, `https://${host}/wp-sitemap.xml`]) {
    const found = await discoverUrls(sitemapUrl)
    if (found.length > 0) {
      console.log(`  ${sitemapUrl} → ${found.length} pages`)
      discovered = discovered.concat(found)
      break
    }
  }
}
console.log(`  ${discovered.length} pages found via sitemaps in total.`)

const allPages = [...SEED_PAGES, ...discovered.map((url) => ({ url, category: 'general' }))]
  const newPages = allPages.filter((p) => !existingSources.has(p.url))
  console.log(`Scraping ${newPages.length} new pages (skipping ${allPages.length - newPages.length} already ingested)…`)

  const items = []
  for (const page of newPages) {
    console.log(`  → ${page.url}`)
    const item = await scrapePage(page)
    if (item) items.push(item)
    await new Promise((r) => setTimeout(r, 500))
  }

  if (items.length === 0) {
    console.log('Nothing new to ingest.')
    return
  }

  console.log(`Ingesting ${items.length} items…`)
  const res = await fetch(`${SUPABASE_URL}/functions/v1/dekut-knowledge-ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ items }),
  })
  const result = await res.json()
  console.log(JSON.stringify(result, null, 2))

  const succeeded = result.results?.filter((r) => r.ok).length ?? 0
  const failed = result.results?.filter((r) => !r.ok).length ?? 0
  console.log(`\nDone. ${succeeded} pages are now live in Curry's knowledge base. ${failed} failed.`)
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
