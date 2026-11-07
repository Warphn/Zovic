"use client"

import * as React from "react"
import { Field } from "@/components/admin/panel"
import { AlbumCoverImage } from "@/components/album-cover-image"
import { FileInput } from "./file-input"

/** The image formats the API takes for a cover (api/domain/shared/cover-image.ts). */
export const COVER_ACCEPT = "image/jpeg,image/png,image/webp"

/** A preview address for a chosen file, released when the file changes or the form closes. */
function useObjectUrl(file: File | null): string | null {
  const url = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  React.useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}

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
