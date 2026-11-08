"use client"

import * as React from "react"
import { CommentIcon } from "@/components/comments/comment-icon"
import { TrackComments } from "@/components/comments/track-comments"
import { PauseIcon, PlayIcon } from "@/components/icons"
import { useSession } from "@/lib/auth/client"
import type { UserProfile } from "@/lib/comments-store"
import { currentTrackOf, playOrToggleTrack, useCatalogTracks, usePlayback } from "@/lib/playback-store"
import type { Track } from "@/lib/playlist-store"
import { cn } from "@/lib/utils"

const DEFAULT_PANEL_HEIGHT = 540
const MIN_PANEL_HEIGHT = 260

interface CommentsTarget {
  track: Track
  /** Como o botão "Tocar" do painel e as marcas de tempo tocam a faixa; sem isso, toca a faixa avulsa. */
  onPlay: (() => void) | undefined
}

interface CommentsPanelApi {
  /** Id da faixa cujo painel está aberto (null com o painel fechado). */
  openTrackId: string | null
  openComments: (track: Track, onPlay?: () => void) => void
}

const CommentsPanelContext = React.createContext<CommentsPanelApi | null>(null)

export function useCommentsPanel(): CommentsPanelApi {
  const api = React.useContext(CommentsPanelContext)
  if (!api) throw new Error("useCommentsPanel precisa estar dentro de <CommentsPanelProvider>")
  return api
}

/**
 * Um único painel de comentários para o app inteiro: qualquer lista de faixas abre ele com
 * `openComments(track)` (use o <TrackCommentsButton>). Fica no layout, acima das páginas.
 */
export function CommentsPanelProvider({ children }: { children: React.ReactNode }) {
  // Perfil ativo vindo da sessão do Better Auth
  const { data: session } = useSession()
  const currentUser: UserProfile | null = React.useMemo(() => {
    if (!session?.user) return null
    return {
      id: Number(session.user.id),
      name: session.user.name,
      birthdate: session.user.birthdate,
      isUnderage: !session.user.isAdult,
    }
  }, [session])

  const playback = usePlayback()
  const catalog = useCatalogTracks()

  const [target, setTarget] = React.useState<CommentsTarget | null>(null)
  const [panelHeight, setPanelHeight] = React.useState(DEFAULT_PANEL_HEIGHT)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragRef = React.useRef<{ startY: number; startHeight: number } | null>(null)

  // Menores de idade nunca têm comentários abertos
  const isOpen = target !== null && currentUser !== null && !currentUser.isUnderage
  const openTrack = isOpen ? target.track : null

  const close = React.useCallback(() => setTarget(null), [])
  const openComments = React.useCallback(
    (track: Track, onPlay?: () => void) => setTarget({ track, onPlay }),
    [],
  )

  // Fecha ao pressionar Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) close()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, close])

  const api = React.useMemo<CommentsPanelApi>(
    () => ({ openTrackId: openTrack?.id ?? null, openComments }),
    [openTrack?.id, openComments],
  )

  // Arrastar a alça redimensiona o painel
  const handleResizeStart = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, startHeight: panelHeight }
    setIsDragging(true)
  }

  const handleResizeMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const next = drag.startHeight + (drag.startY - e.clientY) // arrastar p/ cima aumenta
    const max = Math.round(window.innerHeight * 0.85)
    setPanelHeight(Math.max(MIN_PANEL_HEIGHT, Math.min(max, next)))
  }

  const handleResizeEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    setIsDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (panelHeight < MIN_PANEL_HEIGHT) {
      close()
      setPanelHeight(DEFAULT_PANEL_HEIGHT)
    }
  }

  const handleResizeKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowUp") {
      setPanelHeight((h) => Math.min(Math.round(window.innerHeight * 0.85), h + 40))
    } else if (e.key === "ArrowDown") {
      setPanelHeight((h) => {
        const next = h - 40
        if (next < MIN_PANEL_HEIGHT) {
          close()
          return DEFAULT_PANEL_HEIGHT
        }
        return next
      })
    } else if (e.key === "Escape") {
      close()
    }
  }

  const play = () => {
    if (!target) return
    if (target.onPlay) target.onPlay()
    else playOrToggleTrack(target.track.id, [target.track, ...catalog])
  }
  const isTrackPlaying = openTrack !== null && currentTrackOf(playback)?.id === openTrack.id && Boolean(playback?.isPlaying)

  return (
    <CommentsPanelContext.Provider value={api}>
      {children}

      {/* Painel que sobe (só para maiores de 18) */}
      {openTrack && currentUser && (
        <>
          {/* Fundo ao expandir comentários */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity animate-in fade-in duration-300"
            onClick={close}
            aria-hidden="true"
          />

          <div
            className={cn(
              "fixed bottom-0 inset-x-0 bg-surface/98 backdrop-blur-md border-t-2 border-primary/30 z-50 shadow-2xl ease-in-out flex flex-col overflow-hidden rounded-t-2xl",
              !isDragging && "transition-all duration-300",
            )}
            style={{ height: `min(${panelHeight}px, 85vh)` }}
          >
            {/* Alça de redimensionar */}
            <button
              type="button"
              aria-label="Redimensionar painel de comentários"
              onPointerDown={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={handleResizeEnd}
              onKeyDown={handleResizeKeyDown}
              className="group w-full h-5 shrink-0 flex items-center justify-center cursor-row-resize touch-none select-none focus-visible:outline-none"
            >
              <div className="w-12 h-1 rounded-full bg-border group-hover:bg-muted-foreground/60 group-focus-visible:bg-primary transition-colors" />
            </button>

            {/* Cabeçalho */}
            <div className="h-14 px-6 flex items-center justify-between shrink-0 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <CommentIcon size={20} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-foreground truncate">Comentários: {openTrack.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {openTrack.artist} · {openTrack.duration}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={play}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-border bg-background hover:bg-surface text-xs font-medium cursor-pointer transition-colors"
                >
                  {isTrackPlaying ? (
                    <>
                      <PauseIcon size={14} />
                      <span>Pausar</span>
                    </>
                  ) : (
                    <>
                      <PlayIcon size={14} />
                      <span>Tocar</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="size-8 rounded-md border border-border bg-background hover:bg-surface text-foreground flex items-center justify-center text-xs cursor-pointer transition-colors"
                  aria-label="Fechar painel de comentários"
                  title="Fechar comentários"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Lista de comentários e formulário */}
            <div className="flex-1 overflow-y-auto">
              <TrackComments
                key={openTrack.id}
                track={openTrack}
                user={currentUser}
                currentPlaybackSec={0}
                onSeek={play}
              />
            </div>
          </div>
        </>
      )}
    </CommentsPanelContext.Provider>
  )
}