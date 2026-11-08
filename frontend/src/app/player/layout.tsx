import { RequireSubscription } from "@/components/require-subscription"

// The player plays the catalog, which is for subscribers
export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <RequireSubscription>{children}</RequireSubscription>
}
