"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The native file input prints "Escolher arquivo Nenhum arquivo escolhido" and can't be styled, so
 * it stays hidden and this box opens it: "Escolher arquivo" until a file is chosen, then its name.
 * The box is a button with the field's `id`, so the field label names it and it takes the focus.
 */
export function AudioFileInput({
  id,
  file,
  onChange,
  describedBy,
}: {
  id: string
  file: File | null
  onChange: (file: File | null) => void
  describedBy?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,.mp3"
        hidden
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <button
        id={id}
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-describedby={describedBy}
        title={file?.name}
        className={cn(
          "flex h-9 w-full cursor-pointer items-center rounded-md border border-input bg-surface/90 px-3 text-left text-sm shadow-xs transition-colors outline-none",
          "hover:bg-muted/20 focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/10",
          file ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="truncate">{file ? file.name : "Escolher arquivo"}</span>
      </button>
    </>
  )
}
