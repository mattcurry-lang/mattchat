// lib/facebookSdk.js
//
// Loads the Facebook JS SDK exactly once and initializes it with
// Mattchat's Meta App ID.
//
// IMPORTANT gotcha this file guards against: `window.FB` becomes
// truthy as soon as the SDK script finishes *parsing* — but FB.init()
// doesn't actually run until `window.fbAsyncInit` fires a moment
// later. Checking `if (window.FB)` as a "ready" signal is a race:
// FB.login() can get called on a half-initialized SDK, which throws
// "FB.login() called before FB.init()." We track readiness explicitly
// with `window.__mattchatFbInitialized` instead of trusting FB's mere
// existence.
//
// Requires <div id="fb-root"></div> to exist somewhere in index.html.

let sdkReadyPromise = null

export function loadFacebookSdk(appId) {
  if (sdkReadyPromise) return sdkReadyPromise

  sdkReadyPromise = new Promise((resolve, reject) => {
    const finishInit = () => {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: 'v21.0',
      })
      window.__mattchatFbInitialized = true
      resolve(window.FB)
    }

    // Already fully initialized from an earlier call in this tab
    // (e.g. a previous connect attempt) — safe to reuse immediately.
    if (window.FB && window.__mattchatFbInitialized) {
      resolve(window.FB)
      return
    }

    const existingScript = document.getElementById('facebook-jssdk')
    if (existingScript) {
      // The script tag is already in the page (common with React's
      // dev-mode double-render), so DON'T insert a second one — Meta
      // only calls fbAsyncInit once per script load. Just hook our
      // resolver onto it the same way a fresh load would, instead of
      // silently returning and leaving this promise unresolved.
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
      sdkReadyPromise = null // allow a retry on the next connect attempt
      reject(new Error('Could not load the Facebook SDK'))
    }
    document.body.appendChild(script)
  })

  return sdkReadyPromise
}
