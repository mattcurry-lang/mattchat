// scripts/scrape-dekut-knowledge.mjs
//
// Crawls a fixed list of real DeKUT pages, extracts readable text, and
// sends it to dekut-knowledge-ingest as DRAFT items — never 'active'.
// Someone with admin access must review each draft in DekutKnowledgeAdmin
// and flip it to active before Curry will ever serve it to a student.
// This is deliberate: a crawler can't tell a stale page from a current
// one, or clean nav/footer junk from real content, as reliably as a
// 10-second human glance can.
//
// Run: node scripts/scrape-dekut-knowledge.mjs
// Requires env vars: SUPABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
// (the admin account's own login — the ingest function checks
// profiles.is_admin on whoever's JWT calls it)

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

// Curated seed list — real, specific DeKUT pages worth having in the
// knowledge base. Expand this over time rather than trying to crawl the
// whole domain blind; a hand-picked list of ~30-50 real pages beats an
// unsupervised full-site crawl that also picks up news archives, old
// events, and duplicate menus.
const SEED_PAGES = [
  { url: 'https://www.dkut.ac.ke/index.php/admissions-and-records', category: 'services' },
  { url: 'https://registration.dkut.ac.ke/index.php/admission/joining', category: 'academic' },
  { url: 'https://www.dkut.ac.ke/index.php/about-dekut/administrative-units/directorate-of-ict', category: 'services' },
  { url: 'https://library.dkut.ac.ke/', category: 'academic' },
  { url: 'https://www.dkut.ac.ke/library/', category: 'academic' },
  // Add more real URLs here as you find them — admissions procedures,
  // examinations office, financial aid, student welfare, each school's
  // own page, etc.
]

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')       // strip nav menus — mostly link noise
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ') // strip footers — mostly link noise
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(html, fallback) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i)
  return match ? match[1].trim().split('|')[0].trim() : fallback
}

async function scrapePage({ url, category }) {
  const res = await fetch(url, { headers: { 'User-Agent': 'DeKUT-Hub-Curry-Ingest/1.0' } })
  if (!res.ok) {
    console.error(`  ✗ ${url} → HTTP ${res.status}`)
    return null
  }
  const html = await res.text()
  const title = extractTitle(html, url)
  let content = stripHtml(html)

  // Cap length — a full page of boilerplate isn't useful as one chunk,
  // and the embedding call has practical limits. 2000 chars is a rough
  // "one topic's worth" ceiling; genuinely long pages should be split
  // by hand into multiple knowledge items instead of truncated blindly.
  if (content.length > 2000) content = content.slice(0, 2000) + '…'
  if (content.length < 40) {
    console.error(`  ✗ ${url} → too little extractable text, skipping`)
    return null
  }

  return {
    title,
    content,
    category,
    source: url,
    authority: 'DeKUT website (auto-collected — verify before publishing)',
    status: 'draft', // NEVER 'active' from an automated run
  }
}

async function main() {
  if (!SUPABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Missing SUPABASE_URL, ADMIN_EMAIL, or ADMIN_PASSWORD env vars.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
  })
  if (authErr || !authData.session) {
    console.error('Admin sign-in failed:', authErr?.message)
    process.exit(1)
  }

  console.log(`Scraping ${SEED_PAGES.length} pages…`)
  const items = []
  for (const page of SEED_PAGES) {
    console.log(`  → ${page.url}`)
    const item = await scrapePage(page)
    if (item) items.push(item)
    await new Promise((r) => setTimeout(r, 500)) // be polite to DeKUT's server
  }

  console.log(`Ingesting ${items.length} draft items…`)
  const res = await fetch(`${SUPABASE_URL}/functions/v1/dekut-knowledge-ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authData.session.access_token}`,
    },
    body: JSON.stringify({ items }),
  })
  const result = await res.json()
  console.log(JSON.stringify(result, null, 2))
  console.log(`\nDone. Everything landed as status: 'draft' — go review it in DekutKnowledgeAdmin and flip real ones to 'active'.`)
}

main()
