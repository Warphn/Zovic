import { describe, expect, it } from "bun:test"
import {
  buildLayouts,
  isGapless,
  orderFromLayout,
  packLayout,
  randomGaplessSizes,
  randomSlotSizes,
  reconcileOrder,
} from "./playlist-layout"

describe("playlist-layout", () => {
  it("packs cards without leaving holes a later card could fill", () => {
    const layout = packLayout(
      [
        { i: "a", w: 2, h: 1 },
        { i: "b", w: 2, h: 1 },
        { i: "c", w: 1, h: 1 },
        { i: "d", w: 1, h: 1 },
      ],
      3
    )
    const cells = new Set(layout.flatMap((item) => Array.from({ length: item.w }, (_, dx) => `${item.x + dx},${item.y}`)))
    expect(cells).toEqual(new Set(["0,0", "1,0", "2,0", "0,1", "1,1", "2,1"]))
  })

  it("caps card width to the column count", () => {
    const [item] = packLayout([{ i: "a", w: 2, h: 1 }], 1)
    expect(item?.w).toBe(1)
    expect(item?.maxW).toBe(1)
  })

  it("ties sizes to slots, so a moved playlist takes the size of its new slot", () => {
    const sizes = [
      { w: 2, h: 1 },
      { w: 1, h: 1 },
    ]
    const before = buildLayouts({ order: ["a", "b"], sizes }).lg
    const after = buildLayouts({ order: ["b", "a"], sizes }).lg
    expect(before?.find((item) => item.i === "a")?.w).toBe(2)
    expect(after?.find((item) => item.i === "b")?.w).toBe(2)
    expect(after?.find((item) => item.i === "a")?.w).toBe(1)
  })

  it("keeps saved order, drops deleted playlists and puts new ones first", () => {
    expect(reconcileOrder(["new", "a", "b"], ["b", "gone", "a"])).toEqual(["new", "b", "a"])
  })

  it("reads layout order top to bottom, left to right", () => {
    expect(
      orderFromLayout([
        { i: "c", x: 0, y: 1, w: 1, h: 1 },
        { i: "b", x: 1, y: 0, w: 1, h: 1 },
        { i: "a", x: 0, y: 0, w: 1, h: 1 },
      ])
    ).toEqual(["a", "b", "c"])
  })

  it("detects whether packed sizes fill every row and column", () => {
    expect(isGapless([{ w: 2, h: 1 }, { w: 1, h: 1 }, { w: 1, h: 1 }], 4)).toBe(true)
    expect(isGapless([{ w: 2, h: 1 }, { w: 1, h: 1 }], 4)).toBe(false)
    expect(isGapless([{ w: 1, h: 2 }, { w: 1, h: 1 }], 2)).toBe(false)
  })

  it("draws gapless sizes for the current column count", () => {
    for (const [count, cols] of [
      [8, 4],
      [7, 4],
      [8, 3],
      [5, 2],
      [3, 1],
    ] as const) {
      for (let run = 0; run < 50; run++) {
        expect(isGapless(randomGaplessSizes(count, cols), cols)).toBe(true)
      }
    }
  })

  it("falls back to widening slots when random draws keep leaving gaps", () => {
    // random() always 0 picks 1x1 for every slot: 7 cards in 4 columns leave one gap
    const sizes = randomGaplessSizes(7, 4, () => 0)
    expect(isGapless(sizes, 4)).toBe(true)
  })

  it("draws one size per slot", () => {
    const sizes = randomSlotSizes(5, () => 0.99)
    expect(sizes).toHaveLength(5)
    expect(sizes.every((size) => size.w === 2 && size.h === 2)).toBe(true)
  })
})
