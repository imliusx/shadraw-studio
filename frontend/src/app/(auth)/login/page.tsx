"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/app/providers/auth-provider"
import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) router.replace("/")
  }, [user, router])

  if (user) return null

  return (
    <div className="w-full max-w-sm">
      <LoginForm />
    </div>
  )
}
