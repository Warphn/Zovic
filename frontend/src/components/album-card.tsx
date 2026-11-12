import Link from "next/link"
import { AlbumCoverImage } from "@/components/album-cover-image"
import { PlayIcon } from "@/components/icons"
import type { Album, CatalogMusic } from "@/lib/api/catalog"
import { tracksOfAlbum } from "@/lib/home"
import { playQueue } from "@/lib/playback-store"
import { musicToTrack } from "@/lib/playlist-store"

/** An album in a grid: the cover opens the album page, and the button on it plays the album. */
export function AlbumCard({ album, musics }: { album: Album; musics: CatalogMusic[] }) {
  const tracks = tracksOfAlbum(musics, album.id).map(musicToTrack)
  const artists = album.artists.map((artist) => artist.name).join(", ")
  const meta = [artists, album.year].filter(Boolean).join(" · ")

  return (
    <div className="group relative">
      <Link
        href={`/album/${album.id}`}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        <AlbumCoverImage album={album} className="aspect-square w-full text-3xl" />
        <span className="mt-3 block truncate text-sm font-medium">{album.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </Link>
      {/* Beside the link, never inside it: the card opens the album, the button plays it */}
      {tracks.length > 0 && (
        <button
          type="button"
          onClick={() => playQueue(tracks, 0)}
          aria-label={`Tocar ${album.name}`}
          title={`Tocar ${album.name}`}
          className="absolute top-3 right-3 flex size-10 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [@media(hover:none)]:opacity-100"
        >
          <PlayIcon size={16} />
        </button>
      )}
    </div>
  )
}
