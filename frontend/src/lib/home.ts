import type { Album, CatalogMusic } from "./api/catalog"
import type { HistoryEntry } from "./api/history"

// What the home page (/inicio) and the genre and album pages show, picked from the queries the
// front already has. The API decides what each account may see; these functions only select and
// order. The one exception is the removed musics, which only an admin receives and nobody plays.

export const TOP_PLAYED_COUNT = 10
export const RECENT_COUNT = 5
export const PLAYLIST_TILE_COUNT = 4
export const NEWEST_ALBUM_COUNT = 4

const MORNING_START_HOUR = 5
const AFTERNOON_START_HOUR = 12
const EVENING_START_HOUR = 18

function isActive(music: CatalogMusic) {
  return music.deletedAt === null
}

function byPlaysThenName(first: CatalogMusic, second: CatalogMusic) {
  return second.plays - first.plays || first.name.localeCompare(second.name, "pt-BR")
}

/** The `count` most played musics, ties broken by name. */
export function topPlayed(musics: CatalogMusic[], count: number): CatalogMusic[] {
  return musics.filter(isActive).toSorted(byPlaysThenName).slice(0, count)
}

/** The `count` last musics played that can still be played, most recent first (the API's order). */
export function recentlyPlayed(entries: HistoryEntry[], count: number): HistoryEntry[] {
  return entries.filter((entry) => entry.isAvailable).slice(0, count)
}

/** The `count` albums registered last: ids grow with each new album. */
export function newestAlbums(albums: Album[], count: number): Album[] {
  return albums.toSorted((first, second) => second.id - first.id).slice(0, count)
}

export function musicsOfGenre(musics: CatalogMusic[], genreId: number): CatalogMusic[] {
  return musics
    .filter((music) => isActive(music) && music.genres.some((genre) => genre.id === genreId))
    .toSorted(byPlaysThenName)
}

/** The album's musics in the order they were registered: albums have no track number yet. */
export function tracksOfAlbum(musics: CatalogMusic[], albumId: number): CatalogMusic[] {
  return musics
    .filter((music) => isActive(music) && music.album?.id === albumId)
    .toSorted((first, second) => first.id - second.id)
}

export function countByGenre(musics: CatalogMusic[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const music of musics.filter(isActive)) {
    for (const genre of music.genres) counts.set(genre.id, (counts.get(genre.id) ?? 0) + 1)
  }
  return counts
}

export function greetingFor(hour: number): "Bom dia" | "Boa tarde" | "Boa noite" {
  if (hour >= MORNING_START_HOUR && hour < AFTERNOON_START_HOUR) return "Bom dia"
  if (hour >= AFTERNOON_START_HOUR && hour < EVENING_START_HOUR) return "Boa tarde"
  return "Boa noite"
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ""
}

/** The id in a route like /album/[id]; null for anything but a positive integer. */
export function parseRouteId(param: string | string[] | undefined): number | null {
  if (typeof param !== "string" || !/^\d+$/.test(param)) return null
  const id = Number(param)
  return id > 0 ? id : null
}
