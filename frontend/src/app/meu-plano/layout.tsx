import { RequireSession } from "@/components/require-session"

// The account's own subscription
export default function MyPlanLayout({ children }: { children: React.ReactNode }) {
  return <RequireSession>{children}</RequireSession>
}
