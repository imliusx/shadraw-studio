import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
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
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"

export type ReadImageResult =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string }

export function readImageFileAsDataUrl(
  file: File,
  maxSizeMB = 8
): Promise<ReadImageResult> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve({ ok: false, error: "仅支持图片文件" })
      return
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      resolve({ ok: false, error: `图片不能大于 ${maxSizeMB} MB` })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve({ ok: true, dataUrl: reader.result })
      } else {
        resolve({ ok: false, error: "读取失败,请重试" })
      }
    }
    reader.onerror = () => resolve({ ok: false, error: "读取失败,请重试" })
    reader.readAsDataURL(file)
  })
}

type ReferenceImageUploaderProps = {
  values: string[]
  onRemove: (index: number) => void
  onPick: () => void
  max: number
  disabled?: boolean
}

export function ReferenceImageUploader({
  values,
  onRemove,
  onPick,
  max,
  disabled = false,
}: ReferenceImageUploaderProps) {
  const { scaleFade } = useMotionVariants()
  const canAdd = values.length < max
  const [previewIndex, setPreviewIndex] = React.useState<number | null>(null)
  const previewSrc = previewIndex === null ? null : values[previewIndex] ?? null
  const previewLabel =
    previewIndex !== null ? `参考图 ${previewIndex + 1}` : "参考图预览"
  const canPreviewPrev = previewIndex !== null && previewIndex > 0
  const canPreviewNext =
    previewIndex !== null && previewIndex < values.length - 1

  React.useEffect(() => {
    setPreviewIndex((current) => {
      if (current === null) return current
      if (values.length === 0) return null
      return Math.min(current, values.length - 1)
    })
  }, [values.length])

  return (
    <>
      <div className="flex items-center">
        <AnimatePresence initial={false}>
          {values.map((dataUrl, index) => (
            <motion.div
              key={`${index}-${dataUrl.slice(-16)}`}
              variants={scaleFade}
              initial="hidden"
              animate="show"
              exit="hidden"
              style={{ zIndex: values.length - index }}
              className={cn(
                "group relative transition-transform hover:!z-50",
                index > 0 && "-ml-2.5"
              )}
            >
              <button
                type="button"
                onClick={() => setPreviewIndex(index)}
                aria-label={`预览参考图 ${index + 1}`}
                className="block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <img
                  src={dataUrl}
                  alt={`参考图 ${index + 1}`}
                  className="size-8 cursor-zoom-in rounded-md border bg-background object-cover transition-transform group-hover:scale-110"
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemove(index)
                }}
                disabled={disabled}
                aria-label={`移除参考图 ${index + 1}`}
                className="absolute -right-1 -top-1 inline-flex size-3.5 items-center justify-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="size-2.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {canAdd ? (
          <motion.div
            key="trigger"
            variants={scaleFade}
            initial="hidden"
            animate="show"
            className={cn("relative", values.length > 0 && "ml-0.5")}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onPick}
                  disabled={disabled}
                  aria-label="添加参考图"
                >
                  <ImagePlus />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">添加参考图</TooltipContent>
            </Tooltip>
          </motion.div>
        ) : null}
      </div>
      <Dialog
        open={previewIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewIndex(null)
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="fixed inset-0 left-0 top-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center gap-0 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0 duration-0 outline-none before:hidden sm:max-w-none data-open:animate-none data-open:fade-in-0 data-open:zoom-in-100 data-closed:animate-none data-closed:fade-out-0 data-closed:zoom-out-100"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreviewIndex(null)
            }
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{previewLabel}</DialogTitle>
            <DialogDescription>查看已上传的参考图</DialogDescription>
          </DialogHeader>
          <div
            className="relative flex h-[90vh] w-[90vw] items-center justify-center"
            onPointerDown={() => setPreviewIndex(null)}
          >
            {previewSrc ? (
              <div
                className="relative max-h-full max-w-full"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <img
                  src={previewSrc}
                  alt={previewLabel}
                  className="block max-h-[90vh] max-w-[90vw] object-contain"
                />
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-2 top-2"
                    aria-label="关闭预览"
                  >
                    <X />
                  </Button>
                </DialogClose>
              </div>
            ) : null}
          </div>
          {values.length > 1 ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute left-8 top-1/2 -translate-y-1/2"
                onClick={() => {
                  if (canPreviewPrev) {
                    setPreviewIndex((current) =>
                      current === null ? current : current - 1
                    )
                  }
                }}
                disabled={!canPreviewPrev}
                aria-label="上一张参考图"
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-8 top-1/2 -translate-y-1/2"
                onClick={() => {
                  if (canPreviewNext) {
                    setPreviewIndex((current) =>
                      current === null ? current : current + 1
                    )
                  }
                }}
                disabled={!canPreviewNext}
                aria-label="下一张参考图"
              >
                <ChevronRight />
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
