import { RequireSession } from "@/components/require-session"

// Search covers the catalog, which is for signed-in users
export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <RequireSession>{children}</RequireSession>
}
