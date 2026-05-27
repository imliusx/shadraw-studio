export class HttpError extends Error {
  status: number
  body?: string

  constructor(status: number, body?: string) {
    super(`HTTP ${status}`)
    this.name = "HttpError"
    this.status = status
    this.body = body
  }
}

export class ApiResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApiResponseError"
  }
}

export type ErrorActionType = "retry" | "configure" | "reuse-prompt"

export type ClassifiedError = {
  title: string
  description: string
  action: { label: string; type: ErrorActionType }
  rawMessage: string
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text
}

function extractApiMessage(body?: string): string {
  if (!body) return ""
  try {
    const parsed = JSON.parse(body)
    const msg = parsed?.error?.message
    if (typeof msg === "string") return msg
  } catch {
    // body 不是 JSON
  }
  return truncate(body, 300)
}

function extractApiCode(body?: string): string {
  if (!body) return ""
  try {
    const parsed = JSON.parse(body)
    const code = parsed?.error?.code
    if (typeof code === "string") return code
  } catch {
    // body 不是 JSON
  }
  return ""
}

function isSafetyRejection(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("moderation_blocked") ||
    normalized.includes("content_policy_violation") ||
    normalized.includes("image_generation_user_error") ||
    normalized.includes("rejected by the safety system")
  )
}

export function toUserFacingErrorMessage(message?: string): string {
  if (!message) return "请求失败"
  const safetyMessage = localizeErrorMessage(message)
  if (safetyMessage && safetyMessage !== message) return safetyMessage

  const normalized = message.toLowerCase()
  if (
    normalized.includes("upstream_error") ||
    normalized.includes("upstream request failed")
  ) {
    return "上游服务暂时无法完成生成，请稍后重试"
  }
  if (
    normalized.includes("auth_failed") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid api key")
  ) {
    return "上游认证失败，请检查后台上游配置"
  }
  if (
    normalized.includes("rate_limited") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  ) {
    return "上游请求过于频繁，请稍后重试"
  }
  if (normalized.includes("not_found") || normalized.includes("404")) {
    return "上游接口或模型不存在，请检查后台上游配置"
  }
  if (normalized.includes("network")) {
    return "无法连接上游服务，请稍后重试"
  }
  return message
}

export function localizeErrorMessage(message?: string): string | undefined {
  if (!message) return undefined
  if (isSafetyRejection(message)) {
    return "提示词被安全策略拦截，请调整提示词后重试"
  }
  return message
}

export function classifyError(error: unknown): ClassifiedError {
  if (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return {
      title: "请求超时",
      description: "请求超过 5 分钟未返回,网关可能未响应,请稍后重试",
      action: { label: "重试", type: "retry" },
      rawMessage: error.message,
    }
  }

  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return {
      title: "无法连接到 Base URL",
      description:
        "可能原因:① Base URL 拼写错误;② 网关未开启 CORS(需联系网关管理员);③ 网络断开",
      action: { label: "检查配置", type: "configure" },
      rawMessage: error.message,
    }
  }

  if (error instanceof HttpError) {
    const apiMsg = extractApiMessage(error.body)
    const apiCode = extractApiCode(error.body)
    if (error.status === 400) {
      if (isSafetyRejection(`${apiCode} ${apiMsg} ${error.body ?? ""}`)) {
        return {
          title: "提示词被安全策略拦截",
          description:
            apiMsg ||
            "OpenAI 的安全系统拒绝了本次请求,请调整提示词后重试(避开暴力、色情、特定人物、敏感版权内容)",
          action: { label: "修改提示词", type: "reuse-prompt" },
          rawMessage: `HTTP 400 (${apiCode}): ${apiMsg || error.body || ""}`,
        }
      }
      return {
        title: "请求参数有误",
        description: apiMsg || "请检查提示词、模型 ID 和参数是否合法",
        action: { label: "修改提示词", type: "reuse-prompt" },
        rawMessage: `HTTP 400: ${apiMsg || error.body || ""}`,
      }
    }
    if (error.status === 401) {
      return {
        title: "API Key 无效",
        description: apiMsg || "网关拒绝了当前 Key,可能是密钥过期或填写错误",
        action: { label: "打开 API 配置", type: "configure" },
        rawMessage: `HTTP 401: ${apiMsg || error.body || ""}`,
      }
    }
    if (error.status === 403) {
      return {
        title: "Key 权限不足",
        description:
          apiMsg ||
          "网关接受了 Key 但拒绝调用此 endpoint,可能 Key 未开通 image_generation 权限",
        action: { label: "检查配置", type: "configure" },
        rawMessage: `HTTP 403: ${apiMsg || error.body || ""}`,
      }
    }
    if (error.status === 404) {
      return {
        title: "endpoint 不存在",
        description:
          apiMsg ||
          "网关在 /responses 路径返回 404,可能是 Base URL 错误或网关不支持 Responses API",
        action: { label: "检查 Base URL", type: "configure" },
        rawMessage: `HTTP 404: ${apiMsg || error.body || ""}`,
      }
    }
    if (error.status === 429) {
      return {
        title: "请求过于频繁",
        description: apiMsg || "网关返回 rate limit,建议稍等几秒再试",
        action: { label: "重试", type: "retry" },
        rawMessage: `HTTP 429: ${apiMsg || error.body || ""}`,
      }
    }
    if (error.status >= 500 && error.status < 600) {
      return {
        title: "网关错误",
        description:
          apiMsg || `网关侧出错 (${error.status}),通常稍后重试就能恢复`,
        action: { label: "重试", type: "retry" },
        rawMessage: `HTTP ${error.status}: ${apiMsg || error.body || ""}`,
      }
    }
    return {
      title: "请求失败",
      description: apiMsg || `HTTP ${error.status}`,
      action: { label: "重试", type: "retry" },
      rawMessage: `HTTP ${error.status}: ${apiMsg || error.body || ""}`,
    }
  }

  if (error instanceof ApiResponseError) {
    return {
      title: "API 未返回图片",
      description:
        "网关返回了响应但没有图像数据,可能是 prompt 触发了 moderation,或 model 不支持图生成",
      action: { label: "复用提示词修改", type: "reuse-prompt" },
      rawMessage: error.message,
    }
  }

  const raw = error instanceof Error ? error.message : String(error)
  return {
    title: "请求失败",
    description: truncate(raw, 300),
    action: { label: "重试", type: "retry" },
    rawMessage: raw,
  }
}

export function errorToShortMessage(error: unknown): string {
  return classifyError(error).title
}
