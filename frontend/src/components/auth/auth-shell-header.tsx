"use client"

import Image from "next/image"
import Link from "next/link"

import { useConfig } from "@/app/providers/app-state-provider"
import { BrandLockup } from "@/components/brand-lockup"
import { ThemeToggle } from "@/components/theme-toggle"

export function AuthShellHeader() {
  const { config } = useConfig()
  const siteTitle = config.siteTitle.trim() || "shadraw"

  return (
    <header className="flex h-14 items-center justify-between px-6">
      <Link href="/" className="flex min-w-0 items-center gap-2">
        <Image
          src="/shadraw-logo.svg"
          alt=""
          width={20}
          height={20}
          className="size-5 shrink-0 rounded-md"
          priority
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
