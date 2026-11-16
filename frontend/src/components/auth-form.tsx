"use client"

import * as React from "react"
import Link from "next/link"
import Header from "@/components/header"
import { RecordSleeve, Sleeve } from "@/components/record-sleeve"
import { Input, type InputProps } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getPlaylistInitials, INITIAL_PLAYLISTS } from "@/lib/playlist-store"
import { cn } from "@/lib/utils"
import { AlertIcon } from "@/components/icons"
import { ZovicCat } from "@/components/zovic-cat"

interface AuthShellProps {
  title: string
  description: string
  footer: React.ReactNode
  children: React.ReactNode
}

// The front sleeve is the landing preview's sample playlist, in its color; the two behind it are
// in the page's own ink and sand, like sleeves in the shade of the crate, so one color leads
const FRONT = INITIAL_PLAYLISTS[0]
const BEHIND = [
  { color: "#171512", initials: "TP" },
  { color: "#b9ad91", initials: "CB" },
]

// Sleeves leaning one behind the other, like at the back of a record crate, the front one with
// its record half out. Static: nothing plays before the visitor is in. The sleeves behind sit up
// and to the left, so the stack is shifted down and right to center what is seen
function Shelf() {
  const [back, middle] = BEHIND
  if (!FRONT || !back || !middle) return null
  return (
    <div aria-hidden="true" className="hidden items-center justify-center md:flex">
      <div className="relative translate-x-10 translate-y-10 scale-125 lg:translate-x-12 lg:translate-y-12 lg:scale-150">
        <Sleeve color={back.color} initials={back.initials} className="absolute top-0 left-0 size-48 -translate-x-16 -translate-y-16 md:size-52" />
        <Sleeve color={middle.color} initials={middle.initials} className="absolute top-0 left-0 size-48 -translate-x-8 -translate-y-8 md:size-52" />
        <div className="relative">
          {/* The cat lies on top of the front sleeve, its paws over the edge */}
          <ZovicCat priority className="absolute bottom-full left-6 z-20 h-28 translate-y-3 md:h-32" />
          <RecordSleeve color={FRONT.color} initials={getPlaylistInitials(FRONT.name)} playing={false} />
        </div>
      </div>
    </div>
  )
}

// Page frame shared by /entrar and /cadastro: the form on the left, the shelf on the right
export function AuthShell({ title, description, footer, children }: AuthShellProps) {
  return (
    <div className="flex-1 bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground">
      <Header />
      <main className="flex-1 pt-16">
        <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center gap-16 px-6 py-16 md:grid-cols-[minmax(0,24rem)_1fr] md:px-8">
          <div className="w-full max-w-sm">
            <h1 className="text-4xl leading-[1.05] font-medium tracking-[-0.03em]">{title}</h1>
            <p className="mt-3 mb-8 text-sm text-muted-foreground">{description}</p>
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs">{children}</div>
            <p className="mt-6 text-sm text-muted-foreground">{footer}</p>
          </div>
          <Shelf />
        </div>
      </main>
    </div>
  )
}

interface FormFieldProps extends InputProps {
  id: string
  label: string
  error?: string
}

// Floating label: it rests in the middle of the input and moves up, smaller, while the input is
// focused or has a value (CSS only, via peer + :placeholder-shown; the input always gets a
// placeholder, shown only while focused). Date inputs always render their own mask, so their
// label stays up. The label is set at its small size and scaled up to rest, so the move is
// transform only (translate + scale), never top or font-size.
const LABEL_AT_REST = "translate-y-2 scale-[1.2727]"
const LABEL_FLOAT_ON_STATE =
  "peer-focus:translate-y-0 peer-focus:scale-100 peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:scale-100"

// Labelled input whose error is announced with it (aria-invalid + aria-describedby)
export function FormField({ id, label, error, placeholder, type, ...inputProps }: FormFieldProps) {
  const errorId = `${id}-error`
  const alwaysFloated = type === "date"
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          id={id}
          type={type}
          placeholder={placeholder ?? " "}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "peer h-12 px-3 pt-5 pb-1 placeholder:text-transparent focus:placeholder:text-muted-foreground",
            error && "pr-10"
          )}
          {...inputProps}
        />
        {/* Error marker inside the field, so the problem is visible even before reading the text */}
        {error && (
          <AlertIcon
            size={18}
            // Same spot in every field; the input's pr-10 keeps the date picker button clear of it
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-destructive"
          />
        )}
        <Label
          htmlFor={id}
          className={cn(
            // 11px at the top (8px down), 14px at rest in the middle of the 48px field
            "pointer-events-none absolute top-2 left-3 origin-left text-[11px] leading-4 font-normal text-muted-foreground transition-[translate,scale,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] peer-focus:text-foreground",
            !alwaysFloated && LABEL_AT_REST,
            !alwaysFloated && LABEL_FLOAT_ON_STATE
          )}
        >
          {label}
        </Label>
      </div>
      {error && (
        <p id={errorId} className="pl-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {message}
    </p>
  )
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-foreground underline underline-offset-4 decoration-foreground/30 transition-colors hover:decoration-foreground">
      {children}
    </Link>
  )
}

// After a failed submit, move focus to the first invalid field so keyboard and screen
// reader users land on the problem. Deferred a tick so React has rendered aria-invalid.
export function focusFirstInvalid(form: HTMLFormElement | null) {
  setTimeout(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0)
}
