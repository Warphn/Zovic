import Header from "@/components/header"
import { AdminNav } from "@/components/admin/admin-nav"
import { RequireAdmin } from "@/components/admin/require-admin"

// Platform admin panel: accounts, catalog and usage stats
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground">
        <Header />
        <main className="flex-1 pt-16">
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 md:px-8 py-10">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[var(--color-red)]">Painel de admin</h1>
            <div className="mt-6">
              <AdminNav />
            </div>
            <div className="mt-8">{children}</div>
          </div>
        </main>
      </div>
    </RequireAdmin>
  )
}
