"use client"

import * as React from "react"
import {
  Bot,
  Copy,
  FileType,
  Maximize2,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { HistoryRecord } from "@/components/workbench/types"

type RecordDetailsPopoverProps = {
  record: HistoryRecord
  icon: React.ReactNode
  onCopyPrompt?: (record: HistoryRecord) => void
  onClick?: (event: React.MouseEvent) => void
}

type ParameterSummaryItem = {
  key: string
  label: string
  value: string
  icon: LucideIcon
}

function getParameterSummary(record: HistoryRecord) {
  const items: Array<Omit<ParameterSummaryItem, "value"> & { value?: string }> = [
    { key: "model", label: "模型", value: record.model, icon: Bot },
    {
      key: "size",
      label: "尺寸",
      value: record.imageParams.size,
      icon: Maximize2,
    },
    {
      key: "quality",
      label: "质量",
      value: record.imageParams.quality,
      icon: Sparkles,
    },
    {
      key: "format",
      label: "格式",
      value: record.imageParams.output_format?.toUpperCase(),
      icon: FileType,
    },
  ]

  return items.filter((item): item is ParameterSummaryItem =>
    Boolean(item.value)
  )
}

export function RecordDetailsPopover({
  record,
  icon,
  onCopyPrompt,
  onClick,
}: RecordDetailsPopoverProps) {
  const parameterSummary = getParameterSummary(record)

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onClick}
              aria-label="查看详情"
            >
              {icon}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>查看详情</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="bottom"
        align="end"
        className="flex max-h-[min(24rem,calc(100vh-5rem))] w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 overflow-hidden p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">详情</p>
          <p className="shrink-0 text-xs text-muted-foreground">
            {new Date(record.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="relative shrink-0 rounded-md border bg-muted/30">
          <ScrollArea className="h-40">
            <div className="p-3 pr-10">
              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                {record.prompt || "未公开"}
              </p>
            </div>
          </ScrollArea>
          {onCopyPrompt && record.prompt ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="absolute right-2 top-2"
                  onClick={() => onCopyPrompt(record)}
                  aria-label="复制提示词"
                >
                  <Copy />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制提示词</TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        <div className="flex min-h-0 min-w-0 shrink-0 gap-1.5 overflow-x-auto overflow-y-hidden pb-1">
          {parameterSummary.map((item) => {
            const Icon = item.icon

            return (
              <Badge
                key={item.key}
                variant="secondary"
                className="shrink-0 justify-start"
                title={`${item.label}: ${item.value}`}
                aria-label={`${item.label}: ${item.value}`}
              >
                <Icon aria-hidden="true" />
                <span>{item.value}</span>
              </Badge>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
