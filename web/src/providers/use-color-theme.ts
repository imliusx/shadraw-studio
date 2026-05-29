import * as React from "react"

import { ColorThemeContext } from "@/providers/color-theme-context"

export function useColorTheme() {
  const context = React.useContext(ColorThemeContext)
  if (!context) {
    throw new Error("useColorTheme must be used within ColorThemeProvider")
  }
  return context
}
