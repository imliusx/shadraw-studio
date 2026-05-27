import { Outlet } from "react-router"

import { AuthShellHeader } from "@/components/auth/auth-shell-header"

export function AuthShell() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AuthShellHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Outlet />
      </main>
    </div>
  )
}
