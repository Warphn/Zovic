import { describe, expect, it } from "bun:test"
import { DEFAULT_TRACKS, INITIAL_PLAYLISTS } from "./playlist-store"
import { isPlayingFrom, nextPlayRecord, pickRandomTracks, type PlayRecord, resolveQueue, type PlaybackState } from "./playback-store"

describe("pickRandomTracks", () => {
  it("never suggests the excluded track nor repeats one", () => {
    const picked = pickRandomTracks(DEFAULT_TRACKS, "t1", 4)
    expect(picked).toHaveLength(4)
    expect(picked.some((t) => t.id === "t1")).toBe(false)
    expect(new Set(picked.map((t) => t.id)).size).toBe(4)
  })

  it("returns the whole pool when it is smaller than the count", () => {
    expect(pickRandomTracks(DEFAULT_TRACKS, "t1", 50)).toHaveLength(DEFAULT_TRACKS.length - 1)
  })

  it("order follows the random source", () => {
    // random() = 0 always swaps in the first remaining track: the pool order is kept
    const ids = pickRandomTracks(DEFAULT_TRACKS, "t1", 3, () => 0).map((t) => t.id)
    expect(ids).toEqual(["t2", "t3", "t4"])
    // random() just under 1 always takes the last remaining track
    const last = pickRandomTracks(DEFAULT_TRACKS, "t1", 1, () => 0.999).map((t) => t.id)
    expect(last).toEqual(["t6"])
  })
})

describe("resolveQueue", () => {
  const playlist = INITIAL_PLAYLISTS[1]

  it("is empty when nothing has played", () => {
    expect(resolveQueue(null, INITIAL_PLAYLISTS)).toEqual({ tracks: [], playlist: null })
  })

  it("reads a playlist's tracks live from the playlists", () => {
    const state: PlaybackState = {
      source: { kind: "playlist", playlistId: playlist.id },
      currentTrackId: playlist.tracks[0].id,
      isPlaying: true,
    }
    const reordered = INITIAL_PLAYLISTS.map((p) => (p.id === playlist.id ? { ...p, tracks: p.tracks.toReversed() } : p))
    const resolved = resolveQueue(state, reordered)
    expect(resolved.playlist?.id).toBe(playlist.id)
    expect(resolved.tracks.map((t) => t.id)).toEqual(playlist.tracks.toReversed().map((t) => t.id))
    expect(isPlayingFrom(state, playlist.id)).toBe(true)
  })

  it("plays a lone track's fixed queue, outside any playlist", () => {
    const queue = DEFAULT_TRACKS.slice(0, 3)
    const state: PlaybackState = { source: { kind: "track", queue }, currentTrackId: "t1", isPlaying: true }
    expect(resolveQueue(state, INITIAL_PLAYLISTS)).toEqual({ tracks: queue, playlist: null })
    expect(isPlayingFrom(state, playlist.id)).toBe(false)
  })
})

describe("nextPlayRecord", () => {
  const idle: PlayRecord = { trackId: null, recorded: false }
  // Runs a sequence of (track, playing) states and lists the music ids that were counted
  const counted = (steps: [string | null, boolean][]) => {
    let record = idle
    const ids: number[] = []
    for (const [trackId, isPlaying] of steps) {
      const next = nextPlayRecord(record, trackId, isPlaying)
      record = next.record
      if (next.musicId !== null) ids.push(next.musicId)
    }
    return ids
  }

  it("counts a track once when it starts playing", () => {
    expect(counted([["12", true]])).toEqual([12])
  })

  it("does not count pausing and resuming the same listen", () => {
    expect(counted([["12", true], ["12", false], ["12", true]])).toEqual([12])
  })

  it("counts again after moving to another track and back", () => {
    expect(counted([["12", true], ["30", false], ["12", true]])).toEqual([12, 12])
  })

  it("counts a track picked while paused only when it plays", () => {
    expect(counted([["12", false], ["30", false]])).toEqual([])
    expect(counted([["12", false], ["12", true]])).toEqual([12])
  })

  it("never counts sample tracks or nothing at all", () => {
    expect(counted([["t1", true], [null, true]])).toEqual([])
  })
})
