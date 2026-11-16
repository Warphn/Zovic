import { RequireSubscription } from "@/components/require-subscription"

// An artist page plays from the catalog, which is for subscribers
export default function ArtistLayout({ children }: { children: React.ReactNode }) {
  return <RequireSubscription>{children}</RequireSubscription>
}
