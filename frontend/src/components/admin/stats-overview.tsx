"use client"

import * as React from "react"
import { toast } from "sonner"

import { adminApi } from "@/lib/api/admin-client"
import { ApiError } from "@/lib/api/client"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type Stats = Awaited<ReturnType<typeof adminApi.statsOverview>>["today"]

export function StatsOverview() {
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const resp = await adminApi.statsOverview()
      setStats(resp.today)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    const t = setInterval(() => void load(), 30_000)
    return () => {
      window.clearTimeout(timeout)
      clearInterval(t)
    }
  }, [load])

  if (loading || !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  const successRate =
    stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0

  const items: { label: string; value: string; hint?: string }[] = [
    { label: "今日任务总数", value: String(stats.total) },
    { label: "成功率", value: `${successRate}%`, hint: `${stats.success}/${stats.total}` },
    { label: "失败数", value: String(stats.failed) },
    { label: "平均耗时", value: `${Math.round(stats.avgMs / 1000)}s` },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="gap-1 p-5">
          <div className="text-xs text-muted-foreground">{it.label}</div>
          <div className="text-2xl font-semibold tracking-tight">{it.value}</div>
          {it.hint ? <div className="text-xs text-muted-foreground">{it.hint}</div> : null}
        </Card>
      ))}
    </div>
  )
}
