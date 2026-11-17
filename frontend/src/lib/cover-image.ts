// What the API takes as an image: album and playlist covers and artist photos (api/domain/shared/cover-image.ts).
// Repeated here only to warn before uploading; the API checks it again.

export const MAX_COVER_BYTES = 2 * 1024 * 1024

/** The image formats, as the file input's `accept`. */
export const COVER_ACCEPT = "image/jpeg,image/png,image/webp"

/** Why the API would refuse this file by its size; null when the size is fine. */
export function coverSizeError(file: File): string | null {
  return file.size > MAX_COVER_BYTES ? "A imagem pode ter no máximo 2 MB." : null
}
