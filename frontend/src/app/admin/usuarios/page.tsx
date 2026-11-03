"use client"

import * as React from "react"
import { Field, Loading, Notice, Section } from "@/components/admin/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { type AdminUser, adminApi, ApiError, formatDateTime, type NewUser } from "@/lib/admin/api"
import { useResource } from "@/lib/admin/use-resource"
import { useSession } from "@/lib/auth/client"

const EMPTY_USER: NewUser = { name: "", email: "", password: "", birthdate: "", role: "assinante" }

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Algo deu errado. Tente de novo."
}

export default function AdminUsersPage() {
  const { data: session } = useSession()
  const [search, setSearch] = React.useState("")
  const [query, setQuery] = React.useState("")
  const users = useResource(() => adminApi.listUsers(query), [query])
  const [creating, setCreating] = React.useState(false)
  const [removing, setRemoving] = React.useState<AdminUser | null>(null)
  const [playsOf, setPlaysOf] = React.useState<AdminUser | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  // Search as you type, without one request per keystroke
  React.useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const selfId = Number(session?.user.id)

  return (
    <Section
      title="Contas"
      description="Todas as contas, inclusive as removidas. Remover é soft delete: a pessoa perde o acesso e sai das estatísticas de usuários ativos."
      actions={
        <Button size="lg" onClick={() => setCreating(true)}>
          Nova conta
        </Button>
      }
    >
      <div className="space-y-4">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou email"
          aria-label="Buscar contas"
          className="max-w-sm"
        />
        {notice && <Notice tone="info">{notice}</Notice>}
        {users.error && <Notice>{users.error}</Notice>}
        {users.loading && !users.data ? (
          <Loading />
        ) : users.data && users.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta encontrada.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Conta</th>
                  <th className="px-2 py-2 font-medium">Papel</th>
                  <th className="px-2 py-2 text-right font-medium">Reproduções</th>
                  <th className="px-2 py-2 font-medium">Última reprodução</th>
                  <th className="px-2 py-2 font-medium">Criada em</th>
                  <th className="px-2 py-2">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data?.map((user) => (
                  <tr key={user.id} className="border-t border-border/70 align-middle">
                    <td className="px-2 py-2.5">
                      <div className={user.deletedAt ? "font-medium text-muted-foreground line-through" : "font-medium"}>
                        {user.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{user.email ?? "sem login"}</div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                          {user.role === "admin" ? "Admin" : "Assinante"}
                        </Badge>
                        {user.deletedAt && (
                          <Badge variant="destructive" className="text-[10px]">
                            Removida
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{user.plays.toLocaleString("pt-BR")}</td>
                    <td className="px-2 py-2.5 text-muted-foreground">{user.lastPlayAt ? formatDateTime(user.lastPlayAt) : "—"}</td>
                    <td className="px-2 py-2.5 text-muted-foreground">{formatDateTime(user.createdAt)}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" onClick={() => setPlaysOf(user)}>
                          Reproduções
                        </Button>
                        {!user.deletedAt && user.id !== selfId && (
                          <Button variant="destructive" onClick={() => setRemoving(user)}>
                            Remover
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateUserDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(user) => {
          setNotice(`Conta de ${user.name} criada. A pessoa já pode entrar com o email e a senha definidos.`)
          users.reload()
        }}
      />
      <RemoveUserDialog
        user={removing}
        onClose={() => setRemoving(null)}
        onRemoved={(user) => {
          setNotice(`Conta de ${user.name} removida.`)
          users.reload()
        }}
      />
      <RecentPlaysDialog user={playsOf} onClose={() => setPlaysOf(null)} />
    </Section>
  )
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (user: AdminUser) => void
}) {
  const [form, setForm] = React.useState<NewUser>(EMPTY_USER)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const set = (field: keyof NewUser) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [field]: e.target.value }))

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setForm(EMPTY_USER)
      setError(null)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.")
      return
    }
    setSaving(true)
    try {
      const user = await adminApi.createUser(form)
      onCreated(user)
      close(false)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conta</DialogTitle>
          <DialogDescription>A conta entra com login por email e senha. Passe a senha para a pessoa por um canal seguro.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nome" id="new-name">
            <Input id="new-name" required value={form.name} onChange={set("name")} maxLength={150} />
          </Field>
          <Field label="Email" id="new-email">
            <Input id="new-email" type="email" required value={form.email} onChange={set("email")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Senha" id="new-password">
              <Input id="new-password" type="password" required minLength={8} maxLength={128} value={form.password} onChange={set("password")} />
            </Field>
            <Field label="Data de nascimento" id="new-birthdate">
              <Input id="new-birthdate" type="date" required value={form.birthdate} onChange={set("birthdate")} />
            </Field>
          </div>
          <Field label="Papel" id="new-role">
            <select
              id="new-role"
              value={form.role}
              onChange={set("role")}
              className="flex h-9 w-full rounded-md border border-input bg-surface/90 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <option value="assinante">Assinante</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          {error && <Notice>{error}</Notice>}
          <DialogFooter>
            <Button type="button" variant="ghost" size="lg" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? "Criando…" : "Criar conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RemoveUserDialog({
  user,
  onClose,
  onRemoved,
}: {
  user: AdminUser | null
  onClose: () => void
  onRemoved: (user: AdminUser) => void
}) {
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const close = () => {
    setError(null)
    onClose()
  }

  const confirm = async () => {
    if (!user) return
    setSaving(true)
    try {
      await adminApi.removeUser(user.id)
      onRemoved(user)
      close()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover a conta de {user?.name}?</DialogTitle>
          <DialogDescription>
            As sessões abertas são encerradas e a pessoa não consegue mais entrar. O histórico (reproduções, playlists) fica guardado.
          </DialogDescription>
        </DialogHeader>
        {error && <Notice>{error}</Notice>}
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={close}>
            Cancelar
          </Button>
          <Button variant="destructive" size="lg" onClick={confirm} disabled={saving}>
            {saving ? "Removendo…" : "Remover conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RecentPlaysDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const userId = user?.id
  const plays = useResource(() => (userId ? adminApi.recentPlays(userId) : Promise.resolve([])), [userId])

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Reproduções recentes</DialogTitle>
          <DialogDescription>{user?.name}: as últimas 50, da mais recente para a mais antiga.</DialogDescription>
        </DialogHeader>
        {plays.error ? (
          <Notice>{plays.error}</Notice>
        ) : plays.loading ? (
          <Loading />
        ) : plays.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma reprodução registrada.</p>
        ) : (
          <ol className="max-h-[60vh] space-y-0.5 overflow-y-auto">
            {plays.data?.map((play, index) => (
              <li key={`${play.at}-${index}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/20">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {play.musicName}
                    {play.musicDeleted && <span className="ml-1.5 text-xs font-normal text-destructive">(removida)</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{play.artists.join(", ")}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs tabular-nums text-muted-foreground">{formatDateTime(play.at)}</div>
                  {play.event === "music_skip" && <div className="text-[10px] uppercase tracking-wide text-muted-foreground">pulada</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
