import { RequireSubscription } from "@/components/require-subscription"

// Playlists are for subscribers
export default function PlaylistLayout({ children }: { children: React.ReactNode }) {
  return <RequireSubscription>{children}</RequireSubscription>
}
