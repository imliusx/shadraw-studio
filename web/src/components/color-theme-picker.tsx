import { Palette } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { glassOverlayContentClassName } from "@/lib/surface-styles"
import { COLOR_THEME_OPTIONS, type ColorTheme } from "@/lib/theme/color-theme"
import { cn } from "@/lib/utils"
import { useColorTheme } from "@/providers/use-color-theme"

export function ColorThemePicker() {
  const { colorTheme, setColorTheme } = useColorTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="切换配色主题"
        >
          <Palette />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(glassOverlayContentClassName, "w-30 min-w-30")}
      >
        <DropdownMenuRadioGroup
          value={colorTheme}
          onValueChange={(value) => setColorTheme(value as ColorTheme)}
        >
          {COLOR_THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <span
                aria-hidden="true"
                className={cn(
                  "size-3 rounded-full ring-1 ring-border",
                  option.swatchClassName
                )}
              />
              <span className="text-sm">{option.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
