import { RequireSubscription } from "@/components/require-subscription"

// An album page plays from the catalog, which is for subscribers
export default function AlbumLayout({ children }: { children: React.ReactNode }) {
  return <RequireSubscription>{children}</RequireSubscription>
}
