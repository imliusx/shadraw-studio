"use client"

import * as React from "react"
import { toast } from "sonner"
import { AnimatePresence, motion } from "motion/react"
import {
  Archive,
  Check,
  CircleX,
  Clock3,
  Copy,
  FolderInput,
  FolderOpen,
  Forward,
  History,
  ImageIcon,
  Inbox,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react"

import {
  useActiveHistory,
  useGenerate,
  useHistory,
  useProjects,
} from "@/app/providers/app-state-provider"
import { InfiniteLoadSentinel } from "@/components/infinite-load-sentinel"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  HistoryRecord,
  HistoryStatus,
  ImageParams,
  Project,
} from "@/components/workbench/types"
import { TabFade } from "@/components/motion/tab-fade"
import { usePagedRecords } from "@/components/use-paged-records"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"

type LibraryTab = "history" | "projects" | "favorites"

type ProjectFilter = number | null | undefined

const LIBRARY_PAGE_SIZE = 24

type LibraryPanelProps = {
  setPrompt: (value: string) => void
  setImageParams: (value: ImageParams) => void
}

export function LibraryPanel({
  setPrompt,
  setImageParams,
}: LibraryPanelProps) {
  const { updateRecord, deleteRecord, reloadImage } = useHistory()
  const { projects, addProject, renameProject, deleteProject } = useProjects()
  const [activeHistoryId, setActiveHistoryId] = useActiveHistory()
  const { retry } = useGenerate()
  const { listContainer, listItem, slideInLeft } = useMotionVariants()
  const viewportRef = React.useRef<HTMLDivElement>(null)

  const [tab, setTab] = React.useState<LibraryTab>("history")
  const [searchQuery, setSearchQuery] = React.useState("")
  const deferredQuery = React.useDeferredValue(searchQuery)

  const [projectFilter, setProjectFilter] = React.useState<ProjectFilter>(undefined)

  const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
  const [newProjectName, setNewProjectName] = React.useState("")

  const [deleteRecordTarget, setDeleteRecordTarget] = React.useState<HistoryRecord | null>(null)
  const [deleteProjectTarget, setDeleteProjectTarget] = React.useState<Project | null>(null)
  const [cancelRecordTarget, setCancelRecordTarget] =
    React.useState<HistoryRecord | null>(null)

  const historyPage = usePagedRecords({
    enabled: tab === "history",
    params: {
      projectId:
        projectFilter === null
          ? "none"
          : typeof projectFilter === "number"
            ? String(projectFilter)
            : undefined,
      q: deferredQuery,
    },
    pageSize: LIBRARY_PAGE_SIZE,
  })

  const favoritesPage = usePagedRecords({
    enabled: tab === "favorites",
    params: {
      favorite: true,
      q: deferredQuery,
    },
    pageSize: LIBRARY_PAGE_SIZE,
  })

  const filteredHistory = historyPage.records
  const filteredFavorites = favoritesPage.records

  const sortedProjects = React.useMemo(
    () => [...projects].sort((a, b) => b.createdAt - a.createdAt),
    [projects]
  )

  const projectFilterLabel = React.useMemo(() => {
    if (projectFilter === undefined) return null
    if (projectFilter === null) return "未分类"
    return projects.find((project) => project.id === projectFilter)?.name ?? "项目"
  }, [projectFilter, projects])

  const handleReuse = React.useCallback(
    (record: HistoryRecord) => {
      setPrompt(record.prompt)
      setImageParams(record.imageParams)
      toast.success("提示词已复用")
    },
    [setPrompt, setImageParams]
  )

  const handleSelect = React.useCallback(
    (record: HistoryRecord) => {
      setActiveHistoryId(record.id)
    },
    [setActiveHistoryId]
  )

  const handleRequestCancel = React.useCallback(
    (record: HistoryRecord) => {
      setCancelRecordTarget(record)
    },
    []
  )

  const handleCopyPrompt = React.useCallback(async (record: HistoryRecord) => {
    try {
      await navigator.clipboard.writeText(record.prompt)
      toast.success("提示词已复制")
    } catch {
      toast.error("复制失败")
    }
  }, [])

  const handleToggleFavorite = React.useCallback(
    async (record: HistoryRecord) => {
      await updateRecord(record.id, { favorite: !record.favorite })
      toast.success(record.favorite ? "已取消收藏" : "已加入收藏")
    },
    [updateRecord]
  )

  const handleMoveToProject = React.useCallback(
    async (record: HistoryRecord, projectId: number | undefined) => {
      await updateRecord(record.id, { projectId })
      toast.success("已移动到新项目")
    },
    [updateRecord]
  )

  const handleRetry = React.useCallback(
    async (record: HistoryRecord) => {
      try {
        await retry(record.id)
        toast.success("已重新加入队列")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "重试失败")
      }
    },
    [retry]
  )

  const confirmDeleteRecord = React.useCallback(async () => {
    if (!deleteRecordTarget) return
    await deleteRecord(deleteRecordTarget.id)
    setDeleteRecordTarget(null)
    toast.success("已删除")
  }, [deleteRecord, deleteRecordTarget])

  const confirmCancelRecord = React.useCallback(async () => {
    if (!cancelRecordTarget) return
    await deleteRecord(cancelRecordTarget.id)
    setCancelRecordTarget(null)
    toast.info(
      cancelRecordTarget.status === "running"
        ? "已取消生成任务"
        : "已取消排队任务"
    )
  }, [cancelRecordTarget, deleteRecord])

  const confirmDeleteProject = React.useCallback(async () => {
    if (!deleteProjectTarget) return
    await deleteProject(deleteProjectTarget.id)
    if (projectFilter === deleteProjectTarget.id) {
      setProjectFilter(undefined)
    }
    setDeleteProjectTarget(null)
    toast.success("项目已删除")
  }, [deleteProject, deleteProjectTarget, projectFilter])

  const handleCreateProject = React.useCallback(async () => {
    const name = newProjectName.trim()
    if (!name) return
    await addProject(name)
    setNewProjectName("")
    setCreateProjectOpen(false)
    toast.success("项目已创建")
  }, [addProject, newProjectName])

  const handleSelectInbox = React.useCallback(() => {
    setProjectFilter(null)
    setTab("history")
    setSearchQuery("")
  }, [])

  const handleSelectProject = React.useCallback((projectId: number) => {
    setProjectFilter(projectId)
    setTab("history")
    setSearchQuery("")
  }, [])

  return (
    <motion.aside
      variants={slideInLeft}
      initial="hidden"
      animate="show"
      className="flex h-full min-w-0 flex-col"
    >
      <div className="flex h-12 shrink-0 items-center px-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">素材库</p>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as LibraryTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="space-y-2.5 px-4 pb-1.5 pt-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="搜索提示词"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="history">
              <History className="size-4" />
              历史
            </TabsTrigger>
            <TabsTrigger value="projects">
              <Layers3 className="size-4" />
              项目
            </TabsTrigger>
            <TabsTrigger value="favorites">
              <Star className="size-4" />
              收藏
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea
          className="min-h-0 min-w-0 flex-1 overflow-hidden"
          viewportRef={viewportRef}
        >
          <TabsContent
            value="history"
            className="m-0 min-w-0 overflow-hidden px-4 pb-4 pt-2"
          >
            <TabFade tabKey="history" className="space-y-2">
              {projectFilter !== undefined && projectFilterLabel ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
                  <span className="truncate">
                    当前过滤:{projectFilterLabel}
                  </span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => setProjectFilter(undefined)}
                    aria-label="清除项目过滤"
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ) : null}

              {historyPage.isLoadingInitial ? (
                <HistoryCardSkeletonList />
              ) : filteredHistory.length === 0 ? (
                <EmptyState
                  deferredQuery={deferredQuery}
                  onClearSearch={() => setSearchQuery("")}
                  emptyTitle="还没有生成过图片"
                  emptyDescription="在右侧输入提示词开始"
                />
              ) : (
                <motion.div
                  variants={listContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-2"
                >
                  <AnimatePresence initial={false}>
                    {filteredHistory.map((record) => (
                      <HistoryCard
                        key={record.id}
                        record={record}
                        active={activeHistoryId === record.id}
                        projects={projects}
                        onSelect={handleSelect}
                        onReuse={handleReuse}
                        onCancelWaiting={handleRequestCancel}
                        onRequestDelete={setDeleteRecordTarget}
                        onCopyPrompt={handleCopyPrompt}
                        onToggleFavorite={handleToggleFavorite}
                        onMoveToProject={handleMoveToProject}
                        onRetry={handleRetry}
                        onRequestImage={reloadImage}
                        onRequestCreateProject={() => setCreateProjectOpen(true)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
              {historyPage.isLoadingMore ? <HistoryCardSkeletonList count={3} /> : null}
              <InfiniteLoadSentinel
                disabled={!historyPage.hasMore || historyPage.isLoadingMore}
                onLoadMore={historyPage.loadMore}
                rootRef={viewportRef}
              />
            </TabFade>
          </TabsContent>

          <TabsContent
            value="projects"
            className="m-0 px-4 pb-4 pt-2"
          >
            <TabFade tabKey="projects" className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setCreateProjectOpen(true)}
              >
                <Plus className="size-4" />
                新建项目
              </Button>

              <button
                type="button"
                onClick={handleSelectInbox}
                className="group/project relative flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-card p-2.5 text-left transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Inbox className="size-4 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">未分类</span>
                </div>
              </button>

              {sortedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onSelect={handleSelectProject}
                  onRename={renameProject}
                  onRequestDelete={setDeleteProjectTarget}
                />
              ))}
            </TabFade>
          </TabsContent>

          <TabsContent
            value="favorites"
            className="m-0 px-4 pb-4 pt-2"
          >
            <TabFade tabKey="favorites" className="space-y-2">
              {favoritesPage.isLoadingInitial ? (
                <HistoryCardSkeletonList />
              ) : filteredFavorites.length === 0 ? (
                <EmptyState
                  deferredQuery={deferredQuery}
                  onClearSearch={() => setSearchQuery("")}
                  emptyTitle="还没有收藏任何图片"
                  emptyDescription="点击图片工具栏的星标加入收藏"
                />
              ) : (
                <motion.div
                  variants={listContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-2"
                >
                  <AnimatePresence initial={false}>
                    {filteredFavorites.map((record) => (
                      <HistoryCard
                        key={record.id}
                        record={record}
                        active={activeHistoryId === record.id}
                        projects={projects}
                        onSelect={handleSelect}
                        onReuse={handleReuse}
                        onCancelWaiting={handleRequestCancel}
                        onRequestDelete={setDeleteRecordTarget}
                        onCopyPrompt={handleCopyPrompt}
                        onToggleFavorite={handleToggleFavorite}
                        onMoveToProject={handleMoveToProject}
                        onRetry={handleRetry}
                        onRequestImage={reloadImage}
                        onRequestCreateProject={() => setCreateProjectOpen(true)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
              {favoritesPage.isLoadingMore ? <HistoryCardSkeletonList count={3} /> : null}
              <InfiniteLoadSentinel
                disabled={!favoritesPage.hasMore || favoritesPage.isLoadingMore}
                onLoadMore={favoritesPage.loadMore}
                rootRef={viewportRef}
              />
            </TabFade>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <Dialog
        open={createProjectOpen}
        onOpenChange={(open) => {
          setCreateProjectOpen(open)
          if (!open) setNewProjectName("")
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
            <DialogDescription>
              用于归类历史记录,不影响图片本身。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            placeholder="项目名称"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void handleCreateProject()
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateProjectOpen(false)
                setNewProjectName("")
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={newProjectName.trim().length === 0}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteRecordTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteRecordTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这张记录?</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可恢复,会同步从本地存储中清除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeleteRecord}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteProjectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteProjectTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除此项目?</AlertDialogTitle>
            <AlertDialogDescription>
              项目下的图片不会被删除,会归到「未分类」。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeleteProject}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={cancelRecordTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelRecordTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cancelRecordTarget?.status === "running"
                ? "确认取消生成任务?"
                : "确认取消排队任务?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelRecordTarget?.status === "running"
                ? "任务已经开始运行，取消后会从当前列表移除。上游请求可能已经发出，不一定能立即停止。"
                : "任务还在排队中，取消后会从当前列表移除。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续等待</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmCancelRecord}
            >
              取消任务
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.aside>
  )
}

type HistoryCardProps = {
  record: HistoryRecord
  active: boolean
  projects: Project[]
  onSelect: (record: HistoryRecord) => void
  onReuse: (record: HistoryRecord) => void
  onCancelWaiting: (record: HistoryRecord) => void
  onRequestDelete: (record: HistoryRecord) => void
  onCopyPrompt: (record: HistoryRecord) => void
  onToggleFavorite: (record: HistoryRecord) => void
  onMoveToProject: (record: HistoryRecord, projectId: number | undefined) => void
  onRetry: (record: HistoryRecord) => void
  onRequestImage: (id: number) => Promise<void>
  onRequestCreateProject: () => void
}

function HistoryCard({
  record,
  active,
  projects,
  onSelect,
  onReuse,
  onCancelWaiting,
  onRequestDelete,
  onCopyPrompt,
  onToggleFavorite,
  onMoveToProject,
  onRetry,
  onRequestImage,
  onRequestCreateProject,
}: HistoryCardProps) {
  const { listItem } = useMotionVariants()
  const isImageLoading =
    record.status === "completed" && !record.base64 && !record.imageError

  return (
    <motion.div
      layout
      variants={listItem}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
      className={cn(
        "group/history relative grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-lg border p-2.5 text-left transition hover:bg-accent hover:text-accent-foreground",
        active &&
          "border-primary/20 bg-primary/5 text-foreground shadow-sm hover:bg-primary/5 dark:border-border dark:bg-accent dark:text-accent-foreground dark:shadow-none dark:hover:bg-accent"
      )}
    >
      {isImageLoading ? (
        <HistoryCardSkeleton
          record={record}
          onSelect={onSelect}
          onRequestImage={onRequestImage}
        />
      ) : (
        <>
          <button
            type="button"
            className="row-span-2 self-start rounded-lg focus-visible:outline-none"
            onClick={() => onSelect(record)}
            aria-label="选择历史记录"
          >
            <HistoryThumbnail record={record} onRequestImage={onRequestImage} />
          </button>
          <button
            type="button"
            className="min-w-0 text-left focus-visible:outline-none"
            onClick={() => onSelect(record)}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-2 pr-20 text-xs text-muted-foreground">
                <span className="truncate">
                  {record.model} · {record.imageParams.quality} ·{" "}
                  {record.imageParams.size}
                </span>
              </div>
              <p className="truncate text-sm font-medium leading-5">
                {record.prompt || "(无提示词)"}
              </p>
            </div>
          </button>
          <div className="pointer-events-none absolute right-2 top-2">
            <StatusBadge status={record.status} />
          </div>
          <div className="col-start-2 flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
            <HistoryCardActions
              record={record}
              projects={projects}
              onReuse={onReuse}
              onCopyPrompt={onCopyPrompt}
              onRetry={onRetry}
              onToggleFavorite={onToggleFavorite}
              onMoveToProject={onMoveToProject}
              onRequestCreateProject={onRequestCreateProject}
              onCancelWaiting={onCancelWaiting}
              onRequestDelete={onRequestDelete}
            />
            <span className="shrink-0 truncate">
              {record.status === "waiting" || record.status === "running" ? (
                <LiveElapsed
                  startMs={
                    record.status === "running" && record.startedAt
                      ? record.startedAt
                      : record.createdAt
                  }
                />
              ) : (
                formatRelativeTime(record.createdAt)
              )}
            </span>
          </div>
        </>
      )}
    </motion.div>
  )
}

function HistoryCardSkeleton({
  record,
  onSelect,
  onRequestImage,
}: {
  record: HistoryRecord
  onSelect: (record: HistoryRecord) => void
  onRequestImage: (id: number) => Promise<void>
}) {
  return (
    <>
      <button
        type="button"
        className="row-span-2 self-start rounded-lg focus-visible:outline-none"
        onClick={() => onSelect(record)}
        aria-label="选择历史记录"
      >
        <HistoryThumbnail record={record} onRequestImage={onRequestImage} />
      </button>
      <button
        type="button"
        className="min-w-0 text-left focus-visible:outline-none"
        onClick={() => onSelect(record)}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-1.5 pr-20">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-4 w-11/12" />
        </div>
      </button>
      <div className="absolute right-2 top-2">
        <Skeleton className="h-5 w-12 rounded-4xl" />
      </div>
      <div className="col-start-2 flex min-w-0 items-center justify-between gap-2">
        <div className="-ml-1.5 flex min-w-0 items-center gap-1">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="size-7 rounded-lg" />
        </div>
        <Skeleton className="h-3 w-12 shrink-0" />
      </div>
    </>
  )
}

function HistoryCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="relative grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-lg border p-2.5"
        >
          <Skeleton className="row-span-2 size-12 shrink-0 rounded-lg" />
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-1.5 pr-20">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-4 w-11/12" />
          </div>
          <div className="absolute right-2 top-2">
            <Skeleton className="h-5 w-12 rounded-4xl" />
          </div>
          <div className="col-start-2 flex min-w-0 items-center justify-between gap-2">
            <div className="-ml-1.5 flex min-w-0 items-center gap-1">
              <Skeleton className="size-7 rounded-lg" />
              <Skeleton className="size-7 rounded-lg" />
              <Skeleton className="size-7 rounded-lg" />
            </div>
            <Skeleton className="h-3 w-12 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}

function HistoryCardActions({
  record,
  projects,
  onReuse,
  onCopyPrompt,
  onRetry,
  onToggleFavorite,
  onMoveToProject,
  onRequestCreateProject,
  onCancelWaiting,
  onRequestDelete,
}: Pick<
  HistoryCardProps,
  | "record"
  | "projects"
  | "onReuse"
  | "onCopyPrompt"
  | "onRetry"
  | "onToggleFavorite"
  | "onMoveToProject"
  | "onRequestCreateProject"
  | "onCancelWaiting"
  | "onRequestDelete"
>) {
  return (
    <div className="-ml-1.5 flex min-w-0 items-center gap-px">
      <TooltipIcon
        label="复用提示词"
        onClick={() => onReuse(record)}
        size="icon-sm"
      >
        <Forward className="size-3.5" />
      </TooltipIcon>
      <TooltipIcon
        label="复制提示词"
        onClick={() => onCopyPrompt(record)}
        size="icon-sm"
      >
        <Copy className="size-3.5" />
      </TooltipIcon>
      {record.status === "failed" ? (
        <>
          {record.upstreamError ? (
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="查看上游返回详情">
                      <CircleX className="size-3.5" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>查看上游返回详情</TooltipContent>
              </Tooltip>
              <PopoverContent side="right" align="start" className="w-80 p-0">
                <div className="border-b px-3 py-2 text-xs font-medium">
                  上游返回详情
                </div>
                <ScrollArea className="max-h-40">
                  <pre className="whitespace-pre-wrap break-words p-3 text-xs text-muted-foreground">
                    {record.upstreamError}
                  </pre>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          ) : null}
          <TooltipIcon
            label="重试"
            onClick={() => onRetry(record)}
            size="icon-sm"
          >
            <RefreshCw className="size-3.5" />
          </TooltipIcon>
        </>
      ) : null}
      {record.status === "completed" ? (
        <>
          <TooltipIcon
            label={record.favorite ? "取消收藏" : "加入收藏"}
            onClick={() => onToggleFavorite(record)}
            size="icon-sm"
          >
            <Star
              className={cn(
                "size-3.5",
                record.favorite && "fill-amber-400 text-amber-400"
              )}
            />
          </TooltipIcon>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="移到项目"
                  >
                    <FolderInput className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>移到项目</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={() => onMoveToProject(record, undefined)}
              >
                <Inbox className="size-4" />
                未分类
              </DropdownMenuItem>
              {projects.length > 0 ? <DropdownMenuSeparator /> : null}
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onSelect={() => onMoveToProject(record, project.id)}
                >
                  <Layers3 className="size-4" />
                  {project.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onRequestCreateProject}>
                <Plus className="size-4" />
                新建项目
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
      {record.status === "waiting" || record.status === "running" ? (
        <TooltipIcon
          label="取消"
          onClick={() => onCancelWaiting(record)}
          size="icon-sm"
        >
          <X className="size-3.5" />
        </TooltipIcon>
      ) : (
        <TooltipIcon
          label="删除"
          onClick={() => onRequestDelete(record)}
          size="icon-sm"
        >
          <Trash2 className="size-3.5" />
        </TooltipIcon>
      )}
    </div>
  )
}

function HistoryThumbnail({
  record,
  onRequestImage,
}: {
  record: HistoryRecord
  onRequestImage: (id: number) => Promise<void>
}) {
  const thumbnailRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (record.status !== "completed" || record.base64 || record.imageError) {
      return
    }

    const node = thumbnailRef.current
    if (!node) return

    let requested = false
    const requestImage = () => {
      if (requested) return
      requested = true
      void onRequestImage(record.id)
    }

    if (!("IntersectionObserver" in window)) {
      requestImage()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          requestImage()
          observer.disconnect()
        }
      },
      { rootMargin: "240px 0px" }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [onRequestImage, record])

  if (record.status === "completed" && record.base64) {
    return (
      <div
        ref={thumbnailRef}
        className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted"
      >
        <img
          src={record.base64}
          alt=""
          className="size-full object-cover"
        />
      </div>
    )
  }

  if (record.status === "completed" && !record.imageError) {
    return (
      <Skeleton
        ref={thumbnailRef}
        className="size-12 shrink-0 rounded-lg"
      />
    )
  }

  return (
    <div
      ref={thumbnailRef}
      className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground"
    >
      {record.status === "waiting" ? <Clock3 className="size-4" /> : null}
      {record.status === "running" ? <Spinner className="size-4 text-amber-500" /> : null}
      {record.status === "failed" ? <CircleX className="size-4 text-destructive" /> : null}
      {record.status === "completed" ? <ImageIcon className="size-4" /> : null}
    </div>
  )
}

type ProjectCardProps = {
  project: Project
  onSelect: (projectId: number) => void
  onRename: (id: number, name: string) => Promise<void>
  onRequestDelete: (project: Project) => void
}

function ProjectCard({
  project,
  onSelect,
  onRename,
  onRequestDelete,
}: ProjectCardProps) {
  const [editing, setEditing] = React.useState(false)
  const [draftName, setDraftName] = React.useState(project.name)

  const startEditing = React.useCallback(() => {
    setDraftName(project.name)
    setEditing(true)
  }, [project.name])

  const cancelEditing = React.useCallback(() => {
    setDraftName(project.name)
    setEditing(false)
  }, [project.name])

  const commit = React.useCallback(async () => {
    const trimmed = draftName.trim()
    if (!trimmed || trimmed === project.name) {
      cancelEditing()
      return
    }
    await onRename(project.id, trimmed)
    setEditing(false)
    toast.success("项目已重命名")
  }, [cancelEditing, draftName, onRename, project.id, project.name])

  return (
    <div className="group/project relative flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-card p-2.5 text-left transition hover:bg-accent hover:text-accent-foreground focus-within:ring-2 focus-within:ring-ring">
      {editing ? (
        <Input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              void commit()
            } else if (event.key === "Escape") {
              event.preventDefault()
              cancelEditing()
            }
          }}
          autoFocus
          className="h-7"
        />
      ) : (
        <button
          type="button"
          onClick={() => onSelect(project.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
        >
          <Layers3 className="size-4 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{project.name}</span>
        </button>
      )}
      {!editing ? (
        <div className="flex items-center gap-1">
          <div className="pointer-events-none flex items-center gap-0.5 rounded-md bg-background/95 p-0.5 opacity-0 ring-1 ring-border backdrop-blur transition group-hover/project:pointer-events-auto group-hover/project:opacity-100">
            <TooltipIcon
              label="重命名"
              onClick={(event) => {
                event.stopPropagation()
                startEditing()
              }}
            >
              <Pencil className="size-3" />
            </TooltipIcon>
            <TooltipIcon
              label="删除"
              onClick={(event) => {
                event.stopPropagation()
                onRequestDelete(project)
              }}
            >
              <Trash2 className="size-3" />
            </TooltipIcon>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EmptyState({
  deferredQuery,
  onClearSearch,
  emptyTitle,
  emptyDescription,
}: {
  deferredQuery: string
  onClearSearch: () => void
  emptyTitle: string
  emptyDescription: string
}) {
  const query = deferredQuery.trim()
  if (query) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          未匹配到「{query}」相关结果
        </p>
        <Button variant="outline" size="sm" onClick={onClearSearch}>
          清除搜索
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
      <ImageIcon className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{emptyTitle}</p>
      <p className="text-xs text-muted-foreground">{emptyDescription}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: HistoryStatus }) {
  const config: Record<
    HistoryStatus,
    {
      label: string
      icon: React.ReactNode
    }
  > = {
    waiting: {
      label: "等待",
      icon: <Clock3 />,
    },
    running: {
      label: "生成中",
      icon: <Spinner className="text-amber-500" />,
    },
    completed: {
      label: "完成",
      icon: <Check className="text-green-500" />,
    },
    failed: {
      label: "失败",
      icon: <CircleX className="text-destructive" />,
    },
  }
  const current = config[status]

  return (
    <Badge variant="outline">
      {current.icon}
      {current.label}
    </Badge>
  )
}

function TooltipIcon({
  children,
  label,
  disabled,
  onClick,
  size = "icon-xs",
  variant = "ghost",
}: {
  children: React.ReactNode
  label: string
  disabled?: boolean
  onClick: React.MouseEventHandler<HTMLButtonElement>
  size?: React.ComponentProps<typeof Button>["size"]
  variant?: React.ComponentProps<typeof Button>["variant"]
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size={size} variant={variant} disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const delta = Math.max(0, now - timestamp)
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString()
}

function LiveElapsed({ startMs }: { startMs: number }) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startMs])
  return (
    <span className="tabular-nums">
      {formatElapsedTime(now - startMs)}
    </span>
  )
}

function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} 秒`
}
