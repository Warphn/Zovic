"use client"

import * as React from "react"
import {
  Check,
  CircleAlert,
  Flag,
  Headphones,
  Pencil,
  SkipBack,
  SkipForward,
  ThumbsDown,
  Trash2,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react"
import { motion, type TargetAndTransition, useAnimation } from "motion/react"
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
import { GalleryHorizontalEndIcon as AnimatedGalleryHorizontalEnd } from "./lucide-animated/gallery-horizontal-end"
import { FolderMinusIcon as AnimatedFolderMinus } from "./lucide-animated/folder-minus"
import { HistoryIcon as AnimatedHistory } from "./lucide-animated/history"
import { HomeIcon as AnimatedHome } from "./lucide-animated/home"
import { LogoutIcon as AnimatedLogout } from "./lucide-animated/logout"
import { ShieldCheckIcon as AnimatedShieldCheck } from "./lucide-animated/shield-check"
import { FolderPlusIcon as AnimatedFolderPlus } from "./lucide-animated/folder-plus"
import { MessageSquareIcon as AnimatedMessageSquare } from "./lucide-animated/message-square"
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

// A lucide-react icon with a short motion of our own, for an icon lucide-animated does not have
// (the thumbs down).
// Same handle as the lucide-animated icons, so withParentHover plays it on the button's hover.
function motionLucide(
  Icon: React.ComponentType<{ size?: number; className?: string }>,
  animate: TargetAndTransition,
  displayName: string
): AnimatedLucideIcon {
  const MotionIcon = React.forwardRef<AnimationHandle, React.HTMLAttributes<HTMLDivElement> & { size?: number }>(
    ({ size = 16, className }, ref) => {
      const controls = useAnimation()
      React.useImperativeHandle(ref, () => ({
        startAnimation: () => void controls.start("animate"),
        stopAnimation: () => void controls.start("normal"),
      }))
      return (
        <motion.div animate={controls} variants={{ normal: { x: 0, y: 0, rotate: 0, scale: 1 }, animate }} className={className}>
          <Icon size={size} className="shrink-0" />
        </motion.div>
      )
    }
  )
  MotionIcon.displayName = displayName
  return MotionIcon
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
// The play queue: a card in front with more stacked behind it, like the player itself
export const QueueIcon = withParentHover(AnimatedGalleryHorizontalEnd, "QueueIcon")

export const AlertIcon = staticLucide(CircleAlert)
export const CheckIcon = staticLucide(Check)
export const FlagIcon = staticLucide(Flag)
export const TrashIcon = staticLucide(Trash2)
export const HomeIcon = withParentHover(AnimatedHome, "HomeIcon")
export const HistoryIcon = withParentHover(AnimatedHistory, "HistoryIcon")
export const LogOutIcon = withParentHover(AnimatedLogout, "LogOutIcon")
export const ShieldIcon = withParentHover(AnimatedShieldCheck, "ShieldIcon")
export const SkipBackIcon = staticLucide(SkipBack)
export const SkipForwardIcon = staticLucide(SkipForward)
export const PencilIcon = staticLucide(Pencil)
// A playlist as a folder of tracks: adding to one, taking out of one
export const FolderPlusIcon = withParentHover(AnimatedFolderPlus, "FolderPlusIcon")
export const FolderMinusIcon = withParentHover(AnimatedFolderMinus, "FolderMinusIcon")
// The comments of a track
export const CommentIcon = withParentHover(AnimatedMessageSquare, "CommentIcon")
// A music already listened to (HU-15)
export const HeadphonesIcon = staticLucide(Headphones)
// Dislike: the thumb nods down
export const ThumbsDownIcon = withParentHover(
  motionLucide(ThumbsDown, { y: [0, 2, 0], rotate: [0, -12, 0], transition: { duration: 0.4 } }, "AnimatedThumbsDown"),
  "ThumbsDownIcon"
)
export const DislikeIcon = ThumbsDownIcon

export function VolumeIcon({ level, size = 16, className }: VolumeIconProps) {
  const Icon = level === "muted" ? VolumeX : level === "low" ? Volume1 : Volume2
  return <Icon size={size} className={cn("shrink-0", className)} aria-hidden="true" />
}
