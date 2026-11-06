import { RequireSubscription } from "@/components/require-subscription"

// A genre page plays from the catalog, which is for subscribers
export default function GenreLayout({ children }: { children: React.ReactNode }) {
  return <RequireSubscription>{children}</RequireSubscription>
}
