// shadraw 后端 Auth 客户端。封装统一响应外壳 / 错误码 / 401 自动 refresh。
// 前端与后端同源部署，所有路径使用相对路径（生产同主机，dev 由 Vite proxy 转发）。

import { refreshAccessToken } from "./auth-refresh"
import { tokenStorage, type StoredTokens } from "./auth-storage"

export type AuthUser = {
  id: string
  email: string
  displayName: string
  role: "admin" | "user"
  mustChangePassword: boolean
  createdAt: string
}

export type AuthResponse = {
  user: AuthUser
  tokens: StoredTokens & { expiresIn: number }
}

export type RegisterPayload = {
  email: string
  password: string
  displayName: string
}

export type LoginPayload = {
  email: string
  password: string
}

export type ChangePasswordPayload = {
  oldPassword: string
  newPassword: string
}

// 后端错误码白名单(与 design.md §10.6 对齐)
export type AuthErrorCode =
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

export class AuthError extends Error {
  readonly code: AuthErrorCode
  readonly status: number
  readonly fields?: Record<string, string>

  constructor(
    code: AuthErrorCode,
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
}

type RequestOptions = {
  auth?: boolean // attach Bearer access token
  retry401?: boolean // try refresh + retry once if 401
}

async function request<T>(
  path: string,
  init: RequestInit,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = false, retry401 = true } = options
  const headers = new Headers(init.headers ?? {})
  headers.set("Content-Type", "application/json")
  if (auth) {
    const tokens = tokenStorage.read()
    if (tokens?.accessToken) headers.set("Authorization", `Bearer ${tokens.accessToken}`)
  }

  let resp: Response
  try {
    resp = await fetch(path, { ...init, headers, credentials: "same-origin" })
  } catch (err) {
    throw new AuthError(
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
      // ignore — fall through to status-based error
    }
  }

  if (resp.ok && env?.data) {
    return env.data
  }

  if (resp.status === 401 && auth && retry401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return request<T>(path, init, { ...options, retry401: false })
    }
  }

  const code = (env?.error?.code as AuthErrorCode | undefined) ?? "internal_error"
  const message = env?.error?.message ?? `请求失败 (${resp.status})`
  throw new AuthError(code, message, resp.status, env?.error?.fields)
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const data = await request<AuthResponse>(
      "/api/v1/auth/register",
      { method: "POST", body: JSON.stringify(payload) },
      { auth: false }
    )
    tokenStorage.write({
      accessToken: data.tokens.accessToken,
    })
    return data
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const data = await request<AuthResponse>(
      "/api/v1/auth/login",
      { method: "POST", body: JSON.stringify(payload) },
      { auth: false }
    )
    tokenStorage.write({
      accessToken: data.tokens.accessToken,
    })
    return data
  },

  async me(): Promise<AuthUser> {
    const data = await request<{ user: AuthUser }>(
      "/api/v1/auth/me",
      { method: "GET" },
      { auth: true }
    )
    return data.user
  },

  async refresh(): Promise<void> {
    const ok = await refreshAccessToken()
    if (!ok) {
      throw new AuthError("unauthorized", "登录已过期", 401)
    }
  },

  async logout(): Promise<void> {
    try {
      await request<{ ok: boolean }>(
        "/api/v1/auth/logout",
        { method: "POST" },
        { auth: true, retry401: false }
      )
    } catch {
      // best-effort; clear local state regardless
    }
    tokenStorage.clear()
  },

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await request<{ ok: boolean }>(
      "/api/v1/auth/password",
      { method: "POST", body: JSON.stringify(payload) },
      { auth: true }
    )
    // 后端会撤销所有 refresh token; 本地需要清,让用户重新登录
    tokenStorage.clear()
  },
}
