"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { AlbumCard } from "@/components/album-card"
import { ArtistPhoto } from "@/components/artist-photo"
import { CatalogHeader, CatalogPage, CatalogTrackList } from "@/components/catalog-page"
import { useAlbums, useArtists, useCatalogMusics } from "@/lib/api/catalog"
import { albumsOfArtist, parseRouteId, singlesOfArtist } from "@/lib/home"
import { playOrToggleQueueTrack } from "@/lib/playback-store"
import { musicToTrack } from "@/lib/playlist-store"

const SECTION_TITLE_CLASSES = "text-xl font-medium tracking-[-0.02em]"

export default function ArtistPage() {
  const artistId = parseRouteId(useParams<{ id: string }>()?.id)
  const artists = useArtists()
  const albums = useAlbums()
  const musics = useCatalogMusics()

  const artist = artists.data?.find((candidate) => candidate.id === artistId)
  const artistAlbums = React.useMemo(
    () => (artistId === null ? [] : albumsOfArtist(albums.data ?? [], artistId)),
    [albums.data, artistId]
  )
  const singles = React.useMemo(
    () => (artistId === null ? [] : singlesOfArtist(musics.data ?? [], artistId).map(musicToTrack)),
    [musics.data, artistId]
  )

  return (
    <CatalogPage
      notFoundTitle="Artista não encontrado"
      isNotFound={artistId === null || (artists.isSuccess && !artist)}
      error={artists.error ?? albums.error ?? musics.error}
      isLoading={!artist || albums.isPending || musics.isPending}
    >
      {() =>
        artist && (
          <>
            <CatalogHeader
              kindLabel="Artista"
              title={artist.name}
              cover={<ArtistPhoto artist={artist} className="size-24 text-3xl sm:size-28" />}
              meta={[
                `${artistAlbums.length} ${artistAlbums.length === 1 ? "álbum" : "álbuns"}`,
                singles.length > 0 && `${singles.length} fora de álbum`,
              ]
                .filter(Boolean)
                .join(" · ")}
            />

            <section aria-labelledby="artista-albuns" className="mt-10">
              <h2 id="artista-albuns" className={`${SECTION_TITLE_CLASSES} mb-4`}>
                Álbuns
              </h2>
              {artistAlbums.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum álbum deste artista ainda</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {artistAlbums.map((album) => (
                    <AlbumCard key={album.id} album={album} musics={musics.data ?? []} />
                  ))}
                </div>
              )}
            </section>

            {/* Singles and features have no album to open, so they are listed here */}
            {singles.length > 0 && (
              <section aria-labelledby="artista-fora-de-album" className="mt-12">
                <h2 id="artista-fora-de-album" className={`${SECTION_TITLE_CLASSES} mb-4`}>
                  Fora de álbum
                </h2>
                <CatalogTrackList tracks={singles} onPlay={(index) => playOrToggleQueueTrack(singles, index)} />
              </section>
            )}
          </>
        )
      }
    </CatalogPage>
  )
}
