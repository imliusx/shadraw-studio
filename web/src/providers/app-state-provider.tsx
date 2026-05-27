import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react"

import {
  appConfigApi,
  projectsApi,
  recordsApi,
  type ListRecordsParams,
} from "@/lib/api/records-client"
import { fetchImageBlobURL, ApiError } from "@/lib/api/client"
import {
  localizeErrorMessage,
  toUserFacingErrorMessage,
} from "@/lib/api/errors"
import {
  dtoToRecord,
  dtoToRecordPatch,
} from "@/lib/api/record-mappers"
import { tokenStorage } from "@/lib/api/auth-storage"
import { useAuth } from "@/providers/auth-provider"
import type {
  ApiStatus,
  Config,
  HistoryRecord,
  ImageParams,
  Project,
} from "@/components/workbench/types"

type LightboxState = {
  open: boolean
  recordId: number | null
  navList: number[] | null
}

export type EventLogLevel = "info" | "event" | "data" | "done" | "error"

export type EventLogEntry = {
  id: number
  ts: number
  level: EventLogLevel
  message: string
}

type LoadRecordsPageResult = {
  records: HistoryRecord[]
  page: number
  totalPages: number
  total: number
  hasMore: boolean
}

const EVENT_LOG_CAP = 200
const POLL_INTERVAL_MS = 2000
const INITIAL_HISTORY_PAGE_SIZE = 30

const DEFAULT_CONFIG: Config = {
  baseUrl: "",
  apiKey: "",
  model: "",
  siteTitle: "shadraw",
}

type AppState = {
  history: HistoryRecord[]
  projects: Project[]
  config: Config
  enabledModels: string[]
  activeHistoryId: number | null
  lightbox: LightboxState
  apiStatus: ApiStatus
  apiErrorMessage: string
  isHydrated: boolean
  eventLog: EventLogEntry[]
  settingsOpen: boolean
}

type AppAction =
  | { type: "history/load"; payload: HistoryRecord[] }
  | { type: "history/merge"; payload: HistoryRecord[] }
  | { type: "history/add"; payload: HistoryRecord }
  | {
      type: "history/update"
      payload: { id: number; patch: Partial<HistoryRecord> }
    }
  | { type: "history/delete"; payload: number }
  | { type: "projects/load"; payload: Project[] }
  | { type: "projects/add"; payload: Project }
  | { type: "projects/rename"; payload: { id: number; name: string } }
  | { type: "projects/delete"; payload: number }
  | { type: "config/load"; payload: { config: Config; enabledModels: string[] } }
  | { type: "config/update"; payload: Partial<Config> }
  | { type: "enabledModels/set"; payload: string[] }
  | { type: "ui/setActive"; payload: number | null }
  | {
      type: "ui/openLightbox"
      payload: { recordId: number; navList?: number[] | null }
    }
  | { type: "ui/closeLightbox" }
  | {
      type: "ui/setApiStatus"
      payload: { status: ApiStatus; errorMessage?: string }
    }
  | { type: "system/hydrated" }
  | { type: "events/append"; payload: EventLogEntry }
  | { type: "events/clear" }
  | { type: "ui/setSettingsOpen"; payload: boolean }

const initialState: AppState = {
  history: [],
  projects: [],
  config: DEFAULT_CONFIG,
  enabledModels: [],
  activeHistoryId: null,
  lightbox: { open: false, recordId: null, navList: null },
  apiStatus: "idle",
  apiErrorMessage: "",
  isHydrated: false,
  eventLog: [],
  settingsOpen: false,
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "history/load":
      return { ...state, history: action.payload }
    case "history/merge":
      return { ...state, history: mergeHistory(state.history, action.payload) }
    case "history/add":
      return { ...state, history: mergeHistory(state.history, [action.payload]) }
    case "history/update":
      return {
        ...state,
        history: state.history.map((r) =>
          r.id === action.payload.id ? { ...r, ...action.payload.patch } : r
        ),
      }
    case "history/delete":
      return {
        ...state,
        history: state.history.filter((r) => r.id !== action.payload),
        activeHistoryId:
          state.activeHistoryId === action.payload ? null : state.activeHistoryId,
      }
    case "projects/load":
      return { ...state, projects: action.payload }
    case "projects/add":
      return { ...state, projects: [...state.projects, action.payload] }
    case "projects/rename":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.id ? { ...p, name: action.payload.name } : p
        ),
      }
    case "projects/delete":
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.payload),
        history: state.history.map((r) =>
          r.projectId === action.payload ? { ...r, projectId: undefined } : r
        ),
      }
    case "config/load":
      return {
        ...state,
        config: action.payload.config,
        enabledModels: action.payload.enabledModels,
      }
    case "config/update":
      return { ...state, config: { ...state.config, ...action.payload } }
    case "enabledModels/set":
      return { ...state, enabledModels: action.payload }
    case "ui/setActive":
      return { ...state, activeHistoryId: action.payload }
    case "ui/openLightbox":
      return {
        ...state,
        lightbox: {
          open: true,
          recordId: action.payload.recordId,
          navList: action.payload.navList ?? null,
        },
      }
    case "ui/closeLightbox":
      return { ...state, lightbox: { open: false, recordId: null, navList: null } }
    case "ui/setApiStatus":
      return {
        ...state,
        apiStatus: action.payload.status,
        apiErrorMessage: action.payload.errorMessage ?? "",
      }
    case "system/hydrated":
      return { ...state, isHydrated: true }
    case "events/append": {
      const next = [...state.eventLog, action.payload]
      if (next.length > EVENT_LOG_CAP) next.splice(0, next.length - EVENT_LOG_CAP)
      return { ...state, eventLog: next }
    }
    case "events/clear":
      return { ...state, eventLog: [] }
    case "ui/setSettingsOpen":
      return { ...state, settingsOpen: action.payload }
    default:
      return state
  }
}

type HistoryContextValue = {
  records: HistoryRecord[]
  isHydrated: boolean
  loadRecordsPage: (
    params?: Omit<ListRecordsParams, "scope">
  ) => Promise<LoadRecordsPageResult>
  addRecord: (params: {
    prompt: string
    model: string
    imageParams: ImageParams
    referenceImages?: string[]
  }) => Promise<HistoryRecord>
  retryRecord: (id: number) => Promise<void>
  updateRecord: (id: number, patch: Partial<HistoryRecord>) => Promise<void>
  deleteRecord: (id: number) => Promise<void>
  getById: (id: number) => HistoryRecord | undefined
  reloadImage: (id: number) => Promise<void>
}

type ProjectsContextValue = {
  projects: Project[]
  addProject: (name: string) => Promise<Project>
  renameProject: (id: number, name: string) => Promise<void>
  deleteProject: (id: number) => Promise<void>
}

type ConfigContextValue = {
  config: Config
  enabledModels: string[]
  updateConfig: (patch: Partial<Config>) => void
  refreshAppConfig: () => Promise<void>
  refreshEnabledModels: () => Promise<void>
  testConnection: () => Promise<boolean> // legacy no-op; admin handles real test
}

type UIContextValue = {
  activeHistoryId: number | null
  setActive: (id: number | null) => void
  lightbox: LightboxState
  openLightbox: (recordId: number, navList?: number[] | null) => void
  closeLightbox: () => void
  apiStatus: ApiStatus
  apiErrorMessage: string
  setApiStatus: (status: ApiStatus, errorMessage?: string) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

type EventLogContextValue = {
  entries: EventLogEntry[]
  append: (level: EventLogLevel, message: string) => void
  clear: () => void
}

const HistoryContext = createContext<HistoryContextValue | null>(null)
const ProjectsContext = createContext<ProjectsContextValue | null>(null)
const ConfigContext = createContext<ConfigContextValue | null>(null)
const UIContext = createContext<UIContextValue | null>(null)
const EventLogContext = createContext<EventLogContextValue | null>(null)

// ---- helpers ----

function dtoToProject(dto: { id: string; name: string; createdAt: string }): Project {
  return {
    id: Number(dto.id),
    name: dto.name,
    createdAt: Date.parse(dto.createdAt),
  }
}

function mergeHistory(
  existing: HistoryRecord[],
  incoming: HistoryRecord[]
): HistoryRecord[] {
  if (incoming.length === 0) return existing
  const map = new Map(existing.map((record) => [record.id, record]))

  for (const record of incoming) {
    const previous = map.get(record.id)
    map.set(
      record.id,
      previous
        ? {
            ...record,
            base64: previous.base64,
            imageError: previous.imageError,
            referenceImages: previous.referenceImages,
          }
        : record
    )
  }

  return [...map.values()].sort(
    (a, b) => b.createdAt - a.createdAt || b.id - a.id
  )
}

// ---- provider ----

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const stateRef = useRef<AppState>(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Map record id -> blob URL (so we can revoke on unmount/replace).
  const blobUrlsRef = useRef<Map<string, string>>(new Map())
  useEffect(() => {
    const urls = blobUrlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  // Active polls: record id -> abort flag.
  const pollersRef = useRef<Set<number>>(new Set())
  const imageLoadersRef = useRef<Set<number>>(new Set())

  const { user } = useAuth()
  const userId = user?.id ?? null

  const applyAppConfig = useCallback((cfg: {
    enabledModels: string[]
    siteTitle: string
  }) => {
    const pickModel = (models: string[], currentModel: string): string => {
      if (models.length === 0) return ""
      if (currentModel && models.includes(currentModel)) return currentModel
      if (models.includes("gpt-image-2")) return "gpt-image-2"
      return models[0] ?? ""
    }
    const currentConfig = stateRef.current.config
    dispatch({
      type: "config/load",
      payload: {
        config: {
          ...currentConfig,
          model: pickModel(cfg.enabledModels, currentConfig.model),
          siteTitle: cfg.siteTitle,
        },
        enabledModels: cfg.enabledModels,
      },
    })
  }, [])

  const refreshAppConfig = useCallback<ConfigContextValue["refreshAppConfig"]>(
    async () => {
      const cfg = await appConfigApi.load()
      applyAppConfig(cfg)
    },
    [applyAppConfig]
  )

  useEffect(() => {
    let cancelled = false
    async function loadPublicConfig() {
      try {
        const cfg = await appConfigApi.load()
        if (cancelled) return
        applyAppConfig(cfg)
      } catch {
        /* keep defaults */
      }
    }
    void loadPublicConfig()
    return () => {
      cancelled = true
    }
  }, [applyAppConfig])

  useEffect(() => {
    const title = state.config.siteTitle.trim() || "shadraw"
    document.title = title
  }, [state.config.siteTitle])

  // Wipe all in-memory user data. Called on user-id change.
  const wipe = useCallback(() => {
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    blobUrlsRef.current.clear()
    pollersRef.current.clear()
    dispatch({ type: "history/load", payload: [] })
    dispatch({ type: "projects/load", payload: [] })
    dispatch({
      type: "config/load",
      payload: {
        config: {
          ...DEFAULT_CONFIG,
          siteTitle: stateRef.current.config.siteTitle,
        },
        enabledModels: [],
      },
    })
    dispatch({ type: "ui/setActive", payload: null })
    dispatch({ type: "ui/closeLightbox" })
    dispatch({ type: "events/clear" })
  }, [])

  const loadImageFor = useCallback(async (id: number) => {
    if (imageLoadersRef.current.has(id)) return
    imageLoadersRef.current.add(id)
    // Mark "in flight": clear any prior error and base64 so UI shows loading.
    dispatch({
      type: "history/update",
      payload: { id, patch: { imageError: undefined, base64: undefined } },
    })
    try {
      const key = String(id)
      const existing = blobUrlsRef.current.get(key)
      if (existing) URL.revokeObjectURL(existing)
      const url = await fetchImageBlobURL(String(id))
      blobUrlsRef.current.set(key, url)
      dispatch({
        type: "history/update",
        payload: {
          id,
          patch: {
            base64: url,
            imageError: undefined,
          },
        },
      })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "图片加载失败"
      dispatch({
        type: "history/update",
        payload: { id, patch: { imageError: message } },
      })
    } finally {
      imageLoadersRef.current.delete(id)
    }
  }, [])

  const startPolling = useCallback(
    (id: number) => {
      if (pollersRef.current.has(id)) return
      pollersRef.current.add(id)
      const tick = async () => {
        if (!pollersRef.current.has(id)) return
        try {
          const dto = await recordsApi.get(String(id))
          // Patch only the backend-managed fields. `base64` (a blob URL) and
          // `referenceImages` are front-end-only state that must survive.
          dispatch({
            type: "history/update",
            payload: {
              id,
              patch: dtoToRecordPatch(dto),
            },
          })
          if (dto.status === "completed") {
            pollersRef.current.delete(id)
            await loadImageFor(id)
            return
          }
          if (dto.status === "failed") {
            pollersRef.current.delete(id)
            return
          }
        } catch {
          // network blip; keep polling
        }
        setTimeout(tick, POLL_INTERVAL_MS)
      }
      setTimeout(tick, POLL_INTERVAL_MS)
    },
    [loadImageFor]
  )

  const loadRecordsPage = useCallback<HistoryContextValue["loadRecordsPage"]>(
    async (params = {}) => {
      const pageSize = params.pageSize ?? INITIAL_HISTORY_PAGE_SIZE
      const response = await recordsApi.list({
        ...params,
        page: params.page ?? 1,
        pageSize,
      })
      const list = response.data.records.map((dto) => dtoToRecord(dto))
      dispatch({ type: "history/merge", payload: list })
      for (const rec of list) {
        if (rec.status === "waiting" || rec.status === "running") {
          void startPolling(rec.id)
        }
      }
      const page = response.meta?.page ?? params.page ?? 1
      const totalPages =
        response.meta?.totalPages ??
        (list.length >= pageSize ? page + 1 : page)
      return {
        records: list,
        page,
        totalPages,
        total: response.meta?.total ?? list.length,
        hasMore: page < totalPages,
      }
    },
    [startPolling]
  )

  useEffect(() => {
    // user changed (login/logout/switch). Drop stale data and re-hydrate.
    wipe()
    let cancelled = false
    async function hydrate() {
      if (!userId || !tokenStorage.read()) {
        dispatch({ type: "system/hydrated" })
        dispatch({ type: "ui/setApiStatus", payload: { status: "idle" } })
        return
      }
      try {
        const [recordResponse, projects, cfg] = await Promise.all([
          recordsApi.list({
            page: 1,
            pageSize: INITIAL_HISTORY_PAGE_SIZE,
          }),
          projectsApi.list(),
          appConfigApi.load(),
        ])
        if (cancelled) return
        const list = recordResponse.data.records.map((d) => dtoToRecord(d))
        dispatch({ type: "history/load", payload: list })
        dispatch({
          type: "projects/load",
          payload: projects.map(dtoToProject),
        })
        applyAppConfig(cfg)
        // Reflect upstream-config readiness in the global status indicator.
        dispatch({
          type: "ui/setApiStatus",
          payload:
            cfg.enabledModels.length > 0
              ? { status: "success" }
              : {
                  status: "error",
                  errorMessage: "管理员尚未配置可用模型",
                },
        })
        for (const rec of list) {
          if (rec.status === "waiting" || rec.status === "running") {
            void startPolling(rec.id)
          }
        }
      } catch (err) {
        if (cancelled) return
        dispatch({
          type: "ui/setApiStatus",
          payload: {
            status: "error",
            errorMessage:
              err instanceof ApiError ? err.message : "无法加载用户数据",
          },
        })
      } finally {
        if (!cancelled) dispatch({ type: "system/hydrated" })
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [userId, wipe, loadImageFor, startPolling, applyAppConfig])

  const addRecord = useCallback<HistoryContextValue["addRecord"]>(
    async ({ prompt, model, imageParams, referenceImages }) => {
      const dto = await recordsApi.create({
        prompt,
        model,
        imageParams,
        referenceImages,
      })
      const record = dtoToRecord(dto)
      record.referenceImages = referenceImages
      dispatch({ type: "history/add", payload: record })
      void startPolling(record.id)
      return record
    },
    [startPolling]
  )

  const retryRecord = useCallback<HistoryContextValue["retryRecord"]>(
    async (id) => {
      const dto = await recordsApi.retry(String(id))
      dispatch({
        type: "history/update",
        payload: {
          id,
          patch: {
            ...dtoToRecordPatch(dto),
            base64: undefined,
            imageError: undefined,
          },
        },
      })
      startPolling(id)
    },
    [startPolling]
  )

  const updateRecord = useCallback<HistoryContextValue["updateRecord"]>(
    async (id, patch) => {
      // Only fields the backend supports go through the API.
      const apiPatch: {
        favorite?: boolean
        isPublic?: boolean
        promptPublic?: boolean
        projectId?: string | null
      } = {}
      if (patch.favorite !== undefined) apiPatch.favorite = patch.favorite
      if (patch.isPublic !== undefined) apiPatch.isPublic = patch.isPublic
      if (patch.promptPublic !== undefined)
        apiPatch.promptPublic = patch.promptPublic
      if ("projectId" in patch) {
        apiPatch.projectId =
          patch.projectId === undefined ? null : String(patch.projectId)
      }
      if (Object.keys(apiPatch).length > 0) {
        try {
          const dto = await recordsApi.update(String(id), apiPatch)
          dispatch({
            type: "history/update",
            payload: { id, patch: dtoToRecordPatch(dto) },
          })
          return
        } catch {
          // surface via toast at call site; still keep optimistic state
        }
      }
      dispatch({ type: "history/update", payload: { id, patch } })
    },
    []
  )

  const deleteRecord = useCallback<HistoryContextValue["deleteRecord"]>(
    async (id) => {
      try {
        await recordsApi.remove(String(id))
      } catch {
        /* ignore; still drop locally */
      }
      const staleKeys: string[] = []
      blobUrlsRef.current.forEach((value, key) => {
        if (key.startsWith(`${id}:`)) {
          URL.revokeObjectURL(value)
          staleKeys.push(key)
        }
      })
      for (const key of staleKeys) blobUrlsRef.current.delete(key)
      pollersRef.current.delete(id)
      dispatch({ type: "history/delete", payload: id })
    },
    []
  )

  // Must read state.history (not stateRef), otherwise consumers like
  // preview-stage see a one-frame-stale record (the ref is updated by an
  // effect that runs *after* the children commit).
  const getById = useCallback(
    (id: number) => state.history.find((r) => r.id === id),
    [state.history]
  )

  const addProject = useCallback<ProjectsContextValue["addProject"]>(async (name) => {
    const dto = await projectsApi.create(name)
    const p = dtoToProject(dto)
    dispatch({ type: "projects/add", payload: p })
    return p
  }, [])

  const renameProject = useCallback<ProjectsContextValue["renameProject"]>(
    async (id, name) => {
      await projectsApi.rename(String(id), name)
      dispatch({ type: "projects/rename", payload: { id, name } })
    },
    []
  )

  const deleteProject = useCallback<ProjectsContextValue["deleteProject"]>(
    async (id) => {
      await projectsApi.remove(String(id))
      dispatch({ type: "projects/delete", payload: id })
    },
    []
  )

  const updateConfig = useCallback<ConfigContextValue["updateConfig"]>((patch) => {
    dispatch({ type: "config/update", payload: patch })
  }, [])

  const refreshEnabledModels = useCallback<ConfigContextValue["refreshEnabledModels"]>(
    async () => {
      try {
        const cfg = await appConfigApi.load()
        applyAppConfig(cfg)
      } catch {
        /* ignore */
      }
    },
    [applyAppConfig]
  )

  const testConnection = useCallback<ConfigContextValue["testConnection"]>(
    async () => {
      // 真正的连通性检测由 admin 后台 (POST /api/v1/admin/upstream-configs/test) 完成；
      // 这里只是兼容旧调用：当前用户拉一次 /config，没报错就视为连通。
      dispatch({ type: "ui/setApiStatus", payload: { status: "testing" } })
      try {
        await appConfigApi.load()
        dispatch({ type: "ui/setApiStatus", payload: { status: "success" } })
        return true
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "网络异常"
        dispatch({
          type: "ui/setApiStatus",
          payload: { status: "error", errorMessage: message },
        })
        return false
      }
    },
    []
  )

  const setApiStatus = useCallback<UIContextValue["setApiStatus"]>(
    (status, errorMessage) => {
      dispatch({ type: "ui/setApiStatus", payload: { status, errorMessage } })
    },
    []
  )

  const setActive = useCallback<UIContextValue["setActive"]>((id) => {
    dispatch({ type: "ui/setActive", payload: id })
  }, [])

  const openLightbox = useCallback<UIContextValue["openLightbox"]>(
    (recordId, navList) => {
      dispatch({
        type: "ui/openLightbox",
        payload: { recordId, navList: navList ?? null },
      })
    },
    []
  )

  const closeLightbox = useCallback<UIContextValue["closeLightbox"]>(() => {
    dispatch({ type: "ui/closeLightbox" })
  }, [])

  const setSettingsOpen = useCallback<UIContextValue["setSettingsOpen"]>((open) => {
    dispatch({ type: "ui/setSettingsOpen", payload: open })
  }, [])

  const eventIdRef = useRef(0)

  const appendEvent = useCallback<EventLogContextValue["append"]>((level, message) => {
    eventIdRef.current += 1
    dispatch({
      type: "events/append",
      payload: { id: eventIdRef.current, ts: Date.now(), level, message },
    })
  }, [])

  const clearEvents = useCallback<EventLogContextValue["clear"]>(() => {
    dispatch({ type: "events/clear" })
  }, [])

  const historyValue = useMemo<HistoryContextValue>(
    () => ({
      records: state.history,
      isHydrated: state.isHydrated,
      addRecord,
      retryRecord,
      updateRecord,
      deleteRecord,
      getById,
      loadRecordsPage,
      reloadImage: loadImageFor,
    }),
    [state.history, state.isHydrated, addRecord, retryRecord, updateRecord, deleteRecord, getById, loadRecordsPage, loadImageFor]
  )

  const projectsValue = useMemo<ProjectsContextValue>(
    () => ({
      projects: state.projects,
      addProject,
      renameProject,
      deleteProject,
    }),
    [state.projects, addProject, renameProject, deleteProject]
  )

  const configValue = useMemo<ConfigContextValue>(
    () => ({
      config: state.config,
      enabledModels: state.enabledModels,
      updateConfig,
      refreshAppConfig,
      refreshEnabledModels,
      testConnection,
    }),
    [
      state.config,
      state.enabledModels,
      updateConfig,
      refreshAppConfig,
      refreshEnabledModels,
      testConnection,
    ]
  )

  const uiValue = useMemo<UIContextValue>(
    () => ({
      activeHistoryId: state.activeHistoryId,
      setActive,
      lightbox: state.lightbox,
      openLightbox,
      closeLightbox,
      apiStatus: state.apiStatus,
      apiErrorMessage: state.apiErrorMessage,
      setApiStatus,
      settingsOpen: state.settingsOpen,
      setSettingsOpen,
    }),
    [
      state.activeHistoryId,
      state.lightbox,
      state.apiStatus,
      state.apiErrorMessage,
      state.settingsOpen,
      setActive,
      openLightbox,
      closeLightbox,
      setApiStatus,
      setSettingsOpen,
    ]
  )

  const eventLogValue = useMemo<EventLogContextValue>(
    () => ({
      entries: state.eventLog,
      append: appendEvent,
      clear: clearEvents,
    }),
    [state.eventLog, appendEvent, clearEvents]
  )

  return (
    <HistoryContext.Provider value={historyValue}>
      <ProjectsContext.Provider value={projectsValue}>
        <ConfigContext.Provider value={configValue}>
          <UIContext.Provider value={uiValue}>
            <EventLogContext.Provider value={eventLogValue}>
              {children}
            </EventLogContext.Provider>
          </UIContext.Provider>
        </ConfigContext.Provider>
      </ProjectsContext.Provider>
    </HistoryContext.Provider>
  )
}

// ---- hooks ----

function useRequiredContext<T>(c: React.Context<T | null>, name: string): T {
  const v = useContext(c)
  if (!v) throw new Error(`${name} must be used within AppStateProvider`)
  return v
}

export function useHistory(): HistoryContextValue {
  return useRequiredContext(HistoryContext, "useHistory")
}
export function useProjects(): ProjectsContextValue {
  return useRequiredContext(ProjectsContext, "useProjects")
}
export function useConfig(): ConfigContextValue {
  return useRequiredContext(ConfigContext, "useConfig")
}
function useUI(): UIContextValue {
  return useRequiredContext(UIContext, "useUI")
}
function useEvents(): EventLogContextValue {
  return useRequiredContext(EventLogContext, "useEventLog")
}

export function useActiveHistory(): [number | null, (id: number | null) => void] {
  const { activeHistoryId, setActive } = useUI()
  return [activeHistoryId, setActive]
}

type UseLightboxReturn = {
  open: boolean
  recordId: number | null
  navList: number[] | null
  openWith: (id: number, navList?: number[] | null) => void
  close: () => void
}

export function useLightbox(): UseLightboxReturn {
  const { lightbox, openLightbox, closeLightbox } = useUI()
  return {
    open: lightbox.open,
    recordId: lightbox.recordId,
    navList: lightbox.navList,
    openWith: openLightbox,
    close: closeLightbox,
  }
}

export function useApiStatus(): { status: ApiStatus; errorMessage: string } {
  const { apiStatus, apiErrorMessage } = useUI()
  return { status: apiStatus, errorMessage: apiErrorMessage }
}

export function useSettingsDialog() {
  const { settingsOpen, setSettingsOpen } = useUI()
  return {
    open: settingsOpen,
    openSettings: useCallback(() => setSettingsOpen(true), [setSettingsOpen]),
    closeSettings: useCallback(() => setSettingsOpen(false), [setSettingsOpen]),
    setOpen: setSettingsOpen,
  }
}

export function useEventLog(): EventLogContextValue {
  return useEvents()
}

type SubmitResult =
  | { ok: true; records: HistoryRecord[] }
  | { ok: false; message: string }

type UseGenerateReturn = {
  submit: (params: {
    prompt: string
    imageParams: ImageParams
    referenceImages?: string[]
  }) => Promise<SubmitResult>
  retry: (id: number) => Promise<void>
  isProcessing: boolean
  runningCount: number
  waitingCount: number
}

function apiErrorMessage(error: ApiError): string {
  const message = toUserFacingErrorMessage(
    localizeErrorMessage(error.message) ?? error.message
  )
  if (!error.fields || Object.keys(error.fields).length === 0) return message
  const fields = Object.entries(error.fields)
    .map(([field, detail]) => `${field}: ${detail}`)
    .join(", ")
  return `${message}: ${fields}`
}

export function useGenerate(): UseGenerateReturn {
  const { records, addRecord, retryRecord } = useHistory()
  const { config } = useConfig()
  const { setActive } = useUI()
  const { append: appendEvent, clear: clearEvents } = useEvents()

  const recordsRef = useRef(records)
  useEffect(() => {
    recordsRef.current = records
  }, [records])

  const runningCount = useMemo(
    () => records.filter((r) => r.status === "running").length,
    [records]
  )

  const waitingCount = useMemo(
    () => records.filter((r) => r.status === "waiting").length,
    [records]
  )

  const isProcessing = runningCount > 0 || waitingCount > 0

  const submit = useCallback<UseGenerateReturn["submit"]>(
    async ({ prompt, imageParams, referenceImages }) => {
      if (!config.model) {
        const message = "请先选择模型"
        appendEvent("error", message)
        return { ok: false, message }
      }
      const busy = recordsRef.current.some(
        (r) => r.status === "running" || r.status === "waiting"
      )
      if (!busy) clearEvents()
      appendEvent(
        "info",
        `提交生成请求: ${prompt.slice(0, 60)}`
      )
      if (referenceImages && referenceImages.length > 0) {
        appendEvent("info", `附带 ${referenceImages.length} 张参考图`)
      }
      try {
        const record = await addRecord({
          prompt,
          model: config.model,
          imageParams,
          referenceImages,
        })
        setActive(record.id)
        return { ok: true, records: [record] }
      } catch (err) {
        const message =
          err instanceof ApiError ? apiErrorMessage(err) : "提交失败，请重试"
        appendEvent("error", message)
        return { ok: false, message }
      }
    },
    [config.model, addRecord, setActive, appendEvent, clearEvents]
  )

  const retry = useCallback<UseGenerateReturn["retry"]>(
    async (id) => {
      const target = recordsRef.current.find((r) => r.id === id)
      if (!target) return
      appendEvent("info", `重试记录 #${id}`)
      await retryRecord(id)
      setActive(id)
    },
    [setActive, appendEvent, retryRecord]
  )

  return { submit, retry, isProcessing, runningCount, waitingCount }
}
