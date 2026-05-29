// 共用 HTTP client：统一响应外壳、错误码白名单、401 自动 refresh + 重试。
// 业务接口（records / projects / admin）都通过此模块发请求。
// 前端与后端同源部署，所有路径使用相对路径（生产同主机，dev 由 Vite proxy 转发）。

import { refreshAccessToken } from "./auth-refresh"
import { tokenStorage } from "./auth-storage"

export type ApiErrorCode =
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "account_disabled"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "upstream_error"
  | "internal_error"
  | "network_error"

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly fields?: Record<string, string>

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number,
    fields?: Record<string, string>
  ) {
    super(message)
    this.code = code
    this.status = status
    this.fields = fields
  }
}

type Envelope<T> = {
  data: T | null
  error: { code: string; message: string; fields?: Record<string, string> } | null
  meta?: PageMeta
}

export type PageMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type RequestOptions = {
  auth?: boolean
  retry401?: boolean
  /** when true, returns the raw envelope (with meta); otherwise returns just data */
  withMeta?: boolean
  /** override Content-Type; pass null to omit (for FormData etc.) */
  contentType?: string | null
  /** custom body (FormData, Blob...); takes precedence over jsonBody */
  rawBody?: BodyInit
}

export type ApiResponse<T> = { data: T; meta?: PageMeta }

async function request<T>(
  path: string,
  init: { method?: string; jsonBody?: unknown } & RequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    method = "GET",
    jsonBody,
    auth = true,
    retry401 = true,
    contentType,
    rawBody,
  } = init

  const headers = new Headers()
  if (contentType === undefined) {
    if (jsonBody !== undefined) headers.set("Content-Type", "application/json")
  } else if (contentType !== null) {
    headers.set("Content-Type", contentType)
  }
  if (auth) {
    const tokens = tokenStorage.read()
    if (tokens?.accessToken) {
      headers.set("Authorization", `Bearer ${tokens.accessToken}`)
    }
  }

  const body =
    rawBody !== undefined
      ? rawBody
      : jsonBody !== undefined
        ? JSON.stringify(jsonBody)
        : undefined

  let resp: Response
  try {
    resp = await fetch(path, { method, headers, body, credentials: "same-origin" })
  } catch (err) {
    throw new ApiError(
      "network_error",
      err instanceof Error ? err.message : "网络异常",
      0
    )
  }

  const text = await resp.text()
  let env: Envelope<T> | null = null
  if (text) {
    try {
      env = JSON.parse(text) as Envelope<T>
    } catch {
      // fall through
    }
  }

  if (resp.ok && env && env.data !== null) {
    return { data: env.data, meta: env.meta }
  }

  if (resp.status === 401 && auth && retry401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return request<T>(path, { ...init, retry401: false })
    }
  }

  const code = (env?.error?.code as ApiErrorCode | undefined) ?? "internal_error"
  const message = env?.error?.message ?? `请求失败 (${resp.status})`
  throw new ApiError(code, message, resp.status, env?.error?.fields)
}

export const apiClient = {
  get: <T>(path: string, opts: RequestOptions = {}) =>
    request<T>(path, { method: "GET", ...opts }),
  post: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    request<T>(path, { method: "POST", jsonBody: body, ...opts }),
  put: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    request<T>(path, { method: "PUT", jsonBody: body, ...opts }),
  patch: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    request<T>(path, { method: "PATCH", jsonBody: body, ...opts }),
  delete: <T>(path: string, opts: RequestOptions = {}) =>
    request<T>(path, { method: "DELETE", ...opts }),
}

/** Convenience: GET an image stream URL with bearer header.
 *  Returns a blob URL (`URL.createObjectURL`) the caller must revoke later.
 */
export async function fetchImageBlobURL(recordId: string): Promise<string> {
  const tokens = tokenStorage.read()
  const headers = new Headers()
  if (tokens?.accessToken) headers.set("Authorization", `Bearer ${tokens.accessToken}`)
  const path = `/api/v1/images/${recordId}`
  const resp = await fetch(path, { headers, credentials: "same-origin" })
  if (!resp.ok) {
    throw new ApiError(
      "not_found",
      `image ${recordId} ${resp.status}`,
      resp.status
    )
  }
  const blob = await resp.blob()
  return URL.createObjectURL(blob)
}
