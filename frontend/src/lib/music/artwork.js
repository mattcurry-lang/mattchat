// YouTube "Topic" uploads serve album art inside a 4:3 frame with black bars
// baked in (12.5% top/bottom). We detect those frames and crop the bars out.
export function isLetterboxed(url) {
  return typeof url === 'string' && /ytimg\.com\/.*\/(hq|sd)default/i.test(url)
}
export const LETTERBOX_ZOOM = 1.34
