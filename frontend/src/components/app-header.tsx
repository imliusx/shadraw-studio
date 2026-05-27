"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import {
  Images,
  LogOut,
  Palette,
  Settings,
  Shield,
} from "lucide-react"
import { toast } from "sonner"
import { motion } from "motion/react"

import { useConfig, useSettingsDialog } from "@/app/providers/app-state-provider"
import { useAuth, type AuthUser } from "@/app/providers/auth-provider"
import { ApiStatusIndicator } from "@/components/api-status-indicator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { BrandLockup } from "@/components/brand-lockup"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { useMotionVariants } from "@/lib/motion"

const NAV_ITEMS = [
  { href: "/", label: "工作台", icon: Palette },
  { href: "/gallery", label: "画廊", icon: Images },
] as const

function avatarLetter(user: AuthUser): string {
  const fromName = user.displayName.trim()[0]
  if (fromName) return fromName.toUpperCase()
  const fromEmail = user.email.trim()[0]
  if (fromEmail) return fromEmail.toUpperCase()
  return "U"
}

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { openSettings } = useSettingsDialog()
  const { config } = useConfig()
  const { user, logout } = useAuth()
  const { slideInDown } = useMotionVariants()
  const siteTitle = config.siteTitle.trim() || "shadraw"

  async function handleLogout() {
    await logout()
    toast.info("已退出登录")
    router.replace("/login")
  }

  return (
    <motion.header
      variants={slideInDown}
      initial="hidden"
      animate="show"
      className="flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur"
    >
      <div className="flex min-w-0 items-center gap-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/shadraw-logo.svg"
            alt=""
            width={24}
            height={24}
            className="size-6 shrink-0 rounded-md"
            priority
          />
          <BrandLockup
            title={siteTitle}
            titleClassName="text-lg"
          />
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Button
                key={item.href}
                asChild
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className="h-8"
              >
                <Link href={item.href}>
                  <Icon />
                  {item.label}
                </Link>
              </Button>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center justify-end gap-2">
        <ApiStatusIndicator />
        <ThemeToggle />
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full p-0"
                aria-label="打开个人中心"
              >
                <Avatar>
                  <AvatarFallback>{avatarLetter(user)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuLabel className="px-2 py-1.5">
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarFallback>{avatarLetter(user)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {user.displayName}
                    </span>
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => openSettings()}>
                <Settings className="size-4" />
                设置
              </DropdownMenuItem>
              {user.role === "admin" ? (
                <DropdownMenuItem
                  onSelect={() => router.push("/admin")}
                >
                  <Shield className="size-4" />
                  管理后台
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                <LogOut className="size-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-1">
            <Button asChild size="sm" variant="outline">
              <Link href="/login">登录</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">注册</Link>
            </Button>
          </div>
        )}
      </div>
    </motion.header>
  )
}
