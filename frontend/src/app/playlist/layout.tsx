import { RequireSession } from "@/components/require-session"

// Playlists are for signed-in users
export default function PlaylistLayout({ children }: { children: React.ReactNode }) {
  return <RequireSession>{children}</RequireSession>
}
