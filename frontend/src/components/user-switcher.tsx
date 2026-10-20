"use client"

import * as React from "react"
import { useActiveUser } from "@/lib/user-store"
import { Badge } from "@/components/ui/badge"

export function UserSwitcher() {
  const { user, setUser, users } = useActiveUser()

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-mono">
        <span className="text-muted-foreground hidden sm:inline">Perfil:</span>
        <select
          value={user.id}
          onChange={(e) => {
            const selected = users.find((u) => u.id === Number(e.target.value))
            if (selected) setUser(selected)
          }}
          className="bg-surface text-foreground border border-border rounded px-2 py-1 text-xs font-sans cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="Alternar perfil de usuário"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <Badge
        variant="outline"
        className={`text-[10px] uppercase font-mono px-1.5 py-0 ${
          user.isUnderage
            ? "border-amber-500/50 text-amber-500 bg-amber-500/10"
            : "border-emerald-500/50 text-emerald-500 bg-emerald-500/10"
        }`}
      >
        {user.isUnderage ? "Menor de Idade" : "Maior de 18"}
      </Badge>
    </div>
  )
}

