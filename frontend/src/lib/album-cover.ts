import { PRESET_COLORS } from "@/components/color-picker"

// Albums have no cover image yet: the admin panel draws one from the name and a palette color.

export interface AlbumCover {
  initials: string
  /** Hex color from the playlist palette; the same album always gets the same one. */
  color: string
}

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
  const preset = PRESET_COLORS[album.id % PRESET_COLORS.length]
  return { initials: coverInitials(album.name), color: preset.color }
}
