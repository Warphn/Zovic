import { type Album, type CatalogMusic, useAlbums, useCatalogMusics } from "./api/catalog"

// The cover the player shows for a track: its album's. A queued track only carries the album's
// name, so the album is found through the catalog, which the front already keeps in cache.

const CATALOG_TRACK_ID = /^\d+$/

/** API path of the cover of the track's album; null for sample tracks, tracks without album, albums without cover. */
export function coverUrlOfTrack(trackId: string, musics: CatalogMusic[], albums: Album[]): string | null {
  if (!CATALOG_TRACK_ID.test(trackId)) return null
  const albumId = musics.find((music) => music.id === Number(trackId))?.album?.id
  if (albumId === undefined) return null
  return albums.find((album) => album.id === albumId)?.coverUrl ?? null
}

/** Same, from the cached catalog; queries only while a catalog track (numeric id) is given. */
export function useTrackCover(trackId: string | null | undefined): string | null {
  // The bar shows on pages without a subscription too, where the API refuses the catalog
  const isCatalogTrack = CATALOG_TRACK_ID.test(trackId ?? "")
  const musics = useCatalogMusics({ enabled: isCatalogTrack })
  const albums = useAlbums({ enabled: isCatalogTrack })
  if (!trackId || !isCatalogTrack) return null
  return coverUrlOfTrack(trackId, musics.data ?? [], albums.data ?? [])
}
