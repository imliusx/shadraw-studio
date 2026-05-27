"use client"

import type * as React from "react"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Globe2,
  Lock,
  Star,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import type { HistoryRecord } from "@/components/workbench/types"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"

type ZoomState = {
  recordId: number | null
  value: number
  x: number
  y: number
  dragging: boolean
  dragStartX: number
  dragStartY: number
  originX: number
  originY: number
}

type PanLimits = {
  x: number
  y: number
}

type ImageBox = {
  width: number
  height: number
}

type PreviewNav = {
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
}

type ImagePreviewDialogProps = {
  open: boolean
  record: HistoryRecord | null | undefined
  title?: string
  description?: string
  showFavorite?: boolean
  showVisibility?: boolean
  hidePrivatePrompt?: boolean
  nav?: PreviewNav
  onOpenChange: (open: boolean) => void
  onCopyPrompt: (record: HistoryRecord) => void
  onToggleFavorite?: (record: HistoryRecord) => void
  onTogglePublic?: (record: HistoryRecord) => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25
const DOUBLE_CLICK_ZOOM = 2

const DEFAULT_ZOOM_STATE: ZoomState = {
  recordId: null,
  value: 1,
  x: 0,
  y: 0,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  originX: 0,
  originY: 0,
}

const EMPTY_IMAGE_BOX: ImageBox = {
  width: 0,
  height: 0,
}

function buildDownloadFilename(
  record: { id: number; createdAt: number }
): string {
  const stamp = new Date(record.createdAt)
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 15)
  return `shadraw-${stamp}-${record.id}.png`
}

function triggerDownload(src: string, filename: string) {
  const link = document.createElement("a")
  link.href = src
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function getFittedImageSize(
  viewport: HTMLDivElement | null,
  image: HTMLImageElement | null
): ImageBox {
  if (!viewport || !image?.naturalWidth || !image.naturalHeight) {
    return EMPTY_IMAGE_BOX
  }

  const rect = viewport.getBoundingClientRect()
  const fitScale = Math.min(
    rect.width / image.naturalWidth,
    rect.height / image.naturalHeight,
    1
  )

  return {
    width: image.naturalWidth * fitScale,
    height: image.naturalHeight * fitScale,
  }
}

function getPanLimits(
  viewport: HTMLDivElement | null,
  image: HTMLImageElement | null,
  zoom: number
): PanLimits {
  if (!viewport || zoom <= MIN_ZOOM) return { x: 0, y: 0 }

  const rect = viewport.getBoundingClientRect()
  const fitted = getFittedImageSize(viewport, image)

  return {
    x: Math.max(0, (fitted.width * zoom - rect.width) / 2),
    y: Math.max(0, (fitted.height * zoom - rect.height) / 2),
  }
}

function clampPan(value: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.max(-limit, Math.min(limit, value))
}

export function ImagePreviewDialog({
  open,
  record,
  title = "预览",
  description = "查看生成的图片",
  showFavorite = false,
  showVisibility = false,
  hidePrivatePrompt = false,
  nav,
  onOpenChange,
  onCopyPrompt,
  onToggleFavorite,
  onTogglePublic,
}: ImagePreviewDialogProps) {
  const { fadeIn, scaleFade } = useMotionVariants()
  const recordId = record?.id ?? null
  const imageSrc = record?.base64
  const isImageLoading = Boolean(
    record?.status === "completed" && !record.base64 && !record.imageError
  )
  const canUsePrompt = Boolean(
    record?.prompt && (!hidePrivatePrompt || record.promptPublic)
  )

  const [hovered, setHovered] = useState(false)
  const [zoomState, setZoomState] =
    useState<ZoomState>(DEFAULT_ZOOM_STATE)
  const [imageBox, setImageBox] = useState<ImageBox>(EMPTY_IMAGE_BOX)
  const imageViewportRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const zoom =
    zoomState.recordId === recordId
      ? zoomState
      : {
          ...DEFAULT_ZOOM_STATE,
          recordId,
        }

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setHovered(false)
        setZoomState(DEFAULT_ZOOM_STATE)
      }
      onOpenChange(next)
    },
    [onOpenChange]
  )

  const updateImageBox = useCallback(() => {
    const next = getFittedImageSize(
      imageViewportRef.current,
      imageRef.current
    )

    setImageBox((current) =>
      current.width === next.width && current.height === next.height
        ? current
        : next
    )

    setZoomState((current) => {
      if (
        current.recordId !== recordId ||
        current.value <= MIN_ZOOM
      ) {
        return current
      }

      const limits = getPanLimits(
        imageViewportRef.current,
        imageRef.current,
        current.value
      )
      const nextX = clampPan(current.x, limits.x)
      const nextY = clampPan(current.y, limits.y)

      if (nextX === current.x && nextY === current.y) {
        return current
      }

      return {
        ...current,
        x: nextX,
        y: nextY,
      }
    })
  }, [recordId])

  useEffect(() => {
    if (!open || recordId === null) return

    updateImageBox()

    const viewport = imageViewportRef.current
    let observer: ResizeObserver | undefined

    if (viewport && "ResizeObserver" in window) {
      observer = new ResizeObserver(updateImageBox)
      observer.observe(viewport)
    }

    window.addEventListener("resize", updateImageBox)

    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", updateImageBox)
    }
  }, [open, recordId, updateImageBox])

  const handleDownload = () => {
    if (!record || !imageSrc) return
    triggerDownload(imageSrc, buildDownloadFilename(record))
  }

  const applyZoom = (nextValue: number, nextPan?: { x: number; y: number }) => {
    const nextZoom = clampZoom(nextValue)
    const limits = getPanLimits(
      imageViewportRef.current,
      imageRef.current,
      nextZoom
    )
    const pan = nextPan ?? { x: zoom.x, y: zoom.y }

    setZoomState({
      ...zoom,
      recordId,
      value: nextZoom,
      dragging: false,
      x: clampPan(pan.x, limits.x),
      y: clampPan(pan.y, limits.y),
    })
  }

  const handleZoomOut = () => {
    applyZoom(zoom.value - ZOOM_STEP)
  }

  const handleZoomIn = () => {
    applyZoom(zoom.value + ZOOM_STEP)
  }

  const handleImageWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    applyZoom(zoom.value + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))
  }

  const handleImageDoubleClick = () => {
    applyZoom(zoom.value > MIN_ZOOM ? MIN_ZOOM : DOUBLE_CLICK_ZOOM)
  }

  const handleImagePointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (event.target === event.currentTarget) {
      handleOpenChange(false)
      return
    }
    if (zoom.value <= MIN_ZOOM) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setZoomState({
      ...zoom,
      recordId,
      dragging: true,
      dragStartX: event.clientX,
      dragStartY: event.clientY,
      originX: zoom.x,
      originY: zoom.y,
    })
  }

  const handleImagePointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!zoom.dragging || zoom.value <= MIN_ZOOM) return
    const limits = getPanLimits(
      imageViewportRef.current,
      imageRef.current,
      zoom.value
    )
    const nextX = zoom.originX + event.clientX - zoom.dragStartX
    const nextY = zoom.originY + event.clientY - zoom.dragStartY
    setZoomState({
      ...zoom,
      recordId,
      x: clampPan(nextX, limits.x),
      y: clampPan(nextY, limits.y),
    })
  }

  const handleImagePointerUp = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!zoom.dragging) return
    setZoomState({
      ...zoom,
      recordId,
      dragging: false,
    })
  }

  const shouldPinToolbarToImage =
    zoom.value <= MIN_ZOOM && imageBox.width > 0 && imageBox.height > 0
  const imageToolbarStyle: React.CSSProperties | undefined =
    shouldPinToolbarToImage
      ? {
          bottom: `calc(50% - ${imageBox.height / 2}px + 0.75rem)`,
        }
      : undefined

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 left-0 top-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center gap-0 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0 duration-0 outline-none sm:max-w-none data-open:animate-none data-open:fade-in-0 data-open:zoom-in-100 data-closed:animate-none data-closed:fade-out-0 data-closed:zoom-out-100"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            handleOpenChange(false)
          }
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div
          className="relative flex h-[90vh] w-[90vw] items-center justify-center"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <AnimatePresence mode="wait">
            {record && imageSrc ? (
              <motion.div
                key={record.id}
                variants={scaleFade}
                initial="hidden"
                animate="show"
                exit="exit"
                className="size-full"
              >
                <div
                  ref={imageViewportRef}
                  className={cn(
                    "flex size-full touch-none items-center justify-center overflow-hidden",
                    zoom.value > MIN_ZOOM
                      ? zoom.dragging
                        ? "cursor-grabbing"
                        : "cursor-grab"
                      : "cursor-zoom-in"
                  )}
                  onPointerDown={handleImagePointerDown}
                  onPointerMove={handleImagePointerMove}
                  onPointerUp={handleImagePointerUp}
                  onPointerCancel={handleImagePointerUp}
                  onWheel={handleImageWheel}
                  onDoubleClick={handleImageDoubleClick}
                >
                  <img
                    ref={imageRef}
                    src={imageSrc}
                    alt={record.prompt.slice(0, 40)}
                    draggable={false}
                    onLoad={updateImageBox}
                    className="block max-h-full max-w-full select-none object-contain transition-transform duration-150 ease-out"
                    style={{
                      transform: `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.value})`,
                    }}
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {isImageLoading ? (
            <Skeleton className="h-[70vh] w-[70vw] max-w-4xl rounded-lg" />
          ) : !record || !imageSrc ? (
            <div className="flex min-h-[40vh] min-w-[40vw] items-center justify-center text-sm text-muted-foreground">
              图片不可用
            </div>
          ) : null}

          <AnimatePresence>
            {record && hovered && (
              <motion.div
                key="toolbar"
                variants={fadeIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className={cn(
                  "absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-md bg-background/95 p-0.5 shadow-sm ring-1 ring-border backdrop-blur",
                  zoom.value > MIN_ZOOM && "bottom-4"
                )}
                style={imageToolbarStyle}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={handleZoomOut}
                      disabled={zoom.value <= MIN_ZOOM}
                      aria-label="缩小图片"
                    >
                      <ZoomOut />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>缩小</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={handleZoomIn}
                      disabled={zoom.value >= MAX_ZOOM}
                      aria-label="放大图片"
                    >
                      <ZoomIn />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>放大</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={handleDownload}
                      disabled={!imageSrc}
                      aria-label="下载图片"
                    >
                      <Download />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>下载</TooltipContent>
                </Tooltip>
                {showFavorite && onToggleFavorite ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => onToggleFavorite(record)}
                        aria-label={record.favorite ? "取消收藏" : "收藏"}
                      >
                        <Star
                          className={cn(
                            record.favorite && "fill-amber-400 text-amber-400"
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {record.favorite ? "取消收藏" : "收藏"}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                {showVisibility && onTogglePublic ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => onTogglePublic(record)}
                        aria-label={record.isPublic ? "取消公开" : "公开到社区"}
                      >
                        {record.isPublic ? <Lock /> : <Globe2 />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {record.isPublic ? "取消公开" : "公开到社区"}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                {canUsePrompt ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => onCopyPrompt(record)}
                        aria-label="复制提示词"
                      >
                        <Copy />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>复制提示词</TooltipContent>
                  </Tooltip>
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => handleOpenChange(false)}
                      aria-label="关闭"
                    >
                      <X />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>关闭</TooltipContent>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {nav ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="absolute left-8 top-1/2 -translate-y-1/2"
              onClick={nav.onPrev}
              disabled={!nav.canPrev}
              aria-label="上一张"
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-8 top-1/2 -translate-y-1/2"
              onClick={nav.onNext}
              disabled={!nav.canNext}
              aria-label="下一张"
            >
              <ChevronRight />
            </Button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
