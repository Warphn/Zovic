"use client"

import * as React from "react"
import { useActiveUser } from "@/lib/user-store"
import { cn } from "@/lib/utils"

// Uma cor de avatar por posição na lista, só para diferenciar os perfis
const AVATAR_HUES = [175, 25, 265, 340, 210]

function hueFor(index: number): number {
  return AVATAR_HUES[index % AVATAR_HUES.length] ?? 175
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.charAt(0) ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : ""
  return (first + last).toUpperCase()
}

function Avatar({ name, hue }: { name: string; hue: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-foreground"
      style={{ backgroundColor: `hsl(${hue} 60% 50% / 0.22)` }}
    >
      {getInitials(name)}
    </span>
  )
}

export function UserSwitcher() {
  const { user, setUser, users } = useActiveUser()
  const [open, setOpen] = React.useState(false)
  const listId = React.useId()

  const rootRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  const activeIndex = Math.max(
    0,
    users.findIndex((u) => u.id === user.id),
  )

  // Fecha ao clicar fora ou ao pressionar Esc (sem fechar o painel de comentários junto)
  React.useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && rootRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }

    if (open) {
      document.addEventListener("pointerdown", handlePointerDown)
      document.addEventListener("keydown", handleKeyDown)
    }
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  // Ao abrir, o foco vai para o perfil ativo
  React.useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus()
  }, [open, activeIndex])

  const handleOptionKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = users.length - 1
    let next: number | null = null

    if (e.key === "ArrowDown") next = index === last ? 0 : index + 1
    else if (e.key === "ArrowUp") next = index === 0 ? last : index - 1
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = last

    if (next === null) return
    e.preventDefault()
    optionRefs.current[next]?.focus()
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Perfil ativo: ${user.name}. Alternar perfil`}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 py-1 pl-1 pr-3 text-sm font-medium text-foreground transition-colors cursor-pointer",
          "hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          open && "bg-surface",
        )}
      >
        <Avatar name={user.name} hue={hueFor(activeIndex)} />
        <span className="max-w-[10rem] truncate">{user.name}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn("shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          aria-label="Perfis de usuário"
          className="absolute left-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-border bg-background p-1 shadow-xl animate-in fade-in duration-150 md:left-auto md:right-0"
        >
          {users.map((u, idx) => {
            const isActive = u.id === user.id
            return (
              <li key={u.id}>
                <button
                  ref={(el) => {
                    optionRefs.current[idx] = el
                  }}
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => {
                    setUser(u)
                    setOpen(false)
                    triggerRef.current?.focus()
                  }}
                  onKeyDown={(e) => handleOptionKeyDown(e, idx)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors cursor-pointer",
                    "focus-visible:outline-none focus-visible:bg-surface",
                    isActive
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                >
                  <Avatar name={u.name} hue={hueFor(idx)} />
                  <span className="flex-1 truncate">{u.name}</span>
                  {isActive && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="shrink-0 text-primary"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}