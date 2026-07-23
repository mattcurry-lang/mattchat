// Pulse plugin registry.
//
// A plugin is a plain object:
//   {
//     id: 'gmail',                      // must match the key in AppIcon /
//                                        // PLATFORM_META (PulseIcons.js) and,
//                                        // for remote plugins, the key the
//                                        // pulse-data edge function returns
//                                        // this integration's payload under
//     usesRemoteData: boolean,          // true  -> buildItems needs `raw`
//                                        //          from the pulse-data edge
//                                        //          function; item list stays
//                                        //          empty until raw has loaded
//                                        // false -> purely local data (e.g.
//                                        //          Mattchat's own unread
//                                        //          counts); renders
//                                        //          immediately, no fetch wait
//     buildItems(raw, ctx) -> Item[],   // raw = the pulse-data response, or
//                                        // null before it's loaded. ctx =
//                                        // { conversations, unreadCounts,
//                                        //   getConvoName, session }
//     onOpen(item, ctx) -> void,        // what a tap on this plugin's card
//                                        // should do. ctx additionally
//                                        // includes onOpenConversation.
//   }
//
// Adding a new integration is: create one file that calls
// registerPulsePlugin({...}), add one import line to index.js. Nothing
// in usePulseData.js or PulsePage.js needs to change.

const registry = new Map()

export function registerPulsePlugin(plugin) {
  if (!plugin?.id) throw new Error('Pulse plugin must have an id')
  if (typeof plugin.buildItems !== 'function') throw new Error(`Pulse plugin "${plugin.id}" must implement buildItems()`)
  registry.set(plugin.id, plugin)
}

export function getPulsePlugin(id) {
  return registry.get(id)
}

export function getAllPulsePlugins() {
  return [...registry.values()]
}
