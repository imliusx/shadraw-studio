import { Outlet } from "react-router"

import { AuthShellHeader } from "@/components/auth/auth-shell-header"
import { Meteors } from "@/components/ui/meteors"

export function AuthShell() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <div className="absolute inset-0 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_0%,black_46%,transparent_78%)]">
        <Meteors
          number={32}
          minDelay={0.1}
          maxDelay={1.8}
          minDuration={3}
          maxDuration={9}
          angle={215}
        />
      </div>
      <div className="absolute inset-0 bg-background/35" />
      <div className="relative z-10 flex min-h-svh flex-col">
        <AuthShellHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
