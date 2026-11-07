import React, { useEffect } from 'react'
import { NOTICE_VERSION } from '../../../../lib/music/CampusTrends'

// Fill these in before publishing. They are shown on purpose in square brackets so a missed one is obvious.
const CONTACT = '[mattchat.app.org@gmail.com]'
const UPDATED = '[7th November ,2026]'

const h3 = { fontSize: 15, fontWeight: 800, margin: '22px 0 6px' }
const p = { fontSize: 14, lineHeight: 1.65, margin: '0 0 10px', opacity: 0.88 }
const ul = { margin: '0 0 10px', paddingLeft: 20, fontSize: 14, lineHeight: 1.65, opacity: 0.88 }

export default function CampusTrendsPrivacySection() {
  // lets /privacy#campus-trends scroll here even though the page loads lazily
  useEffect(() => {
    if (window.location.hash !== '#campus-trends') return undefined
    const t = setTimeout(() => document.getElementById('campus-trends')?.scrollIntoView(), 150)
    return () => clearTimeout(t)
  }, [])

  return (
    <section
      id="campus-trends" aria-labelledby="ct-priv-title"
      style={{ scrollMarginTop: 16, marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(128,128,128,0.35)' }}
    >
      <h2 id="ct-priv-title" style={{ fontSize: 20, fontWeight: 900, margin: '0 0 4px' }}>Campus Trends</h2>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 14 }}>Notice version {NOTICE_VERSION} · Updated {UPDATED}</div>

      <p style={p}>
        Campus Trends is an optional part of Pulse Music. It shows weekly charts of what students at the same campus
        listen to and save. You are only included if you choose “Contribute to campus trends”. If you choose “Not now”,
        nothing else in Mattchat changes.
      </p>

      <h3 style={h3}>What we count</h3>
      <ul style={ul}>
        <li>Songs you add to one of your playlists after you opted in.</li>
        <li>Songs you play for 30 seconds or more after you opted in.</li>
        <li>The campus you chose, which decides which chart you belong to.</li>
      </ul>
      <p style={p}>
        We do not count anything from before you opted in, your likes, downloads, chats, or anything outside Pulse Music.
        Mattchat already keeps your own listening history so it can remember your last song and build your mixes. That
        happens whether or not you join Campus Trends. Campus Trends only reads it for people who opted in.
      </p>
      <p style={p}>
        To stop the charts being manipulated, only accounts at least 7 days old count, and one person counts for at most
        30 songs a week.
      </p>

      <h3 style={h3}>When and how it is processed</h3>
      <p style={p}>
        Once a week, after Sunday midnight Nairobi time, an automated process in our database counts how many different
        opted-in students at each campus added or played each song during the week that just ended. It uses your account
        so that you count once per song, however many times you play it. It does not save a result for you personally.
      </p>

      <h3 style={h3}>What other students can see</h3>
      <p style={p}>
        Ranks, whether a song went up, down or is new, popular artists, and rough genre shares rounded to the nearest 5%.
        Never names, never how many students, and never which students. A chart appears only if at least 20 students at the
        campus took part that week, and a song or artist needs at least 5 different students. These are our current
        settings. An administrator can change them, but only within fixed minimum limits, and every change is logged.
      </p>
      <p style={p}>
        Combined charts make it much harder to tell what any one person listens to, but we cannot promise it is impossible
        in every case. That is why we call this combined data, not anonymous data. Playlists you make public are visible to
        other people, as they always were. That is separate from Campus Trends.
      </p>

      <h3 style={h3}>Who can access the information</h3>
      <p style={p}>
        Other students cannot. The administrator screen for Campus Trends shows campus totals only, such as how many
        students opted in and whether the weekly process ran. The people who run Mattchat’s database can technically reach
        stored records, as with any online service. We do not use that access to look at individual students’ listening
        for Campus Trends.
      </p>

      <h3 style={h3}>How long we keep it</h3>
      <ul style={ul}>
        <li>Your choices (whether you opted in, when, and your campus): until you change them or delete your account.</li>
        <li>Exact weekly song totals, used only to compare one week with the next: 12 weeks, then deleted.</li>
        <li>Published weekly charts, which hold ranks and no personal information: up to 12 months, so weeks can be compared.</li>
      </ul>
      <p style={p}>Your playlists and listening history themselves are covered by the rest of this privacy notice.</p>

      <h3 style={h3}>Your choices and rights</h3>
      <p style={p}>
        You can turn Campus Trends off at any time in Pulse, then Music, then Campus, under Your settings. From then on you
        are left out of every future weekly chart, including the week in progress, because eligibility is checked when the
        weekly process runs. Charts already published stay. They contain no names, and one person’s contribution cannot be
        taken out of combined ranks. You can change your campus once every 28 days, starting the following Monday.
      </p>
      <p style={p}>
        Under the Kenya Data Protection Act, 2019, you have rights that include being informed, seeing your data, having it
        corrected or deleted, objecting to its use, and withdrawing your consent. Withdrawing does not affect processing
        done before. To use any of these rights, contact {CONTACT}. If you are not happy with our answer, you can complain
        to the Office of the Data Protection Commissioner (ODPC) in Kenya.
      </p>

      <h3 style={h3}>Song information from YouTube</h3>
      <p style={p}>
        To show titles and artwork for songs on a chart, we ask YouTube for public information about the songs, not about
        you. Songs play through YouTube’s player, so YouTube’s own terms and privacy policy apply to that playback.
      </p>
    </section>
  )
}
