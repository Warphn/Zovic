// oxlint-disable jsx-a11y/label-has-associated-control
import * as React from "react"
import { cn } from "@/lib/utils"

export type LabelProps = React.ComponentProps<"label">

function Label({ className, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-xs font-medium tracking-wide text-foreground/80 select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
}

export { Label }
