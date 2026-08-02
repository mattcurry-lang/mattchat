// lib/facebookSdk.js — DIAGNOSTIC BUILD
//
// Same as before, but with explicit checks that fail loudly and
// specifically instead of letting Meta's generic "FB.login() called
// before FB.init()" error mask the real cause. Once we've confirmed
// what's actually wrong, we can strip the console.debug lines back out.

let sdkReadyPromise = null

export function loadFacebookSdk(appId) {
  if (!appId) {
    console.error('[whatsapp] loadFacebookSdk called with a falsy appId:', appId)
    return Promise.reject(new Error('Missing Meta App ID — check the whatsapp-oauth-start response.'))
  }

  if (!document.getElementById('fb-root')) {
    console.error('[whatsapp] <div id="fb-root"></div> is missing from the page. Add it to index.html <body>.')
    return Promise.reject(new Error('Missing <div id="fb-root"></div> in index.html — required by the Facebook SDK.'))
  }

  if (sdkReadyPromise) return sdkReadyPromise

  console.debug('[whatsapp] loadFacebookSdk starting, appId:', appId)

  sdkReadyPromise = new Promise((resolve, reject) => {
    const finishInit = () => {
      console.debug('[whatsapp] fbAsyncInit fired, calling FB.init()')
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: 'v21.0',
      })
      window.__mattchatFbInitialized = true
      console.debug('[whatsapp] FB.init() complete, SDK ready')
      resolve(window.FB)
    }

    if (window.FB && window.__mattchatFbInitialized) {
      console.debug('[whatsapp] FB already initialized, reusing')
      resolve(window.FB)
      return
    }

    const existingScript = document.getElementById('facebook-jssdk')
    if (existingScript) {
      console.debug('[whatsapp] facebook-jssdk script tag already present, attaching fbAsyncInit')
      window.fbAsyncInit = finishInit
      return
    }

    window.fbAsyncInit = finishInit

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.onerror = () => {
      sdkReadyPromise = null
      reject(new Error('Could not load the Facebook SDK (network/script error).'))
    }
    console.debug('[whatsapp] inserting facebook-jssdk script tag')
    document.body.appendChild(script)
  })

  return sdkReadyPromise
}
