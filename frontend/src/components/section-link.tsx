"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

const PENDING_SECTION_KEY = "zovic_pending_section"

/** Smooth-scrolls to a landing section by id without putting a #hash in the URL. */
export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
}

interface SectionLinkProps extends Omit<React.ComponentProps<typeof Link>, "href"> {
  /** id of the section on the landing page */
  section: string
}

// Link to a landing section that never leaves a #hash in the URL: with a hash, clicking the
// same link again after scrolling away does nothing. On the landing page it scrolls in place;
// from other pages it goes to "/" and the landing page scrolls once it mounts.
// href stays "/#id" so opening in a new tab still works.
export function SectionLink({ section, onClick, ...props }: SectionLinkProps) {
  const pathname = usePathname()
  const router = useRouter()
  return (
    <Link
      href={`/#${section}`}
      onClick={(e) => {
        onClick?.(e)
        // Let modified clicks (new tab, etc.) behave like a normal link
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        if (pathname === "/") {
          scrollToSection(section)
          return
        }
        try {
          sessionStorage.setItem(PENDING_SECTION_KEY, section)
        } catch {
          // storage unavailable: land at the top of the page
        }
        router.push("/")
      }}
      {...props}
    />
  )
}

/** Plain Link, except "/#id" hrefs, which become a SectionLink. */
export function SiteLink({ href, ...props }: React.ComponentProps<typeof Link> & { href: string }) {
  if (href.startsWith("/#")) return <SectionLink section={href.slice(2)} {...props} />
  return <Link href={href} {...props} />
}

/**
 * On the landing page: scroll to the section a SectionLink asked for from another page.
 * (A page opened at "/#id" directly is scrolled by the browser; a leftover hash is harmless,
 * since SectionLink scrolls on click instead of relying on the URL.)
 */
export function useLandingSectionScroll() {
  React.useEffect(() => {
    let pending: string | null = null
    try {
      pending = sessionStorage.getItem(PENDING_SECTION_KEY)
      sessionStorage.removeItem(PENDING_SECTION_KEY)
    } catch {
      // storage unavailable: nothing pending
    }
    if (!pending) return
    const target = pending
    requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView())
  }, [])
}
