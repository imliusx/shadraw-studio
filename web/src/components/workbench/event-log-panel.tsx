import * as React from "react"
import { motion } from "motion/react"
import { Activity, Eraser } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"
import {
  useEventLog,
  type EventLogEntry,
  type EventLogLevel,
} from "@/providers/app-state-provider"

const LEVEL_LABEL: Record<EventLogLevel, string> = {
  info: "INFO ",
  event: "EVENT",
  data: "DATA ",
  done: "DONE ",
  error: "ERROR",
}

const LEVEL_CLASS: Record<EventLogLevel, string> = {
  info: "text-muted-foreground",
  event: "text-amber-500",
  data: "text-blue-500",
  done: "text-green-500",
  error: "text-destructive",
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, "0")
  const ms = String(d.getMilliseconds()).padStart(3, "0")
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`
}

export function EventLogPanel() {
  const { entries, clear } = useEventLog()
  const viewportRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [entries])

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-between px-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Activity className="size-3.5" />
          <span>实时事件流</span>
          <span className="tabular-nums">[{entries.length}]</span>
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={clear}
          disabled={entries.length === 0}
          aria-label="清空日志"
        >
          <Eraser className="size-3.5" />
        </Button>
      </div>

      <div
        ref={viewportRef}
        className="min-h-0 flex-1 overflow-auto bg-background font-mono text-xs leading-relaxed"
      >
        {entries.length === 0 ? (
          <div className="flex h-full min-h-24 items-center justify-center px-4 py-8 text-center text-xs text-muted-foreground">
            <span className="opacity-60">
              {"// 点击右侧「生成图片」后,这里会显示实时 SSE 事件流"}
            </span>
          </div>
        ) : (
          <ol className="px-3 py-2">
            {entries.map((entry) => (
              <LogLine key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

function LogLine({ entry }: { entry: EventLogEntry }) {
  const { listItem } = useMotionVariants()
  return (
    <motion.li
      variants={listItem}
      initial="hidden"
      animate="show"
      className="flex items-baseline gap-2 whitespace-pre"
    >
      <span className="shrink-0 text-muted-foreground/70 tabular-nums">
        {formatTime(entry.ts)}
      </span>
      <span
        className={cn(
          "shrink-0 font-semibold tracking-wide",
          LEVEL_CLASS[entry.level]
        )}
      >
        {LEVEL_LABEL[entry.level]}
      </span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-foreground">
        {entry.message}
      </span>
    </motion.li>
  )
}
