import { cn } from "@/lib/utils"

/** The "E" next to a track with explicit content (minors never see those tracks). */
export function ExplicitMark({ className }: { className?: string }) {
  return (
    <abbr
      title="Conteúdo explícito"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-current/15 text-[9px] font-bold leading-none no-underline",
        className
      )}
    >
      E
    </abbr>
  )
}
