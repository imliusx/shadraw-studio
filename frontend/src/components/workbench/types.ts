export type ApiStatus = "idle" | "testing" | "success" | "error"

export type HistoryStatus = "waiting" | "running" | "completed" | "failed"

export type ImageBackground = "auto" | "transparent" | "opaque"
export type ImageModeration = "auto" | "low"
export type ImageOutputFormat = "png" | "jpeg" | "webp"
export type ImageQuality = "auto" | "high" | "medium" | "low"

export type ImageParams = {
  size: string
  quality: ImageQuality
  background: ImageBackground
  moderation: ImageModeration
  output_format: ImageOutputFormat
  output_compression?: number
  stream?: boolean
  partial_images?: number
  input_fidelity?: string
  mask?: string
  response_format?: string
  style?: string
  user?: string
}

export type HistoryRecord = {
  id: number
  prompt: string
  model: string
  imageParams: ImageParams
  status: HistoryStatus
  base64?: string
  /** 仅前端使用：图片下载失败的错误描述。set 后 UI 会显示"重试" */
  imageError?: string
  referenceImages?: string[]
  error?: string
  upstreamError?: string
  favorite: boolean
  isPublic: boolean
  promptPublic: boolean
  projectId?: number
  createdAt: number
  startedAt?: number
  completedAt?: number
  publishedAt?: number
}

export type Project = {
  id: number
  name: string
  createdAt: number
}

export type Config = {
  baseUrl: string
  apiKey: string
  model: string
  siteTitle: string
}

// 保留 baseUrl / apiKey 字段是为了向后兼容；新代码只读 model，
// 真实的上游连接信息由后端管理员配置。
