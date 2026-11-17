"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AddToPlaylistMenu } from "@/components/add-to-playlist-menu"
import { AddToQueueButton } from "@/components/add-to-queue-button"
import { CatalogHeader, CatalogPage, CatalogTrackList } from "@/components/catalog-page"
import { ColorPicker, getPlaylistAccentStyle } from "@/components/color-picker"
import { TrackCommentsButton } from "@/components/comments/track-comments-button"
import { FileInput, useObjectUrl } from "@/components/file-input"
import { FolderMinusIcon, PencilIcon, UserIcon } from "@/components/icons"
import { PlaylistCollaboratorsDialog } from "@/components/playlist-collaborators-dialog"
import { PlaylistMark } from "@/components/playlist-mark"
import { PlaylistPrivacyField } from "@/components/playlist-privacy-field"
import { RecordSleeve } from "@/components/record-sleeve"
import { TrackDislikeButton } from "@/components/track-dislike-button"
import { TrackLikeButton } from "@/components/track-like-button"
import { TRACK_ACTION_CLASSES } from "@/components/track-action"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiErrorMessage } from "@/lib/api/client"
import {
  parsePlaylistId,
  useRemovePlaylistMusic,
  useReorderPlaylistMusics,
  useSetPlaylistCover,
  useUpdatePlaylist,
} from "@/lib/api/playlists"
import { COVER_ACCEPT, coverSizeError } from "@/lib/cover-image"
import { formatTotalDuration, sumDurationSec } from "@/lib/format-duration"
import { currentTrackOf, isPlayingFrom, playOrTogglePlaylistTrack, playPlaylist, usePlayback } from "@/lib/playback-store"
import { MAX_PLAYLIST_NAME_LENGTH, type PlaylistDraft, playlistChanges, usePlaylistData } from "@/lib/playlist-store"

export default function PlaylistDetailPage() {
  const params = useParams<{ id: string }>()
  const playlistId = params?.id

  // The playlist and its musics, in the playlist's order, from the API
  const { data: currentPlaylist, isPending, error, tracksError } = usePlaylistData(playlistId)
  const updatePlaylist = useUpdatePlaylist()
  const setCover = useSetPlaylistCover()
  const reorderTracks = useReorderPlaylistMusics()
  const removeTrack = useRemovePlaylistMusic()

  // The playlist being edited (name, visibility, color); null while the dialog is closed. Its
  // color is previewed on the page; nothing is saved until "Salvar"
  const [draft, setDraft] = React.useState<PlaylistDraft | null>(null)
  // The cover in the editor (HU-35): a new image, "remove" to take it out, or null to keep it
  const [coverChoice, setCoverChoice] = React.useState<File | "remove" | null>(null)
  const [coverError, setCoverError] = React.useState<string | null>(null)
  const coverPreviewUrl = useObjectUrl(coverChoice instanceof File ? coverChoice : null)
  const [isCollaboratorsOpen, setIsCollaboratorsOpen] = React.useState(false)
  const numericPlaylistId = parsePlaylistId(playlistId)

  // Playback is shared by every page (see playback-store); this page shows it when it comes
  // from this playlist, and starts this playlist when one of its tracks is played
  const playback = usePlayback()
  const isThisPlaylist = isPlayingFrom(playback, playlistId ?? "")

  const openEditor = () => {
    if (!currentPlaylist) return
    updatePlaylist.reset()
    setCover.reset()
    setCoverChoice(null)
    setCoverError(null)
    setDraft({ name: currentPlaylist.name, isPrivate: currentPlaylist.isPrivate, color: currentPlaylist.color })
  }

  // Closing without saving drops the draft, color and cover previews included
  const closeEditor = () => {
    setDraft(null)
    setCoverChoice(null)
  }

  const chooseCover = (file: File | null) => {
    const sizeError = file ? coverSizeError(file) : null
    setCoverError(sizeError)
    setCoverChoice(sizeError ? null : file)
  }

  // One PATCH with only what changed, then the cover; on failure the dialog stays open with the reason
  const saveEditor = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = parsePlaylistId(playlistId)
    if (!currentPlaylist || !draft || id === null) return
    const changes = playlistChanges(
      { name: currentPlaylist.name, isPrivate: currentPlaylist.isPrivate, color: currentPlaylist.color },
      draft
    )
    if (!changes && coverChoice === null) {
      if (draft.name.trim()) closeEditor()
      return
    }
    try {
      if (changes) await updatePlaylist.mutateAsync({ id, input: changes })
      if (coverChoice !== null) await setCover.mutateAsync({ id, cover: coverChoice === "remove" ? null : coverChoice })
      closeEditor()
    } catch {
      // The mutation that failed shows its error in the dialog
    }
  }

  // Takes a track out of the playlist (owner and collaborators); the list refreshes from the API
  const handleRemoveTrack = (trackId: string) => {
    const id = parsePlaylistId(playlistId)
    if (id !== null) removeTrack.mutate({ id, musicId: Number(trackId) })
  }

  // Reorder tracks (drag in the tracklist): saved for everyone who sees the playlist. The list
  // moves at once and goes back if the API refuses; playback follows the track id, so the playing
  // track stays the same one
  const handleReorderTracks = (ids: string[]) => {
    const id = parsePlaylistId(playlistId)
    if (id !== null) reorderTracks.mutate({ id, musicIds: ids.map(Number) })
  }

  // Empty-state, header and track list come from the catalog page, like an album's
  const renderPlaylist = () => {
    if (!currentPlaylist) return null
    const tracks = currentPlaylist.tracks
    const color = draft?.color ?? currentPlaylist.color
    const isPlaying = isThisPlaylist && Boolean(playback?.isPlaying)
    // "Músicas Curtidas" is fed by the heart, so it is never reordered (HU-34)
    const canReorder = Boolean(currentPlaylist.canEditMusics) && !currentPlaylist.isLikedSongs

    return (
      <>
        <CatalogHeader
          kindLabel={`Playlist ${currentPlaylist.isPrivate ? "privada" : "pública"}`}
          title={currentPlaylist.name}
          cover={
            <RecordSleeve
              color={color}
              initials={<PlaylistMark name={currentPlaylist.name} isLikedSongs={currentPlaylist.isLikedSongs} iconSize={56} />}
              playing={isPlaying}
              coverUrl={coverChoice === "remove" ? null : currentPlaylist.coverUrl}
              coverPreviewUrl={coverPreviewUrl}
            />
          }
          meta={`${tracks.length} ${tracks.length === 1 ? "faixa" : "faixas"} · ${formatTotalDuration(sumDurationSec(tracks))}`}
          onPlay={() => playPlaylist(currentPlaylist, 0)}
          isPlayDisabled={tracks.length === 0}
          actions={
            <>
              {/* The owner and the collaborators see who builds it (HU-19) */}
              {currentPlaylist.canEditMusics && !currentPlaylist.isLikedSongs && numericPlaylistId !== null && (
                <Button variant="outline" size="lg" onClick={() => setIsCollaboratorsOpen(true)} className="gap-2">
                  <UserIcon size={16} className="text-muted-foreground" />
                  Colaboradores
                </Button>
              )}
              {/* Only the owner can edit it, and never "Músicas Curtidas"; the API refuses anyone else */}
              {currentPlaylist.canManage && !currentPlaylist.isLikedSongs && (
                <Button variant="outline" size="lg" onClick={openEditor} className="gap-2">
                  <PencilIcon size={16} className="text-muted-foreground" />
                  Editar playlist
                </Button>
              )}
            </>
          }
        />
        {numericPlaylistId !== null && (
          <PlaylistCollaboratorsDialog
            playlistId={numericPlaylistId}
            isOwner={Boolean(currentPlaylist.canManage)}
            open={isCollaboratorsOpen}
            onOpenChange={setIsCollaboratorsOpen}
          />
        )}

        <div className="mt-8">
          {reorderTracks.isError && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              Não deu para salvar a nova ordem. {apiErrorMessage(reorderTracks.error)}
            </p>
          )}
          {removeTrack.isError && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              Não deu para tirar a faixa. {apiErrorMessage(removeTrack.error)}
            </p>
          )}
          {tracksError ? (
            <p role="alert" className="text-sm text-destructive">
              Não deu para carregar as faixas. {tracksError}
            </p>
          ) : (
            <CatalogTrackList
              tracks={tracks}
              onPlay={(index) => playOrTogglePlaylistTrack(currentPlaylist, index)}
              // Only a track started from this playlist shows as playing here
              playingTrackId={isPlaying ? (currentTrackOf(playback)?.id ?? null) : null}
              isNumbered
              isAlbumShown
              searchLabel="Buscar na playlist"
              onReorder={canReorder ? handleReorderTracks : undefined}
              renderActions={(track, { announce, play }) => (
                <>
                  <AddToQueueButton track={track} onResult={announce} />
                  <TrackCommentsButton track={track} onPlay={play} />
                  <TrackLikeButton trackId={track.id} isInLikedSongs={Boolean(currentPlaylist.isLikedSongs)} />
                  <TrackDislikeButton trackId={track.id} />
                  {/* "Músicas Curtidas" (HU-34) loses a track by unliking it, so it offers the other
                      playlists instead; the menu never lists "Músicas Curtidas" itself */}
                  {currentPlaylist.isLikedSongs ? (
                    <AddToPlaylistMenu musicId={Number(track.id)} title={track.title} onResult={announce} />
                  ) : (
                    currentPlaylist.canEditMusics && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTrack(track.id)}
                        disabled={removeTrack.isPending && removeTrack.variables?.musicId === Number(track.id)}
                        aria-label={`Tirar ${track.title} da playlist`}
                        title="Tirar da playlist"
                        className={TRACK_ACTION_CLASSES}
                      >
                        <FolderMinusIcon size={16} />
                      </button>
                    )
                  )}
                </>
              )}
              emptyMessage={
                // An empty playlist: the owner and collaborators get the way to fill it, everyone else just an empty list
                currentPlaylist.isLikedSongs ? (
                  "Curta uma música no coração para ela aparecer aqui."
                ) : currentPlaylist.canEditMusics ? (
                  <>
                    Busque uma música e use{" "}
                    <Link href="/busca" className="text-foreground underline underline-offset-4">
                      Adicionar à playlist
                    </Link>
                  </>
                ) : (
                  "Esta playlist ainda não tem faixas."
                )
              }
            />
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <CatalogPage
        notFoundTitle="Playlist não encontrada"
        notFoundMessage={error ?? "Ela pode ter sido removida, ser privada ou o link está incorreto"}
        back={{ href: "/playlist", label: "Voltar às playlists" }}
        isNotFound={!isPending && !currentPlaylist}
        error={null}
        isLoading={isPending}
        style={currentPlaylist ? getPlaylistAccentStyle(draft?.color ?? currentPlaylist.color) : undefined}
      >
        {renderPlaylist}
      </CatalogPage>

      <Dialog open={draft !== null} onOpenChange={(open) => (open ? openEditor() : closeEditor())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar playlist</DialogTitle>
            <DialogDescription>A cor vale para o disco e os destaques desta página, e a capa, para o encarte</DialogDescription>
          </DialogHeader>

          {draft && (
            <form onSubmit={saveEditor} className="space-y-5 pt-1">
              <div className="space-y-2">
                <Label htmlFor="edit-playlist-name" className="text-sm font-medium">
                  Nome
                </Label>
                <Input
                  id="edit-playlist-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  maxLength={MAX_PLAYLIST_NAME_LENGTH}
                  required
                />
              </div>

              <ColorPicker color={draft.color} onChange={(next) => setDraft({ ...draft, color: next })} />

              <div className="space-y-2">
                <Label htmlFor="edit-playlist-cover" className="text-sm font-medium">
                  Capa (JPEG, PNG ou WebP, até 2 MB)
                </Label>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <FileInput
                      id="edit-playlist-cover"
                      file={coverChoice instanceof File ? coverChoice : null}
                      accept={COVER_ACCEPT}
                      onChange={chooseCover}
                    />
                  </div>
                  {(coverChoice instanceof File || (currentPlaylist?.coverUrl && coverChoice !== "remove")) && (
                    <Button type="button" variant="outline" onClick={() => setCoverChoice(currentPlaylist?.coverUrl ? "remove" : null)}>
                      Tirar capa
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {coverChoice === "remove"
                    ? "A capa sai ao salvar, e o encarte volta a mostrar a cor e as iniciais."
                    : "Sem capa, o encarte mostra a cor e as iniciais."}
                </p>
                {coverError && (
                  <p role="alert" className="text-sm text-destructive">
                    {coverError}
                  </p>
                )}
              </div>

              <PlaylistPrivacyField isPrivate={draft.isPrivate} onChange={(next) => setDraft({ ...draft, isPrivate: next })} />

              {updatePlaylist.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {apiErrorMessage(updatePlaylist.error)}
                </p>
              )}
              {setCover.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {apiErrorMessage(setCover.error)}
                </p>
              )}

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="lg" onClick={closeEditor}>
                  Cancelar
                </Button>
                <Button type="submit" size="lg" disabled={!draft.name.trim() || updatePlaylist.isPending || setCover.isPending}>
                  {updatePlaylist.isPending || setCover.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
