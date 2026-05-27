import { useEffect } from "react"
import { useNavigate } from "react-router"

import { useAuth } from "@/providers/auth-provider"
import { RegisterForm } from "@/components/auth/register-form"

export default function RegisterPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate("/", { replace: true })
  }, [user, navigate])

  if (user) return null

  return (
    <div className="w-full max-w-sm">
      <RegisterForm />
    </div>
  )
}
