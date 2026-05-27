import * as React from "react"
import { toast } from "sonner"

import { adminApi } from "@/lib/api/admin-client"
import { ApiError } from "@/lib/api/client"
import type { RecordDTO } from "@/lib/api/records-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS_VARIANT: Record<RecordDTO["status"], "default" | "secondary" | "outline" | "destructive"> = {
  completed: "default",
  running: "secondary",
  waiting: "outline",
  failed: "destructive",
}

export function RecordsCard() {
  const [records, setRecords] = React.useState<RecordDTO[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [statusFilter, setStatusFilter] = React.useState<string>("")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const resp = await adminApi.listRecords({ page, pageSize: 20, status: statusFilter || undefined })
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
    if (!window.confirm("确认删除这条任务？")) return
    try {
      await adminApi.deleteRecord(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
      toast.success("已删除")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "删除失败")
    }
  }

  return (
    <Card className="gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">全局任务</h3>
        <div className="flex items-center gap-2 text-sm">
          {(["", "waiting", "running", "completed", "failed"] as const).map((s) => (
            <Button
              key={s || "all"}
              size="sm"
              variant={statusFilter === s ? "secondary" : "ghost"}
              onClick={() => {
                setPage(1)
                setStatusFilter(s)
              }}
            >
              {s === "" ? "全部" : s}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
          暂无记录
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">ID</TableHead>
              <TableHead className="w-24">状态</TableHead>
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
                <TableCell className="max-w-[420px] truncate" title={r.prompt}>
                  {r.prompt || <span className="text-muted-foreground">(空)</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.model}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => void handleDelete(r.id)}>
                    删除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
            disabled={records.length < 20}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </Card>
  )
}
