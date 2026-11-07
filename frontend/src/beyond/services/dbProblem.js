// src/beyond/services/dbProblem.js
//
// Turns "the request failed" into something a person can act on. Without this, a
// missing table or a permissions error just looks like an endless "Checking…".

export function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject({ timeout: true, message: 'timeout' }), ms)),
  ])
}

export function classifyDbError(err) {
  if (!err) return null
  if (err.timeout) return { kind: 'timeout', message: 'The database did not answer in time' }
  const msg = String(err.message || err.details || err)
  const code = String(err.code || '')
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202'
    || /does not exist|schema cache|could not find the (table|function)/i.test(msg)) {
    return { kind: 'missing', message: msg }
  }
  if (code === '42501' || /permission denied|row-level security/i.test(msg)) {
    return { kind: 'denied', message: msg }
  }
  return { kind: 'error', message: msg }
}

// what: 'Live location' | 'Battery sharing'
export function problemText(problem, what) {
  if (!problem) return ''
  switch (problem.kind) {
    case 'missing':
      return `${what} isn’t set up in the database yet. Run supabase/beyond-all.sql in the Supabase SQL editor, then reload.`
    case 'denied':
      return `The database refused this request (a permissions rule). Re-run supabase/beyond-all.sql so the policies are current, then reload.`
    case 'timeout':
      return `The database didn’t answer in time. Check your connection.`
    default:
      return `Something went wrong: ${problem.message}`
  }
}
