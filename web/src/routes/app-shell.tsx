import { Outlet } from "react-router"

import { AppHeader } from "@/components/app-header"
import { SettingsDialog } from "@/components/settings/settings-dialog"

export function AppShell() {
  return (
    <div className="min-h-svh pt-14">
      <AppHeader />
      <Outlet />
      <SettingsDialog />
    </div>
  )
}
