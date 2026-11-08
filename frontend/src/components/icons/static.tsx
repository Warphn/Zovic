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
export const QueueIcon = svg(
  <>
    <path d="M6 5v14M2 7v10" />
    <rect width="12" height="18" x="10" y="3" rx="2" />
  </>
)
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
export const ShieldIcon = svg(
  <>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </>
)
export const SkipBackIcon = glyph("⏮")
export const SkipForwardIcon = glyph("⏭")

export const PencilIcon = svg(
  <>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    <path d="m15 5 4 4" />
  </>
)
export const ListPlusIcon = svg(<path d="M11 12H3M16 6H3M16 18H3M18 9v6M21 12h-6" />)
export const HomeIcon = svg(
  <>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </>
)
export const HistoryIcon = svg(
  <>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </>
)
export const ListMinusIcon = svg(<path d="M11 12H3M16 6H3M16 18H3M21 12h-6" />)

export function VolumeIcon({ level, size = 16, className }: VolumeIconProps) {
  const char = level === "muted" ? "🔇" : level === "low" ? "🔉" : "🔊"
  return glyph(char)({ size, className })
}
