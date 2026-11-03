import * as React from "react"
import { AlertIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

/** An inline message: an error (announced right away) or neutral information. */
export function Notice({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
        tone === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-muted/20"
      )}
    >
      {tone === "error" && <AlertIcon size={16} className="mt-0.5" />}
      <span>{children}</span>
    </div>
  )
}
