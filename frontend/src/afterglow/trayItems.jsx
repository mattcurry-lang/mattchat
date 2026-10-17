import React from 'react'
import { IconImagePlus, IconPencil, IconChart, IconCheckSquare, IconClock, IconPlay, IconSparkle } from '../components/Icons'

/**
 * The "+" tray. These are the things that used to live in the header's
 * three-dot menu or behind separate buttons — now one tap from the composer.
 * ChatPage passes its existing handlers in; nothing here knows how they work.
 */
export function buildTrayItems({ onMedia, onDraw, onPoll, onTask, onSchedule, onYouTube, onCurry, curryActive = false, pollActive = false, taskActive = false }) {
  return [
    { id: 'media', label: 'Photos & files', icon: <IconImagePlus size={22} />, onClick: onMedia },
    { id: 'draw', label: 'Draw together', icon: <IconPencil size={22} />, onClick: onDraw },
    { id: 'poll', label: 'Poll', icon: <IconChart size={22} />, onClick: onPoll, active: pollActive },
    { id: 'task', label: 'Task', icon: <IconCheckSquare size={22} />, onClick: onTask, active: taskActive },
    { id: 'schedule', label: 'Schedule', icon: <IconClock size={22} />, onClick: onSchedule },
    { id: 'youtube', label: 'YouTube', icon: <IconPlay size={22} />, onClick: onYouTube },
    { id: 'curry', label: 'Ask Curry', icon: <IconSparkle size={22} />, onClick: onCurry, active: curryActive },
  ].filter((i) => typeof i.onClick === 'function')
}
