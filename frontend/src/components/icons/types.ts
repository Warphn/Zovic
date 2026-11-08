export interface IconProps {
  /** Icon box in px (default 16) */
  size?: number
  className?: string
  /** Animated set only: play the animation when the parent button/link is hovered (default true) */
  animateOnHover?: boolean
}

export interface VolumeIconProps extends IconProps {
  level: "muted" | "low" | "high"
}
