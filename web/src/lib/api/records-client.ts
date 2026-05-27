import { apiClient, type ApiResponse } from "./client"

export type RecordStatus = "waiting" | "running" | "completed" | "failed"

export type ImageBackground = "auto" | "transparent" | "opaque"
export type ImageModeration = "auto" | "low"
export type ImageOutputFormat = "png" | "jpeg" | "webp"
export type ImageQuality = "auto" | "high" | "medium" | "low"

export type ImageParams = {
  size?: string
  quality?: ImageQuality
  background?: ImageBackground
  moderation?: ImageModeration
  output_format?: ImageOutputFormat
  output_compression?: number
  stream?: boolean
  partial_images?: number
  input_fidelity?: string
  mask?: string
  response_format?: string
  style?: string
  user?: string
}

export type RecordDTO = {
  id: string
  uuid: string
  prompt: string
  model: string
  imageParams: ImageParams
  status: RecordStatus
  favorite: boolean
  isPublic: boolean
  promptPublic?: boolean
  hasImage: boolean
  error?: string
  upstreamError?: string
  projectId?: string
  referenceCount: number
  startedAt?: string
  completedAt?: string
  publishedAt?: string
  createdAt: string
}

export type CreateRecordPayload = {
  prompt: string
  model: string
  imageParams: ImageParams
  projectId?: string | null
  referenceImages?: string[] // data: URLs
}

export type ListRecordsParams = {
  status?: RecordStatus
  projectId?: string
  favorite?: boolean
  scope?: "mine" | "public"
  q?: string
  page?: number
  pageSize?: number
}

function listQuery(p: ListRecordsParams): string {
  const sp = new URLSearchParams()
  if (p.status) sp.set("status", p.status)
  if (p.projectId) sp.set("projectId", p.projectId)
  if (p.favorite !== undefined) sp.set("favorite", String(p.favorite))
  if (p.scope === "public") sp.set("scope", "public")
  if (p.q?.trim()) sp.set("q", p.q.trim())
  if (p.page) sp.set("page", String(p.page))
  if (p.pageSize) sp.set("pageSize", String(p.pageSize))
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export const recordsApi = {
  async create(payload: CreateRecordPayload): Promise<RecordDTO> {
    const { data } = await apiClient.post<{ record: RecordDTO }>("/api/v1/records", payload)
    return data.record
  },

  async get(id: string): Promise<RecordDTO> {
    const { data } = await apiClient.get<{ record: RecordDTO }>(`/api/v1/records/${id}`)
    return data.record
  },

  async list(
    params: ListRecordsParams = {}
  ): Promise<ApiResponse<{ records: RecordDTO[] }>> {
    return apiClient.get<{ records: RecordDTO[] }>(`/api/v1/records${listQuery(params)}`)
  },

  async update(
    id: string,
    patch: {
      favorite?: boolean
      isPublic?: boolean
      promptPublic?: boolean
      projectId?: string | null
    }
  ): Promise<RecordDTO> {
    const body: Record<string, unknown> = {}
    if (patch.favorite !== undefined) body.favorite = patch.favorite
    if (patch.isPublic !== undefined) body.isPublic = patch.isPublic
    if (patch.promptPublic !== undefined) body.promptPublic = patch.promptPublic
    if (patch.projectId !== undefined)
      body.projectId = patch.projectId === null ? "" : patch.projectId
    const { data } = await apiClient.patch<{ record: RecordDTO }>(
      `/api/v1/records/${id}`,
      body
    )
    return data.record
  },

  async retry(id: string): Promise<RecordDTO> {
    const { data } = await apiClient.post<{ record: RecordDTO }>(
      `/api/v1/records/${id}/retry`
    )
    return data.record
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete<{ ok: boolean }>(`/api/v1/records/${id}`)
  },
}

export type ProjectDTO = {
  id: string
  name: string
  createdAt: string
}

export const projectsApi = {
  async list(): Promise<ProjectDTO[]> {
    const { data } = await apiClient.get<{ projects: ProjectDTO[] }>("/api/v1/projects")
    return data.projects
  },
  async create(name: string): Promise<ProjectDTO> {
    const { data } = await apiClient.post<{ project: ProjectDTO }>("/api/v1/projects", { name })
    return data.project
  },
  async rename(id: string, name: string): Promise<void> {
    await apiClient.patch<{ ok: boolean }>(`/api/v1/projects/${id}`, { name })
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete<{ ok: boolean }>(`/api/v1/projects/${id}`)
  },
}

export type AppConfig = {
  enabledModels: string[]
  siteTitle: string
}

export const appConfigApi = {
  async load(): Promise<AppConfig> {
    const { data } = await apiClient.get<AppConfig>("/api/v1/config", {
      auth: false,
      retry401: false,
    })
    return {
      enabledModels: data.enabledModels ?? [],
      siteTitle: data.siteTitle?.trim() || "shadraw",
    }
  },
}
