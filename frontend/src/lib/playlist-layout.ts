"use client"

import * as React from "react"
import type { Layout, LayoutItem, ResponsiveLayouts } from "react-grid-layout"

export const GRID_BREAKPOINTS = { lg: 1100, md: 760, sm: 480, xs: 0 } as const
export type GridBreakpoint = keyof typeof GRID_BREAKPOINTS
export const GRID_COLS: Record<GridBreakpoint, number> = { lg: 4, md: 3, sm: 2, xs: 1 }

const BREAKPOINT_NAMES = Object.keys(GRID_BREAKPOINTS) as GridBreakpoint[]
const LAYOUT_STORAGE_KEY = "zovic_playlist_layout_v2"
const MAX_ITEM_SIZE = 2

export interface SlotSize {
  w: number
  h: number
}

// Sizes belong to positions (slots), not to playlists: the playlist moved into
// slot N takes slot N's size.
export interface BentoArrangement {
  order: string[]
  sizes: SlotSize[]
}

const SMALL: SlotSize = { w: 1, h: 1 }

// Featured slots (1st and 5th) start two columns wide, like the original bento.
export function defaultSlotSize(slot: number): SlotSize {
  return slot === 0 || slot === 4 ? { w: 2, h: 1 } : SMALL
}

// Weighted so most cards stay small and the grid keeps a bento rhythm.
const RANDOM_SIZES: { size: SlotSize; weight: number }[] = [
  { size: { w: 1, h: 1 }, weight: 5 },
  { size: { w: 2, h: 1 }, weight: 3 },
  { size: { w: 1, h: 2 }, weight: 1 },
  { size: { w: 2, h: 2 }, weight: 1 },
]

export function randomSlotSizes(count: number, random: () => number = Math.random): SlotSize[] {
  const total = RANDOM_SIZES.reduce((acc, option) => acc + option.weight, 0)
  return Array.from({ length: count }, () => {
    let pick = random() * total
    for (const option of RANDOM_SIZES) {
      pick -= option.weight
      if (pick < 0) return option.size
    }
    return SMALL
  })
}

// True when the packed cards form a full rectangle: every row and column filled.
export function isGapless(sizes: SlotSize[], cols: number): boolean {
  const layout = packLayout(
    sizes.map((size, slot) => ({ i: String(slot), ...size })),
    cols
  )
  const rows = Math.max(0, ...layout.map((item) => item.y + item.h))
  const area = layout.reduce((acc, item) => acc + item.w * item.h, 0)
  return area === rows * cols
}

const GAPLESS_ATTEMPTS = 500

// Random sizes that leave no empty cell at `cols` columns. Rejection sampling keeps the
// weighted bento mix; if it keeps missing, widen the first slots until the last row closes.
export function randomGaplessSizes(
  count: number,
  cols: number,
  random: () => number = Math.random
): SlotSize[] {
  for (let attempt = 0; attempt < GAPLESS_ATTEMPTS; attempt++) {
    const sizes = randomSlotSizes(count, random)
    if (isGapless(sizes, cols)) return sizes
  }
  const missing = (cols - (count % cols)) % cols
  const widened = Array.from({ length: count }, (_, slot) => (slot < missing ? { w: 2, h: 1 } : SMALL))
  // Too few playlists to fill a row even when widened (cards are at most 2 wide): keep them small.
  return isGapless(widened, cols) ? widened : Array.from({ length: count }, () => SMALL)
}

// First-fit packing: each card takes the first free slot scanning rows top to bottom,
// so cards never leave holes a later card could fill.
export function packLayout(items: { i: string; w: number; h: number }[], cols: number): LayoutItem[] {
  const occupied = new Set<string>()
  const fits = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (occupied.has(`${x + dx},${y + dy}`)) return false
      }
    }
    return true
  }

  return items.map((item) => {
    const w = Math.min(item.w, cols)
    for (let y = 0; ; y++) {
      for (let x = 0; x + w <= cols; x++) {
        if (!fits(x, y, w, item.h)) continue
        for (let dy = 0; dy < item.h; dy++) {
          for (let dx = 0; dx < w; dx++) occupied.add(`${x + dx},${y + dy}`)
        }
        return {
          i: item.i,
          x,
          y,
          w,
          h: item.h,
          minW: 1,
          minH: 1,
          maxW: Math.min(MAX_ITEM_SIZE, cols),
          maxH: MAX_ITEM_SIZE,
        }
      }
    }
  })
}

export function buildLayouts({ order, sizes }: BentoArrangement): ResponsiveLayouts<GridBreakpoint> {
  const items = order.map((i, slot) => ({ i, ...(sizes[slot] ?? defaultSlotSize(slot)) }))
  const layouts = {} as Record<GridBreakpoint, Layout>
  for (const bp of BREAKPOINT_NAMES) layouts[bp] = packLayout(items, GRID_COLS[bp])
  return layouts
}

// Keeps the saved order for playlists that still exist; new playlists go first,
// matching where the store puts them.
export function reconcileOrder(ids: string[], savedOrder: string[]): string[] {
  const kept = savedOrder.filter((id) => ids.includes(id))
  return [...ids.filter((id) => !kept.includes(id)), ...kept]
}

// Reading order of a grid layout: top to bottom, then left to right.
export function orderFromLayout(layout: Layout): string[] {
  return layout.toSorted((a, b) => a.y - b.y || a.x - b.x).map((item) => item.i)
}

function readSavedArrangement(): BentoArrangement | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BentoArrangement>
    return Array.isArray(parsed.order) && Array.isArray(parsed.sizes)
      ? { order: parsed.order, sizes: parsed.sizes }
      : null
  } catch {
    return null
  }
}

// The arrangement is a per-viewer convenience, so it lives in this browser's localStorage.
// It is read on the first render; the grid only renders on the client after measuring its
// width (measureBeforeMount), so the server-side null never reaches the markup.
export function usePlaylistLayouts(ids: string[]) {
  const [saved, setSaved] = React.useState<BentoArrangement | null>(readSavedArrangement)

  const persist = React.useCallback((next: BentoArrangement) => {
    setSaved(next)
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // storage unavailable: keep the arrangement for this session only
    }
  }, [])

  const idsKey = ids.join("|")
  const arrangement = React.useMemo<BentoArrangement>(
    () => ({ order: reconcileOrder(ids, saved?.order ?? []), sizes: saved?.sizes ?? [] }),
    // ids is rebuilt every render; idsKey captures its content
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [idsKey, saved]
  )
  const layouts = React.useMemo(() => buildLayouts(arrangement), [arrangement])

  const sizesFor = (count: number) =>
    Array.from({ length: count }, (_, slot) => arrangement.sizes[slot] ?? defaultSlotSize(slot))

  // Reordering playlists (grid drop or list drag); each slot keeps its size.
  const reorder = (order: string[]) => {
    persist({ order, sizes: sizesFor(arrangement.order.length) })
  }
  const moveCards = (layout: Layout) => reorder(orderFromLayout(layout))

  // Resizing a card changes the size of the slot it sits in.
  const resizeSlot = (item: LayoutItem | null) => {
    const slot = item ? arrangement.order.indexOf(item.i) : -1
    if (!item || slot < 0) return
    const sizes = sizesFor(arrangement.order.length)
    sizes[slot] = { w: item.w, h: item.h }
    persist({ order: arrangement.order, sizes })
  }

  // Same playlist order, new random size for every slot, with no empty cell at `cols` columns.
  const shuffleSizes = (cols: number) => {
    persist({ order: arrangement.order, sizes: randomGaplessSizes(arrangement.order.length, cols) })
  }

  return { order: arrangement.order, layouts, reorder, moveCards, resizeSlot, shuffleSizes }
}
