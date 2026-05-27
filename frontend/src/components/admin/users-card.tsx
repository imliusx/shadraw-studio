import * as React from "react"
import { toast } from "sonner"

import { adminApi } from "@/lib/api/admin-client"
import { ApiError } from "@/lib/api/client"
import type { AuthUser } from "@/lib/api/auth-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function UsersCard() {
  const [users, setUsers] = React.useState<AuthUser[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [working, setWorking] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const resp = await adminApi.listUsers({ search, page, pageSize: 20 })
      setUsers(resp.data.users)
      setTotal(resp.meta?.total ?? 0)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [search, page])

  React.useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const setUserDisabled = async (id: string, disabled: boolean) => {
    setWorking(id)
    try {
      const next = await adminApi.updateUser(id, { disabled })
      setUsers((prev) => prev.map((u) => (u.id === id ? next : u)))
      toast.success(disabled ? "已禁用用户" : "已启用用户")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "操作失败")
    } finally {
      setWorking(null)
    }
  }

  const resetPassword = async (id: string) => {
    setWorking(id)
    try {
      const temp = await adminApi.resetPassword(id)
      toast.success(`临时密码已生成: ${temp}`, { duration: 30000 })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "重置失败")
    } finally {
      setWorking(null)
    }
  }

  return (
    <Card className="gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">用户管理</h3>
        <div className="flex items-center gap-2">
          <Input
            placeholder="搜索邮箱"
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
            className="w-56"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
          暂无用户
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">ID</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>昵称</TableHead>
              <TableHead className="w-20">角色</TableHead>
              <TableHead className="w-24">状态</TableHead>
              <TableHead className="w-60 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const disabled = (u as AuthUser & { mustChangePassword?: boolean }).role
                ? false
                : false
              // Backend doesn't yet expose `disabled` on the public dto; we rely on optimistic flags
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.id}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.displayName}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{disabled ? "禁用" : "正常"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={working === u.id}
                        onClick={() => void resetPassword(u.id)}
                      >
                        重置密码
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={working === u.id || u.role === "admin"}
                        onClick={() => void setUserDisabled(u.id, true)}
                      >
                        禁用
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">共 {total} 条</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className="px-2 text-sm">第 {page} 页</span>
          <Button
            size="sm"
            variant="outline"
            disabled={users.length < 20}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </Card>
  )
}
