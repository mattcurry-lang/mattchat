// zLayers.js
// Single source of truth for stacking order across the whole app.
// Every position:fixed/absolute overlay should import Z from here
// instead of hardcoding a zIndex number. When adding a new overlay,
// find the closest matching tier below rather than picking a bigger
// number to "be safe" — that's exactly how we ended up with 80, 600,
// 2000, and 9999 scattered around with no relationship to each other.
//
// Tiers, lowest to highest:
export const Z = {
  base: 0,             // normal document flow
  stickyHeader: 10,     // chat header, top-header bar
  dropdown: 100,        // inline dropdowns, small popovers anchored to a button
  panel: 500,           // slide-in / centered feature panels (Documents, Tasks, Instagram full view, Email Workspace)
  fullscreenEditor: 1000, // full-screen creation flows: MediaComposer, MarkupEditor, MomentComposer, DrawingModal canvas
  contextMenu: 2000,     // ThreeDotMenu, MessageActionsMenu — must beat panels AND editors, since they can open from either
  viewer: 3000,          // full-screen content viewers: MediaViewer, MomentViewer, StatusViewer, ProfileCard, AvatarViewer
  lightbox: 4000,        // single-image/media zoom-ins launched from inside a bubble (DrawingBubble expanded view)
  callUI: 8000,          // IncomingCallModal, OutgoingCallScreen, CallOverlay — calls interrupt everything except critical alerts
  toast: 9999,           // top-level alerts/toasts — always wins, nothing should render above this
}
