"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/app/providers/auth-provider"
import { Spinner } from "@/components/ui/spinner"

export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, isInitializing } = useAuth()

  useEffect(() => {
    if (isInitializing) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (user.role !== "admin") {
      router.replace("/")
    }
  }, [isInitializing, user, router])

  if (isInitializing || !user || user.role !== "admin") {
    return (
      <div className="flex h-dvh w-full items-center justify-center text-muted-foreground">
        <Spinner />
      </div>
    )
  }
  return <>{children}</>
}
