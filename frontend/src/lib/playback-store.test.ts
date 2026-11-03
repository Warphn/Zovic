import { describe, expect, it } from "bun:test"
import { DEFAULT_TRACKS, INITIAL_PLAYLISTS, uniqueTracks } from "./playlist-store"
import { isPlayingFrom, pickRandomTracks, resolveQueue, type PlaybackState } from "./playback-store"

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

describe("uniqueTracks", () => {
  it("lists each track once across playlists", () => {
    const ids = uniqueTracks(INITIAL_PLAYLISTS).map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.toSorted()).toEqual(DEFAULT_TRACKS.map((t) => t.id).toSorted())
  })
})
