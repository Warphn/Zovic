import { RequireSubscription } from "@/components/require-subscription"

// The history lists catalog musics, which are for subscribers
export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return <RequireSubscription>{children}</RequireSubscription>
}
