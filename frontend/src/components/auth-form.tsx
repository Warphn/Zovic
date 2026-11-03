"use client"

import * as React from "react"
import Link from "next/link"
import Header from "@/components/header"
import SilkBackground from "@/components/silk-background"
import { Input, type InputProps } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { AlertIcon } from "@/components/icons"

interface AuthShellProps {
  title: string
  description: string
  footer: React.ReactNode
  children: React.ReactNode
}

// Page frame shared by /entrar and /cadastro
export function AuthShell({ title, description, footer, children }: AuthShellProps) {
  return (
    <div className="relative min-h-screen text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground">
      <SilkBackground />
      <Header />
      <main className="flex-1 pt-16 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-4xl font-black tracking-tight">{title}</h1>
          <p className="mt-2 mb-8 text-sm font-light text-muted-foreground">{description}</p>
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-xs">{children}</div>
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
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

// Floating label: it sits in the middle of the input and slides up while the input is focused
// or has a value (CSS only, via peer + :placeholder-shown; the input always gets a placeholder,
// shown only while focused). Date inputs always render their own mask, so their label stays up.
const LABEL_FLOATED =
  "top-2 translate-y-0 text-[10px] font-semibold uppercase tracking-wider"
const LABEL_FLOAT_ON_STATE = [
  "peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:uppercase peer-focus:tracking-wider",
  "peer-not-placeholder-shown:top-2 peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:text-[10px] peer-not-placeholder-shown:font-semibold peer-not-placeholder-shown:uppercase peer-not-placeholder-shown:tracking-wider",
].join(" ")

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
            error && "pr-10 bg-destructive/5"
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
            "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-normal text-muted-foreground transition-all duration-200 ease-out peer-focus:text-primary",
            alwaysFloated ? LABEL_FLOATED : LABEL_FLOAT_ON_STATE,
            error && "text-destructive peer-focus:text-destructive"
          )}
        >
          {label}
        </Label>
      </div>
      {error && (
        <p id={errorId} className="pl-3 text-xs font-medium text-destructive">
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
    <Link href={href} className="font-semibold text-foreground underline-offset-4 hover:underline">
      {children}
    </Link>
  )
}

// After a failed submit, move focus to the first invalid field so keyboard and screen
// reader users land on the problem. Deferred a tick so React has rendered aria-invalid.
export function focusFirstInvalid(form: HTMLFormElement | null) {
  setTimeout(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0)
}
