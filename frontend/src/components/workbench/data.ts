import type { ImageParams } from "./types"

export const DEFAULT_IMAGE_PARAMS: ImageParams = {
  size: "auto",
  quality: "auto",
  background: "auto",
  moderation: "auto",
  output_format: "png",
}

export const imageRatioOptions = [
  { label: "auto", size: "auto" },
  { label: "1:1", size: "1024x1024" },
  { label: "3:4", size: "1024x1536" },
  { label: "4:3", size: "1536x1024" },
  { label: "9:16", size: "1024x1536" },
  { label: "16:9", size: "1536x1024" },
] as const

export type ImageRatioLabel = (typeof imageRatioOptions)[number]["label"]

export function imageRatioToSize(ratio: ImageRatioLabel): string {
  return imageRatioOptions.find((option) => option.label === ratio)?.size ?? "auto"
}

export function imageSizeToRatio(size: string): ImageRatioLabel {
  switch (size) {
    case "1024x1024":
    case "2048x2048":
    case "4096x4096":
      return "1:1"
    case "1024x1536":
      return "3:4"
    case "1536x1024":
      return "4:3"
    default:
      return "auto"
  }
}

export const sizeOptions = [
  "auto",
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
  "4096x4096",
]

export const qualityOptions = ["auto", "high", "medium", "low"] as const
export const backgroundOptions = ["auto", "transparent", "opaque"] as const
export const moderationOptions = ["auto", "low"] as const
export const outputFormatOptions = ["png", "jpeg", "webp"] as const
