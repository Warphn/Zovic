import * as React from "react"
import { Label } from "@/components/ui/label"

/** A label above its control; `id` ties them together. */
export function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
