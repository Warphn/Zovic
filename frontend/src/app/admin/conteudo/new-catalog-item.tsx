"use client"

import * as React from "react"
import { ColorPicker, PRESET_COLORS } from "@/components/color-picker"
import { Notice } from "@/components/admin/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCreateArtist, useCreateGenre } from "@/lib/api/admin"
import { apiErrorMessage } from "@/lib/api/client"

// These fields live inside the music and album forms, and a <form> cannot hold another one:
// Enter and the button create the item without submitting the outer form.

/** Creates an artist without leaving the form; the new one comes back already selected. */
export function NewArtistField({ onCreated }: { onCreated: (artistId: number) => void }) {
  const createArtist = useCreateArtist()
  const [name, setName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const create = async () => {
    if (!name.trim() || createArtist.isPending) return
    setError(null)
    try {
      const artist = await createArtist.mutateAsync(name.trim())
      onCreated(artist.id)
      setName("")
    } catch (createError) {
      setError(apiErrorMessage(createError))
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            void create()
          }}
          placeholder="Novo artista"
          aria-label="Nome do novo artista"
          maxLength={255}
        />
        <Button type="button" variant="outline" onClick={create} disabled={!name.trim() || createArtist.isPending}>
          {createArtist.isPending ? "Adicionando…" : "Adicionar"}
        </Button>
      </div>
      {error && <Notice>{error}</Notice>}
    </div>
  )
}

/** Creates a genre (name and color) without leaving the form; the new one comes back already selected. */
export function NewGenreField({ onCreated }: { onCreated: (genreId: number) => void }) {
  const createGenre = useCreateGenre()
  const [name, setName] = React.useState("")
  const [color, setColor] = React.useState(PRESET_COLORS[0].color)
  const [error, setError] = React.useState<string | null>(null)

  const create = async () => {
    if (!name.trim() || createGenre.isPending) return
    setError(null)
    try {
      const genre = await createGenre.mutateAsync({ name: name.trim(), color })
      onCreated(genre.id)
      setName("")
    } catch (createError) {
      setError(apiErrorMessage(createError))
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/70 p-2.5">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            void create()
          }}
          placeholder="Novo gênero"
          aria-label="Nome do novo gênero"
          maxLength={100}
        />
        <Button type="button" variant="outline" onClick={create} disabled={!name.trim() || createGenre.isPending}>
          {createGenre.isPending ? "Adicionando…" : "Adicionar"}
        </Button>
      </div>
      {name.trim() && <ColorPicker color={color} onChange={setColor} />}
      {error && <Notice>{error}</Notice>}
    </div>
  )
}
