import { type Album, type CatalogMusic, useAlbums, useCatalogMusics } from "./api/catalog"

// The cover the player shows for a track: its album's. A queued track only carries the album's
// name, so the album is found through the catalog, which the front already keeps in cache.

const CATALOG_TRACK_ID = /^\d+$/

/** The track's album; null for sample tracks, tracks without album or not in the catalog. */
export function albumOfTrack(trackId: string, musics: CatalogMusic[], albums: Album[]): Album | null {
  if (!CATALOG_TRACK_ID.test(trackId)) return null
  const albumId = musics.find((music) => music.id === Number(trackId))?.album?.id
  if (albumId === undefined) return null
  return albums.find((album) => album.id === albumId) ?? null
}

/** API path of the cover of the track's album; null for sample tracks, tracks without album, albums without cover. */
export function coverUrlOfTrack(trackId: string, musics: CatalogMusic[], albums: Album[]): string | null {
  return albumOfTrack(trackId, musics, albums)?.coverUrl ?? null
}

/**
 * The track's album, from the cached catalog; queries only while a catalog track (numeric id) is
 * given, so the playback bar asks nothing on pages without a subscription, where the API refuses
 * the catalog.
 */
export function useTrackAlbum(trackId: string | null | undefined): Album | null {
  const isCatalogTrack = CATALOG_TRACK_ID.test(trackId ?? "")
  const musics = useCatalogMusics({ enabled: isCatalogTrack })
  const albums = useAlbums({ enabled: isCatalogTrack })
  if (!trackId || !isCatalogTrack) return null
  return albumOfTrack(trackId, musics.data ?? [], albums.data ?? [])
}
