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
  { url: 'https://nursing.dkut.ac.ke/staff-profiles.html', category: 'academic' },  // was /staff-profiles/
  { url: 'https://nursing.dkut.ac.ke/about.html', category: 'academic' },           // was /about-us/
  { url: 'https://nursing.dkut.ac.ke/', category: 'academic' },
  { url: 'https://sbme.dkut.ac.ke/staff-profiles/', category: 'academic' },         // add this, seen in crawl log
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
    const timer = setTimeout(() => controller.abort(), 25000)
    const res = await fetch(url, { /* ...unchanged... */ signal: controller.signal, redirect: 'follow', dispatcher: insecureDekutDispatcher })
    clearTimeout(timer)

    if (!res.ok) { console.error(`  ✗ ${url} → HTTP ${res.status}`); return null }
    const html = await res.text()
    const title = extractTitle(html, url)

    if (looksLikeStaffPage(url)) {
      const blockText = htmlToBlockText(html)
      const staffEntries = splitStaffEntries(blockText, url)
      if (staffEntries) return staffEntries // array — caller must flatten
    }

    // Fallback: normal whole-page behavior for non-directory pages
    let content = sanitizeText(stripHtml(html))
    if (content.length > 2000) content = content.slice(0, 2000) + '…'
    if (content.length < 40) { console.error(`  ✗ ${url} → too little extractable text, skipping`); return null }
    return { title, content, category, source: url, authority: 'DeKUT Official Website', status: 'active' }
  } catch (err) {
    console.error(`  ✗ ${url} → ${err.message}`)
    return null
  }
}
// Detects a page that's actually a staff/faculty directory rather than
// prose, and splits it into one record per person instead of one
// truncated blob for the whole page.
const STAFF_TITLE_RE = /\b(Prof\.?|Dr\.?|Eng\.?|Mr\.?|Mrs\.?|Ms\.?)\s+[A-Z][\w.'-]+(?:\s+[A-Z][\w.'-]+){0,3}/g

function looksLikeStaffPage(url) {
  return /staff-profiles|staff|faculty|team|people/i.test(url)
}

// Preserve block boundaries as newlines BEFORE stripping tags, so
// "Dr. Jane Wanjiru<br>Lecturer<br>jwanjiru@dkut.ac.ke" doesn't collapse
// into one run-on sentence with nothing to split on.
function htmlToBlockText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

// Splits directory text into one chunk per person: everything from one
// "Dr./Prof./Mr. Name" match up to the next one becomes that person's
// record. Falls back to null (caller keeps old whole-page behavior) if
// fewer than 2 name-like matches are found — not actually a directory.
function splitStaffEntries(blockText, sourceUrl) {
  const matches = [...blockText.matchAll(STAFF_TITLE_RE)]
  if (matches.length < 2) return null

  const entries = []
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : blockText.length
    const chunk = sanitizeText(blockText.slice(start, end).replace(/\s+/g, ' ').trim())
    const name = sanitizeText(matches[i][0].trim())
    if (chunk.length < 15) continue // just a bare name with nothing else, skip
    entries.push({
      title: name,
      content: chunk.slice(0, 1200),
      category: 'academic',
      source: `${sourceUrl}#${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      authority: 'DeKUT Official Website',
      status: 'active',
    })
  }
  return entries.length > 0 ? entries : null
}
// When a homepage is reachable but we don't know its real page structure
// (no sitemap, guessed slugs 404), follow the actual links on that page
// instead of guessing more slugs. Depth 1 only — homepage plus whatever
// it directly links to on the same host — so this stays fast and never
// wanders into unrelated parts of a site.
async function crawlFromHomepage(homepageUrl, category, maxPages = 8) {
  try {
    const res = await fetch(homepageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, dispatcher: insecureDekutDispatcher })
    if (!res.ok) return []
    const html = await res.text()
    const host = new URL(homepageUrl).host
    const links = [...html.matchAll(/href=["']([^"']+)["']/gi)]
      .map((m) => { try { return new URL(m[1], homepageUrl).href } catch { return null } })
      .filter((u) => u && new URL(u).host === host)
      .filter((u) => !/\.(pdf|jpg|jpeg|png|zip|docx?|css|js)$/i.test(u))
      .filter((u) => /staff|faculty|about|department|contact|team|people/i.test(u)) // only pages likely to matter
    return [...new Set(links)].slice(0, maxPages)
  } catch (err) {
    console.error(`  ✗ crawlFromHomepage(${homepageUrl}) → ${err.message}`)
    return []
  }
}

// WordPress sitemaps are two layers: the top sitemap.xml/wp-sitemap.xml
// lists OTHER sitemaps (one per content type — posts, pages, a custom
// "person" type for staff directories, etc.), not actual pages. This
// follows one extra layer down whenever a discovered URL is itself a
// sitemap file, so real content (like individual lecturer profile URLs
// under a "person" post type) actually gets reached — and, critically,
// never returns a sitemap URL itself as something to scrape as content.
async function discoverUrls(sitemapUrl, limit = 200, depth = 0) {
  if (depth > 2) return [] // safety cap against any circular/malformed sitemap
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(sitemapUrl, { dispatcher: insecureDekutDispatcher, signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return []
    const xml = await res.text()
    const rawUrls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim())

    const looksLikeSitemap = (u) => /sitemap.*\.xml$/i.test(u)
    const nestedSitemaps = rawUrls.filter(looksLikeSitemap)
    const realPages = rawUrls.filter((u) => !looksLikeSitemap(u))

    let all = realPages
    for (const nested of nestedSitemaps) {
      const deeper = await discoverUrls(nested, limit, depth + 1)
      all = all.concat(deeper)
    }

    return all
      .filter((u) => !/\.(pdf|jpg|jpeg|png|zip|docx?)$/i.test(u) && !/login|admin|wp-json/i.test(u))
      .slice(0, limit)
  } catch (err) {
    console.error(`  ✗ ${sitemapUrl} → ${err.message}${err.cause ? ` (${err.cause.code || err.cause.message})` : ''}`)
    return []
  }
}

// Built from DeKUT's actual confirmed schools/institutes/departments
// (an international university directory, cross-checked against the
// pattern that already worked: mechanical.dkut.ac.ke). Department-level
// names, not school-level ones — "engineering.dkut.ac.ke" never
// resolved, but "mechanical.dkut.ac.ke" did, so DeKUT names sites after
// departments, not schools.
const CANDIDATE_SCHOOL_SUBDOMAINS = [
  // School of Engineering — departments
  'civil', 'electrical', 'mechanical', 'electronics',
  // School of Computer Science and IT — already confirmed live (csit, cs)
  'csit', 'cs',
  // School of Business, Management and Economics
  'business', 'economics', 'commerce', 'sbme',
  // School of Science
  'science', 'mathematics', 'physics', 'chemistry', 'biology',
  // School of Nursing — already confirmed live
  'nursing',
  // Institutes
  'icfoss', 'criminology', 'ifbt', 'food', 'iggres', 'geomatics',
  'getri', 'geothermal', 'tourism', 'hospitality',
  // Other known undergraduate programmes suggesting their own department
  'architecture', 'agriculture',
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

  console.log('Following links from homepages with no sitemap…')
  const sitemappedHosts = new Set(discovered.map((u) => { try { return new URL(u).host } catch { return '' } }))
  const noSitemapHosts = allHosts.filter((h) => !sitemappedHosts.has(h))
  for (const host of noSitemapHosts) {
    const links = await crawlFromHomepage(`https://${host}/`, 'academic')
    if (links.length > 0) {
      console.log(`  https://${host}/ → followed ${links.length} likely pages: ${links.join(', ')}`)
      discovered = discovered.concat(links)
    }
  }

  const allPages = [...SEED_PAGES, ...discovered.map((url) => ({ url, category: 'general' }))]
  const newPages = allPages.filter((p) => !existingSources.has(p.url))
  console.log(`Scraping ${newPages.length} new pages (skipping ${allPages.length - newPages.length} already ingested)…`)

  const items = []
  for (const page of newPages) {
    console.log(`  → ${page.url}`)
   const item = await scrapePage(page)
if (Array.isArray(item)) items.push(...item)
else if (item) items.push(item)
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
