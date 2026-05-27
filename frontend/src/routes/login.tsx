import { useEffect } from "react"
import { useNavigate } from "react-router"

import { useAuth } from "@/providers/auth-provider"
import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate("/", { replace: true })
  }, [user, navigate])

  if (user) return null

  return (
    <div className="w-full max-w-sm">
      <LoginForm />
    </div>
  )
}
