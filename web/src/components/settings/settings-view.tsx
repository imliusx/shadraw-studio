import * as React from "react"
import { toast } from "sonner"
import { AnimatePresence, motion } from "motion/react"
import { useNavigate } from "react-router"
import {
  CircleUser,
  Save,
  Search,
  Settings,
  Sparkles,
} from "lucide-react"

import { useAuth } from "@/providers/auth-provider"
import { AuthError } from "@/lib/api/auth-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PasswordInput } from "@/components/password-input"
import { Spinner } from "@/components/ui/spinner"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"

type SectionId = "account" | "general"

type SectionMeta = {
  id: SectionId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const SECTIONS: ReadonlyArray<SectionMeta> = [
  { id: "account", label: "账户", icon: CircleUser },
  { id: "general", label: "通用", icon: Settings },
]

const settingsSurfaceClassName =
  "relative isolate gap-0 bg-popover/60 py-0 text-popover-foreground shadow-none ring-1 ring-foreground/10 before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150"

const settingsInputClassName =
  "w-full bg-background/20 shadow-none sm:w-64"

export function SettingsView() {
  return (
    <main className="h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      <div className="mx-auto h-full w-full max-w-5xl px-6 py-10">
        <SettingsContent variant="page" />
      </div>
    </main>
  )
}

export function SettingsContent({ variant }: { variant: "page" | "dialog" }) {
  const [active, setActive] = React.useState<SectionId>("account")
  const { fadeInUp, slideInLeft } = useMotionVariants()
  const viewportRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 })
  }, [active])

  const navAside =
    variant === "page" ? (
      <motion.aside
        variants={slideInLeft}
        initial="hidden"
        animate="show"
      >
        <SettingsSubNav active={active} onChange={setActive} />
      </motion.aside>
    ) : (
      <aside>
        <SettingsSubNav active={active} onChange={setActive} />
      </aside>
    )

  return (
    <div className="grid h-full min-h-0 gap-6 md:grid-cols-[12rem_minmax(0,1fr)] md:grid-rows-1 md:gap-8">
      {navAside}
      <section className="flex min-h-0 flex-col">
        <ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              className="py-1 pl-1 pr-5"
              variants={fadeInUp}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {active === "account" ? <AccountSection /> : null}
              {active === "general" ? <GeneralSection /> : null}
            </motion.div>
          </AnimatePresence>
        </ScrollArea>
      </section>
    </div>
  )
}

function SettingsSubNav({
  active,
  onChange,
}: {
  active: SectionId
  onChange: (id: SectionId) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="搜索设置"
          className="pl-8"
          aria-label="搜索设置"
        />
      </div>
      <nav className="flex flex-col gap-1" aria-label="设置分组">
        {SECTIONS.map((section) => {
          const Icon = section.icon
          const selected = section.id === active
          return (
            <Button
              key={section.id}
              type="button"
              variant={selected ? "secondary" : "ghost"}
              size="default"
              className="w-full justify-start"
              aria-current={selected ? "page" : undefined}
              onClick={() => onChange(section.id)}
            >
              <Icon className="size-4" />
              {section.label}
            </Button>
          )
        })}
      </nav>
    </div>
  )
}

function AccountSection() {
  const navigate = useNavigate()
  const { user, updateProfile, uploadAvatar, changePassword } = useAuth()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = React.useState(user?.displayName ?? "")
  const [displayNameError, setDisplayNameError] = React.useState<string | null>(null)
  const [profilePending, setProfilePending] = React.useState(false)
  const [avatarPending, setAvatarPending] = React.useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false)
  const [passwordPending, setPasswordPending] = React.useState(false)
  const [passwordValues, setPasswordValues] = React.useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [passwordErrors, setPasswordErrors] = React.useState<
    Partial<Record<keyof typeof passwordValues, string>>
  >({})
  const initial =
    user?.displayName?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "U"

  const notImplemented = (label: string) =>
    toast.info(`${label} 功能开发中`)

  React.useEffect(() => {
    setDisplayName(user?.displayName ?? "")
  }, [user?.displayName])

  function validateDisplayName(value: string): string | null {
    const trimmed = value.trim()
    if (!trimmed) return "昵称不能为空"
    if (trimmed.length > 32) return "昵称不能超过 32 字"
    return null
  }

  function messageFromError(err: unknown): string {
    if (err instanceof AuthError) {
      if (err.fields) {
        const first = Object.values(err.fields)[0]
        if (first) return first
      }
      return err.message
    }
    if (err instanceof Error) return err.message
    return "操作失败"
  }

  async function saveDisplayName() {
    const nextError = validateDisplayName(displayName)
    setDisplayNameError(nextError)
    if (nextError) {
      toast.error(nextError)
      return
    }
    if (displayName.trim() === (user?.displayName ?? "").trim()) return
    setProfilePending(true)
    try {
      await updateProfile({ displayName: displayName.trim() })
      toast.success("昵称已更新")
    } catch (err) {
      toast.error(messageFromError(err))
    } finally {
      setProfilePending(false)
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("头像仅支持 JPG 或 PNG")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("头像不能超过 2MB")
      return
    }
    setAvatarPending(true)
    try {
      await uploadAvatar(file)
      toast.success("头像已更新")
    } catch (err) {
      toast.error(messageFromError(err))
    } finally {
      setAvatarPending(false)
    }
  }

  function validatePasswordForm() {
    const next: Partial<Record<keyof typeof passwordValues, string>> = {}
    if (!passwordValues.oldPassword) next.oldPassword = "请输入当前密码"
    if (passwordValues.newPassword.length < 8) next.newPassword = "新密码至少 8 位"
    if (passwordValues.confirmPassword !== passwordValues.newPassword) {
      next.confirmPassword = "两次输入的密码不一致"
    }
    return next
  }

  function resetPasswordForm() {
    setPasswordValues({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    })
    setPasswordErrors({})
  }

  function handlePasswordDialogChange(open: boolean) {
    setPasswordDialogOpen(open)
    if (!open && !passwordPending) resetPasswordForm()
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validatePasswordForm()
    setPasswordErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setPasswordPending(true)
    try {
      await changePassword({
        oldPassword: passwordValues.oldPassword,
        newPassword: passwordValues.newPassword,
      })
      toast.success("密码已修改，请重新登录")
      setPasswordDialogOpen(false)
      resetPasswordForm()
      navigate("/login", { replace: true })
    } catch (err) {
      toast.error(messageFromError(err))
    } finally {
      setPasswordPending(false)
    }
  }

  function setPasswordField(field: keyof typeof passwordValues, value: string) {
    setPasswordValues((prev) => ({ ...prev, [field]: value }))
    setPasswordErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  return (
    <>
      <div className="grid gap-6">
        <h2 className="text-lg font-semibold tracking-tight">账户</h2>

        <div className="grid gap-3">
          <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            基础资料
          </h3>
          <Card className={settingsSurfaceClassName}>
            <div className="divide-y divide-foreground/5">
              <SettingRow label="头像" description="JPG / PNG, 不超过 2MB" compact>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="修改头像"
                  disabled={avatarPending}
                >
                  <Avatar size="lg">
                    {user?.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={handleAvatarChange}
                />
              </SettingRow>
              <SettingRow label="昵称" description="在画廊与日志里展示" compact>
                <Input
                  className={settingsInputClassName}
                  value={displayName}
                  placeholder="未设置"
                  maxLength={32}
                  aria-invalid={Boolean(displayNameError)}
                  disabled={profilePending}
                  onBlur={() => void saveDisplayName()}
                  onChange={(event) => {
                    setDisplayName(event.target.value)
                    setDisplayNameError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      event.currentTarget.blur()
                    }
                  }}
                />
              </SettingRow>
              <SettingRow label="邮箱" description="用于登录与接收通知" compact>
                <Input
                  className={settingsInputClassName}
                  type="email"
                  defaultValue={user?.email ?? ""}
                  readOnly
                />
              </SettingRow>
            </div>
          </Card>
        </div>

        <div className="grid gap-3">
          <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            账户安全
          </h3>
          <Card className={settingsSurfaceClassName}>
            <div className="divide-y divide-foreground/5">
              <SettingRow
                label="修改密码"
                description="建议每 90 天更换一次"
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  修改密码
                </Button>
              </SettingRow>
              <SettingRow
                label="退出所有设备"
                description="撤销其他端的登录态,本端保留"
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => notImplemented("退出所有设备")}
                >
                  立即退出
                </Button>
              </SettingRow>
            </div>
          </Card>
        </div>

        <div className="grid gap-3">
          <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            危险区
          </h3>
          <Card className={settingsSurfaceClassName}>
            <div className="divide-y divide-foreground/5">
              <SettingRow
                label="删除账户"
                description="此操作不可恢复,所有云端与本地数据将一并清除"
              >
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => notImplemented("删除账户")}
                >
                  删除账户
                </Button>
              </SettingRow>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={passwordDialogOpen} onOpenChange={handlePasswordDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>
              修改成功后需要重新登录。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} noValidate>
            <FieldGroup>
              <Field data-invalid={Boolean(passwordErrors.oldPassword)}>
                <FieldLabel htmlFor="settings-old-password">
                  当前密码
                </FieldLabel>
                <PasswordInput
                  id="settings-old-password"
                  autoComplete="current-password"
                  value={passwordValues.oldPassword}
                  disabled={passwordPending}
                  aria-invalid={Boolean(passwordErrors.oldPassword)}
                  onChange={(event) =>
                    setPasswordField("oldPassword", event.target.value)
                  }
                />
                {passwordErrors.oldPassword ? (
                  <FieldError>{passwordErrors.oldPassword}</FieldError>
                ) : null}
              </Field>
              <Field data-invalid={Boolean(passwordErrors.newPassword)}>
                <FieldLabel htmlFor="settings-new-password">
                  新密码
                </FieldLabel>
                <PasswordInput
                  id="settings-new-password"
                  autoComplete="new-password"
                  value={passwordValues.newPassword}
                  disabled={passwordPending}
                  aria-invalid={Boolean(passwordErrors.newPassword)}
                  onChange={(event) =>
                    setPasswordField("newPassword", event.target.value)
                  }
                />
                {passwordErrors.newPassword ? (
                  <FieldError>{passwordErrors.newPassword}</FieldError>
                ) : (
                  <FieldDescription>至少 8 位</FieldDescription>
                )}
              </Field>
              <Field data-invalid={Boolean(passwordErrors.confirmPassword)}>
                <FieldLabel htmlFor="settings-confirm-password">
                  确认新密码
                </FieldLabel>
                <PasswordInput
                  id="settings-confirm-password"
                  autoComplete="new-password"
                  value={passwordValues.confirmPassword}
                  disabled={passwordPending}
                  aria-invalid={Boolean(passwordErrors.confirmPassword)}
                  onChange={(event) =>
                    setPasswordField("confirmPassword", event.target.value)
                  }
                />
                {passwordErrors.confirmPassword ? (
                  <FieldError>{passwordErrors.confirmPassword}</FieldError>
                ) : null}
              </Field>
              <DialogFooter>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={passwordPending}
                  >
                    取消
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={passwordPending}>
                  {passwordPending ? <Spinner /> : <Save />}
                  更新密码
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function GeneralSection() {
  return (
    <div className="grid gap-6">
      <h2 className="text-lg font-semibold tracking-tight">通用</h2>

      <div className="grid gap-3">
        <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          偏好
        </h3>
        <Card className={settingsSurfaceClassName}>
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <Sparkles className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">更多选项即将上线</p>
            <p className="text-xs text-muted-foreground">
              主题、默认比例、默认像素等正在规划
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

function SettingRow({
  label,
  description,
  compact = false,
  children,
}: {
  label: string
  description?: string
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        compact ? "py-3" : "py-4"
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium">{label}</div>
        {description ? (
          <div className="text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <div className="min-w-0 sm:shrink-0">{children}</div>
    </div>
  )
}
