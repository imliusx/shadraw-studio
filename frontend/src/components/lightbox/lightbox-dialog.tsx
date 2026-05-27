"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { useHistory, useLightbox } from "@/app/providers/app-state-provider"
import {
  PublishConfirmDialog,
  type PublishOptions,
} from "@/components/gallery/publish-confirm-dialog"
import { ImagePreviewDialog } from "@/components/lightbox/image-preview-dialog"
import type { HistoryRecord } from "@/components/workbench/types"

export function LightboxDialog() {
  const { open, recordId, navList, openWith, close } = useLightbox()
  const { getById, updateRecord, reloadImage } = useHistory()
  const [publishTarget, setPublishTarget] = useState<HistoryRecord | null>(null)

  const record = recordId !== null ? getById(recordId) : undefined

  useEffect(() => {
    if (open && recordId !== null && !record) {
      close()
    }
  }, [open, recordId, record, close])

  useEffect(() => {
    if (
      open &&
      record?.status === "completed" &&
      !record.base64 &&
      !record.imageError
    ) {
      void reloadImage(record.id)
    }
  }, [open, record, reloadImage])

  const currentIndex =
    navList && recordId !== null ? navList.indexOf(recordId) : -1
  const hasNav = navList !== null && navList.length > 1
  const canPrev = hasNav && currentIndex > 0
  const canNext =
    hasNav && currentIndex >= 0 && currentIndex < navList.length - 1

  const handlePrev = () => {
    if (canPrev && navList) {
      openWith(navList[currentIndex - 1], navList)
    }
  }

  const handleNext = () => {
    if (canNext && navList) {
      openWith(navList[currentIndex + 1], navList)
    }
  }

  const handleToggleFavorite = (target: HistoryRecord) => {
    void updateRecord(target.id, { favorite: !target.favorite })
  }

  const handleTogglePublic = (target: HistoryRecord) => {
    if (!target.isPublic) {
      setPublishTarget(target)
      return
    }
    void updateRecord(target.id, { isPublic: false, promptPublic: true })
    toast.success("已取消公开")
  }

  const handleConfirmPublish = (target: HistoryRecord, options: PublishOptions) => {
    void updateRecord(target.id, {
      isPublic: true,
      promptPublic: options.promptPublic,
    })
    setPublishTarget(null)
    toast.success("已公开到社区画廊")
  }

  const handleCopyPrompt = async (target: HistoryRecord) => {
    try {
      await navigator.clipboard.writeText(target.prompt)
      toast.success("提示词已复制")
    } catch {
      toast.error("复制失败")
    }
  }

  return (
    <>
      <ImagePreviewDialog
        open={open}
        record={record}
        showFavorite
        showVisibility
        nav={
          hasNav
            ? {
                canPrev,
                canNext,
                onPrev: handlePrev,
                onNext: handleNext,
              }
            : undefined
        }
        onOpenChange={(next) => {
          if (!next) close()
        }}
        onCopyPrompt={handleCopyPrompt}
        onToggleFavorite={handleToggleFavorite}
        onTogglePublic={handleTogglePublic}
      />
      <PublishConfirmDialog
        record={publishTarget}
        onOpenChange={(next) => {
          if (!next) setPublishTarget(null)
        }}
        onConfirm={handleConfirmPublish}
      />
    </>
  )
}
