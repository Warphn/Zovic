"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { label: "Visão geral", href: "/admin" },
  { label: "Usuários", href: "/admin/usuarios" },
  { label: "Conteúdo", href: "/admin/conteudo" },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Seções do painel" className="flex gap-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-t-md",
              active
                ? "border-[var(--color-red)] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
