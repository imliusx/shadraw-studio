import * as React from "react"

import { ColorThemeContext } from "@/providers/color-theme-context"
import {
  COLOR_THEME_STORAGE_KEY,
  DEFAULT_COLOR_THEME,
  isColorTheme,
  type ColorTheme,
} from "@/lib/theme/color-theme"

function readStoredColorTheme(): ColorTheme {
  if (typeof window === "undefined") return DEFAULT_COLOR_THEME

  const stored = window.localStorage.getItem(COLOR_THEME_STORAGE_KEY)
  if (stored && isColorTheme(stored)) {
    return stored
  }

  return DEFAULT_COLOR_THEME
}

function applyColorTheme(theme: ColorTheme) {
  if (typeof document === "undefined") return

  document.documentElement.dataset.palette = theme
}

export function ColorThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [colorTheme, setColorThemeState] = React.useState(readStoredColorTheme)

  React.useEffect(() => {
    applyColorTheme(colorTheme)
    window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, colorTheme)
  }, [colorTheme])

  const setColorTheme = React.useCallback((theme: ColorTheme) => {
    setColorThemeState(theme)
  }, [])

  const value = React.useMemo(
    () => ({ colorTheme, setColorTheme }),
    [colorTheme, setColorTheme]
  )

  return (
    <ColorThemeContext.Provider value={value}>
      {children}
    </ColorThemeContext.Provider>
  )
}
