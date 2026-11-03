"use client"

import * as React from "react"
import { AlertIcon } from "@/components/icons"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Building blocks shared by the admin pages: section cards, stat tiles, ranked bars, notices.

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-surface/70 p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-black tabular-nums tracking-tight">{value.toLocaleString("pt-BR")}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

export interface RankedItem {
  key: string | number
  label: string
  sublabel?: string
  value: number
  /** Small identity swatch next to the label (e.g. the genre color); the bar keeps the panel hue. */
  swatch?: string
  /** Extra line for the hover/focus detail. */
  detail?: string
  muted?: boolean
}

// Horizontal bars for a ranking: one series, one hue, the value written at the end of each bar
// and the extra detail on hover (and in the accessible name). The rows double as the table view.
export function RankedBars({ items, unit, empty }: { items: RankedItem[]; unit: string; empty: string }) {
  const max = Math.max(1, ...items.map((item) => item.value))

  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>

  return (
    <ol className="space-y-1">
      {items.map((item) => (
        <li
          key={item.key}
          className="group relative grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/25 sm:grid-cols-[minmax(0,14rem)_1fr]"
        >
          <div className="min-w-0">
            <div className={cn("flex items-center gap-1.5 truncate text-sm font-medium", item.muted && "text-muted-foreground")}>
              {item.swatch && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: item.swatch }} />}
              <span className="truncate">{item.label}</span>
            </div>
            {item.sublabel && <div className="truncate text-xs text-muted-foreground">{item.sublabel}</div>}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 flex-1" aria-hidden="true">
              <div
                className="h-full rounded-r-[4px] bg-[var(--color-red)]"
                style={{ width: `${Math.max(1, (item.value / max) * 100)}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums">
              {item.value.toLocaleString("pt-BR")}
              <span className="sr-only">
                {" "}
                {unit}
                {item.detail ? `, ${item.detail}` : ""}
              </span>
            </span>
          </div>
          {item.detail && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-full z-10 mt-1 hidden rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg group-hover:block"
            >
              <span className="font-semibold">
                {item.value.toLocaleString("pt-BR")} {unit}
              </span>
              <span className="text-muted-foreground"> · {item.detail}</span>
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

export function Notice({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
        tone === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-muted/20"
      )}
    >
      {tone === "error" && <AlertIcon size={16} className="mt-0.5" />}
      <span>{children}</span>
    </div>
  )
}

export function Loading() {
  return <p className="text-sm text-muted-foreground">Carregando…</p>
}

export function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
