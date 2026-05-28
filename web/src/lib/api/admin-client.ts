import { apiClient, type ApiResponse } from "./client"
import type { RecordDTO } from "./records-client"
import type { AuthUser } from "./auth-client"

export type RuntimeSettingsDTO = {
  workerConcurrency: number
  perUserWorkerConcurrency: number
  perUserQueueLimit: number
}

export type UpstreamConfigDTO = RuntimeSettingsDTO & {
  baseUrl: string
  apiKeyMasked?: string
  apiKeySet: boolean
  enabledModels: string[]
}

export type SiteConfigDTO = {
  siteTitle: string
}

export type UpdateUpstreamPayload = {
  baseUrl?: string
  apiKey?: string | null // string = set; null = clear; undefined = unchanged
  enabledModels?: string[]
}

export type TestConnectionResp = {
  ok: boolean
  status: number
  message?: string
  elapsedMs?: number
  imageBytes?: number
}

export const adminApi = {
  async getUpstream(): Promise<UpstreamConfigDTO> {
    const { data } = await apiClient.get<{ config: UpstreamConfigDTO }>(
      "/api/v1/admin/upstream-configs"
    )
    return data.config
  },
  async updateUpstream(p: UpdateUpstreamPayload): Promise<UpstreamConfigDTO> {
    const body: Record<string, unknown> = {}
    if (p.baseUrl !== undefined) body.baseUrl = p.baseUrl
    if (p.apiKey === null) body.apiKey = ""
    else if (p.apiKey !== undefined) body.apiKey = p.apiKey
    if (p.enabledModels !== undefined) body.enabledModels = p.enabledModels
    const { data } = await apiClient.put<{ config: UpstreamConfigDTO }>(
      "/api/v1/admin/upstream-configs",
      body
    )
    return data.config
  },
  async testUpstream(model?: string): Promise<TestConnectionResp> {
    const { data } = await apiClient.post<TestConnectionResp>(
      "/api/v1/admin/upstream-configs/test",
      model ? { model } : {}
    )
    return data
  },

  async getRuntime(): Promise<RuntimeSettingsDTO> {
    const { data } = await apiClient.get<RuntimeSettingsDTO>(
      "/api/v1/admin/runtime"
    )
    return data
  },
  async updateRuntime(settings: RuntimeSettingsDTO): Promise<RuntimeSettingsDTO> {
    const { data } = await apiClient.patch<RuntimeSettingsDTO>(
      "/api/v1/admin/runtime",
      settings
    )
    return data
  },

  async getSiteSettings(): Promise<SiteConfigDTO> {
    const { data } = await apiClient.get<{ config: SiteConfigDTO }>(
      "/api/v1/admin/site-settings"
    )
    return data.config
  },
  async updateSiteSettings(p: SiteConfigDTO): Promise<SiteConfigDTO> {
    const { data } = await apiClient.patch<{ config: SiteConfigDTO }>(
      "/api/v1/admin/site-settings",
      p
    )
    return data.config
  },

  async listUsers(params: {
    search?: string
    page?: number
    pageSize?: number
  } = {}): Promise<ApiResponse<{ users: AuthUser[] }>> {
    const sp = new URLSearchParams()
    if (params.search) sp.set("search", params.search)
    if (params.page) sp.set("page", String(params.page))
    if (params.pageSize) sp.set("pageSize", String(params.pageSize))
    const q = sp.toString()
    return apiClient.get<{ users: AuthUser[] }>(
      `/api/v1/admin/users${q ? "?" + q : ""}`
    )
  },
  async updateUser(
    id: string,
    patch: { disabled?: boolean; role?: "admin" | "user" }
  ): Promise<AuthUser> {
    const { data } = await apiClient.patch<{ user: AuthUser }>(
      `/api/v1/admin/users/${id}`,
      patch
    )
    return data.user
  },
  async resetPassword(id: string): Promise<string> {
    const { data } = await apiClient.post<{ tempPassword: string }>(
      `/api/v1/admin/users/${id}/reset-password`
    )
    return data.tempPassword
  },

  async listRecords(params: {
    status?: string
    userId?: string
    page?: number
    pageSize?: number
  } = {}): Promise<ApiResponse<{ records: RecordDTO[] }>> {
    const sp = new URLSearchParams()
    if (params.status) sp.set("status", params.status)
    if (params.userId) sp.set("userId", params.userId)
    if (params.page) sp.set("page", String(params.page))
    if (params.pageSize) sp.set("pageSize", String(params.pageSize))
    const q = sp.toString()
    return apiClient.get<{ records: RecordDTO[] }>(
      `/api/v1/admin/records${q ? "?" + q : ""}`
    )
  },
  async deleteRecord(id: string): Promise<void> {
    await apiClient.delete<{ ok: boolean }>(`/api/v1/admin/records/${id}`)
  },

  async statsOverview(): Promise<{
    today: {
      total: number
      success: number
      failed: number
      running: number
      waiting: number
      avgMs: number
    }
  }> {
    const { data } = await apiClient.get<{
      today: {
        total: number
        success: number
        failed: number
        running: number
        waiting: number
        avgMs: number
      }
    }>("/api/v1/admin/stats/overview")
    return data
  },
}
