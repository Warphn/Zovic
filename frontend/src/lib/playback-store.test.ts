import { describe, expect, it } from "bun:test"
import { DEFAULT_TRACKS, type Track } from "./playlist-store"
import {
  appendToQueue,
  currentTrackOf,
  getPlaybackSnapshot,
  isPlayingFrom,
  listenToRecord,
  moveTo,
  nextOnEnded,
  parsePlaybackState,
  pickRandomTracks,
  type PlaybackState,
  playQueue,
  removeFromQueue,
  skipUnavailable,
  skipUnavailableTrack,
  startQueue,
  stopPlayback,
} from "./playback-store"

const PLAYLIST_ORIGIN = { kind: "playlist", playlistId: "7" } as const

/** A catalog track: its id is the music's id in the API. */
function catalogTrack(id: number): Track {
  return { ...DEFAULT_TRACKS[0], id: String(id), title: `Música ${id}` }
}

/** A queue of `tracks`, playing from `index`. */
function playing(tracks: Track[], index = 0): PlaybackState {
  const state = startQueue(null, tracks, index, null)
  if (!state) throw new Error("empty queue")
  return state
}

const queueIds = (state: PlaybackState) => state.queue.map((track) => track.id)

describe("pickRandomTracks", () => {
  it("never suggests the excluded track nor repeats one", () => {
    const picked = pickRandomTracks(DEFAULT_TRACKS, "t1", 4)
    expect(picked).toHaveLength(4)
    expect(picked.some((track) => track.id === "t1")).toBe(false)
    expect(new Set(picked.map((track) => track.id)).size).toBe(4)
  })

  it("returns the whole pool when it is smaller than the count", () => {
    expect(pickRandomTracks(DEFAULT_TRACKS, "t1", 50)).toHaveLength(DEFAULT_TRACKS.length - 1)
  })

  it("order follows the random source", () => {
    // random() = 0 always swaps in the first remaining track: the pool order is kept
    const ids = pickRandomTracks(DEFAULT_TRACKS, "t1", 3, () => 0).map((track) => track.id)
    expect(ids).toEqual(["t2", "t3", "t4"])
    // random() just under 1 always takes the last remaining track
    const last = pickRandomTracks(DEFAULT_TRACKS, "t1", 1, () => 0.999).map((track) => track.id)
    expect(last).toEqual(["t6"])
  })
})

describe("startQueue", () => {
  it("a playlist of 5 tracks gives a queue of 5, in order", () => {
    const five = DEFAULT_TRACKS.slice(0, 5)
    const state = startQueue(null, five, 0, PLAYLIST_ORIGIN)

    expect(state && queueIds(state)).toEqual(five.map((track) => track.id))
    expect(state?.origin).toEqual(PLAYLIST_ORIGIN)
    expect(state?.isPlaying).toBe(true)
  })

  it("copies the tracks, so editing the playlist later does not change the queue", () => {
    const tracks = DEFAULT_TRACKS.slice(0, 3)
    const state = playing(tracks)
    tracks.reverse()

    expect(queueIds(state)).toEqual(["t1", "t2", "t3"])
  })

  it("starts a new listen", () => {
    const first = playing(DEFAULT_TRACKS)
    const second = startQueue(first, DEFAULT_TRACKS, 0, null)

    expect(second?.listenId).toBe(first.listenId + 1)
  })

  it("gives nothing for an empty list", () => {
    expect(startQueue(null, [], 0, null)).toBeNull()
  })
})

describe("nextOnEnded", () => {
  it("the next track starts on its own when one ends", () => {
    const state = playing(DEFAULT_TRACKS)
    const next = nextOnEnded(state)

    expect(next.currentIndex).toBe(1)
    expect(next.isPlaying).toBe(true)
    expect(next.listenId).toBe(state.listenId + 1)
  })

  it("the queue stops at its last track", () => {
    const state = playing(DEFAULT_TRACKS, DEFAULT_TRACKS.length - 1)
    const next = nextOnEnded(state)

    expect(next.currentIndex).toBe(DEFAULT_TRACKS.length - 1)
    expect(next.isPlaying).toBe(false)
    expect(next.listenId).toBe(state.listenId)
  })
})

describe("skipUnavailable", () => {
  it("skipping an unavailable last track stops there", () => {
    const state = playing(DEFAULT_TRACKS.slice(0, 2), 1)
    const next = skipUnavailable(state)

    expect(next.currentIndex).toBe(1)
    expect(next.isPlaying).toBe(false)
  })

  it("moves past an unavailable track in the middle", () => {
    expect(skipUnavailable(playing(DEFAULT_TRACKS, 1)).currentIndex).toBe(2)
  })
})

describe("skipUnavailableTrack", () => {
  it("skips only while the failed listen is still the current one", () => {
    playQueue(DEFAULT_TRACKS.slice(0, 3), 0)
    const failedListenId = getPlaybackSnapshot()?.listenId ?? -1

    skipUnavailableTrack(failedListenId - 1)
    expect(getPlaybackSnapshot()?.currentIndex).toBe(0)
    skipUnavailableTrack(failedListenId)
    expect(getPlaybackSnapshot()?.currentIndex).toBe(1)
    stopPlayback()
  })
})

describe("appendToQueue", () => {
  it("adding puts the track at the end", () => {
    const state = playing(DEFAULT_TRACKS.slice(0, 3), 1)
    const next = appendToQueue(state, DEFAULT_TRACKS[4])

    expect(queueIds(next)).toEqual(["t1", "t2", "t3", "t5"])
    expect(next.currentIndex).toBe(1)
    expect(next.listenId).toBe(state.listenId)
  })

  it("adding with nothing playing starts a paused queue", () => {
    const next = appendToQueue(null, DEFAULT_TRACKS[2])

    expect(queueIds(next)).toEqual(["t3"])
    expect(next.currentIndex).toBe(0)
    expect(next.isPlaying).toBe(false)
  })

  it("a track can be in the queue twice", () => {
    const state = playing(DEFAULT_TRACKS.slice(0, 3))

    expect(appendToQueue(state, DEFAULT_TRACKS[0]).queue).toHaveLength(4)
  })
})

describe("removeFromQueue", () => {
  it("a removed track does not play when the previous one ends", () => {
    const state = playing(DEFAULT_TRACKS.slice(0, 3))
    const next = nextOnEnded(removeFromQueue(state, 1))

    expect(currentTrackOf(next)?.id).toBe("t3")
  })

  it("removing a track before the current one keeps the same track and listen", () => {
    const state = playing(DEFAULT_TRACKS.slice(0, 3), 2)
    const next = removeFromQueue(state, 0)

    expect(currentTrackOf(next)?.id).toBe("t3")
    expect(next.currentIndex).toBe(1)
    expect(next.listenId).toBe(state.listenId)
  })

  it("the current track cannot be removed", () => {
    const state = playing(DEFAULT_TRACKS.slice(0, 3), 1)

    expect(removeFromQueue(state, 1)).toEqual(state)
  })
})

describe("moveTo", () => {
  it("starts a new listen at the chosen position", () => {
    const state = playing(DEFAULT_TRACKS)
    const next = moveTo(state, 3, true)

    expect(next.currentIndex).toBe(3)
    expect(next.listenId).toBe(state.listenId + 1)
  })

  it("keeps play or pause when not told", () => {
    const paused = { ...playing(DEFAULT_TRACKS), isPlaying: false }

    expect(moveTo(paused, 2).isPlaying).toBe(false)
  })
})

describe("listenToRecord", () => {
  it("records each listen once", () => {
    const state = playing([catalogTrack(10)])

    expect(listenToRecord(null, state)).toEqual({ listenId: state.listenId, musicId: 10 })
    expect(listenToRecord(state.listenId, state)).toBeNull()
  })

  it("records again after moving to another position", () => {
    const state = playing([catalogTrack(10), catalogTrack(11)])
    const moved = moveTo(state, 1, true)

    expect(listenToRecord(state.listenId, moved)).toEqual({ listenId: moved.listenId, musicId: 11 })
  })

  it("sample tracks are not counted", () => {
    const state = playing(DEFAULT_TRACKS)

    expect(listenToRecord(null, state)).toEqual({ listenId: state.listenId, musicId: null })
  })
})

describe("parsePlaybackState", () => {
  it("an old v1 state is ignored", () => {
    const old = { source: { kind: "track", queue: [] }, currentTrackId: "1", isPlaying: true }

    expect(parsePlaybackState(old)).toBeNull()
  })

  it("a restored state comes back paused", () => {
    const saved = JSON.parse(JSON.stringify(playing(DEFAULT_TRACKS, 2))) as unknown

    expect(parsePlaybackState(saved)).toMatchObject({ currentIndex: 2, isPlaying: false })
  })

  it("an index outside the queue is ignored", () => {
    const saved = { ...playing(DEFAULT_TRACKS.slice(0, 2)), currentIndex: 5 }

    expect(parsePlaybackState(saved)).toBeNull()
  })
})

describe("isPlayingFrom", () => {
  it("isPlayingFrom reads the origin", () => {
    const fromPlaylist = startQueue(null, DEFAULT_TRACKS, 0, PLAYLIST_ORIGIN)

    expect(isPlayingFrom(fromPlaylist, "7")).toBe(true)
    expect(isPlayingFrom(fromPlaylist, "8")).toBe(false)
    expect(isPlayingFrom(playing(DEFAULT_TRACKS), "7")).toBe(false)
  })
})
