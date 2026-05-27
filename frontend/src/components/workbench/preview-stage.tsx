"use client"

import * as React from "react"
import { toast } from "sonner"
import { AnimatePresence, motion } from "motion/react"
import {
  CircleAlert,
  Copy,
  Download,
  FileText,
  Globe2,
  ImageIcon,
  Lock,
  RefreshCw,
  Star,
  WandSparkles,
} from "lucide-react"

import {
  useActiveHistory,
  useGenerate,
  useHistory,
  useLightbox,
} from "@/app/providers/app-state-provider"
import { toUserFacingErrorMessage } from "@/lib/api/errors"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import {
  PublishConfirmDialog,
  type PublishOptions,
} from "@/components/gallery/publish-confirm-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { RecordDetailsPopover } from "@/components/workbench/record-details-popover"
import { useMotionVariants } from "@/lib/motion"
import type { HistoryRecord, ImageParams } from "@/components/workbench/types"
import { cn } from "@/lib/utils"

type PreviewStageProps = {
  setPrompt: (value: string) => void
  setImageParams: (value: ImageParams) => void
}

export function PreviewStage({
  setPrompt,
  setImageParams,
}: PreviewStageProps) {
  const [activeId] = useActiveHistory()
  const { getById, updateRecord, reloadImage } = useHistory()
  const { openWith } = useLightbox()
  const { submit, retry } = useGenerate()
  const [publishTarget, setPublishTarget] =
    React.useState<HistoryRecord | null>(null)

  const record = activeId !== null ? getById(activeId) : undefined

  const handleReuse = React.useCallback(() => {
    if (!record) return
    setPrompt(record.prompt)
    setImageParams(record.imageParams)
    toast.success("提示词已复用")
  }, [record, setPrompt, setImageParams])

  const handleRegenerate = React.useCallback(() => {
    if (!record) return
    void submit({
      prompt: record.prompt,
      imageParams: record.imageParams,
    }).then((result) => {
      if (result.ok) {
        toast.success("已提交新生成请求")
      } else {
        toast.error(result.message)
      }
    })
  }, [record, submit])

  const handleRetry = React.useCallback(() => {
    if (!record) return
    void retry(record.id)
      .then(() => {
        toast.success("已重新加入队列")
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "重试失败")
      })
  }, [record, retry])

  const handleDownload = React.useCallback(() => {
    if (!record?.base64) return
    const stamp = new Date(record.createdAt)
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 15)
    const link = document.createElement("a")
    link.href = record.base64
    link.download = `shadraw-${stamp}-${record.id}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("下载已开始")
  }, [record])

  const handleToggleFavorite = React.useCallback(async () => {
    if (!record) return
    await updateRecord(record.id, { favorite: !record.favorite })
    toast.success(record.favorite ? "已取消收藏" : "已加入收藏")
  }, [record, updateRecord])

  const handleTogglePublic = React.useCallback(async () => {
    if (!record) return
    if (!record.isPublic) {
      setPublishTarget(record)
      return
    }
    await updateRecord(record.id, { isPublic: false, promptPublic: true })
    toast.success("已取消公开")
  }, [record, updateRecord])

  const confirmPublish = React.useCallback(
    async (target: HistoryRecord, options: PublishOptions) => {
      await updateRecord(target.id, {
        isPublic: true,
        promptPublic: options.promptPublic,
      })
      setPublishTarget(null)
      toast.success("已公开到社区画廊")
    },
    [updateRecord]
  )

  const handleCopyPrompt = React.useCallback(async () => {
    if (!record) return
    try {
      await navigator.clipboard.writeText(record.prompt)
      toast.success("提示词已复制")
    } catch {
      toast.error("复制失败")
    }
  }, [record])

  const handleOpenLightbox = React.useCallback(() => {
    if (!record) return
    openWith(record.id, null)
  }, [openWith, record])

  const handleReloadImage = React.useCallback(() => {
    if (!record) return
    void reloadImage(record.id)
  }, [record, reloadImage])

  const stageKey = !record
    ? "empty"
    : record.status === "waiting" || record.status === "running"
      ? `loading-${record.id}`
      : record.status === "failed"
        ? `failed-${record.id}`
        : record.base64
          ? `completed-${record.id}`
          : record.imageError
            ? `image-error-${record.id}`
            : `loading-${record.id}`

  return (
    <>
      <section className="flex h-full min-w-0 flex-col bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--foreground)_14%,transparent)_1px,transparent_0)] bg-[size:22px_22px]">
        <div className="@container/preview flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 md:p-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stageKey}
              initial={{ opacity: 0, scale: 0.98, y: 4 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] },
              }}
              exit={{
                opacity: 0,
                scale: 0.98,
                transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
              }}
              className="flex h-full w-full min-h-0 min-w-0 items-center justify-center"
            >
              {!record ? (
                <EmptyStageState />
              ) : record.status === "waiting" ||
                record.status === "running" ||
                (record.status === "completed" &&
                  !record.base64 &&
                  !record.imageError) ? (
                <GeneratingState record={record} />
              ) : record.status === "completed" &&
                !record.base64 &&
                record.imageError ? (
                <ImageLoadFailedState
                  error={record.imageError}
                  onRetry={handleReloadImage}
                />
              ) : record.status === "failed" ? (
                <FailedState
                  record={record}
                  onRetry={handleRetry}
                  onReuse={handleReuse}
                />
              ) : record.base64 ? (
                <CompletedState
                  record={record}
                  onOpenLightbox={handleOpenLightbox}
                  onDownload={handleDownload}
                  onToggleFavorite={handleToggleFavorite}
                  onTogglePublic={handleTogglePublic}
                  onCopyPrompt={handleCopyPrompt}
                  onRegenerate={handleRegenerate}
                />
              ) : (
                <EmptyStageState />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
      <PublishConfirmDialog
        record={publishTarget}
        onOpenChange={(open) => {
          if (!open) setPublishTarget(null)
        }}
        onConfirm={confirmPublish}
      />
    </>
  )
}

function GeneratingState({ record }: { record: HistoryRecord }) {
  const startMs = record
    .status === "running" && record.startedAt
      ? record.startedAt
      : record.createdAt
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startMs])

  const elapsedMs = now - startMs
  const elapsedText = formatElapsedTime(elapsedMs)
  const progressValue = getGeneratingProgress(record.status, elapsedMs)

  const phase =
    record.status === "waiting"
      ? "排队中"
      : record.status === "running"
        ? "生成中"
        : "处理中"

  return (
    <div className="flex min-h-64 w-full max-w-sm flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 p-6 text-center">
      <Spinner className="size-5 text-muted-foreground" />
      <div className="flex items-baseline gap-2">
        <p className="text-sm font-medium">{phase}</p>
        <span className="text-sm tabular-nums text-muted-foreground">
          {elapsedText}
        </span>
      </div>
      <Progress
        value={progressValue}
        aria-label="生成进度"
        className="h-1.5 max-w-56"
      />
      <p className="text-xs text-muted-foreground">
        可以离开此页面，完成后回来查看
      </p>
    </div>
  )
}

function getGeneratingProgress(status: HistoryRecord["status"], elapsedMs: number) {
  const elapsedSeconds = Math.max(0, elapsedMs / 1000)

  if (status === "waiting") return Math.min(10, 4 + elapsedSeconds / 10)
  if (status === "running") {
    const baseProgress = 12
    const targetProgress = 90
    const estimatedDurationSeconds = 180
    const progress =
      baseProgress +
      (elapsedSeconds / estimatedDurationSeconds) *
        (targetProgress - baseProgress)

    return Math.min(96, progress)
  }
  return 96
}

function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} 秒`
}

function ImageLoadFailedState({
  error,
  onRetry,
}: {
  error: string
  onRetry: () => void
}) {
  return (
    <div className="flex min-h-64 w-full max-w-sm flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/40 bg-muted/20 p-6 text-center">
      <CircleAlert className="size-5 text-destructive" />
      <p className="text-sm font-medium">图片加载失败</p>
      <p className="text-xs text-muted-foreground">{error}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-4" />
        重新加载
      </Button>
    </div>
  )
}

function FailedState({
  record,
  onRetry,
  onReuse,
}: {
  record: HistoryRecord
  onRetry: () => void
  onReuse: () => void
}) {
  const errorText = toUserFacingErrorMessage(record.error)
  return (
    <div className="flex min-h-64 w-full max-w-sm flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/40 bg-muted/20 p-6 text-center">
      <CircleAlert className="size-5 text-destructive" />
      <p className="text-sm font-medium">{errorText}</p>
      {record.upstreamError ? (
        <Collapsible className="w-full rounded-md border bg-background/60 text-left">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-muted-foreground"
            >
              查看上游返回详情
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="max-h-28 border-t">
              <pre className="whitespace-pre-wrap break-words p-3 text-xs text-muted-foreground">
                {record.upstreamError}
              </pre>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" className="hover:bg-primary/80" onClick={onRetry}>
          <RefreshCw className="size-4" />
          重试
        </Button>
        <Button size="sm" variant="outline" onClick={onReuse}>
          <WandSparkles className="size-4" />
          复用提示词
        </Button>
      </div>
    </div>
  )
}

function sizeToAspect(size: string): string {
  const parts = size.split("x").map(Number)
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "1 / 1"
  return `${parts[0]} / ${parts[1]}`
}

function CompletedState({
  record,
  onOpenLightbox,
  onDownload,
  onToggleFavorite,
  onTogglePublic,
  onCopyPrompt,
  onRegenerate,
}: {
  record: HistoryRecord
  onOpenLightbox: () => void
  onDownload: () => void
  onToggleFavorite: () => void
  onTogglePublic: () => void
  onCopyPrompt: () => void
  onRegenerate: () => void
}) {
  const [aspect, setAspect] = React.useState<string>(() =>
    sizeToAspect(record.imageParams.size)
  )

  const handleLoad = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setAspect(`${img.naturalWidth} / ${img.naturalHeight}`)
      }
    },
    []
  )

  return (
    <div
      className="group relative max-h-full max-w-full overflow-hidden"
      style={{ aspectRatio: aspect }}
    >
      <img
        src={record.base64}
        alt={record.prompt.slice(0, 40)}
        onLoad={handleLoad}
        onClick={onOpenLightbox}
        className="block size-full cursor-zoom-in object-contain"
      />
      <div className="pointer-events-none absolute right-3 top-3 flex translate-y-[-0.25rem] items-center gap-0.5 rounded-md bg-background/95 p-0.5 opacity-0 shadow-sm ring-1 ring-border backdrop-blur transition group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
        <PreviewActions
          record={record}
          onDownload={onDownload}
          onToggleFavorite={onToggleFavorite}
          onTogglePublic={onTogglePublic}
          onCopyPrompt={onCopyPrompt}
          onRegenerate={onRegenerate}
        />
      </div>
    </div>
  )
}

function PreviewActions({
  record,
  onDownload,
  onToggleFavorite,
  onTogglePublic,
  onCopyPrompt,
  onRegenerate,
}: {
  record: HistoryRecord
  onDownload: () => void
  onToggleFavorite: () => void
  onTogglePublic: () => void
  onCopyPrompt: () => void
  onRegenerate: () => void
}) {
  return (
    <>
      <RecordDetailsPopover
        record={record}
        icon={<FileText className="size-3.5" />}
        onCopyPrompt={() => onCopyPrompt()}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon-xs" variant="ghost" onClick={onDownload}>
            <Download className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>下载</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon-xs" variant="ghost" onClick={onToggleFavorite}>
            <motion.span
              key={record.favorite ? "fav" : "unfav"}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: [0.7, 1.25, 1], opacity: 1 }}
              transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
              className="inline-flex"
            >
              <Star
                className={cn(
                  "size-3.5",
                  record.favorite && "fill-amber-400 text-amber-400"
                )}
              />
            </motion.span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{record.favorite ? "取消收藏" : "收藏"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon-xs" variant="ghost" onClick={onTogglePublic}>
            {record.isPublic ? (
              <Lock className="size-3.5" />
            ) : (
              <Globe2 className="size-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{record.isPublic ? "取消公开" : "公开到社区"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon-xs" variant="ghost" onClick={onCopyPrompt}>
            <Copy className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>复制提示词</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon-xs" variant="ghost" onClick={onRegenerate}>
            <RefreshCw className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>重新生成</TooltipContent>
      </Tooltip>
    </>
  )
}

function EmptyStageState() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <ImageIcon className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">暂无生成结果</p>
      <p className="text-xs text-muted-foreground">
        在右侧输入提示词开始
      </p>
    </div>
  )
}
