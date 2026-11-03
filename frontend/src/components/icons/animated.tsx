"use client"

import * as React from "react"
import { CircleAlert, LogOut, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import type { IconProps, VolumeIconProps } from "./types"
import { ArrowLeftIcon as AnimatedArrowLeft } from "./lucide-animated/arrow-left"
import { ArrowRightIcon as AnimatedArrowRight } from "./lucide-animated/arrow-right"
import { HeartIcon as AnimatedHeart } from "./lucide-animated/heart"
import { LayoutGridIcon as AnimatedLayoutGrid } from "./lucide-animated/layout-grid"
import { MenuIcon as AnimatedMenu } from "./lucide-animated/menu"
import { PauseIcon as AnimatedPause } from "./lucide-animated/pause"
import { PlayIcon as AnimatedPlay } from "./lucide-animated/play"
import { PlusIcon as AnimatedPlus } from "./lucide-animated/plus"
import { SearchIcon as AnimatedSearch } from "./lucide-animated/search"
import { XIcon as AnimatedX } from "./lucide-animated/x"
import { UserIcon as AnimatedUser } from "./lucide-animated/user"
import { ListIcon as AnimatedList } from "./custom/list"

// Animated icon set: lucide-animated (https://lucide-animated.com, MIT, copied into
// ./lucide-animated), our own animated list (./custom/list), and static lucide-react icons
// where neither has an animated version.

interface AnimationHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

type AnimatedLucideIcon = React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLDivElement> & { size?: number } & React.RefAttributes<AnimationHandle>
>

// lucide-animated icons animate when the icon itself is hovered. Here they animate when the
// surrounding button or link is hovered or focused, which is the area people actually aim at.
function ParentHoverIcon({
  icon: Icon,
  size = 16,
  className,
  animateOnHover = true,
}: IconProps & { icon: AnimatedLucideIcon }) {
  const iconRef = React.useRef<AnimationHandle>(null)
  const wrapperRef = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    const wrapper = wrapperRef.current
    const target = wrapper?.closest<HTMLElement>("button, a") ?? wrapper
    if (!target || !animateOnHover) return
    const start = () => iconRef.current?.startAnimation()
    const stop = () => iconRef.current?.stopAnimation()
    target.addEventListener("mouseenter", start)
    target.addEventListener("mouseleave", stop)
    target.addEventListener("focus", start)
    target.addEventListener("blur", stop)
    return () => {
      target.removeEventListener("mouseenter", start)
      target.removeEventListener("mouseleave", stop)
      target.removeEventListener("focus", start)
      target.removeEventListener("blur", stop)
    }
  }, [animateOnHover])

  return (
    <span ref={wrapperRef} aria-hidden="true" className={cn("inline-flex shrink-0", className)}>
      <Icon ref={iconRef} size={size} className="flex" />
    </span>
  )
}

function withParentHover(icon: AnimatedLucideIcon, displayName: string) {
  const Wrapped = (props: IconProps) => <ParentHoverIcon icon={icon} {...props} />
  Wrapped.displayName = displayName
  return Wrapped
}

function staticLucide(Icon: React.ComponentType<{ size?: number; className?: string }>) {
  return function StaticLucideIcon({ size = 16, className }: IconProps) {
    return <Icon size={size} className={cn("shrink-0", className)} aria-hidden="true" />
  }
}

export const CloseIcon = withParentHover(AnimatedX, "CloseIcon")
export const HeartIcon = withParentHover(AnimatedHeart, "HeartIcon")
export const PlayIcon = withParentHover(AnimatedPlay, "PlayIcon")
export const PauseIcon = withParentHover(AnimatedPause, "PauseIcon")
export const ArrowLeftIcon = withParentHover(AnimatedArrowLeft, "ArrowLeftIcon")
export const ArrowRightIcon = withParentHover(AnimatedArrowRight, "ArrowRightIcon")
export const SearchIcon = withParentHover(AnimatedSearch, "SearchIcon")
export const GridIcon = withParentHover(AnimatedLayoutGrid, "GridIcon")
export const MenuIcon = withParentHover(AnimatedMenu, "MenuIcon")
export const PlusIcon = withParentHover(AnimatedPlus, "PlusIcon")
export const ListIcon = withParentHover(AnimatedList, "ListIcon")
export const UserIcon = withParentHover(AnimatedUser, "UserIcon")

export const AlertIcon = staticLucide(CircleAlert)
export const LogOutIcon = staticLucide(LogOut)
export const SkipBackIcon = staticLucide(SkipBack)
export const SkipForwardIcon = staticLucide(SkipForward)

export function VolumeIcon({ level, size = 16, className }: VolumeIconProps) {
  const Icon = level === "muted" ? VolumeX : level === "low" ? Volume1 : Volume2
  return <Icon size={size} className={cn("shrink-0", className)} aria-hidden="true" />
}
