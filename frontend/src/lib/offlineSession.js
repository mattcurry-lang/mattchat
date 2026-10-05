// Reads the login Supabase already saved on this device, so the app can open with no internet.

function findKey() {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (/^sb-.+-auth-token$/.test(k)) return k
  }
  return null
}

export function readStoredSession() {
  try {
    const key = findKey()
    if (!key) return null
    const s = JSON.parse(localStorage.getItem(key))
    return s?.user && s?.refresh_token ? s : null
  } catch {
    return null
  }
}

function jwtClaims(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) } catch { return {} }
}

// True when the user has two-factor set up but this saved login hasn't passed it
export function storedSessionNeedsMfa(s) {
  const hasMfa = (s?.user?.factors || []).some((f) => f.status === 'verified')
  return hasMfa && jwtClaims(s.access_token).aal !== 'aal2'
}
