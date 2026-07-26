import { useState, useEffect } from 'react'

const cache = new Map()

// Samples a downscaled version of the thumbnail on a canvas and
// averages pixels — cheap (16x9 canvas), no extra network request
// since we already have the thumbnail loaded for the poster frame.
export function useDominantColor(imageUrl) {
  const [color, setColor] = useState(cache.get(imageUrl) || '#111118')

  useEffect(() => {
    if (!imageUrl) return
    if (cache.has(imageUrl)) { setColor(cache.get(imageUrl)); return }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 16; canvas.height = 9
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 16, 9)
        const { data } = ctx.getImageData(0, 0, 16, 9)
        let r = 0, g = 0, b = 0, count = 0
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count++
        }
        r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count)
        // Darken slightly so text/UI stays legible over it
        const darken = (v) => Math.max(0, Math.round(v * 0.55))
        const hex = `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`
        cache.set(imageUrl, hex)
        setColor(hex)
      } catch (e) {
        // CORS-tainted canvas or decode failure — fall back silently
        cache.set(imageUrl, '#111118')
      }
    }
    img.onerror = () => setColor('#111118')
    img.src = imageUrl
  }, [imageUrl])

  return color
}
