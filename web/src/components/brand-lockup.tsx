import { cn } from "@/lib/utils"

type BrandLockupProps = {
  title: string
  subtitle?: string
  className?: string
  titleClassName?: string
  subtitleClassName?: string
}

export function BrandLockup({
  title,
  subtitle,
  className,
  titleClassName,
  subtitleClassName,
}: BrandLockupProps) {
  return (
    <span className={cn("inline-flex max-w-full flex-col gap-0.5", className)}>
      <span
        className={cn(
          "font-brand-wordmark block truncate text-xl text-foreground/80",
          titleClassName
        )}
      >
        {title}
      </span>
      {subtitle ? (
        <span
          className={cn(
            "block truncate text-2xs font-medium uppercase leading-none tracking-widest text-muted-foreground",
            subtitleClassName
          )}
        >
          {subtitle}
        </span>
      ) : null}
    </span>
  )
}
