"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import type { NamedItem } from "@/lib/api/catalog"
import { cn } from "@/lib/utils"

// Multi-select as toggle chips, with a filter when the list is long
export function Picker({
  label,
  items,
  selected,
  onChange,
}: {
  label: string
  items: (NamedItem & { color?: string })[]
  selected: number[]
  onChange: (ids: number[]) => void
}) {
  const [filter, setFilter] = React.useState("")
  const visible = items.filter((item) => selected.includes(item.id) || item.name.toLowerCase().includes(filter.trim().toLowerCase()))
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium tracking-wide text-foreground/80">
        {label} <span className="text-muted-foreground">({selected.length} selecionado{selected.length === 1 ? "" : "s"})</span>
      </legend>
      {items.length > 12 && (
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Filtrar ${label.toLowerCase()}`} aria-label={`Filtrar ${label.toLowerCase()}`} />
      )}
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto py-1">
        {visible.map((item) => {
          const on = selected.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(item.id)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted/30"
              )}
            >
              {item.color && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: item.color }} />}
              {item.name}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
