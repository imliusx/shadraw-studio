import * as React from "react"

type InfiniteLoadSentinelProps = {
  disabled: boolean
  onLoadMore: () => void
  rootRef?: React.RefObject<HTMLDivElement | null>
  rootMargin?: string
  className?: string
}

export function InfiniteLoadSentinel({
  disabled,
  onLoadMore,
  rootRef,
  rootMargin = "480px 0px",
  className = "h-px",
}: InfiniteLoadSentinelProps) {
  const nodeRef = React.useRef<HTMLDivElement | null>(null)
  const onLoadMoreRef = React.useRef(onLoadMore)

  React.useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  React.useEffect(() => {
    const node = nodeRef.current
    if (!node || disabled) return

    if (!("IntersectionObserver" in window)) {
      onLoadMoreRef.current()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current()
        }
      },
      {
        root: rootRef?.current ?? null,
        rootMargin,
      }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [disabled, rootMargin, rootRef])

  return <div ref={nodeRef} className={className} aria-hidden="true" />
}
