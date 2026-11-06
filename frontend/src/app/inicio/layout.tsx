import { RequireSubscription } from "@/components/require-subscription"

// The home page plays from the catalog, which is for subscribers
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <RequireSubscription>{children}</RequireSubscription>
}
