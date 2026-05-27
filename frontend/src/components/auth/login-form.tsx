"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { CircleAlert } from "lucide-react"
import { toast } from "sonner"

import { useConfig } from "@/app/providers/app-state-provider"
import { useAuth } from "@/app/providers/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/password-input"
import { Spinner } from "@/components/ui/spinner"
import { useMotionVariants } from "@/lib/motion"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldKey = "email" | "password"
type FieldErrors = Partial<Record<FieldKey, string>>

function validateEmail(value: string): string | null {
  if (!value.trim()) return "请输入有效的邮箱地址"
  return EMAIL_PATTERN.test(value) ? null : "请输入有效的邮箱地址"
}

function validatePassword(value: string): string | null {
  return value.length >= 8 ? null : "密码至少 8 位"
}

function runValidation(values: { email: string; password: string }): FieldErrors {
  return {
    email: validateEmail(values.email) ?? undefined,
    password: validatePassword(values.password) ?? undefined,
  }
}

export function LoginForm() {
  const router = useRouter()
  const { config } = useConfig()
  const { login, status, error, clearError } = useAuth()
  const { fadeInUp } = useMotionVariants()
  const siteTitle = config.siteTitle.trim() || "shadraw"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    email: false,
    password: false,
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  useEffect(() => {
    clearError()
  }, [clearError])

  const isSubmitting = status === "submitting"

  function fieldError(field: FieldKey): string | undefined {
    return touched[field] ? errors[field] : undefined
  }

  function handleBlur(field: FieldKey) {
    setTouched((prev) => ({ ...prev, [field]: true }))
    setErrors(runValidation({ email, password }))
  }

  function handleChange(field: FieldKey, value: string) {
    if (field === "email") setEmail(value)
    if (field === "password") setPassword(value)
    if (touched[field]) {
      setErrors(
        runValidation({
          email: field === "email" ? value : email,
          password: field === "password" ? value : password,
        })
      )
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = runValidation({ email, password })
    setErrors(next)
    setTouched({ email: true, password: true })
    if (next.email || next.password) return
    const success = await login({ email, password })
    if (!success) return
    const localPart = email.split("@")[0] || email
    toast.success(`欢迎回来，${localPart}`)
    router.replace("/")
  }

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="show">
      <Card className="py-8">
      <CardHeader className="items-center px-8 text-center">
        <CardTitle className="text-xl font-semibold tracking-tight">账号登录</CardTitle>
        <CardDescription>
          登录你的{" "}
          <span className="font-brand-wordmark text-foreground/70">
            {siteTitle}
          </span>{" "}
          账号
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8">
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            {error ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor="login-email">邮箱</FieldLabel>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                aria-invalid={Boolean(fieldError("email"))}
                disabled={isSubmitting}
              />
              {fieldError("email") ? (
                <FieldError>{fieldError("email")}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="login-password">密码</FieldLabel>
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                aria-invalid={Boolean(fieldError("password"))}
                disabled={isSubmitting}
              />
              {fieldError("password") ? (
                <FieldError>{fieldError("password")}</FieldError>
              ) : null}
            </Field>
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner /> 登录中...
                  </>
                ) : (
                  "登录"
                )}
              </Button>
              <FieldDescription className="text-center">
                还没有账号？{" "}
                <Link
                  href="/register"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  立即注册 →
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
    </motion.div>
  )
}
