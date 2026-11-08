import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.ComponentProps<"input">

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-surface/90 px-3 py-1.5 text-sm text-foreground shadow-xs transition-colors outline-none",
          "placeholder:text-muted-foreground",
          // Focus in ink, like the header search: the red stays for actions and errors
          "focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/10",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
