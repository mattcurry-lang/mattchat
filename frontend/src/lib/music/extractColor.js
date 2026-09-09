// lib/music/extractColor.js
//
// Canvas-based dominant-color extraction from track artwork — the
// same idea Spotify uses to make the Now Playing / playlist screens
// change color with whatever's on screen instead of staying a fixed
// brand purple. Downsamples to a tiny canvas, averages pixels, then
// runs the average through a vibrancy/contrast pass so washed-out or
// near-black album art still produces a usable, legible color.
// Results are cached by URL so replaying a track is instant.

import { useState, useEffect } from 'react'

const cache = new Map()
const FALLBACK = { r: 108, g: 99, b: 255 } // brand purple — used until extraction resolves, or on failure

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s
  const l = (max + min) / 2
  if (max === min) { h = s = 0 }
  else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h /= 6
  }
  return [h, s, l]
}

function hslToRgb(h, s, l) {
  let r, g, b
  if (s === 0) { r = g = b = l }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

export function extractDominantColor(imageUrl) {
  if (!imageUrl) return Promise.resolve(FALLBACK)
  if (cache.has(imageUrl)) return Promise.resolve(cache.get(imageUrl))

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const SIZE = 24
        const canvas = document.createElement('canvas')
        canvas.width = SIZE
        canvas.height = SIZE
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, SIZE, SIZE)
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE)

        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue // skip transparent pixels
          r += data[i]; g += data[i + 1]; b += data[i + 2]
          n++
        }
        if (n === 0) { cache.set(imageUrl, FALLBACK); resolve(FALLBACK); return }
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n)

        // vibrancy/contrast pass — pulls muddy or near-black averages
        // into a saturation/lightness band that still reads as "this
        // song's color" without going illegible against dark text
        const [h, s, l] = rgbToHsl(r, g, b)
        const boostedS = Math.min(0.72, Math.max(s, 0.42))
        const boostedL = Math.min(0.46, Math.max(l, 0.24))
        const [br, bg, bb] = hslToRgb(h, boostedS, boostedL)

        const result = { r: br, g: bg, b: bb }
        cache.set(imageUrl, result)
        resolve(result)
      } catch {
        resolve(FALLBACK)
      }
    }
    img.onerror = () => resolve(FALLBACK)
    img.src = imageUrl
  })
}

export function rgba({ r, g, b }, alpha = 1) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** React hook wrapper — re-extracts whenever the artwork URL changes. */
export function useDominantColor(artworkUrl) {
  const [color, setColor] = useState(FALLBACK)
  useEffect(() => {
    let cancelled = false
    extractDominantColor(artworkUrl).then((c) => { if (!cancelled) setColor(c) })
    return () => { cancelled = true }
  }, [artworkUrl])
  return color
}
