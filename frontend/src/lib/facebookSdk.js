 
//
// Loads the Facebook JS SDK exactly once and initializes it with
// Mattchat's Meta App ID. No other integration in this app needs it —
// Instagram/TikTok/etc. all use plain redirect-based OAuth. WhatsApp's
// Embedded Signup is the only flow that requires FB.login() running
// client-side in a popup.
//
// Requires <div id="fb-root"></div> to exist somewhere in index.html
// (Meta's SDK looks for it; see the setup notes for where to add it).

let loadPromise = null

export function loadFacebookSdk(appId) {
  if (window.FB) return Promise.resolve(window.FB)
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: 'v21.0',
      })
      resolve(window.FB)
    }

    if (document.getElementById('facebook-jssdk')) return // tag already inserted; fbAsyncInit will still fire

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.onerror = () => reject(new Error('Could not load the Facebook SDK'))
    document.body.appendChild(script)
  })

  return loadPromise
}
