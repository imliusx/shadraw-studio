import * as React from "react"
import { toast } from "sonner"

import { adminApi } from "@/lib/api/admin-client"
import { ApiError } from "@/lib/api/client"
import type { AdminRecordDTO } from "@/lib/api/admin-client"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const STATUS_VARIANT: Record<
  AdminRecordDTO["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  completed: "default",
  running: "secondary",
  waiting: "outline",
  failed: "destructive",
}

const PAGE_SIZE = 20
const STATUS_FILTERS = ["all", "waiting", "running", "completed", "failed"] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]

function isStatusFilter(value: string): value is StatusFilter {
  return STATUS_FILTERS.some((status) => status === value)
}

export function RecordsCard() {
  const [records, setRecords] = React.useState<AdminRecordDTO[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
  const [deleteTarget, setDeleteTarget] = React.useState<AdminRecordDTO | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const resp = await adminApi.listRecords({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
      })
      setRecords(resp.data.records)
      setTotal(resp.meta?.total ?? 0)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  React.useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const handleDelete = async (id: string) => {
    try {
      await adminApi.deleteRecord(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
      toast.success("已删除")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "删除失败")
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <Card className="gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">全局任务</h3>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={statusFilter}
            size="sm"
            aria-label="任务状态筛选"
            onValueChange={(value) => {
              if (isStatusFilter(value)) {
                setPage(1)
                setStatusFilter(value)
              }
            }}
          >
            {STATUS_FILTERS.map((status) => (
              <ToggleGroupItem key={status} value={status}>
                {status === "all" ? "全部" : status}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : records.length === 0 ? (
        <Empty className="min-h-32">
          <EmptyHeader>
            <EmptyTitle>暂无记录</EmptyTitle>
            <EmptyDescription>
              {statusFilter === "all"
                ? "还没有生成任务记录。"
                : "当前状态下没有匹配的任务记录。"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table className="min-w-[960px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">ID</TableHead>
              <TableHead className="w-24">状态</TableHead>
              <TableHead className="w-56">生成用户</TableHead>
              <TableHead>提示词</TableHead>
              <TableHead className="w-32">模型</TableHead>
              <TableHead className="w-44">创建时间</TableHead>
              <TableHead className="w-24 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.id}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                </TableCell>
                <TableCell className="max-w-56">
                  <div className="truncate text-sm">
                    {r.user.displayName || r.user.email || `用户 ${r.user.id}`}
                  </div>
                  {r.user.email ? (
                    <div className="truncate text-xs text-muted-foreground">{r.user.email}</div>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-[420px] truncate" title={r.prompt}>
                  {r.prompt || <span className="text-muted-foreground">(空)</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.model}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setDeleteTarget(r)}>
                    删除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这条任务?</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可恢复，会永久删除这条任务记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget) void handleDelete(deleteTarget.id)
              }}
            >
              删除
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
