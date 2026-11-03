"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Menu } from "@base-ui/react/menu"
import { ListPlusIcon } from "@/components/icons"
import { apiErrorMessage } from "@/lib/api/client"
import { useAddPlaylistMusic } from "@/lib/api/playlists"
import { useMyPlaylistsData } from "@/lib/playlist-store"

// "Adicionar à playlist" for one music: a menu with the playlists the viewer administers (only
// they can add musics). The music goes to the end of the chosen playlist; the outcome, added or
// why not, is reported through `onResult`, for the page to announce.
export function AddToPlaylistMenu({
  musicId,
  title,
  onResult,
}: {
  musicId: number
  title: string
  onResult: (message: string, ok: boolean) => void
}) {
  const router = useRouter()
  const { data: playlists, isPending } = useMyPlaylistsData()
  const addMusic = useAddPlaylistMusic()
  const editable = playlists.filter((p) => p.canEdit)

  const add = (playlistId: string, name: string) =>
    addMusic.mutate(
      { id: Number(playlistId), musicId },
      {
        onSuccess: () => onResult(`“${title}” entrou em ${name}`, true),
        onError: (error) => onResult(`Não deu para adicionar “${title}” a ${name}. ${apiErrorMessage(error)}`, false),
      }
    )

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Adicionar ${title} a uma playlist`}
        title="Adicionar à playlist"
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 data-[popup-open]:bg-muted/40 data-[popup-open]:text-foreground"
      >
        <ListPlusIcon size={16} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="end" className="z-[60]">
          <Menu.Popup className="max-h-80 min-w-56 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-popover outline-none origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
            <div className="px-2.5 pt-1.5 pb-2 font-mono text-[11px] text-muted-foreground">Adicionar à playlist</div>
            {isPending ? (
              <div className="px-2.5 py-2 text-sm text-muted-foreground">Carregando…</div>
            ) : editable.length === 0 ? (
              <Menu.Item
                onClick={() => router.push("/playlist")}
                className="flex cursor-pointer items-center rounded-md px-2.5 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-muted/40"
              >
                Criar uma playlist primeiro
              </Menu.Item>
            ) : (
              editable.map((playlist) => (
                <Menu.Item
                  key={playlist.id}
                  onClick={() => add(playlist.id, playlist.name)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-muted/40"
                >
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-sm border border-black/10"
                    style={{ backgroundColor: playlist.color }}
                  />
                  <span className="truncate">{playlist.name}</span>
                </Menu.Item>
              ))
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
