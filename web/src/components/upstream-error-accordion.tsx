import * as React from "react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type UpstreamErrorAccordionProps = {
  error: string
  triggerLabel?: string
  className?: string
  contentClassName?: string
  scrollAreaClassName?: string
  defaultOpen?: boolean
  stopPropagation?: boolean
}

const ACCORDION_VALUE = "upstream-error"

export function UpstreamErrorAccordion({
  error,
  triggerLabel = "查看上游返回详情",
  className,
  contentClassName,
  scrollAreaClassName,
  defaultOpen,
  stopPropagation = false,
}: UpstreamErrorAccordionProps) {
  const stopBubbling = React.useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation()
  }, [])

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? ACCORDION_VALUE : undefined}
      className={cn(
        "w-full rounded-md border bg-background/60 text-left",
        className
      )}
      onClick={stopPropagation ? stopBubbling : undefined}
      onKeyDown={stopPropagation ? stopBubbling : undefined}
    >
      <AccordionItem value={ACCORDION_VALUE}>
        <AccordionTrigger className="px-3 py-2 text-xs text-muted-foreground hover:no-underline">
          <span className="truncate">{triggerLabel}</span>
        </AccordionTrigger>
        <AccordionContent className={cn("pb-0", contentClassName)}>
          <ScrollArea className={cn("max-h-40 border-t", scrollAreaClassName)}>
            <pre className="whitespace-pre-wrap break-words p-3 text-xs text-muted-foreground">
              {error}
            </pre>
          </ScrollArea>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
