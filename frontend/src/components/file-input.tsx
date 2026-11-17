"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/** A preview address for a chosen file, released when the file changes or the form closes. */
export function useObjectUrl(file: File | null): string | null {
  const url = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  React.useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}

const FILE_BOX =
  "flex h-9 w-full cursor-pointer items-center rounded-md border border-input bg-surface/90 px-3 text-left text-sm shadow-xs transition-colors outline-none hover:bg-muted/20 focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"

/**
 * The native file input prints "Escolher arquivo Nenhum arquivo escolhido" and can't be styled, so
 * it stays hidden and this box opens it: "Escolher arquivo" until a file is chosen, then its name.
 * The box is a button with the field's `id`, so the field label names it and it takes the focus.
 */
export function FileInput({
  id,
  file,
  accept,
  onChange,
  describedBy,
}: {
  id: string
  file: File | null
  /** Same format as the native `accept`, like "audio/mpeg,.mp3". */
  accept: string
  onChange: (file: File | null) => void
  describedBy?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} hidden onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
      <button
        id={id}
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-describedby={describedBy}
        title={file?.name}
        className={cn(FILE_BOX, file ? "text-foreground" : "text-muted-foreground")}
      >
        <span className="truncate">{file ? file.name : "Escolher arquivo"}</span>
      </button>
    </>
  )
}

/** Same box as FileInput, for picking several files at once; the list of chosen files is the caller's. */
export function FilesInput({
  id,
  accept,
  text,
  disabled,
  onChange,
}: {
  id: string
  accept: string
  /** What the box says, like "Escolher arquivos". */
  text: string
  disabled?: boolean
  onChange: (files: File[]) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(event) => {
          onChange(Array.from(event.target.files ?? []))
          // Lets the same file be chosen again after it is taken out of the list
          event.target.value = ""
        }}
      />
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(FILE_BOX, "text-muted-foreground")}
      >
        <span className="truncate">{text}</span>
      </button>
    </>
  )
}
