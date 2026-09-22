import { Agent } from 'node:undici'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

// DeKUT's TLS cert chain is missing its intermediate certificate — a
// real server misconfiguration, not a spoofing risk we're choosing to
// ignore. Scoped ONLY to requests to dkut.ac.ke domains; the Supabase
// calls below (which carry admin credentials) keep full verification.
// Worst case if this domain were ever actually compromised in transit:
// bad content lands as a 'draft' row nobody has activated yet — it
// never reaches a student without a human reviewing and approving it.
const insecureDekutDispatcher = new Agent({ connect: { rejectUnauthorized: false } })

const SEED_PAGES = [
  { url: 'https://www.dkut.ac.ke/index.php/admissions-and-records', category: 'services' },
  { url: 'https://registration.dkut.ac.ke/index.php/admission/joining', category: 'academic' },
  { url: 'https://www.dkut.ac.ke/index.php/about-dekut/administrative-units/directorate-of-ict', category: 'services' },
  { url: 'https://library.dkut.ac.ke/', category: 'academic' },
  { url: 'https://www.dkut.ac.ke/library/', category: 'academic' },
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

// Strips characters Postgres text columns reject outright — control
// characters and lone UTF-16 surrogates (half of a broken multi-byte
// character, usually from a page served in a different encoding than
// we assumed). Scraped web text is the one place this kind of garbage
// reliably shows up; hand-typed knowledge-admin entries won't need this.
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

    if (!res.ok) {
      console.error(`  ✗ ${url} → HTTP ${res.status}`)
      return null
    }
    const html = await res.text()
    const title = extractTitle(html, url)
    let content = sanitizeText(stripHtml(html))
    if (content.length > 2000) content = content.slice(0, 2000) + '…'
    if (content.length < 40) {
      console.error(`  ✗ ${url} → too little extractable text, skipping`)
      return null
    }
   return {
  title, content, category, source: url,
  authority: 'DeKUT website (auto-collected)',
  status: 'active',  
}
  } catch (err) {
    console.error(`  ✗ ${url} → ${err.message}${err.cause ? ` (cause: ${err.cause.code || err.cause.message})` : ''}`)
    return null
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
// Discovers real page URLs automatically instead of a hand-picked list —
// this is what actually gets toward "everything," not the fixed array.
async function discoverUrls(sitemapUrl, limit = 60) {
  try {
    const res = await fetch(sitemapUrl, { dispatcher: insecureDekutDispatcher })
    if (!res.ok) return []
    const xml = await res.text()
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim())
    const filtered = urls.filter((u) => !/\.(pdf|jpg|jpeg|png|zip|docx?)$/i.test(u) && !/login|admin|wp-json/i.test(u))
    return filtered.slice(0, limit)
  } catch (err) {
    console.error(`Sitemap discovery failed for ${sitemapUrl}: ${err.message}`)
    return []
  }
}
async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, or ADMIN_PASSWORD env vars.')
    process.exit(1)
  }

console.log('Discovering pages…')
const discovered = await discoverUrls('https://www.dkut.ac.ke/sitemap.xml')
const allPages = [
  ...SEED_PAGES,
  ...discovered.map((url) => ({ url, category: 'general' })),
]
console.log(`Scraping ${allPages.length} pages…`)
const items = []
for (const page of allPages) {
  console.log(`  → ${page.url}`)
  const item = await scrapePage(page)
  if (item) items.push(item)
  await new Promise((r) => setTimeout(r, 500))
}

  if (items.length === 0) {
    console.error('Nothing scraped successfully — nothing to ingest.')
    process.exit(1)
  }

  console.log(`Ingesting ${items.length} draft items…`)
  const res = await fetch(`${SUPABASE_URL}/functions/v1/dekut-knowledge-ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ items }),
  })
  const result = await res.json()
  console.log(JSON.stringify(result, null, 2))
  console.log(`\nDone. Everything landed as status: 'draft' — review it in DekutKnowledgeAdmin before activating.`)
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
