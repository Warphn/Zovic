import { describe, expect, it } from "bun:test"
import {
  DEFAULT_VOLUME,
  getAudioSnapshot,
  markUnavailable,
  reportProgress,
  seekTo,
  setVolume,
  toggleMute,
} from "./audio-player"

describe("audio player", () => {
  it("starts at the default volume", () => {
    expect(getAudioSnapshot().volume).toBe(DEFAULT_VOLUME)
  })

  it("setVolume clamps to 0..1 and unmutes", () => {
    toggleMute()
    setVolume(1.4)

    expect(getAudioSnapshot()).toMatchObject({ volume: 1, isMuted: false })
    setVolume(-0.2)
    expect(getAudioSnapshot().volume).toBe(0)
  })

  it("seekTo stays inside the track", () => {
    reportProgress(0, 100)

    seekTo(150)
    expect(getAudioSnapshot().currentTime).toBe(100)
    seekTo(-3)
    expect(getAudioSnapshot().currentTime).toBe(0)
  })

  it("marks a track unavailable once", () => {
    markUnavailable("7")
    markUnavailable("7")

    expect(getAudioSnapshot().unavailableTrackIds.size).toBe(1)
    expect(getAudioSnapshot().unavailableTrackIds.has("7")).toBe(true)
  })
})
