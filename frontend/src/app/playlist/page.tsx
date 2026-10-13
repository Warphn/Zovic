"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import {
  ColorPicker,
  PRESET_COLORS,
  getColorName,
  getContrastTextColor,
} from "@/components/color-picker"
import {
  type PlaylistData,
  getPlaylistInitials,
  useStoredPlaylists,
} from "@/lib/playlist-store"
import {
  PLAYLIST_NAME_MAX_LENGTH,
  PlaylistApiError,
  type PlaylistField,
  createPlaylist,
} from "@/lib/playlists-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export default function PlaylistPage() {
  const router = useRouter()
  const { playlists, persistPlaylists } = useStoredPlaylists()

  // Modal State for Creating a Playlist
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [newPlaylistName, setNewPlaylistName] = React.useState("")
  const [newPlaylistColor, setNewPlaylistColor] = React.useState(PRESET_COLORS[0]?.color ?? "#1e7f82")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<PlaylistField, string>>>({})

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newPlaylistName.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    setFormError(null)
    setFieldErrors({})

    try {
      const created = await createPlaylist({ name: trimmed, color: newPlaylistColor })

      const newPl: PlaylistData = {
        id: String(created.id),
        name: created.name,
        color: created.color ?? newPlaylistColor,
        isPrivate: created.isPrivate,
        createdAt: "Hoje",
        tracks: [],
      }

      persistPlaylists([newPl, ...playlists])
      setIsCreateModalOpen(false)
      setNewPlaylistName("")
      router.push(`/playlist/${newPl.id}`)
    } catch (error) {
      if (error instanceof PlaylistApiError) {
        setFormError(error.message)
        setFieldErrors(error.fieldErrors)
      } else {
        setFormError("Não foi possível criar a playlist. Tente de novo.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

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
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-border">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="size-2 rounded-full bg-primary" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                  Catálogo de Vinil Zovic
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
                Playlists
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-light">
                Coleções sonoras e prensagens em vinil com identificação cromática.
              </p>
            </div>

            {/* Action: Open Modal to Create Playlist */}
            <Button
              variant="default"
              size="lg"
              onClick={() => {
                setNewPlaylistName("")
                setNewPlaylistColor(PRESET_COLORS[0]?.color ?? "#1e7f82")
                setFormError(null)
                setFieldErrors({})
                setIsCreateModalOpen(true)
              }}
              className="h-10 px-5 text-sm rounded-lg font-semibold shadow-xs cursor-pointer gap-2"
            >
              <span className="text-base font-bold leading-none">+</span> Criar Playlist
            </Button>
          </div>

          {/* Bento Grid */}
          <div className="pt-8 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 auto-rows-[240px]">
              {/* Playlist Bento Cards */}
              {playlists.map((playlist, idx) => {
                const cardInitials = getPlaylistInitials(playlist.name)
                const contrastClass = getContrastTextColor(playlist.color)
                const playlistDuration = Math.round(
                  playlist.tracks.reduce((acc, t) => acc + t.durationSec, 0) / 60
                )
                const isFeatured = idx === 0 || idx === 4

                return (
                  <div
                    key={playlist.id}
                    className={cn(
                      "group relative rounded-2xl overflow-hidden border border-black/10 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between p-6 select-none",
                      isFeatured ? "sm:col-span-2" : "col-span-1"
                    )}
                    style={{
                      backgroundColor: playlist.color,
                    }}
                  >
                    {/* Subtle Tactile Vinyl Groove & Grain Texture */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/35 via-transparent to-white/20 pointer-events-none" />
                    <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

                    {/* Top Header of the Card (NO IDs shown) */}
                    <div className="relative z-10 flex items-center justify-between">
                      <span
                        className={cn(
                          "text-[10px] font-mono tracking-widest uppercase font-bold px-2 py-0.5 rounded bg-black/25 backdrop-blur-xs",
                          contrastClass
                        )}
                      >
                        {playlist.isPrivate ? "Privada" : "PúblicaÁAAA"}
                      </span>
                      <span className={cn("text-[10px] font-mono tracking-wider opacity-75", contrastClass)}>
                        33⅓ RPM
                      </span>
                    </div>

                    {/* Center: Monogram / Large Initials (Displayed beautifully without hover) */}
                    <div className="relative z-10 my-auto text-center transition-transform duration-300 group-hover:scale-95">
                      <span
                        className={cn(
                          "font-black tracking-tighter drop-shadow-sm transition-all duration-300 block",
                          isFeatured ? "text-7xl sm:text-8xl" : "text-6xl sm:text-7xl",
                          contrastClass
                        )}
                      >
                        {cardInitials}
                      </span>
                    </div>

                    {/* Bottom Footer (Static indicator before hover - PT-BR color name & tracks) */}
                    <div className="relative z-10 flex items-center justify-between opacity-80 group-hover:opacity-0 transition-opacity duration-200">
                      {getColorName(playlist.color) ? (
                        <span className={cn("text-[9px] font-mono tracking-wider uppercase", contrastClass)}>
                          {getColorName(playlist.color)}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className={cn("text-[9px] font-mono", contrastClass)}>
                        {playlist.tracks.length} FAIXAS
                      </span>
                    </div>

                    {/* Semantic Card Link Overlay: Clicking anywhere on the card or its initials/icon opens /playlist/:id */}
                    <Link
                      href={`/playlist/${playlist.id}`}
                      aria-label={`Abrir playlist ${playlist.name}`}
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
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 border-white/30 text-white font-mono"
                        >
                          {playlist.isPrivate ? "Privada" : "Pública"}
                        </Badge>

                        {/* Delete Playlist Button - interactive with pointer-events-auto */}
                        <button
                          type="button"
                          onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                          aria-label={`Excluir playlist ${playlist.name}`}
                          title="Excluir playlist"
                          className="pointer-events-auto relative z-30 size-7 rounded-full bg-white/10 hover:bg-red-600 hover:text-white text-white/80 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          ✕
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
                      <div className="flex items-center justify-between pt-2 border-t border-white/20">
                        {getColorName(playlist.color) ? (
                          <span className="text-[11px] font-mono text-white/70">
                            {getColorName(playlist.color)}
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className="text-xs font-bold text-white flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Abrir Playlist →
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
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

          <form onSubmit={(e) => void handleCreatePlaylist(e)} className="space-y-5 pt-1">
            <div className="space-y-2">
              <Label htmlFor="create-playlist-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nome da Playlist
              </Label>
              <Input
                id="create-playlist-name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Ex: MPB de Domingo, Sintetizadores Noturnos..."
                maxLength={PLAYLIST_NAME_MAX_LENGTH}
                aria-invalid={fieldErrors.name ? true : undefined}
                aria-describedby={fieldErrors.name ? "create-playlist-name-error" : undefined}
                required
              />
              {fieldErrors.name && (
                <p id="create-playlist-name-error" className="text-xs text-destructive">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <ColorPicker
                color={newPlaylistColor}
                onChange={setNewPlaylistColor}
              />
              {fieldErrors.color && (
                <p className="text-xs text-destructive">{fieldErrors.color}</p>
              )}
            </div>

            {formError && (
              <p role="alert" className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {formError}
              </p>
            )}

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
                disabled={!newPlaylistName.trim() || isSubmitting}
                className="h-9 text-xs font-bold"
              >
                {isSubmitting ? "Criando..." : "Criar Playlist"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
