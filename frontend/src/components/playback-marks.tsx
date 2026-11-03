import { cn } from "@/lib/utils"

// Three level bars for what is playing. They only move while it plays, and stay still for
// people who ask for reduced motion
export function LevelBars({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span className={cn("flex h-3 items-end gap-0.5", className)} aria-hidden="true">
      {[0, -0.4, -0.8].map((delay) => (
        <span
          key={delay}
          className={cn(
            "h-full w-0.5 origin-bottom rounded-full bg-current",
            playing ? "motion-safe:animate-level" : "scale-y-50"
          )}
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  )
}

// Grooves of a vinyl record, with light catching them so the turning is visible
export const RECORD_BACKGROUND = [
  "conic-gradient(from 20deg, transparent 0 18%, rgb(255 255 255 / 0.08) 24%, transparent 30% 68%, rgb(255 255 255 / 0.08) 74%, transparent 80%)",
  "repeating-radial-gradient(circle, #1f1c18 0 1px, #151310 1px 3px)",
].join(", ")

// A small record with a center label in the playlist color; it turns while `playing`
export function Record({ color, playing, className }: { color: string; playing: boolean; className?: string }) {
  return (
    <div
      className={cn("relative rounded-full", playing && "motion-safe:animate-record", className)}
      style={{ background: RECORD_BACKGROUND }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 m-auto flex size-[36%] items-center justify-center rounded-full" style={{ backgroundColor: color }}>
        <div className="size-[18%] min-h-1 min-w-1 rounded-full bg-background" />
      </div>
    </div>
  )
}
