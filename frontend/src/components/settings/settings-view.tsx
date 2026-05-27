import * as React from "react"
import { toast } from "sonner"
import { AnimatePresence, motion } from "motion/react"
import {
  CircleUser,
  Search,
  Settings,
  Sparkles,
} from "lucide-react"

import { useAuth } from "@/providers/auth-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useMotionVariants } from "@/lib/motion"

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
              className="p-1"
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
  const { user } = useAuth()
  const initial =
    user?.displayName?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "U"

  const notImplemented = (label: string) =>
    toast.info(`${label} 功能开发中`)

  return (
    <div className="grid gap-6">
      <h2 className="text-lg font-semibold tracking-tight">账户</h2>

      <div className="grid gap-3">
        <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          基础资料
        </h3>
        <Card className="gap-0 py-0">
          <div className="divide-y">
            <SettingRow label="头像" description="JPG / PNG, 不超过 2MB">
              <button
                type="button"
                onClick={() => notImplemented("修改头像")}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="修改头像"
              >
                <Avatar size="lg">
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
              </button>
            </SettingRow>
            <SettingRow label="昵称" description="在画廊与日志里展示">
              <Input
                className="w-64"
                defaultValue={user?.displayName ?? ""}
                placeholder="未设置"
              />
            </SettingRow>
            <SettingRow label="邮箱" description="用于登录与接收通知">
              <Input
                className="w-64"
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
        <Card className="gap-0 py-0">
          <div className="divide-y">
            <SettingRow
              label="修改密码"
              description="建议每 90 天更换一次"
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => notImplemented("修改密码")}
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
        <Card className="gap-0 py-0">
          <div className="divide-y">
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
        <Card className="gap-0 py-0">
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
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-4">
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium">{label}</div>
        {description ? (
          <div className="text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
