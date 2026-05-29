import * as React from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { motion } from "motion/react"
import { MasonryPhotoAlbum, type Photo } from "react-photo-album"
import {
  Archive,
  Copy,
  Download,
  FileText,
  FolderInput,
  Globe2,
  ImageIcon,
  Inbox,
  Lock,
  Search,
  Star,
  Trash2,
  WandSparkles,
} from "lucide-react"

import {
  useHistory,
  useLightbox,
  useProjects,
} from "@/providers/app-state-provider"
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  HistoryRecord,
  Project,
} from "@/components/workbench/types"
import { ImagePreviewDialog } from "@/components/lightbox/image-preview-dialog"
import {
  PublishConfirmDialog,
  type PublishOptions,
} from "@/components/gallery/publish-confirm-dialog"
import { RecordDetailsPopover } from "@/components/workbench/record-details-popover"
import { TabFade } from "@/components/motion/tab-fade"
import { usePagedRecords } from "@/components/use-paged-records"
import { fetchImageBlobURL } from "@/lib/api/client"
import { recordsApi } from "@/lib/api/records-client"
import { dtoToRecord } from "@/lib/api/record-mappers"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"

type GalleryScope = "mine" | "community"
type GalleryTab = "all" | "favorites" | "projects"

type GalleryPhoto = Photo & {
  record: HistoryRecord
}

type NaturalImageSize = {
  src: string
  width: number
  height: number
}

type CommunityState = {
  status: "idle" | "loading" | "ready" | "error"
  records: HistoryRecord[]
  page: number
  total: number
  totalPages: number
  message?: string
}

type CommunityImageState = {
  urls: Map<number, string>
  loading: Set<number>
  errors: Set<number>
}

const GALLERY_PAGE_SIZE = 30

const INITIAL_COMMUNITY_STATE: CommunityState = {
  status: "idle",
  records: [],
  page: 0,
  total: 0,
  totalPages: 1,
}

function buildDownloadFilename(record: HistoryRecord): string {
  const stamp = new Date(record.createdAt)
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 15)
  return `shadraw-${stamp}-${record.id}.png`
}

function downloadRecordImage(record: HistoryRecord) {
  if (!record.base64) return
  const link = document.createElement("a")
  link.href = record.base64
  link.download = buildDownloadFilename(record)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function appendUniqueRecords(
  current: HistoryRecord[],
  incoming: HistoryRecord[]
): HistoryRecord[] {
  const map = new Map(current.map((record) => [record.id, record]))
  for (const record of incoming) {
    map.set(record.id, record)
  }
  return [...map.values()]
}

export function GalleryView() {
  const { records, deleteRecord, updateRecord, reloadImage } = useHistory()
  const { projects } = useProjects()
  const { openWith } = useLightbox()
  const navigate = useNavigate()
  const viewportRef = React.useRef<HTMLDivElement>(null)

  const [scope, setScope] = React.useState<GalleryScope>("community")
  const [tab, setTab] = React.useState<GalleryTab>("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const deferredQuery = React.useDeferredValue(searchQuery)
  const [communityState, setCommunityState] =
    React.useState<CommunityState>(INITIAL_COMMUNITY_STATE)
  const [communityImages, setCommunityImages] =
    React.useState<CommunityImageState>(() => ({
      urls: new Map(),
      loading: new Set(),
      errors: new Set(),
    }))
  const communityUrlsRef = React.useRef<Map<number, string>>(new Map())
  const communityLoadersRef = React.useRef<Set<number>>(new Set())
  const [communityPreview, setCommunityPreview] =
    React.useState<HistoryRecord | null>(null)
  const [publishTarget, setPublishTarget] =
    React.useState<HistoryRecord | null>(null)

  const [deleteTarget, setDeleteTarget] =
    React.useState<HistoryRecord | null>(null)

  const communityQuery = deferredQuery.trim()
  const communityLoadingRef = React.useRef(false)
  const communityRequestIdRef = React.useRef(0)

  const loadCommunityPage = React.useCallback(
    async (page: number, mode: "reset" | "append") => {
      if (scope !== "community" || communityLoadingRef.current) return
      communityLoadingRef.current = true
      const requestId = communityRequestIdRef.current + 1
      communityRequestIdRef.current = requestId
      setCommunityState((current) =>
        mode === "reset"
          ? { ...INITIAL_COMMUNITY_STATE, status: "loading" }
          : { ...current, status: "loading", message: undefined }
      )
      try {
        const response = await recordsApi.list({
          scope: "public",
          q: communityQuery,
          page,
          pageSize: GALLERY_PAGE_SIZE,
        })
        const rows = response.data.records.map((dto) => dtoToRecord(dto))
        if (communityRequestIdRef.current !== requestId) return
        setCommunityState((current) => {
          const records =
            mode === "reset"
              ? rows
              : appendUniqueRecords(current.records, rows)
          return {
            status: "ready",
            records,
            page: response.meta?.page ?? page,
            total: response.meta?.total ?? records.length,
            totalPages: response.meta?.totalPages ?? page,
          }
        })
      } catch (error) {
        if (communityRequestIdRef.current !== requestId) return
        setCommunityState((current) => ({
          ...current,
          status: "error",
          message: error instanceof Error ? error.message : "社区画廊加载失败",
        }))
      } finally {
        if (communityRequestIdRef.current === requestId) {
          communityLoadingRef.current = false
        }
      }
    },
    [communityQuery, scope]
  )

  React.useEffect(() => {
    communityRequestIdRef.current += 1
    communityLoadingRef.current = false
    if (scope !== "community") return
    void loadCommunityPage(1, "reset")
  }, [loadCommunityPage, scope])

  React.useEffect(() => {
    const urls = communityUrlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  const loadCommunityImage = React.useCallback(
    async (record: HistoryRecord) => {
      if (
        communityUrlsRef.current.has(record.id) ||
        communityLoadersRef.current.has(record.id)
      ) {
        return
      }
      communityLoadersRef.current.add(record.id)

      setCommunityImages((current) => {
        if (current.urls.has(record.id) || current.loading.has(record.id)) {
          return current
        }
        const loading = new Set(current.loading)
        const errors = new Set(current.errors)
        loading.add(record.id)
        errors.delete(record.id)
        return { urls: current.urls, loading, errors }
      })

      try {
        const url = await fetchImageBlobURL(String(record.id))
        const previous = communityUrlsRef.current.get(record.id)
        if (previous) URL.revokeObjectURL(previous)
        communityUrlsRef.current.set(record.id, url)
        setCommunityImages((current) => {
          const urls = new Map(current.urls)
          const loading = new Set(current.loading)
          const errors = new Set(current.errors)
          urls.set(record.id, url)
          loading.delete(record.id)
          errors.delete(record.id)
          return { urls, loading, errors }
        })
      } catch {
        setCommunityImages((current) => {
          const loading = new Set(current.loading)
          const errors = new Set(current.errors)
          loading.delete(record.id)
          errors.add(record.id)
          return { urls: current.urls, loading, errors }
        })
      } finally {
        communityLoadersRef.current.delete(record.id)
      }
    },
    []
  )

  const completed = React.useMemo(
    () =>
      [...records]
        .filter((record) => record.status === "completed")
        .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id),
    [records]
  )

  const mineQuery = deferredQuery.trim()
  const mineAll = usePagedRecords({
    enabled: scope === "mine" && tab === "all",
    params: {
      status: "completed",
      q: mineQuery,
    },
    pageSize: GALLERY_PAGE_SIZE,
  })
  const mineFavorites = usePagedRecords({
    enabled: scope === "mine" && tab === "favorites",
    params: {
      status: "completed",
      favorite: true,
      q: mineQuery,
    },
    pageSize: GALLERY_PAGE_SIZE,
  })

  const queryText = deferredQuery.trim().toLowerCase()
  const applyQuery = React.useCallback(
    (list: HistoryRecord[]) => {
      if (!queryText) return list
      return list.filter((record) =>
        record.prompt
          ? record.prompt.toLowerCase().includes(queryText)
          : false
      )
    },
    [queryText]
  )

  const allList = mineAll.records
  const favoritesList = mineFavorites.records
  const communityList = React.useMemo(
    () =>
      applyQuery(
        communityState.records.map((record) => {
          const url = communityImages.urls.get(record.id)
          if (url) return { ...record, base64: url, imageError: undefined }
          if (communityImages.errors.has(record.id)) {
            return { ...record, imageError: "图片加载失败" }
          }
          return record
        })
      ),
    [
      applyQuery,
      communityImages.errors,
      communityImages.urls,
      communityState.records,
    ]
  )

  const sortedProjects = React.useMemo(
    () => [...projects].sort((a, b) => b.createdAt - a.createdAt),
    [projects]
  )

  const handleReuse = React.useCallback(
    (record: HistoryRecord) => {
      navigate(`/?activeId=${record.id}`)
      toast.info("已切回工作台")
    },
    [navigate]
  )

  const handleMoveToProject = React.useCallback(
    async (record: HistoryRecord, projectId: number | undefined) => {
      await updateRecord(record.id, { projectId })
      toast.success("已移动到新项目")
    },
    [updateRecord]
  )

  const handleToggleFavorite = React.useCallback(
    async (record: HistoryRecord) => {
      await updateRecord(record.id, { favorite: !record.favorite })
      setCommunityState((current) => ({
        ...current,
        records: current.records.map((item) =>
          item.id === record.id
            ? { ...item, favorite: !record.favorite }
            : item
        ),
      }))
      setCommunityPreview((current) =>
        current?.id === record.id
          ? { ...current, favorite: !record.favorite }
          : current
      )
      toast.success(record.favorite ? "已取消收藏" : "已加入收藏")
    },
    [updateRecord]
  )

  const handleTogglePublic = React.useCallback(
    async (record: HistoryRecord) => {
      if (!record.isPublic) {
        setPublishTarget(record)
        return
      }
      await updateRecord(record.id, { isPublic: false, promptPublic: true })
      toast.success("已取消公开")
    },
    [updateRecord]
  )

  const confirmPublish = React.useCallback(
    async (record: HistoryRecord, options: PublishOptions) => {
      await updateRecord(record.id, {
        isPublic: true,
        promptPublic: options.promptPublic,
      })
      setPublishTarget(null)
      toast.success("已公开到社区画廊")
    },
    [updateRecord]
  )

  const handleCopyPrompt = React.useCallback(async (record: HistoryRecord) => {
    try {
      await navigator.clipboard.writeText(record.prompt)
      toast.success("提示词已复制")
    } catch {
      toast.error("复制失败")
    }
  }, [])

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget) return
    await deleteRecord(deleteTarget.id)
    setDeleteTarget(null)
    toast.success("已删除")
  }, [deleteRecord, deleteTarget])

  const handleOpenLightbox = React.useCallback(
    (record: HistoryRecord, navList: HistoryRecord[]) => {
      if (!record.base64) {
        void reloadImage(record.id)
        return
      }
      openWith(
        record.id,
        navList.map((item) => item.id)
      )
    },
    [openWith, reloadImage]
  )

  const handleOpenCommunityPreview = React.useCallback(
    (record: HistoryRecord) => {
      if (!record.base64) {
        void loadCommunityImage(record)
        return
      }
      setCommunityPreview(record)
    },
    [loadCommunityImage]
  )

  const communityPreviewIndex = communityPreview
    ? communityList.findIndex((record) => record.id === communityPreview.id)
    : -1
  const hasCommunityNav =
    communityPreviewIndex >= 0 && communityList.length > 1

  const renderAlbum = (
    list: HistoryRecord[],
    className?: string,
    editable = true
  ) => (
    <GalleryAlbum
      list={list}
      projects={sortedProjects}
      editable={editable}
      className={className}
      onOpen={
        editable
          ? handleOpenLightbox
          : handleOpenCommunityPreview
      }
      onReuse={handleReuse}
      onMoveToProject={handleMoveToProject}
      onToggleFavorite={handleToggleFavorite}
      onTogglePublic={handleTogglePublic}
      onCopyPrompt={handleCopyPrompt}
      onRequestImage={
        editable ? (record) => void reloadImage(record.id) : loadCommunityImage
      }
      onRequestDelete={setDeleteTarget}
    />
  )

  const currentMinePage = tab === "favorites" ? mineFavorites : mineAll
  const currentMineLoadMore = currentMinePage.loadMore
  const currentHasMore =
    scope === "community"
      ? communityState.page < communityState.totalPages
      : tab === "projects"
        ? false
        : currentMinePage.hasMore
  const currentLoadingMore =
    scope === "community"
      ? communityState.status === "loading" && communityState.records.length > 0
      : tab === "projects"
        ? false
        : currentMinePage.isLoadingMore

  const handleLoadMore = React.useCallback(() => {
    if (scope === "community") {
      if (communityState.status === "loading") return
      if (communityState.page >= communityState.totalPages) return
      void loadCommunityPage(communityState.page + 1, "append")
      return
    }
    if (tab === "projects") return
    currentMineLoadMore()
  }, [
    communityState.page,
    communityState.status,
    communityState.totalPages,
    currentMineLoadMore,
    loadCommunityPage,
    scope,
    tab,
  ])

  const projectSections = React.useMemo(() => {
    type Section = {
      key: string
      name: string
      list: HistoryRecord[]
    }
    const sections: Section[] = []

    const unclassified = applyQuery(
      completed.filter((record) => record.projectId === undefined)
    )
    if (unclassified.length > 0) {
      sections.push({ key: "inbox", name: "未分类", list: unclassified })
    }

    for (const project of sortedProjects) {
      const list = applyQuery(
        completed.filter((record) => record.projectId === project.id)
      )
      if (list.length > 0) {
        sections.push({
          key: `project-${project.id}`,
          name: project.name,
          list,
        })
      }
    }

    return sections
  }, [applyQuery, completed, sortedProjects])

  const hasAnyCompleted = completed.length > 0

  let content: React.ReactNode = null
  if (scope === "community") {
    if (
      communityState.status === "loading" &&
      communityState.records.length === 0
    ) {
      content = <LoadingArea />
    } else if (communityState.status === "error") {
      content = (
        <EmptyArea
          deferredQuery=""
          onClearSearch={() => setSearchQuery("")}
          emptyTitle="社区画廊加载失败"
          emptyDescription={communityState.message ?? "请稍后重试"}
        />
      )
    } else {
      content =
        communityList.length > 0 ? (
          renderAlbum(communityList, "p-3", false)
        ) : (
          <EmptyArea
            deferredQuery={deferredQuery}
            onClearSearch={() => setSearchQuery("")}
            emptyTitle="社区画廊还是空的"
            emptyDescription="公开图片后会出现在这里"
          />
        )
    }
  } else if (tab === "all") {
    content =
      mineAll.isLoadingInitial ? (
        <LoadingArea />
      ) :
      allList.length > 0 ? (
        renderAlbum(allList, "p-3")
      ) : (
        <EmptyArea
          deferredQuery={deferredQuery}
          onClearSearch={() => setSearchQuery("")}
          emptyTitle="画廊还是空的"
          emptyDescription="先去工作台生成一些图吧"
        />
      )
  } else if (tab === "favorites") {
    content =
      mineFavorites.isLoadingInitial ? (
        <LoadingArea />
      ) :
      favoritesList.length > 0 ? (
        renderAlbum(favoritesList, "p-3")
      ) : (
        <EmptyArea
          deferredQuery={deferredQuery}
          onClearSearch={() => setSearchQuery("")}
          emptyTitle={hasAnyCompleted ? "还没有收藏" : "画廊还是空的"}
          emptyDescription={
            hasAnyCompleted
              ? "在工作台或 Lightbox 里点星标加入收藏"
              : "先去工作台生成一些图吧"
          }
        />
      )
  } else {
    content =
      projectSections.length > 0 ? (
        <div className="flex flex-col">
          {projectSections.map((section) => (
            <section key={section.key}>
              <h2 className="flex items-center gap-2 px-4 pb-2 pt-4 text-sm font-medium">
                {section.name}
              </h2>
              {renderAlbum(section.list, "px-3 pb-3")}
            </section>
          ))}
        </div>
      ) : (
        <EmptyArea
          deferredQuery={deferredQuery}
          onClearSearch={() => setSearchQuery("")}
          emptyTitle="画廊还是空的"
          emptyDescription="先去工作台生成一些图吧"
        />
      )
  }

  return (
    <main className="h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      <div className="flex h-full flex-col">
        <div className="flex min-h-12 shrink-0 flex-col gap-2 px-4 py-2">
          <div className="mx-auto flex w-full max-w-7xl min-w-0 justify-center">
            <Tabs
              value={scope}
              onValueChange={(value) => setScope(value as GalleryScope)}
            >
              <TabsList variant="line">
                <TabsTrigger value="mine">
                  <Lock />
                  我的
                </TabsTrigger>
                <TabsTrigger value="community">
                  <Globe2 />
                  社区
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="mx-auto grid w-full max-w-7xl gap-2 px-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex min-w-0 justify-start">
              {scope === "mine" ? (
                <Tabs
                  value={tab}
                  onValueChange={(value) => setTab(value as GalleryTab)}
                >
                  <TabsList>
                    <TabsTrigger value="all">全部</TabsTrigger>
                    <TabsTrigger value="favorites">收藏</TabsTrigger>
                    <TabsTrigger value="projects">按项目</TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : null}
            </div>
            <div className="relative w-full max-w-full justify-self-end md:w-64">
              <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="搜索提示词"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
          <div className="mx-auto w-full max-w-7xl">
            <TabFade tabKey={`${scope}:${tab}`}>
              {content}
              {currentLoadingMore ? <LoadingArea compact /> : null}
              <InfiniteLoadSentinel
                disabled={!currentHasMore || currentLoadingMore}
                onLoadMore={handleLoadMore}
                rootRef={viewportRef}
              />
            </TabFade>
          </div>
        </ScrollArea>
      </div>

      <ImagePreviewDialog
        open={communityPreview !== null}
        record={communityPreview}
        title="社区图片预览"
        description="查看社区公开图片"
        nav={
          hasCommunityNav
            ? {
                canPrev: communityPreviewIndex > 0,
                canNext: communityPreviewIndex < communityList.length - 1,
                onPrev: () => {
                  if (communityPreviewIndex > 0) {
                    setCommunityPreview(communityList[communityPreviewIndex - 1])
                  }
                },
                onNext: () => {
                  if (communityPreviewIndex < communityList.length - 1) {
                    setCommunityPreview(communityList[communityPreviewIndex + 1])
                  }
                },
              }
            : undefined
        }
        onOpenChange={(next) => {
          if (!next) setCommunityPreview(null)
        }}
        onCopyPrompt={handleCopyPrompt}
        onToggleFavorite={handleToggleFavorite}
        showFavorite
        hidePrivatePrompt
      />

      <PublishConfirmDialog
        record={publishTarget}
        onOpenChange={(open) => {
          if (!open) setPublishTarget(null)
        }}
        onConfirm={confirmPublish}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这张记录?</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可恢复,会同步从存储中清除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

type GalleryAlbumProps = {
  list: HistoryRecord[]
  projects: Project[]
  editable: boolean
  className?: string
  onOpen: (record: HistoryRecord, navList: HistoryRecord[]) => void
  onReuse: (record: HistoryRecord) => void
  onMoveToProject: (
    record: HistoryRecord,
    projectId: number | undefined
  ) => void
  onToggleFavorite: (record: HistoryRecord) => void
  onTogglePublic: (record: HistoryRecord) => void
  onCopyPrompt: (record: HistoryRecord) => void
  onRequestImage: (record: HistoryRecord) => void
  onRequestDelete: (record: HistoryRecord) => void
}

function GalleryAlbum({
  list,
  projects,
  editable,
  className,
  onOpen,
  onReuse,
  onMoveToProject,
  onToggleFavorite,
  onTogglePublic,
  onCopyPrompt,
  onRequestImage,
  onRequestDelete,
}: GalleryAlbumProps) {
  const [naturalSizes, setNaturalSizes] = React.useState<
    Map<number, NaturalImageSize>
  >(() => new Map())

  React.useEffect(() => {
    let cancelled = false
    const loaders: HTMLImageElement[] = []

    for (const record of list) {
      const src = record.base64
      if (!src) continue

      const image = new Image()
      loaders.push(image)
      image.onload = () => {
        if (
          cancelled ||
          image.naturalWidth <= 0 ||
          image.naturalHeight <= 0
        ) {
          return
        }

        setNaturalSizes((current) => {
          const previous = current.get(record.id)
          if (
            previous &&
            previous.src === src &&
            previous.width === image.naturalWidth &&
            previous.height === image.naturalHeight
          ) {
            return current
          }

          const next = new Map(current)
          next.set(record.id, {
            src,
            width: image.naturalWidth,
            height: image.naturalHeight,
          })
          return next
        })
      }
      image.src = src
    }

    return () => {
      cancelled = true
      for (const image of loaders) {
        image.onload = null
      }
    }
  }, [list])

  const photos = React.useMemo(
    () =>
      list.map((record) => {
        const size = naturalSizes.get(record.id)
        const [width, height] =
          size && size.src === record.base64
            ? [size.width, size.height]
            : imageSizeToDimensions(record.imageParams.size)
        return {
          key: String(record.id),
          src: record.base64 ?? "",
          alt: record.prompt.slice(0, 40),
          width,
          height,
          record,
        } satisfies GalleryPhoto
      }),
    [list, naturalSizes]
  )

  return (
    <div className={cn("w-full", className)}>
      <MasonryPhotoAlbum
        photos={photos}
        spacing={6}
        padding={0}
        columns={(containerWidth) => {
          if (containerWidth < 640) return 2
          if (containerWidth < 1024) return 3
          if (containerWidth < 1280) return 4
          return 5
        }}
        sizes={{
          size: "calc((100vw - 36px) / 2)",
          sizes: [
            {
              viewport: "(min-width: 640px)",
              size: "calc((100vw - 48px) / 3)",
            },
            {
              viewport: "(min-width: 1024px)",
              size: "calc((100vw - 60px) / 4)",
            },
            {
              viewport: "(min-width: 1280px)",
              size: "240px",
            },
          ],
        }}
        render={{
          photo: (_props, { photo, width, height }) => (
            <GalleryCard
              key={photo.key}
              record={photo.record}
              projects={projects}
              editable={editable}
              width={width}
              height={height}
              onOpen={(target) => onOpen(target, list)}
              onReuse={onReuse}
              onMoveToProject={onMoveToProject}
              onToggleFavorite={onToggleFavorite}
              onTogglePublic={onTogglePublic}
              onCopyPrompt={onCopyPrompt}
              onRequestImage={onRequestImage}
              onRequestDelete={onRequestDelete}
            />
          ),
        }}
      />
    </div>
  )
}

type GalleryCardProps = {
  record: HistoryRecord
  projects: Project[]
  editable: boolean
  width: number
  height: number
  onOpen: (record: HistoryRecord) => void
  onReuse: (record: HistoryRecord) => void
  onMoveToProject: (
    record: HistoryRecord,
    projectId: number | undefined
  ) => void
  onToggleFavorite: (record: HistoryRecord) => void
  onTogglePublic: (record: HistoryRecord) => void
  onCopyPrompt: (record: HistoryRecord) => void
  onRequestImage: (record: HistoryRecord) => void
  onRequestDelete: (record: HistoryRecord) => void
}

function GalleryCard({
  record,
  projects,
  editable,
  width,
  height,
  onOpen,
  onReuse,
  onMoveToProject,
  onToggleFavorite,
  onTogglePublic,
  onCopyPrompt,
  onRequestImage,
  onRequestDelete,
}: GalleryCardProps) {
  const { listItem } = useMotionVariants()
  const cardRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (record.status !== "completed" || record.base64 || record.imageError) {
      return
    }

    const node = cardRef.current
    if (!node) return

    let requested = false
    const requestImage = () => {
      if (requested) return
      requested = true
      onRequestImage(record)
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
      { rootMargin: "200px 0px" }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [onRequestImage, record])

  const isImageLoading =
    record.status === "completed" && !record.base64 && !record.imageError

  return (
    <motion.div
      ref={cardRef}
      layout
      variants={listItem}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      className="group relative overflow-hidden border bg-card"
      style={{ width, height }}
    >
      <button
        type="button"
        onClick={() => onOpen(record)}
        className={cn(
          "block size-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          record.base64 ? "cursor-zoom-in" : "cursor-default"
        )}
        aria-label={record.base64 ? "预览图片" : "图片加载中"}
      >
        {record.base64 ? (
          <img
            src={record.base64}
            alt={record.prompt.slice(0, 40)}
            className="block size-full object-contain"
          />
        ) : isImageLoading ? (
          <Skeleton className="size-full rounded-none" />
        ) : record.imageError ? (
          <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
            <ImageIcon className="size-8" />
          </div>
        ) : (
          <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
            <ImageIcon className="size-8" />
          </div>
        )}
      </button>

      {record.favorite || record.isPublic ? (
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1">
          {record.favorite ? (
            <Star
              aria-label="已收藏"
              className="size-4 fill-amber-400 text-amber-400"
            />
          ) : null}
          {record.isPublic ? (
            <Globe2
              aria-label="已公开"
              className="size-4 text-muted-foreground"
            />
          ) : null}
        </div>
      ) : null}

      <div className="pointer-events-none absolute right-2 top-2 flex translate-y-[-0.25rem] items-center gap-0.5 rounded-md bg-popover/70 p-0.5 text-popover-foreground opacity-0 shadow-sm ring-1 ring-foreground/10 backdrop-blur-2xl backdrop-saturate-150 transition group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
        {record.prompt || record.promptPublic === false ? (
          <PromptButton record={record} onCopyPrompt={onCopyPrompt} />
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                onToggleFavorite(record)
              }}
              aria-label={record.favorite ? "取消收藏" : "收藏"}
            >
              <Star
                className={cn(
                  "size-3.5",
                  record.favorite && "fill-amber-400 text-amber-400"
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{record.favorite ? "取消收藏" : "收藏"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                downloadRecordImage(record)
              }}
              disabled={!record.base64}
              aria-label="下载图片"
            >
              <Download className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>下载</TooltipContent>
        </Tooltip>

        {editable ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation()
                    onTogglePublic(record)
                  }}
                  aria-label={record.isPublic ? "取消公开" : "公开到社区"}
                >
                  {record.isPublic ? (
                    <Lock className="size-3.5" />
                  ) : (
                    <Globe2 className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {record.isPublic ? "取消公开" : "公开到社区"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation()
                    onReuse(record)
                  }}
                  aria-label="复用提示词"
                >
                  <WandSparkles className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复用提示词</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={(event) => event.stopPropagation()}
                      aria-label="移到项目"
                    >
                      <FolderInput className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>移到项目</TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                onClick={(event) => event.stopPropagation()}
              >
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
                    <Archive className="size-4" />
                    {project.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRequestDelete(record)
                  }}
                  aria-label="删除"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>删除</TooltipContent>
            </Tooltip>
          </>
        ) : null}
      </div>
    </motion.div>
  )
}

function PromptButton({
  record,
  onCopyPrompt,
}: {
  record: HistoryRecord
  onCopyPrompt: (record: HistoryRecord) => void
}) {
  return (
    <RecordDetailsPopover
      record={record}
      icon={<FileText className="size-3.5" />}
      onCopyPrompt={record.prompt ? onCopyPrompt : undefined}
      onClick={(event) => event.stopPropagation()}
    />
  )
}

function imageSizeToDimensions(size: string): [number, number] {
  const parts = size.split("x").map(Number)
  if (parts.length !== 2 || !parts[0] || !parts[1]) return [1, 1]
  return [parts[0], parts[1]]
}

function LoadingArea({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: compact ? 4 : 8 }, (_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "w-full rounded-none",
            index % 3 === 0
              ? "aspect-[3/4]"
              : index % 3 === 1
                ? "aspect-square"
                : "aspect-[4/3]"
          )}
        />
      ))}
    </div>
  )
}

function EmptyArea({
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
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
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
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-2 p-8 text-center">
      <ImageIcon className="size-10 text-muted-foreground" />
      <p className="text-sm font-medium">{emptyTitle}</p>
      <p className="text-xs text-muted-foreground">{emptyDescription}</p>
    </div>
  )
}
