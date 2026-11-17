"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { CatalogHeader, CatalogPage, CatalogTrackList } from "@/components/catalog-page"
import { useCatalogMusics, useGenres } from "@/lib/api/catalog"
import { musicsOfGenre, parseRouteId } from "@/lib/home"
import { playOrToggleQueueTrack, playQueue } from "@/lib/playback-store"
import { musicToTrack } from "@/lib/playlist-store"

export default function GenrePage() {
  const genreId = parseRouteId(useParams<{ id: string }>()?.id)
  const genres = useGenres()
  const musics = useCatalogMusics()

  const genre = genres.data?.find((candidate) => candidate.id === genreId)
  const tracks = React.useMemo(
    () => (genreId === null ? [] : musicsOfGenre(musics.data ?? [], genreId).map(musicToTrack)),
    [musics.data, genreId]
  )

  return (
    <CatalogPage
      notFoundTitle="Gênero não encontrado"
      isNotFound={genreId === null || (genres.isSuccess && !genre)}
      error={genres.error ?? musics.error}
      isLoading={!genre || musics.isPending}
    >
      {() =>
        genre && (
          <>
            <CatalogHeader
              kindLabel="Gênero"
              title={genre.name}
              titleMark={
                <span aria-hidden="true" className="size-4 shrink-0 rounded-full" style={{ backgroundColor: genre.color }} />
              }
              meta={`${tracks.length} ${tracks.length === 1 ? "música" : "músicas"}`}
              onPlay={() => playQueue(tracks, 0)}
              isPlayDisabled={tracks.length === 0}
            />
            <CatalogTrackList
              tracks={tracks}
              onPlay={(index) => playOrToggleQueueTrack(tracks, index)}
              searchLabel="Buscar no gênero"
              emptyMessage="Nenhuma música neste gênero ainda"
              className="mt-8"
            />
          </>
        )
      }
    </CatalogPage>
  )
}
