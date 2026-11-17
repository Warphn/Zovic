"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlbumCoverImage } from "@/components/album-cover-image"
import { CatalogHeader, CatalogPage, CatalogTrackList } from "@/components/catalog-page"
import { useAlbums, useCatalogMusics } from "@/lib/api/catalog"
import { formatTotalDuration, sumDurationSec } from "@/lib/format-duration"
import { parseRouteId, tracksOfAlbum } from "@/lib/home"
import { playOrToggleQueueTrack, playQueue } from "@/lib/playback-store"
import { musicToTrack } from "@/lib/playlist-store"

export default function AlbumPage() {
  const albumId = parseRouteId(useParams<{ id: string }>()?.id)
  const albums = useAlbums()
  const musics = useCatalogMusics()

  const album = albums.data?.find((candidate) => candidate.id === albumId)
  const tracks = React.useMemo(
    () => (albumId === null ? [] : tracksOfAlbum(musics.data ?? [], albumId).map(musicToTrack)),
    [musics.data, albumId]
  )

  return (
    <CatalogPage
      notFoundTitle="Álbum não encontrado"
      isNotFound={albumId === null || (albums.isSuccess && !album)}
      error={albums.error ?? musics.error}
      isLoading={!album || musics.isPending}
    >
      {() =>
        album && (
          <>
            <CatalogHeader
              kindLabel="Álbum"
              title={album.name}
              cover={<AlbumCoverImage album={album} className="size-48 shrink-0 text-5xl sm:size-56" />}
              subtitle={
                album.artists.length > 0 && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {album.artists.map((artist, index) => (
                      <React.Fragment key={artist.id}>
                        {index > 0 && ", "}
                        <Link
                          href={`/artista/${artist.id}`}
                          className="rounded-sm underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {artist.name}
                        </Link>
                      </React.Fragment>
                    ))}
                  </p>
                )
              }
              meta={[
                album.year,
                `${tracks.length} ${tracks.length === 1 ? "faixa" : "faixas"}`,
                formatTotalDuration(sumDurationSec(tracks)),
              ]
                .filter(Boolean)
                .join(" · ")}
              onPlay={() => playQueue(tracks, 0)}
              isPlayDisabled={tracks.length === 0}
            />
            <CatalogTrackList
              tracks={tracks}
              onPlay={(index) => playOrToggleQueueTrack(tracks, index)}
              isNumbered
              isCoverShown={false}
              searchLabel="Buscar no álbum"
              className="mt-8"
            />
          </>
        )
      }
    </CatalogPage>
  )
}
