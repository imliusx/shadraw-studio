import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AnimatedThemeToggler
          variant="circle"
          isDark={isDark}
          onToggleTheme={(nextIsDark) => {
            setTheme(nextIsDark ? "dark" : "light")
          }}
          aria-label="切换明暗模式"
          className="inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
        />
      </TooltipTrigger>
      <TooltipContent>切换明暗模式</TooltipContent>
    </Tooltip>
  )
}
