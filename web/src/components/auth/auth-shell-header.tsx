import { Link } from "react-router"

import { useConfig } from "@/providers/app-state-provider"
import { BrandLockup } from "@/components/brand-lockup"
import { ThemeToggle } from "@/components/theme-toggle"

export function AuthShellHeader() {
  const { config } = useConfig()
  const siteTitle = config.siteTitle.trim() || "shadraw"

  return (
    <header className="flex h-14 items-center justify-between px-6">
      <Link to="/" className="flex min-w-0 items-center gap-2">
        <img
          src="/shadraw-logo.svg"
          alt=""
          width={20}
          height={20}
          className="size-5 shrink-0 rounded-md"
        />
        <BrandLockup
          title={siteTitle}
          titleClassName="text-base"
        />
      </Link>
      <ThemeToggle />
    </header>
  )
}
