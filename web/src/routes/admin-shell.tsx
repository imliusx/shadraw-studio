import { Outlet } from "react-router"

import { AppHeader } from "@/components/app-header"

export function AdminShell() {
  return (
    <div className="min-h-svh pt-14">
      <AppHeader />
      <Outlet />
    </div>
  )
}
