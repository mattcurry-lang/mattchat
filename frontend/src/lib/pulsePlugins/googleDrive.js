import { registerPulsePlugin } from './registry'

// Google Drive — recently modified files per connected account, from
// the pulse-data edge function's `googleDrive` key. Mirrors gmail.js:
// one item per account with something to show, plus a distinct error
// item per account that needs reconnecting.
registerPulsePlugin({
  id: 'google_drive',
  usesRemoteData: true,
  buildItems(raw) {
    const drive = raw?.googleDrive
    if (!drive?.connected) return []

    const items = []
    drive.accounts.forEach((acc) => {
      if (acc.error) {
        items.push({
          id: `google_drive-error-${acc.email}`,
          app: 'google_drive',
          sender: acc.email,
          title: acc.error === 'token_expired' ? 'Reconnect needed' : "Couldn't check Drive",
          count: 0,
          receivedAt: new Date().toISOString(),
          importance: 'low',
          error: true,
        })
        return
      }

      const recentCount = acc.recentFiles?.length || 0
      if (recentCount > 0) {
        const mostRecent = acc.recentFiles[0]
        items.push({
          id: `google_drive-${acc.email}`,
          app: 'google_drive',
          sender: acc.email,
          title: recentCount === 1
            ? `"${mostRecent.name}" updated`
            : `${recentCount} files updated recently`,
          count: recentCount,
          receivedAt: mostRecent.modifiedTime || new Date().toISOString(),
          importance: recentCount >= 5 ? 'high' : 'medium',
          fileUrl: mostRecent.webViewLink,
        })
      }
    })
    return items
  },
  onOpen(item) {
    window.open(item?.fileUrl || 'https://drive.google.com', '_blank')
  },
})
