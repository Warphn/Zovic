import { getContrastTextColor } from "@/components/color-picker"
import { Record } from "@/components/playback-marks"
import { cn } from "@/lib/utils"

// A record sleeve in the playlist color, with the printed frame around its artwork and the
// playlist initials. `className` sets its size and position.
export function Sleeve({ color, initials, className }: { color: string; initials: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-md",
        "shadow-[0_1px_2px_rgba(23,21,18,0.12),0_16px_32px_-16px_rgba(23,21,18,0.45)]",
        getContrastTextColor(color),
        className
      )}
      style={{ backgroundColor: color }}
    >
      {/* Printed frame, like the rule around a sleeve's artwork */}
      <div className="pointer-events-none absolute inset-3 rounded-sm border border-current opacity-25" />
      <span className="select-none text-6xl font-medium tracking-[-0.03em]">{initials}</span>
    </div>
  )
}

// The playlist cover as a record sleeve, with the record half out of it. While the playlist
// plays, the record slides a little further out and turns
export function RecordSleeve({ color, initials, playing }: { color: string; initials: string; playing: boolean }) {
  return (
    <div className="relative h-48 w-64 shrink-0 md:h-52 md:w-72">
      {/* Record */}
      <div
        className={cn(
          "absolute top-2 left-0 size-44 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:size-48",
          playing ? "translate-x-20" : "translate-x-14"
        )}
      >
        <Record
          color={color}
          playing={playing}
          className="size-full shadow-[0_8px_20px_-10px_rgba(23,21,18,0.6)]"
        />
      </div>

      <Sleeve color={color} initials={initials} className="z-10 size-48 md:size-52" />
    </div>
  )
}
