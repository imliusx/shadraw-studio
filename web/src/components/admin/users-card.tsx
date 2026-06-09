import * as React from "react"
import { toast } from "sonner"

import { adminApi } from "@/lib/api/admin-client"
import { ApiError } from "@/lib/api/client"
import type { AdminUserDTO } from "@/lib/api/admin-client"
import { AdminPagination } from "@/components/admin/admin-pagination"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
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

const PAGE_SIZE = 20

export function UsersCard() {
  const [users, setUsers] = React.useState<AdminUserDTO[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [working, setWorking] = React.useState<string | null>(null)
  const [resetTarget, setResetTarget] = React.useState<AdminUserDTO | null>(null)
  const [disableTarget, setDisableTarget] = React.useState<AdminUserDTO | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const resp = await adminApi.listUsers({ search, page, pageSize: PAGE_SIZE })
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
      setDisableTarget(null)
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
      setResetTarget(null)
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
        <Empty className="min-h-32">
          <EmptyHeader>
            <EmptyTitle>暂无用户</EmptyTitle>
            <EmptyDescription>
              {search.trim() ? "当前搜索条件没有匹配用户。" : "还没有可管理的用户。"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
            {users.map((u) => (
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
                  <Badge variant="outline">{u.disabled ? "禁用" : "正常"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={working === u.id}
                      onClick={() => setResetTarget(u)}
                    >
                      重置密码
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={working === u.id || u.role === "admin" || u.disabled}
                      onClick={() => setDisableTarget(u)}
                    >
                      禁用
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重置密码?</AlertDialogTitle>
            <AlertDialogDescription>
              将为 {resetTarget?.email ?? "该用户"} 生成新的临时密码，用户下次登录后需要改密。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (resetTarget) void resetPassword(resetTarget.id)
              }}
            >
              重置密码
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={disableTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDisableTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认禁用用户?</AlertDialogTitle>
            <AlertDialogDescription>
              禁用后，{disableTarget?.email ?? "该用户"} 将无法继续登录或调用接口。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (disableTarget) void setUserDisabled(disableTarget.id, true)
              }}
            >
              禁用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
      />
    </Card>
  )
}
