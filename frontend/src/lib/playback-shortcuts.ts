// Keyboard shortcuts for play/pause: Space on any page, Enter only on the player. Neither works
// while the visitor types, nor where the key already does something of its own.

export const PLAYER_PATH = "/player"

export interface ShortcutContext {
  /** Focus is in a field or control the key acts on: text, select, checkbox, switch, slider… */
  isTyping: boolean
  /** Focus is on a button or link, which Enter already activates. */
  isActivatable: boolean
  pathname: string
  /** Something is in the queue, so there is something to pause or resume. */
  hasPlayback: boolean
}

/** Whether this key press should play or pause. */
export function togglesPlayback(key: string, context: ShortcutContext): boolean {
  if (context.isTyping || !context.hasPlayback) return false
  if (key === " ") return true
  return key === "Enter" && context.pathname === PLAYER_PATH && !context.isActivatable
}
