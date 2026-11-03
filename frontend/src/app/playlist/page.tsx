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
} from "@/components/color-picker"
import {
  DEFAULT_TRACKS,
  type PlaylistData,
  getPlaylistInitials,
  useStoredPlaylists,
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
import { ArrowRightIcon, CloseIcon, GridIcon, ListIcon, PlusIcon } from "@/components/icons"

type CatalogView = "grid" | "list"
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
  const { playlists, persistPlaylists } = useStoredPlaylists()

  // Modal State for Creating a Playlist
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [newPlaylistName, setNewPlaylistName] = React.useState("")
  const [newPlaylistColor, setNewPlaylistColor] = React.useState(PRESET_COLORS[0]?.color ?? "#d33a2c")

  // Handle Form Submit (Create Playlist)
  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newPlaylistName.trim()
    if (!trimmed) return

    const newPl: PlaylistData = {
      id: "pl-" + Date.now(),
      name: trimmed,
      color: newPlaylistColor,
      isPrivate: false,
      createdAt: "Hoje",
      tracks: DEFAULT_TRACKS,
    }

    const updated = [newPl, ...playlists]
    persistPlaylists(updated)
    setIsCreateModalOpen(false)
    setNewPlaylistName("")
    router.push(`/playlist/${newPl.id}`)
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

  // Handle Playlist Delete
  const handleDeletePlaylist = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const updated = playlists.filter((p) => p.id !== id)
    persistPlaylists(updated)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground relative">
      <Header />

      <main className="flex-1 pt-16 flex flex-col">
        {/* =========================================================================
            BENTO GRID VIEW (CATALOG OF PLAYLISTS)
            ========================================================================= */}
        <div className="max-w-7xl mx-auto w-full px-6 md:px-8 py-10 flex-1 flex flex-col">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8">
            <div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
                Playlists
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-light">
                Coleções sonoras e prensagens em vinil com identificação cromática.
              </p>
            </div>

            <div className="flex items-center gap-2">
            {/* Action: Shuffle slot sizes (keeps playlist order). Hidden but kept in the flow in
                list view, so the buttons around it do not jump when switching. */}
            <Button
              variant="outline"
              size="lg"
              onClick={() => shuffleSizes(GRID_COLS[getBreakpointFromWidth(GRID_BREAKPOINTS, gridWidth)])}
              disabled={view !== "grid"}
              aria-hidden={view !== "grid"}
              tabIndex={view === "grid" ? undefined : -1}
              className={cn(
                // No transition: hiding/showing on view change should be instant, not a fade
                "h-10 px-5 text-sm rounded-lg font-semibold cursor-pointer transition-none",
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
              className="flex items-center rounded-lg border border-border bg-surface p-0.5 cursor-pointer"
            >
              {VIEW_OPTIONS.map((option) => (
                <span
                  key={option.value}
                  className={cn(
                    "size-8 rounded-md flex items-center justify-center transition-colors",
                    view === option.value ? "bg-foreground text-background" : "text-muted-foreground"
                  )}
                >
                  {/* Only the view you would switch to animates on hover */}
                  <option.Icon animateOnHover={view !== option.value} />
                </span>
              ))}
            </button>

            {/* Action: Open Modal to Create Playlist */}
            <Button
              variant="default"
              size="lg"
              onClick={() => {
                setNewPlaylistName("")
                setNewPlaylistColor(PRESET_COLORS[0]?.color ?? "#d33a2c")
                setIsCreateModalOpen(true)
              }}
              className="h-10 px-5 text-sm rounded-lg font-semibold shadow-xs cursor-pointer gap-2"
            >
              <PlusIcon size={16} /> Criar Playlist
            </Button>
            </div>
          </div>

          {/* Bento Grid */}
          <div ref={gridRef} className="pt-8 flex-1">
            {view === "list" && (
              <SortableList ids={order} rowHeight={70} onReorder={reorder}>
                {orderedPlaylists.map((playlist) => {
                  const contrastClass = getContrastTextColor(playlist.color)
                  const playlistDuration = Math.round(
                    playlist.tracks.reduce((acc, t) => acc + t.durationSec, 0) / 60
                  )
                  return (
                    <div
                      key={playlist.id}
                      className="group relative h-full rounded-xl border border-border/70 bg-surface/70 hover:bg-surface hover:border-border p-3.5 transition-colors flex items-center justify-between gap-4 select-none cursor-grab active:cursor-grabbing"
                    >
                      {/* Left: Cover, Name & Specs */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className="size-10 rounded-lg border border-black/10 flex items-center justify-center font-black text-sm shrink-0 shadow-2xs"
                          style={{ backgroundColor: playlist.color }}
                        >
                          <span className={contrastClass}>{getPlaylistInitials(playlist.name)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-foreground truncate group-hover:underline">
                            {playlist.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {playlist.tracks.length} {playlist.tracks.length === 1 ? "faixa" : "faixas"}{" "}
                            <span className="opacity-40">•</span> {playlistDuration} min
                          </div>
                        </div>
                      </div>

                      {/* Semantic Row Link Overlay: clicking anywhere on the row opens /playlist/:id */}
                      <Link
                        href={`/playlist/${playlist.id}`}
                        aria-label={`Abrir playlist ${playlist.name}`}
                        draggable={false}
                        className="absolute inset-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                      />

                      {/* Right: Visibility & Delete */}
                      <div className="relative flex items-center gap-3 shrink-0 font-mono text-xs">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {playlist.isPrivate ? "Privada" : "Pública"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                          aria-label={`Excluir playlist ${playlist.name}`}
                          title="Excluir playlist"
                          className="size-7 rounded-lg border border-border bg-background text-muted-foreground hover:bg-red-600 hover:border-red-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <CloseIcon size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </SortableList>
            )}
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
                resizeSlot(newItem)
                stopArranging()
              }}
            >
              {/* Playlist Bento Cards */}
              {playlists.map((playlist) => {
                const cardInitials = getPlaylistInitials(playlist.name)
                const contrastClass = getContrastTextColor(playlist.color)
                const playlistDuration = Math.round(
                  playlist.tracks.reduce((acc, t) => acc + t.durationSec, 0) / 60
                )

                return (
                  <div
                    key={playlist.id}
                    className={cn(
                      "@container group relative rounded-2xl overflow-hidden border border-black/10 shadow-xs hover:shadow-xl transition-shadow duration-300 flex flex-col justify-between p-6 select-none cursor-grab active:cursor-grabbing"
                    )}
                    style={{
                      backgroundColor: playlist.color,
                    }}
                  >
                    {/* Subtle Tactile Vinyl Groove & Grain Texture */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/35 via-transparent to-white/20 pointer-events-none" />
                    <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

                    {/* Top Header of the Card (NO IDs shown) */}
                    {/* No z-index here, so the visibility chip can sit above the hover overlay and stay unchanged */}
                    <div className="relative flex items-center justify-between">
                      <span
                        className={cn(
                          "relative z-30 pointer-events-none text-[10px] font-mono tracking-widest uppercase font-bold px-2 py-0.5 rounded",
                          contrastClass
                        )}
                        style={{ backgroundColor: `color-mix(in srgb, ${playlist.color} 75%, black)` }}
                      >
                        {playlist.isPrivate ? "Privada" : "Pública"}
                      </span>
                      <span className={cn("relative z-10 text-[10px] font-mono tracking-wider opacity-75", contrastClass)}>
                        33⅓ RPM
                      </span>
                    </div>

                    {/* Center: Monogram / Large Initials (Displayed beautifully without hover) */}
                    <div className="relative z-10 my-auto text-center">
                      <span
                        className={cn(
                          "font-black tracking-tighter drop-shadow-sm block text-6xl @xs:text-7xl @lg:text-8xl",
                          contrastClass
                        )}
                      >
                        {cardInitials}
                      </span>
                    </div>

                    {/* Bottom Footer (Static indicator before hover - track count) */}
                    <div className="relative z-10 flex items-center justify-end opacity-80 group-hover:opacity-0 transition-opacity duration-200">
                      <span className={cn("text-[9px] font-mono", contrastClass)}>
                        {playlist.tracks.length} FAIXAS
                      </span>
                    </div>

                    {/* Semantic Card Link Overlay: Clicking anywhere on the card or its initials/icon opens /playlist/:id */}
                    <Link
                      href={`/playlist/${playlist.id}`}
                      aria-label={`Abrir playlist ${playlist.name}`}
                      draggable={false}
                      onClick={(e) => {
                        if (isArrangingRef.current) e.preventDefault()
                      }}
                      className="absolute inset-0 z-20 w-full h-full cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-ring rounded-2xl"
                    />

                    {/* HOVER REVEAL OVERLAY (Shows full info upon hover with pointer-events-none so click passes through to Link) */}
                    <div
                      className={cn(
                        "absolute inset-0 z-25 pointer-events-none p-6 flex flex-col justify-between transition-all duration-300 ease-out",
                        "opacity-0 group-hover:opacity-100 backdrop-blur-md bg-black/60 text-white"
                      )}
                    >
                      {/* Hover Top Details */}
                      <div className="flex items-center justify-between">
                        {/* Visibility chip stays from the card header above */}
                        <span />

                        {/* Delete Playlist Button - interactive with pointer-events-auto */}
                        <button
                          type="button"
                          onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                          aria-label={`Excluir playlist ${playlist.name}`}
                          title="Excluir playlist"
                          className="no-drag pointer-events-auto relative z-30 size-7 rounded-full bg-white/10 hover:bg-red-600 hover:text-white text-white/80 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <CloseIcon size={14} />
                        </button>
                      </div>

                      {/* Hover Center: Playlist Icon + Full Title & Specs */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          {/* Visual Playlist Monogram Icon */}
                          <div
                            className="size-11 rounded-xl border border-white/20 flex items-center justify-center font-black text-base shrink-0 shadow-xs"
                            style={{ backgroundColor: playlist.color }}
                          >
                            {cardInitials}
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight line-clamp-1">
                              {playlist.name}
                            </h2>
                            <div className="flex items-center gap-2 text-xs text-white/80 font-mono mt-0.5">
                              <span>{playlist.tracks.length} músicas</span>
                              <span>•</span>
                              <span>{playlistDuration} min</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hover Bottom Action */}
                      <div className="flex items-center justify-end pt-2 border-t border-white/20">
                        <span className="text-xs font-bold text-white flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Abrir Playlist <ArrowRightIcon size={14} />
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </ResponsiveGridLayout>
            )}
          </div>
        </div>
      </main>

      {/* =========================================================
          MODAL: CRIAR PLAYLIST (Clean, focused, no excess boxes)
          ========================================================= */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Nova Playlist</DialogTitle>
            <DialogDescription>
              Defina o nome da sua seleção e a cor da identidade cromática do vinil.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePlaylist} className="space-y-5 pt-1">
            <div className="space-y-2">
              <Label htmlFor="create-playlist-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nome da Playlist
              </Label>
              <Input
                id="create-playlist-name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Ex: MPB de Domingo, Sintetizadores Noturnos..."
                required
              />
            </div>

            <ColorPicker
              color={newPlaylistColor}
              onChange={setNewPlaylistColor}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                className="h-9 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={!newPlaylistName.trim()}
                className="h-9 text-xs font-bold"
              >
                Criar Playlist
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
