"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { CircleAlert } from "lucide-react"
import { toast } from "sonner"

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
import { Checkbox } from "@/components/ui/checkbox"
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

type FieldKey = "displayName" | "email" | "password" | "confirmPassword"
type FieldErrors = Partial<Record<FieldKey, string>>

type Values = {
  displayName: string
  email: string
  password: string
  confirmPassword: string
}

function validateDisplayName(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length < 1) return "昵称不能为空"
  if (trimmed.length > 32) return "昵称不能超过 32 字"
  return null
}

function validateEmail(value: string): string | null {
  if (!value.trim()) return "请输入有效的邮箱地址"
  return EMAIL_PATTERN.test(value) ? null : "请输入有效的邮箱地址"
}

function validatePassword(value: string): string | null {
  return value.length >= 8 ? null : "密码至少 8 位"
}

function validateConfirmPassword(value: string, password: string): string | null {
  return value === password ? null : "两次输入的密码不一致"
}

function runValidation(values: Values): FieldErrors {
  return {
    displayName: validateDisplayName(values.displayName) ?? undefined,
    email: validateEmail(values.email) ?? undefined,
    password: validatePassword(values.password) ?? undefined,
    confirmPassword:
      validateConfirmPassword(values.confirmPassword, values.password) ?? undefined,
  }
}

export function RegisterForm() {
  const router = useRouter()
  const { register, status, error, clearError } = useAuth()
  const { fadeInUp } = useMotionVariants()

  const [values, setValues] = useState<Values>({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    displayName: false,
    email: false,
    password: false,
    confirmPassword: false,
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
    setErrors(runValidation(values))
  }

  function handleChange(field: FieldKey, value: string) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (touched[field] || (field === "password" && touched.confirmPassword)) {
      setErrors(runValidation(next))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = runValidation(values)
    setErrors(next)
    setTouched({
      displayName: true,
      email: true,
      password: true,
      confirmPassword: true,
    })
    if (
      next.displayName ||
      next.email ||
      next.password ||
      next.confirmPassword
    ) {
      return
    }
    const success = await register({
      email: values.email,
      password: values.password,
      displayName: values.displayName.trim(),
    })
    if (!success) return
    toast.success("账号创建成功")
    router.replace("/")
  }

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="show">
      <Card className="py-8">
      <CardHeader className="items-center px-8 text-center">
        <CardTitle className="text-xl font-semibold tracking-tight">账号注册</CardTitle>
        <CardDescription>开始你的 AI 生图之旅</CardDescription>
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
              <FieldLabel htmlFor="register-displayName">昵称</FieldLabel>
              <Input
                id="register-displayName"
                autoComplete="nickname"
                placeholder="张三"
                value={values.displayName}
                onChange={(e) => handleChange("displayName", e.target.value)}
                onBlur={() => handleBlur("displayName")}
                aria-invalid={Boolean(fieldError("displayName"))}
                disabled={isSubmitting}
              />
              {fieldError("displayName") ? (
                <FieldError>{fieldError("displayName")}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="register-email">邮箱</FieldLabel>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder="m@example.com"
                value={values.email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                aria-invalid={Boolean(fieldError("email"))}
                disabled={isSubmitting}
              />
              {fieldError("email") ? (
                <FieldError>{fieldError("email")}</FieldError>
              ) : (
                <FieldDescription>用于登录与接收通知</FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="register-password">密码</FieldLabel>
              <PasswordInput
                id="register-password"
                autoComplete="new-password"
                value={values.password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                aria-invalid={Boolean(fieldError("password"))}
                disabled={isSubmitting}
              />
              {fieldError("password") ? (
                <FieldError>{fieldError("password")}</FieldError>
              ) : (
                <FieldDescription>至少 8 位</FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="register-confirmPassword">
                确认密码
              </FieldLabel>
              <PasswordInput
                id="register-confirmPassword"
                autoComplete="new-password"
                value={values.confirmPassword}
                onChange={(e) =>
                  handleChange("confirmPassword", e.target.value)
                }
                onBlur={() => handleBlur("confirmPassword")}
                aria-invalid={Boolean(fieldError("confirmPassword"))}
                disabled={isSubmitting}
              />
              {fieldError("confirmPassword") ? (
                <FieldError>{fieldError("confirmPassword")}</FieldError>
              ) : null}
            </Field>
            <Field
              orientation="horizontal"
              className="justify-center *:data-[slot=field-label]:flex-none"
            >
              <Checkbox
                id="register-agree"
                checked={agreeTerms}
                onCheckedChange={(v) => setAgreeTerms(v === true)}
                disabled={isSubmitting}
              />
              <FieldLabel
                htmlFor="register-agree"
                className="text-xs font-normal text-muted-foreground"
              >
                我已阅读并同意{" "}
                <a href="#" className="text-foreground hover:underline">
                  服务条款
                </a>{" "}
                和{" "}
                <a href="#" className="text-foreground hover:underline">
                  隐私政策
                </a>
              </FieldLabel>
            </Field>
            <Field>
              <Button type="submit" disabled={!agreeTerms || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner /> 创建账号中...
                  </>
                ) : (
                  "创建账号"
                )}
              </Button>
              <FieldDescription className="text-center">
                已有账号？{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  登录 →
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
