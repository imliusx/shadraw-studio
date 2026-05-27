import { AppHeader } from "@/components/app-header"
import { AuthGuard } from "@/components/auth/auth-guard"
import { SettingsDialog } from "@/components/settings/settings-dialog"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <AppHeader />
      {children}
      <SettingsDialog />
    </AuthGuard>
  )
}
