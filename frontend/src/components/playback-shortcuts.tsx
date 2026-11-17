"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { getPlaybackSnapshot, togglePlayback } from "@/lib/playback-store"
import { togglesPlayback } from "@/lib/playback-shortcuts"

// Where Space or Enter types or acts on its own: text fields, selects and the toggle-like controls
const TYPING_TARGETS =
  'input, textarea, select, [contenteditable], [role="switch"], [role="checkbox"], [role="radio"], [role="slider"], [role="option"], [role^="menuitem"]'

function closestOf(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null
}

// Space plays or pauses on every page, Enter on the player (lib/playback-shortcuts says when).
// Mounted once in the root layout.
export function PlaybackShortcuts() {
  const pathname = usePathname()

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      const shouldToggle = togglesPlayback(event.key, {
        isTyping: closestOf(event.target, TYPING_TARGETS),
        isActivatable: closestOf(event.target, "button, a"),
        pathname,
        hasPlayback: getPlaybackSnapshot() !== null,
      })
      if (!shouldToggle) return
      // Space would also scroll the page or press the focused button
      event.preventDefault()
      togglePlayback()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [pathname])

  return null
}
