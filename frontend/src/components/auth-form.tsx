"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import Header from "@/components/header"
import { Input, type InputProps } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { AlertIcon } from "@/components/icons"

interface AuthShellProps {
  title: string
  description: string
  /** What the cat says in a balloon beside the form; without it, no balloon. */
  catSays?: string
  footer: React.ReactNode
  children: React.ReactNode
}

// Comic-strip look, like the illustration: an ink outline and a hard shadow with no blur. The
// balloon's shadow is a drop-shadow filter, so it follows its tail too
const COMIC_BORDER = "border-2 border-ink"
const COMIC_PANEL_SHADOW = "shadow-[4px_4px_0_var(--color-ink)]"
const COMIC_BALLOON_SHADOW = "drop-shadow-[3px_3px_0_var(--color-ink)]"

// The cat at the turntable in a comic panel beside the form, saying `catSays` (if any) in a
// speech balloon; both wobble between a few held poses, unless the visitor asked for less motion.
// Decorative: the form says what the page is for
function AuthIllustration({ catSays }: { catSays?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative hidden w-full max-w-md rounded-3xl bg-primary p-10 md:block lg:p-12",
        COMIC_BORDER,
        COMIC_PANEL_SHADOW
      )}
    >
      {catSays && (
        <p
          className={cn(
            // In the panel's empty top right corner, above the turntable
            "absolute top-5 right-5 z-10 max-w-[12rem] rounded-2xl bg-surface px-4 py-2.5 text-base leading-snug font-semibold tracking-[-0.01em]",
            // Wobbles with the cat, from its tail's corner
            "origin-bottom-left motion-safe:animate-wobble",
            COMIC_BORDER,
            COMIC_BALLOON_SHADOW
          )}
        >
          {catSays}
          {/* The balloon's tail, pointing down at the cat */}
          <span className="absolute -bottom-[9px] left-6 size-4 rotate-45 border-r-2 border-b-2 border-ink bg-surface" />
        </p>
      )}
      <Image
        src="/illustrations/cat-turntable.png"
        alt=""
        width={986}
        height={901}
        priority
        sizes="(min-width: 768px) 24rem, 0px"
        className="pointer-events-none h-auto w-full origin-bottom select-none motion-safe:animate-wobble"
      />
    </div>
  )
}

// Page frame shared by /entrar and /cadastro: the form and the illustration in two equal halves, each
// centered in its own, so the pair sits in the middle of the page; on a phone, just the form
export function AuthShell({ title, description, catSays, footer, children }: AuthShellProps) {
  return (
    <div className="flex-1 bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground">
      <Header />
      <main className="flex-1 pt-16">
        <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center justify-items-center gap-16 px-6 py-16 md:grid-cols-2 md:px-8">
          <div className="w-full max-w-sm">
            <h1 className="text-4xl leading-[1.05] font-medium tracking-[-0.03em]">{title}</h1>
            <p className="mt-3 mb-8 text-sm text-muted-foreground">{description}</p>
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs">{children}</div>
            <p className="mt-6 text-sm text-muted-foreground">{footer}</p>
          </div>
          <AuthIllustration catSays={catSays} />
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
// A value the browser autofilled may not count as typed yet (the placeholder still "shows"), so
// :autofill floats the label too
const LABEL_FLOAT_ON_STATE =
  "peer-focus:translate-y-0 peer-focus:scale-100 peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:scale-100 peer-autofill:translate-y-0 peer-autofill:scale-100"

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
            // The browser paints autofilled fields light blue; an inset shadow in the field's own
            // surface covers it, and the text keeps the ink
            "autofill:shadow-[inset_0_0_0_1000px_var(--color-surface)] autofill:[-webkit-text-fill-color:var(--color-foreground)]",
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
