"use client"

import { Field } from "@/components/admin/panel"
import { AlbumCoverImage } from "@/components/album-cover-image"
import { FileInput, useObjectUrl } from "@/components/file-input"
import { COVER_ACCEPT } from "@/lib/cover-image"

/** The cover file field with a preview next to it; `album` gives the current cover when editing. */
export function CoverField({
  id,
  file,
  onChange,
  album,
  label = "Imagem de capa (JPEG, PNG ou WebP, até 2 MB)",
}: {
  id: string
  file: File | null
  onChange: (file: File | null) => void
  album: { id: number; name: string; coverUrl: string | null }
  label?: string
}) {
  const previewUrl = useObjectUrl(file)
  return (
    <div className="flex items-end gap-3">
      <AlbumCoverImage album={album} previewUrl={previewUrl} className="size-16 shrink-0 text-base" />
      <div className="min-w-0 flex-1">
        <Field label={label} id={id}>
          <FileInput id={id} file={file} accept={COVER_ACCEPT} onChange={onChange} />
        </Field>
      </div>
    </div>
  )
}
