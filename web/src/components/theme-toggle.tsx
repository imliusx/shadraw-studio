import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { buttonVariants } from "@/components/ui/button"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <AnimatedThemeToggler
      variant="circle"
      isDark={isDark}
      onToggleTheme={(nextIsDark) => {
        setTheme(nextIsDark ? "dark" : "light")
      }}
      aria-label="切换明暗模式"
      className={buttonVariants({
        variant: "ghost",
        size: "icon",
        className: "size-8",
      })}
    />
  )
}
