"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ImagePlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
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

  return (
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt={`参考图 ${index + 1}`}
              className="size-8 rounded-md border bg-background object-cover transition-transform group-hover:scale-110"
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
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
  )
}
