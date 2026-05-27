"use client"

import { useApiStatus } from "@/app/providers/app-state-provider"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ApiStatus } from "@/components/workbench/types"
import { cn } from "@/lib/utils"

const STATUS_CONFIG = {
  idle: {
    label: "API Untested",
    dotClassName: "bg-muted-foreground",
  },
  testing: {
    label: "API Testing",
    dotClassName: "bg-amber-500",
  },
  success: {
    label: "API Ready",
    dotClassName: "bg-green-500",
  },
  error: {
    label: "API Error",
    dotClassName: "bg-destructive",
  },
} satisfies Record<ApiStatus, { label: string; dotClassName: string }>

export function ApiStatusIndicator() {
  const { status, errorMessage } = useApiStatus()
  const current = STATUS_CONFIG[status]

  const truncated =
    status === "error" && errorMessage
      ? errorMessage.length > 60
        ? errorMessage.slice(0, 60) + "..."
        : errorMessage
      : null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="status"
          aria-label={`API 状态: ${current.label}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-md"
        >
          <span className="relative flex size-2">
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-60",
                current.dotClassName
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                current.dotClassName
              )}
            />
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {current.label}
        {truncated ? (
          <span className="block opacity-70">{truncated}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}
