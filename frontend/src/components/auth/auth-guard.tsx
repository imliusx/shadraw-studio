"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/app/providers/auth-provider"
import { Spinner } from "@/components/ui/spinner"

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, isInitializing } = useAuth()

  useEffect(() => {
    if (!isInitializing && !user) {
      router.replace("/login")
    }
  }, [isInitializing, user, router])

  if (isInitializing || !user) {
    return (
      <div className="flex h-dvh w-full items-center justify-center text-muted-foreground">
        <Spinner />
      </div>
    )
  }
  return <>{children}</>
}
