// src/lib/curryMedia.js
// Is this message a request to PLAY something? ("give me a luh kel song",
// "play Overload by Luh Kel", "show me a video of how to tie a tie")
//
// If yes, the app finds it itself (your music providers / YouTube) and shows playable
// cards, because a language model can't play audio. If no, the message goes to Curry
// exactly as before, so ordinary questions are never hijacked. When in doubt this
// returns null.
//
// parseMediaRequest(text) -> null | { kind: 'song' | 'video', query, plural, source }
//   query   what to search for ('' when the request is too vague, e.g. "play something")
//   plural  they asked for several ("songs", "some ...")
//   source  'youtube' if they said so ("... from YouTube"), else null

const SONG_NOUN = /\b(songs?|tracks?|tunes?|music|bangers?|singles?|remix(?:es)?|hits?|jams?|playlist|mix)\b/i
const VIDEO_NOUN = /\b(videos?|clips?|trailers?|tutorials?|vids?)\b/i
const WATCH_VERB = /\b(?:want to|wanna|let me|can i|i'd like to|id like to|please)\s+watch\b/i
const YOUTUBE = /\b(youtube|you tube|yt)\b/i
const LISTEN = /\b(?:listen to|hear)\b/i

const REQUEST = new RegExp(
  '\\b(?:play|put on|queue|give me|give us|get me|get us|find me|find|search for|search|look up|look for|show me|show us|' +
  'recommend|suggest|i want|i wanna|i\'d like|id like|i need|let me (?:hear|listen to|watch)|' +
  'can i (?:get|have|hear|listen to|watch)|can you (?:play|find|get|show|give|put)|' +
  'could you (?:play|find|get|show|give|put)|would you (?:play|find|get|show|give|put)|any)\\b', 'i')

const STARTS_WITH_PLAY = /^(?:hey curry[,!.\s]*)?(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?(?:play|put on|queue)\b/i

// Things that mention songs but are not "play it": making one, asking about one.
const CREATE = /\b(?:write|compose|create|make|produce|generate|draft)\b.{0,40}\b(?:song|lyrics|beat|jingle|poem|rap|verse)\b/i
const INFO = /\b(?:summary|summari[sz]e|explain|transcribe|analy[sz]e|review|(?:video|song|clip|track) (?:i|we|they|he|she) (?:just )?(?:sent|shared|posted|uploaded|made)|lyrics|meaning of|what does .{1,40} mean|who (?:sings?|sang|wrote|made|is the artist|performs?)|when (?:was|did) .{1,40} (?:released|come out)|ideas?|titles? for|name for|how to (?:play|make|write|produce))\b/i
const NOT_MUSIC_PLAY = /^(?:hey curry[,!.\s]*)?(?:please\s+)?(?:can you\s+|could you\s+)?play\s+(?:a game|games?|with|along|chess|ball|football|tennis|cards|pretend|dumb|fair|it safe)\b/i

const STRIP = [
  /^hey curry[,!.\s]*/i,
  /\b(?:can|could|would|will) you\b/gi,
  /\bplease\b|\bpls\b|\bplz\b/gi,
  /\b(?:that|which) i can (?:play|listen to|hear|watch|use)(?: it)?(?: there| here| now)?\b/gi,
  /\b(?:on|from|in|using|via)\s+(?:youtube|you tube|yt|mattchat|your music)\b/gi,
  /\b(?:play|put on|queue|give me|give us|get me|get us|find me|find|search for|search|look up|look for|show me|show us|recommend me|recommend|suggest me|suggest|i want to|i wanna|i want|i'd like to|i'd like|id like|i need|let me hear|let me listen to|let me watch|can i get|can i have|can i hear|can i listen to|can i watch|listen to|hear|watch)\b/gi,
  /\b(?:youtube|you tube|yt)\b/gi,
  // "video of", "song about", "clip for": the media word and its connector go together
  /\b(?:songs?|tracks?|tunes?|music|videos?|vids?|clips?|playlist|mix)\s+(?:of|for|about|on|by|from)\b/gi,
  /\b(?:songs?|tracks?|tunes?|music|bangers?|singles?|videos?|vids?|clips?|playlist|mix)\b/gi,
  /\bfor me\b|\bright now\b|\bnow\b|\bthere\b|\bhere\b/gi,
  /\bby\b/gi,
]

// Leading filler is removed only at the FRONT (never inside), so "how to tie a tie" and
// "Like a Prayer" keep their middle words.
const LEADING = /^(?:a|an|the|some|any|another|one|few|couple of|bunch of|up|of|about)\s+/i
const TRAILING = /\s+(?:of|about|for|to|with|me|us)$/i

function extractQuery(text) {
  let q = String(text)
  for (const re of STRIP) q = q.replace(re, ' ')
  q = q.replace(/[?!.,;:"“”]+/g, ' ').replace(/\s+/g, ' ').trim()
  for (let i = 0; i < 6; i++) {
    const next = q.replace(LEADING, '').replace(TRAILING, '').trim()
    if (next === q) break
    q = next
  }
  return q
}

export function parseMediaRequest(input) {
  const text = String(input || '').trim()
  if (!text || text.length > 200) return null            // long messages are conversations, not commands
  if (CREATE.test(text) || INFO.test(text) || NOT_MUSIC_PLAY.test(text)) return null

  const startsPlay = STARTS_WITH_PLAY.test(text)
  const song = SONG_NOUN.test(text)
  const video = VIDEO_NOUN.test(text) || WATCH_VERB.test(text)
  const youtube = YOUTUBE.test(text)
  const listen = LISTEN.test(text) && /\b(?:i want|i wanna|i'd like|id like|let me|can i|can you|please|just)\b|^(?:listen to|hear)\b/i.test(text)

  const asked = REQUEST.test(text) || startsPlay || listen
  if (!asked) return null
  if (!(startsPlay || listen || song || video || (youtube && REQUEST.test(text)))) return null
  // Something like "can you find the nearest bank" has a request verb but nothing media-like.
  if (!startsPlay && !listen && !song && !video && !youtube) return null

  // "video" words win ("music video", "show me a video of ..."); a bare "youtube" next to a song word is just a source.
  const wantsVideo = video || (youtube && !song && !startsPlay && !listen)
  const kind = wantsVideo ? 'video' : 'song'

  const query = extractQuery(text)
  const plural = /\b(?:songs|tracks|tunes|videos|clips|bangers|singles|playlist|mix|some|a few|couple of|bunch of)\b/i.test(text)
  return { kind, query, plural, source: youtube ? 'youtube' : null }
}
