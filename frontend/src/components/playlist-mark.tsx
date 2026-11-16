import { HeartIcon } from "@/components/icons"
import { getPlaylistInitials } from "@/lib/playlist-store"

// What a playlist's sleeve prints: a heart on "Músicas Curtidas" (HU-34), the initials on any other
export function PlaylistMark({ name, isLikedSongs, iconSize }: { name: string; isLikedSongs?: boolean; iconSize: number }) {
  if (isLikedSongs) return <HeartIcon size={iconSize} className="inline-block" />
  return <>{getPlaylistInitials(name)}</>
}
