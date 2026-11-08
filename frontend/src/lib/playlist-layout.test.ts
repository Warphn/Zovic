import { describe, expect, it } from "bun:test"
import {
  buildLayouts,
  fillAfterResize,
  isGapless,
  orderFromLayout,
  packLayout,
  randomGaplessSizes,
  randomSlotSizes,
  reconcileOrder,
} from "./playlist-layout"

const small = (n: number) => Array.from({ length: n }, () => ({ w: 1, h: 1 }))
// Slots whose size differs between two size lists
const changedSlots = (before: { w: number; h: number }[], after: { w: number; h: number }[]) =>
  after.flatMap((s, i) => (s.w === before[i]?.w && s.h === before[i]?.h ? [] : [i]))

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

  describe("fillAfterResize", () => {
    it("changes nothing else when the resize already fills every row", () => {
      // 7 small + a 2x1 in slot 6 fills two rows of 4
      const sizes = small(7)
      const result = fillAfterResize(sizes, 6, { w: 2, h: 1 }, 4)
      expect(result).not.toBeNull()
      expect(changedSlots(sizes, result!)).toEqual([6])
    })

    it("keeps the size the user chose and changes as few other cards as possible", () => {
      // 8 small fill two rows of 4; widening slot 0 leaves 9 cells, so one more card must grow
      const sizes = small(8)
      const result = fillAfterResize(sizes, 0, { w: 2, h: 1 }, 4)
      expect(result).not.toBeNull()
      expect(result![0]).toEqual({ w: 2, h: 1 })
      expect(isGapless(result!, 4)).toBe(true)
      expect(changedSlots(sizes, result!)).toHaveLength(2)
    })

    it("prefers the smallest change in area, then the cards nearest the resized one", () => {
      // 2x1 + 6 small fill two rows of 4; shrinking slot 0 leaves a gap that one nearby card closes
      const sizes = [{ w: 2, h: 1 }, ...small(6)]
      const result = fillAfterResize(sizes, 0, { w: 1, h: 1 }, 4)
      expect(result).not.toBeNull()
      expect(isGapless(result!, 4)).toBe(true)
      expect(changedSlots(sizes, result!)).toEqual([0, 1])
      expect(result![1]).toEqual({ w: 2, h: 1 })
    })

    it("works at the column count in use", () => {
      const sizes = small(6)
      for (const cols of [2, 3]) {
        const result = fillAfterResize(sizes, 2, { w: 2, h: 2 }, cols)
        expect(result).not.toBeNull()
        expect(isGapless(result!, cols)).toBe(true)
        expect(result![2]).toEqual({ w: 2, h: 2 })
      }
    })

    it("returns null when no fill exists", () => {
      // A single card can never fill a row of 4
      expect(fillAfterResize(small(1), 0, { w: 2, h: 1 }, 4)).toBeNull()
    })
  })
})
