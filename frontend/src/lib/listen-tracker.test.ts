import { describe, expect, it } from "bun:test"
import { type ListenProgress, musicIdToMark, shouldReportListened, trackListen } from "./listen-tracker"

const TIMEUPDATE_STEP_SECONDS = 0.25

/** Feeds the positions to the tracker as consecutive timeupdate events of one listen. */
function playPositions(positions: number[], listenId = 1, start: ListenProgress | null = null): ListenProgress {
  let progress = start
  for (const position of positions) progress = trackListen(progress, listenId, position)
  if (!progress) throw new Error("No positions played")
  return progress
}

/** Positions from `from` to `to` (inclusive), a timeupdate every quarter second. */
function range(from: number, to: number): number[] {
  const positions: number[] = []
  for (let position = from; position <= to + 1e-9; position += TIMEUPDATE_STEP_SECONDS) positions.push(position)
  return positions
}

describe("listen-tracker", () => {
  it("soma o som de uma reprodução e avisa só depois de 30 s", () => {
    const atThirty = playPositions(range(0, 30))

    expect(atThirty.playedSeconds).toBeCloseTo(30)
    expect(shouldReportListened(atThirty)).toBe(false)

    const pastThirty = trackListen(atThirty, 1, 30.25)
    expect(shouldReportListened(pastThirty)).toBe(true)
  })

  it("avisa uma vez só", () => {
    const reported = { ...playPositions(range(0, 31)), isReported: true }

    expect(shouldReportListened(playPositions(range(31.25, 40), 1, reported))).toBe(false)
  })

  it("não conta o salto da barra", () => {
    const progress = playPositions([0, 0.25, 45, 45.25])

    expect(progress.playedSeconds).toBeCloseTo(0.5)
  })

  it("não conta voltar pela barra", () => {
    const progress = playPositions([0, 0.25, 0.5, 0.25, 0.5])

    expect(progress.playedSeconds).toBeCloseTo(0.75)
  })

  it("pausar não zera", () => {
    const beforePause = playPositions(range(0, 20))
    // No timeupdate while paused: the next one comes from where it stopped
    const afterPause = playPositions(range(20.25, 31), 1, beforePause)

    expect(afterPause.playedSeconds).toBeCloseTo(31)
    expect(shouldReportListened(afterPause)).toBe(true)
  })

  it("uma reprodução nova começa do zero", () => {
    const firstListen = playPositions(range(0, 25), 1)

    const secondListen = trackListen(firstListen, 2, 0)

    expect(secondListen).toEqual({ listenId: 2, playedSeconds: 0, lastPosition: 0, isReported: false })
  })

  it("faixa de exemplo não tem id do catálogo", () => {
    expect(musicIdToMark("sample-1")).toBeNull()
    expect(musicIdToMark("0")).toBeNull()
    expect(musicIdToMark("42")).toBe(42)
  })
})
