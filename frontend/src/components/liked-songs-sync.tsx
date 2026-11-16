"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { likedMusicsApi, playlistKeys } from "@/lib/api/playlists"
import { useSession } from "@/lib/auth/client"
import { musicIdsToSync } from "@/lib/liked-songs-sync"
import { useLikedTracks } from "@/lib/likes-store"

// Sent once per account in each browser session
const SYNCED_KEY_PREFIX = "zovic_liked_songs_synced_"

// Puts the hearts this browser already had into "Músicas Curtidas" (HU-34), once per session, so
// a heart given before the playlist existed is not a heart with an empty playlist. Draws nothing.
export function LikedSongsSync() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const userId = Number(session?.user.id) || 0
  const { likedTrackIds } = useLikedTracks(userId)

  React.useEffect(() => {
    if (!userId || likedTrackIds.length === 0) return
    const syncedKey = `${SYNCED_KEY_PREFIX}${userId}`
    try {
      if (sessionStorage.getItem(syncedKey)) return
      sessionStorage.setItem(syncedKey, "1")
    } catch {
      return
    }
    const sendInOrder = async () => {
      // One after the other: each like goes on top, so the order of the hearts is kept
      for (const musicId of musicIdsToSync(likedTrackIds)) await likedMusicsApi.like(musicId).catch(() => {})
      await queryClient.invalidateQueries({ queryKey: playlistKeys.all })
    }
    void sendInOrder()
  }, [userId, likedTrackIds, queryClient])

  return null
}
