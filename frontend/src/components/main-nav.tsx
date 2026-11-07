"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HistoryIcon, HomeIcon, ListIcon, PlayIcon } from "@/components/icons"
import { isNavLinkActive } from "@/lib/main-nav"
import { cn } from "@/lib/utils"

// The pages a subscriber goes back to all the time. Search has its own bar in the header.
const MAIN_NAV_LINKS = [
  { label: "Início", href: "/inicio", Icon: HomeIcon },
  { label: "Playlists", href: "/playlist", Icon: ListIcon },
  { label: "Histórico", href: "/historico", Icon: HistoryIcon },
  { label: "Tocando", href: "/player", Icon: PlayIcon },
]

/**
 * The links beside the logo, from 1024 px. Only their icon shows, the name goes in the tooltip
 * and to screen readers: with the labels they would run into the centered search at any width.
 */
export function MainNavBar({ className }: { className?: string }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Principal" className={cn("items-center gap-1", className)}>
      {MAIN_NAV_LINKS.map(({ label, href, Icon }) => (
        <Link
          key={href}
          href={href}
          title={label}
          aria-current={isNavLinkActive(href, pathname) ? "page" : undefined}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 aria-[current=page]:bg-foreground/5 aria-[current=page]:text-foreground"
        >
          <Icon size={18} />
          <span className="sr-only">{label}</span>
        </Link>
      ))}
    </nav>
  )
}

/** The same links in the ☰ menu, one per row. */
export function MainNavList({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Principal" className="flex flex-col">
      {MAIN_NAV_LINKS.map(({ label, href, Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={isNavLinkActive(href, pathname) ? "page" : undefined}
          className="flex items-center gap-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground"
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </nav>
  )
}
