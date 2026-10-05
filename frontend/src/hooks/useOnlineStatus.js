import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => { setOnline(true); supabase.auth.startAutoRefresh() }
    const down = () => { setOnline(false); supabase.auth.stopAutoRefresh() }
    if (!navigator.onLine) supabase.auth.stopAutoRefresh()
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return online
}
