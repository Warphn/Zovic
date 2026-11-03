"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ResponsiveGridLayout, getBreakpointFromWidth, useContainerWidth } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import Header from "@/components/header"
import {
  ColorPicker,
  PRESET_COLORS,
  getContrastTextColor,
  getPlaylistAccentStyle,
} from "@/components/color-picker"
import { apiErrorMessage } from "@/lib/api/client"
import { useCreatePlaylist, useDeletePlaylist } from "@/lib/api/playlists"
import { PlaylistPrivacyField } from "@/components/playlist-privacy-field"
import {
  MAX_PLAYLIST_NAME_LENGTH,
  type PlaylistData,
  getPlaylistInitials,
  useMyPlaylistsData,
} from "@/lib/playlist-store"
import { GRID_BREAKPOINTS, GRID_COLS, usePlaylistLayouts } from "@/lib/playlist-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { SortableList } from "@/components/sortable-list"
import { CloseIcon, GridIcon, ListIcon, PlusIcon } from "@/components/icons"
import { LevelBars } from "@/components/playback-marks"
import { formatTotalDuration, sumDurationSec } from "@/lib/format-duration"
import { isPlayingFrom, usePlayback } from "@/lib/playback-store"

type CatalogView = "grid" | "list"


// Track count and length, while the API does not send a playlist's musics: nothing to show yet
function trackSummary(playlist: PlaylistData, withDuration: boolean): string | null {
  const count = playlist.tracks.length
  if (count === 0) return null
  const label = `${count} ${count === 1 ? "faixa" : "faixas"}`
  return withDuration ? `${label} · ${formatTotalDuration(sumDurationSec(playlist.tracks))}` : label
}
const VIEW_STORAGE_KEY = "zovic_playlist_view"
const VIEW_CHANGE_EVENT = "zovic_playlist_view_updated"

// The server always renders the grid (server snapshot); the client then switches to the saved view.
function subscribeView(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(VIEW_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(VIEW_CHANGE_EVENT, callback)
  }
}

function getViewSnapshot(): CatalogView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid"
  } catch {
    return "grid"
  }
}

function changeView(next: CatalogView) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, next)
  } catch {
    // storage unavailable: the toggle has nowhere to remember the choice
  }
  window.dispatchEvent(new Event(VIEW_CHANGE_EVENT))
}

const VIEW_OPTIONS = [
  { value: "grid", Icon: GridIcon },
  { value: "list", Icon: ListIcon },
] as const

export default function PlaylistPage() {
  const router = useRouter()
  const { data: playlists, isPending, error } = useMyPlaylistsData()
  const createPlaylist = useCreatePlaylist()
  const deletePlaylist = useDeletePlaylist()

  // Modal State for Creating a Playlist
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [newPlaylistName, setNewPlaylistName] = React.useState("")
  const [newPlaylistColor, setNewPlaylistColor] = React.useState(PRESET_COLORS[0]?.color ?? "#d33a2c")
  const [newPlaylistPrivate, setNewPlaylistPrivate] = React.useState(false)

  // Handle Form Submit (Create Playlist)
  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newPlaylistName.trim()
    if (!trimmed || createPlaylist.isPending) return

    createPlaylist.mutate(
      { name: trimmed, color: newPlaylistColor, isPrivate: newPlaylistPrivate },
      {
        onSuccess: (created) => {
          setIsCreateModalOpen(false)
          setNewPlaylistName("")
          router.push(`/playlist/${created.id}`)
        },
      }
    )
  }

  // Bento grid layout (drag to reorder, resize from the corner)
  const { width: gridWidth, containerRef: gridRef, mounted: gridMounted } = useContainerWidth({ measureBeforeMount: true })
  const { order, layouts, reorder, moveCards, resizeSlot, shuffleSizes } = usePlaylistLayouts(playlists.map((p) => p.id))
  // A drag or resize ends with a click on the card; this flag keeps that click from opening the playlist
  const isArrangingRef = React.useRef(false)
  const startArranging = () => {
    isArrangingRef.current = true
  }
  const stopArranging = () => {
    setTimeout(() => {
      isArrangingRef.current = false
    }, 0)
  }

  // Catalog view: bento grid or a plain list, remembered per viewer
  const view = React.useSyncExternalStore(subscribeView, getViewSnapshot, () => "grid" as const)
  const orderedPlaylists = order
    .map((id) => playlists.find((p) => p.id === id))
    .filter((p): p is PlaylistData => Boolean(p))

  // The playlist being played (or paused) shows it in the list: a rule in its color and level bars
  const playback = usePlayback()
  const playbackOf = (id: string) => ({
    isSource: isPlayingFrom(playback, id),
    isPlaying: isPlayingFrom(playback, id) && Boolean(playback?.isPlaying),
  })
  const shelfDurationSec = playlists.reduce((acc, p) => acc + sumDurationSec(p.tracks), 0)

  // Handle Playlist Delete
  const handleDeletePlaylist = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    deletePlaylist.mutate(Number(id))
  }

  return (
    <div className="flex-1 bg-background text-foreground flex flex-col font-sans">
      <Header />

      <main className="flex-1 pt-16 flex flex-col">
        <div className="max-w-6xl mx-auto w-full px-6 md:px-8 pt-8 pb-16 flex-1 flex flex-col">
          {/* Page header: title and shelf totals, then the actions */}
          <div className="flex flex-col gap-6 pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-5xl">Playlists</h1>
              <p className="mt-3 font-mono text-xs text-muted-foreground tabular-nums">
                {isPending
                  ? "Carregando…"
                  : `${playlists.length} ${playlists.length === 1 ? "playlist" : "playlists"}`}
                {shelfDurationSec > 0 && ` · ${formatTotalDuration(shelfDurationSec)}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Shuffle slot sizes (keeps playlist order). Hidden but kept in the flow in list view,
                  so the buttons around it do not jump when switching. */}
              <Button
                variant="outline"
                size="lg"
                onClick={() => shuffleSizes(GRID_COLS[getBreakpointFromWidth(GRID_BREAKPOINTS, gridWidth)])}
                disabled={view !== "grid"}
                aria-hidden={view !== "grid"}
                tabIndex={view === "grid" ? undefined : -1}
                className={cn(
                  // No transition: hiding/showing on view change should be instant, not a fade
                  "h-9 px-4 text-sm transition-none",
                  view !== "grid" && "invisible"
                )}
              >
                Sortear layout
              </Button>

              {/* View toggle: one button, a press anywhere flips between bento grid and list */}
              <button
                type="button"
                onClick={() => changeView(view === "grid" ? "list" : "grid")}
                aria-label={`Modo de exibição: ${view === "grid" ? "grade" : "lista"}. Alternar para ${view === "grid" ? "lista" : "grade"}`}
                title={view === "grid" ? "Exibir em lista" : "Exibir em grade"}
                className="flex cursor-pointer items-center rounded-lg border border-border bg-surface p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {VIEW_OPTIONS.map((option) => (
                  <span
                    key={option.value}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md transition-colors duration-150",
                      view === option.value ? "bg-foreground text-background" : "text-muted-foreground"
                    )}
                  >
                    {/* Only the view you would switch to animates on hover */}
                    <option.Icon animateOnHover={view !== option.value} />
                  </span>
                ))}
              </button>

              <Button
                variant="default"
                size="lg"
                onClick={() => {
                  setNewPlaylistName("")
                  setNewPlaylistColor(PRESET_COLORS[0]?.color ?? "#d33a2c")
                  setNewPlaylistPrivate(false)
                  createPlaylist.reset()
                  setIsCreateModalOpen(true)
                }}
                className="h-9 gap-2 px-4 text-sm"
              >
                <PlusIcon size={16} /> Criar playlist
              </Button>
            </div>
          </div>

          {(error || deletePlaylist.isError) && (
            <p role="alert" className="pb-6 text-sm text-destructive">
              {error ?? `Não deu para excluir a playlist. ${apiErrorMessage(deletePlaylist.error)}`}
            </p>
          )}
          {!isPending && !error && playlists.length === 0 && (
            <p className="py-12 text-center font-mono text-xs text-muted-foreground">
              Nenhuma playlist ainda. Crie a primeira.
            </p>
          )}

          <div ref={gridRef} className="flex-1">
            {/* List: the shelf inventory, one row per playlist (drag to reorder) */}
            {view === "list" && (
              <SortableList ids={order} rowHeight={56} gap={2} onReorder={reorder}>
                {orderedPlaylists.map((playlist) => {
                  const { isSource, isPlaying } = playbackOf(playlist.id)
                  return (
                    <div
                      key={playlist.id}
                      // The row's accent is its playlist color, as on the playlist page
                      style={getPlaylistAccentStyle(playlist.color)}
                      className={cn(
                        "group relative flex h-full cursor-grab select-none items-center gap-3 rounded-lg px-3 transition-colors duration-150 active:cursor-grabbing",
                        isSource ? "bg-surface" : "hover:bg-ink/[0.04]"
                      )}
                    >
                      {/* The playlist in playback carries a thin rule in its color on the left edge */}
                      {isSource && (
                        <span className="pointer-events-none absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary" />
                      )}

                      {/* Mini sleeve */}
                      <div
                        className={cn(
                          "pointer-events-none flex size-10 shrink-0 items-center justify-center rounded-sm text-sm font-medium",
                          getContrastTextColor(playlist.color)
                        )}
                        style={{ backgroundColor: playlist.color }}
                      >
                        {getPlaylistInitials(playlist.name)}
                      </div>

                      <div className="pointer-events-none min-w-0 flex-1">
                        <div className={cn("truncate text-sm font-medium", isSource && "text-primary")}>
                          {playlist.name}
                        </div>
                        {trackSummary(playlist, true) && (
                          <div className="truncate font-mono text-xs text-muted-foreground tabular-nums">
                            {trackSummary(playlist, true)}
                          </div>
                        )}
                      </div>

                      {/* Whole row opens /playlist/:id */}
                      <Link
                        href={`/playlist/${playlist.id}`}
                        aria-label={`Abrir playlist ${playlist.name}`}
                        draggable={false}
                        className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      />

                      <div className="relative flex shrink-0 items-center gap-3">
                        {isSource && (
                          <span className="pointer-events-none text-primary" title={isPlaying ? "Tocando" : "Pausada"}>
                            <LevelBars playing={isPlaying} />
                            <span className="sr-only">{isPlaying ? "Tocando" : "Pausada"}</span>
                          </span>
                        )}
                        <span className="pointer-events-none w-14 text-right font-mono text-xs text-muted-foreground">
                          {playlist.isPrivate ? "Privada" : "Pública"}
                        </span>
                        {playlist.canEdit && (
                          <button
                            type="button"
                            onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                            aria-label={`Excluir playlist ${playlist.name}`}
                            title="Excluir playlist"
                            className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[color,background-color,opacity] duration-150 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring [@media(hover:none)]:opacity-100"
                          >
                            <CloseIcon size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </SortableList>
            )}

            {/* Grid: the sleeves facing out (drag to reorder, resize from the corner) */}
            {view === "grid" && gridMounted && (
              <ResponsiveGridLayout
                width={gridWidth}
                layouts={layouts}
                breakpoints={GRID_BREAKPOINTS}
                cols={GRID_COLS}
                rowHeight={240}
                margin={[20, 20]}
                containerPadding={[0, 0]}
                dragConfig={{ cancel: ".no-drag" }}
                onDrag={startArranging}
                onDragStop={(layout) => {
                  moveCards(layout)
                  stopArranging()
                }}
                onResize={startArranging}
                onResizeStop={(_, __, newItem) => {
                  resizeSlot(newItem, GRID_COLS[getBreakpointFromWidth(GRID_BREAKPOINTS, gridWidth)])
                  stopArranging()
                }}
              >
                {playlists.map((playlist) => {
                  const contrastClass = getContrastTextColor(playlist.color)

                  return (
                    <div
                      key={playlist.id}
                      className={cn(
                        "@container group relative flex cursor-grab select-none flex-col overflow-hidden rounded-xl p-7 active:cursor-grabbing",
                        "shadow-[0_1px_2px_rgba(23,21,18,0.12)] transition-shadow duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        "hover:shadow-[0_1px_2px_rgba(23,21,18,0.12),0_16px_32px_-16px_rgba(23,21,18,0.45)]",
                        contrastClass
                      )}
                      style={{ backgroundColor: playlist.color }}
                    >
                      {/* Printed frame, the same rule as on the playlist page's sleeve; 12px in, so the 28px padding leaves 16px between it and the text */}
                      <div className="pointer-events-none absolute inset-3 rounded-sm border border-current opacity-25" />

                      {/* Top: the name, on the top edge of the delete button (same 28px from the card edge),
                          leaving room for it on the right; the row keeps the button's 32px so the art does not shift */}
                      <div className="pointer-events-none relative z-10 flex h-8 items-start pr-10">
                        <h2 className="min-w-0 truncate text-base leading-snug font-medium @xs:text-lg">{playlist.name}</h2>
                      </div>

                      {/* Art: the initials */}
                      <div className="pointer-events-none relative z-10 flex flex-1 items-center justify-center">
                        <span className="text-6xl leading-none font-medium tracking-[-0.03em] @xs:text-7xl @lg:text-8xl">
                          {getPlaylistInitials(playlist.name)}
                        </span>
                      </div>

                      {/* Bottom: visibility on the left, track count on the right */}
                      <div className="pointer-events-none relative z-10 flex items-end justify-between gap-3 font-mono text-xs opacity-75 tabular-nums">
                        <span>{playlist.isPrivate ? "Privada" : "Pública"}</span>
                        <span>{trackSummary(playlist, false)}</span>
                      </div>

                      {/* Whole card opens /playlist/:id, except right after a drag or resize */}
                      <Link
                        href={`/playlist/${playlist.id}`}
                        aria-label={`Abrir playlist ${playlist.name}`}
                        draggable={false}
                        onClick={(e) => {
                          if (isArrangingRef.current) e.preventDefault()
                        }}
                        className="absolute inset-0 z-20 rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current"
                      />

                      {playlist.canEdit && (
                        <button
                          type="button"
                          onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                          aria-label={`Excluir playlist ${playlist.name}`}
                          title="Excluir playlist"
                          className="no-drag absolute top-7 right-7 z-30 flex size-8 cursor-pointer items-center justify-center rounded-md bg-black/15 opacity-0 transition-[background-color,opacity] duration-150 group-hover:opacity-100 hover:bg-black/30 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-current [@media(hover:none)]:opacity-100"
                        >
                          <CloseIcon size={16} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </ResponsiveGridLayout>
            )}
          </div>
        </div>
      </main>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova playlist</DialogTitle>
            <DialogDescription>Dê um nome, escolha a cor do encarte e quem pode ver</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePlaylist} className="space-y-5 pt-1">
            <div className="space-y-2">
              <Label htmlFor="create-playlist-name" className="text-sm font-medium">
                Nome
              </Label>
              <Input
                id="create-playlist-name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Ex.: MPB de domingo"
                maxLength={MAX_PLAYLIST_NAME_LENGTH}
                required
              />
            </div>

            <ColorPicker color={newPlaylistColor} onChange={setNewPlaylistColor} />

            <PlaylistPrivacyField isPrivate={newPlaylistPrivate} onChange={setNewPlaylistPrivate} />

            {createPlaylist.isError && (
              <p role="alert" className="text-sm text-destructive">
                {apiErrorMessage(createPlaylist.error)}
              </p>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="lg" onClick={() => setIsCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="default"
                size="lg"
                disabled={!newPlaylistName.trim() || createPlaylist.isPending}
              >
                {createPlaylist.isPending ? "Criando…" : "Criar playlist"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
