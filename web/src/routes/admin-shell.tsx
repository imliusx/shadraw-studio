import { Outlet } from "react-router"

import { AppHeader } from "@/components/app-header"

export function AdminShell() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}
