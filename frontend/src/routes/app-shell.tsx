import { Outlet } from "react-router"

import { AppHeader } from "@/components/app-header"
import { SettingsDialog } from "@/components/settings/settings-dialog"

export function AppShell() {
  return (
    <>
      <AppHeader />
      <Outlet />
      <SettingsDialog />
    </>
  )
}
