import { cn } from "@/lib/utils"
import type { IconProps, VolumeIconProps } from "./types"

// The icons the app used before the animated set: text glyphs and a few inline SVGs.
// Kept so the switch in ./index.ts can go back to them.

function glyph(char: string) {
  return function GlyphIcon({ size = 16, className }: IconProps) {
    return (
      <span
        aria-hidden="true"
        className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}
        style={{ fontSize: size, width: size, height: size }}
      >
        {char}
      </span>
    )
  }
}

function svg(children: React.ReactNode) {
  return function SvgIcon({ size = 16, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn("shrink-0", className)}
      >
        {children}
      </svg>
    )
  }
}

export const CloseIcon = svg(<path d="M18 6 6 18M6 6l12 12" />)
export const HeartIcon = glyph("♥")
export const PlayIcon = glyph("▶")
export const PauseIcon = glyph("❚❚")
export const ArrowLeftIcon = glyph("←")
export const ArrowRightIcon = glyph("→")
export const SearchIcon = svg(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>
)
export const GridIcon = svg(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </>
)
export const ListIcon = svg(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />)
export const MenuIcon = svg(<path d="M3 6h18M3 12h18M3 18h18" />)
export const PlusIcon = glyph("+")
export const AlertIcon = svg(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </>
)
export const UserIcon = svg(
  <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>
)
export const LogOutIcon = svg(<path d="m16 17 5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />)
export const SkipBackIcon = glyph("⏮")
export const SkipForwardIcon = glyph("⏭")

export function VolumeIcon({ level, size = 16, className }: VolumeIconProps) {
  const char = level === "muted" ? "🔇" : level === "low" ? "🔉" : "🔊"
  return glyph(char)({ size, className })
}
