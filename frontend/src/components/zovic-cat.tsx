import Image from "next/image"
import { cn } from "@/lib/utils"

// The Zovic cat, the brand mascot. Always decorative: the "Zovic" name beside it, or the content
// it sits on, already says what it is. `className` sets the height; the width follows the image
export function ZovicCat({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/zovic-cat.png"
      alt=""
      aria-hidden="true"
      width={480}
      height={600}
      priority={priority}
      className={cn("pointer-events-none w-auto select-none", className)}
    />
  )
}
