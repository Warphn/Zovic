// An album without a cover image gets one drawn from its name and a color.

export interface AlbumCover {
  initials: string
  /** Hex color from ALBUM_COVER_COLORS; the same album always gets the same one. */
  color: string
}

/**
 * The colors of a drawn cover: the app's own ink, red, teal and the browns of the paper, so a list
 * of albums reads like a shelf of printed sleeves and not a rainbow.
 */
export const ALBUM_COVER_COLORS = ["#171512", "#d33a2c", "#1e7f82", "#565043", "#b9ad91"] as const

const COVER_INITIALS_LENGTH = 2

/** "Ondas de Concreto" → "OC", "Varanda" → "VA". */
function coverInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, COVER_INITIALS_LENGTH).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

export function albumCover(album: { id: number; name: string }): AlbumCover {
  // By id, not by name: renaming the album keeps its color
  const color = ALBUM_COVER_COLORS[album.id % ALBUM_COVER_COLORS.length] ?? ALBUM_COVER_COLORS[0]
  return { initials: coverInitials(album.name), color }
}
