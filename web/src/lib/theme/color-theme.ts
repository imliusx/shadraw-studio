export type ColorTheme =
  | "default"
  | "violet"
  | "yellow"
  | "sky"
  | "blue"
  | "red"
  | "lime"
  | "emerald"
  | "pink"

export type ColorThemeOption = {
  value: ColorTheme
  label: string
  swatchClassName: string
}

export const COLOR_THEME_STORAGE_KEY = "shadraw-ui:color-theme"
export const DEFAULT_COLOR_THEME: ColorTheme = "default"

export const COLOR_THEME_OPTIONS: ColorThemeOption[] = [
  {
    value: "default",
    label: "默认",
    swatchClassName: "bg-(--theme-swatch-default)",
  },
  {
    value: "violet",
    label: "紫罗兰",
    swatchClassName: "bg-(--theme-swatch-violet)",
  },
  {
    value: "yellow",
    label: "明黄",
    swatchClassName: "bg-(--theme-swatch-yellow)",
  },
  {
    value: "sky",
    label: "天空蓝",
    swatchClassName: "bg-(--theme-swatch-sky)",
  },
  {
    value: "blue",
    label: "深海蓝",
    swatchClassName: "bg-(--theme-swatch-blue)",
  },
  {
    value: "red",
    label: "绯红",
    swatchClassName: "bg-(--theme-swatch-red)",
  },
  {
    value: "lime",
    label: "青柠",
    swatchClassName: "bg-(--theme-swatch-lime)",
  },
  {
    value: "emerald",
    label: "翡翠绿",
    swatchClassName: "bg-(--theme-swatch-emerald)",
  },
  {
    value: "pink",
    label: "玫粉",
    swatchClassName: "bg-(--theme-swatch-pink)",
  },
]

export const COLOR_THEME_VALUES = new Set<ColorTheme>(
  COLOR_THEME_OPTIONS.map((option) => option.value)
)

export function isColorTheme(value: string): value is ColorTheme {
  return COLOR_THEME_VALUES.has(value as ColorTheme)
}
