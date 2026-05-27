import * as React from "react"

import { RecordsCard } from "@/components/admin/records-card"
import { SiteSettingsCard } from "@/components/admin/site-settings-card"
import { StatsOverview } from "@/components/admin/stats-overview"
import { UpstreamConfigCard } from "@/components/admin/upstream-config-card"
import { UsersCard } from "@/components/admin/users-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function AdminConsole() {
  return (
    <main className="h-[calc(100vh-3.5rem)] overflow-y-auto bg-background">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">管理控制台</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            配置站点信息与上游生图接口、管理用户与任务、查看运行指标。
          </p>
        </header>

        <StatsOverview />

        <Tabs defaultValue="site" className="mt-6">
          <TabsList>
            <TabsTrigger value="site">站点设置</TabsTrigger>
            <TabsTrigger value="upstream">上游配置</TabsTrigger>
            <TabsTrigger value="users">用户</TabsTrigger>
            <TabsTrigger value="records">任务</TabsTrigger>
          </TabsList>
          <TabsContent value="site" className="mt-4">
            <SiteSettingsCard />
          </TabsContent>
          <TabsContent value="upstream" className="mt-4">
            <UpstreamConfigCard />
          </TabsContent>
          <TabsContent value="users" className="mt-4">
            <UsersCard />
          </TabsContent>
          <TabsContent value="records" className="mt-4">
            <RecordsCard />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
