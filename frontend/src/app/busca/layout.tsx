import { RequireSubscription } from "@/components/require-subscription"

// Search covers the catalog, which is for subscribers
export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <RequireSubscription>{children}</RequireSubscription>
}
