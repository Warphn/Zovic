"use client"

import { Switch } from "@/components/ui/switch"

// Public or private, as one switch with what each choice means. Used when creating and when
// editing a playlist.
export function PlaylistPrivacyField({
  isPrivate,
  onChange,
}: {
  isPrivate: boolean
  onChange: (isPrivate: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div id="playlist-private-label" className="text-sm font-medium">
          Playlist privada
        </div>
        <p id="playlist-private-hint" className="mt-1 text-xs text-muted-foreground">
          {isPrivate ? "Só os membros veem e encontram na busca" : "Qualquer pessoa com conta vê e encontra na busca"}
        </p>
      </div>
      <Switch
        checked={isPrivate}
        onCheckedChange={onChange}
        aria-labelledby="playlist-private-label"
        aria-describedby="playlist-private-hint"
        className="mt-0.5"
      />
    </div>
  )
}
