import { RequireSession } from "@/components/require-session"

// The player plays the signed-in user's catalog
export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <RequireSession>{children}</RequireSession>
}
