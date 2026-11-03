"use client"

import type { Variants } from "motion/react"
import { motion, useAnimation } from "motion/react"
import type { HTMLAttributes } from "react"
import { forwardRef, useImperativeHandle } from "react"

// Animated Lucide "list" in the lucide-animated style (same handle API). lucide-animated has
// no list icon, so this one is ours: the rows redraw one after another.

export interface ListIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

interface ListIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number
}

const ROW_VARIANTS: Variants = {
  normal: { pathLength: 1, opacity: 1 },
  animate: (row: number) => ({
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: { duration: 0.3, delay: row * 0.1, ease: "easeOut" },
  }),
}

const DOT_VARIANTS: Variants = {
  normal: { scale: 1 },
  animate: (row: number) => ({
    scale: [1, 1.6, 1],
    transition: { duration: 0.3, delay: row * 0.1 },
  }),
}

const ROWS = [6, 12, 18]

const ListIcon = forwardRef<ListIconHandle, ListIconProps>(({ size = 28, ...props }, ref) => {
  const controls = useAnimation()

  useImperativeHandle(ref, () => ({
    startAnimation: () => controls.start("animate"),
    stopAnimation: () => controls.start("normal"),
  }))

  return (
    <div {...props}>
      <svg
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {ROWS.map((y, row) => (
          <motion.path
            key={`dot-${y}`}
            d={`M3 ${y}h.01`}
            animate={controls}
            custom={row}
            initial="normal"
            variants={DOT_VARIANTS}
          />
        ))}
        {ROWS.map((y, row) => (
          <motion.path
            key={`row-${y}`}
            d={`M8 ${y}h13`}
            animate={controls}
            custom={row}
            initial="normal"
            variants={ROW_VARIANTS}
          />
        ))}
      </svg>
    </div>
  )
})

ListIcon.displayName = "ListIcon"

export { ListIcon }
