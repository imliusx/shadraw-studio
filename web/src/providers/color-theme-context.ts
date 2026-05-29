import * as React from "react"

import type { ColorTheme } from "@/lib/theme/color-theme"

type ColorThemeContextValue = {
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}

export const ColorThemeContext =
  React.createContext<ColorThemeContextValue | null>(null)
