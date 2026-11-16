/**
 * Accessible name of a track row's play button. The button's aria-label replaces its content, so
 * the listened mark (HU-15) has to be in the label for a screen reader to announce it.
 */
export function playButtonLabel(title: string, { isPlaying, isListened }: { isPlaying: boolean; isListened: boolean }): string {
  const action = isPlaying ? `Pausar ${title}` : `Tocar ${title}`
  return isListened ? `${action}, já ouvida` : action
}
