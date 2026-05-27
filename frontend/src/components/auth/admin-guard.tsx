import { useEffect } from "react"
import { Outlet, useNavigate } from "react-router"

import { useAuth } from "@/providers/auth-provider"
import { Spinner } from "@/components/ui/spinner"

export function AdminGuard() {
  const navigate = useNavigate()
  const { user, isInitializing } = useAuth()

  useEffect(() => {
    if (isInitializing) return
    if (!user) {
      navigate("/login", { replace: true })
      return
    }
    if (user.role !== "admin") {
      navigate("/", { replace: true })
    }
  }, [isInitializing, user, navigate])

  if (isInitializing || !user || user.role !== "admin") {
    return (
      <div className="flex h-dvh w-full items-center justify-center text-muted-foreground">
        <Spinner />
      </div>
    )
  }
  return <Outlet />
}
