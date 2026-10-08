import { useCallback, useEffect, useMemo } from 'react'
import { MotionConfig } from 'framer-motion'
import ProfileMenuSheet from './ProfileMenuSheet'
import useProfileSettings from '../hooks/useProfileSettings'
import { getDefaults, hydrate, setSettings, useSetting } from '../lib/appearanceStore'

/*
 * Drop-in replacement for <ProfileMenuSheet />.
 * ChatPage keeps passing the same props; this adds:
 *   - step 1: loading and saving every setting (profiles + user_settings)
 *   - step 3: applying appearance settings app-wide, straight away, from a local cache
 *
 * It is always mounted (the sheet just toggles isOpen), so settings apply as soon as the profile loads,
 * not only after someone opens the sheet.
 */
export default function ProfileMenuSheetConnected(props) {
  const userId = props.profile?.id
  const reduceMotion = useSetting('reduceMotion')

  const { features, onFeatureChange, ready } = useProfileSettings(userId, {
    onError: (e) => console.error('profile settings:', e),
  })

  // Server values win; this device's cache fills any gaps. Runs once per load.
  useEffect(() => {
    if (ready && userId) hydrate(userId, features)
  }, [ready, userId, features])

  // What the sheet should show before the user touches anything.
  const initialFeatures = useMemo(() => ({ ...getDefaults(), ...features }), [features])

  const handleFeatureChange = useCallback((key, value) => {
    setSettings({ [key]: value }) // applies instantly and updates the local cache
    onFeatureChange(key, value)   // saves to Supabase
  }, [onFeatureChange])

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <ProfileMenuSheet
        {...props}
        key={ready ? 'ready' : 'loading'} // remounts once so the sheet starts from the saved values
        features={initialFeatures}
        onFeatureChange={handleFeatureChange}
      />
    </MotionConfig>
  )
}
