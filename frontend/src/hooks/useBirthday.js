import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const dismissKey = (userId, dateStr) => `pulse_birthday_dismissed_${userId}_${dateStr}`

// Local date, not UTC — "today" has to mean the user's actual calendar
// day, not whatever day it is at UTC when they happen to open Pulse.
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useBirthday(userId, profile) {
  const todayStr = localDateStr()

  const isBirthdayToday = useMemo(() => {
    if (!profile?.birthday) return false
    // profile.birthday comes back as 'YYYY-MM-DD' from Postgres date —
    // parse as local, not UTC, so the month/day comparison can't drift
    // a day off near midnight.
    const [, month, day] = profile.birthday.split('-').map(Number)
    const now = new Date()
    return month === now.getMonth() + 1 && day === now.getDate()
  }, [profile?.birthday])

  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(dismissKey(userId, todayStr)) === '1' } catch { return false }
  })

  const dismiss = () => {
    setDismissed(true)
    try { sessionStorage.setItem(dismissKey(userId, todayStr), '1') } catch {}
  }

  const reopen = () => setDismissed(false)

  const saveBirthday = async (isoDate) => {
    const { error } = await supabase.from('profiles').update({ birthday: isoDate }).eq('id', userId)
    if (error) throw error
  }

  return {
    isBirthdayToday,
    hasBirthday: !!profile?.birthday,
    shouldShowExperience: isBirthdayToday && !dismissed,
    dismiss,
    reopen,
    saveBirthday,
  }
}
