"use client"

import * as React from "react"

import { useHistory } from "@/app/providers/app-state-provider"
import type { ListRecordsParams } from "@/lib/api/records-client"
import type { HistoryRecord } from "@/components/workbench/types"

type MineRecordsParams = Omit<ListRecordsParams, "scope" | "page" | "pageSize">

type PagedRecordsState = {
  ids: number[]
  page: number
  total: number
  totalPages: number
  status: "idle" | "loading" | "ready" | "loadingMore" | "error"
  message?: string
}

type UsePagedRecordsOptions = {
  enabled?: boolean
  params?: MineRecordsParams
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 30

const INITIAL_STATE: PagedRecordsState = {
  ids: [],
  page: 0,
  total: 0,
  totalPages: 1,
  status: "idle",
}

export function usePagedRecords({
  enabled = true,
  params = {},
  pageSize = DEFAULT_PAGE_SIZE,
}: UsePagedRecordsOptions) {
  const { records, loadRecordsPage } = useHistory()
  const normalizedParams = React.useMemo<MineRecordsParams>(
    () => ({
      status: params.status,
      projectId: params.projectId,
      favorite: params.favorite,
      q: params.q?.trim() || undefined,
    }),
    [params.favorite, params.projectId, params.q, params.status]
  )
  const queryKey = React.useMemo(
    () =>
      [
        normalizedParams.status ?? "",
        normalizedParams.projectId ?? "",
        normalizedParams.favorite === undefined
          ? ""
          : String(normalizedParams.favorite),
        normalizedParams.q ?? "",
        String(pageSize),
      ].join("\u0001"),
    [normalizedParams, pageSize]
  )

  const [state, setState] = React.useState<PagedRecordsState>(INITIAL_STATE)
  const loadingRef = React.useRef(false)
  const requestIdRef = React.useRef(0)

  const loadPage = React.useCallback(
    async (page: number, mode: "reset" | "append") => {
      if (!enabled || loadingRef.current) return
      loadingRef.current = true
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      setState((current) =>
        mode === "reset"
          ? { ...INITIAL_STATE, status: "loading" }
          : { ...current, status: "loadingMore", message: undefined }
      )

      try {
        const result = await loadRecordsPage({
          ...normalizedParams,
          page,
          pageSize,
        })
        if (requestIdRef.current !== requestId) return

        const incomingIds = result.records.map((record) => record.id)
        setState((current) => {
          const ids =
            mode === "reset"
              ? incomingIds
              : appendUniqueIds(current.ids, incomingIds)
          return {
            ids,
            page: result.page,
            total: result.total,
            totalPages: result.totalPages,
            status: "ready",
          }
        })
      } catch (error) {
        if (requestIdRef.current !== requestId) return
        setState((current) => ({
          ...current,
          status: "error",
          message: error instanceof Error ? error.message : "加载失败",
        }))
      } finally {
        if (requestIdRef.current === requestId) {
          loadingRef.current = false
        }
      }
    },
    [enabled, loadRecordsPage, normalizedParams, pageSize]
  )

  React.useEffect(() => {
    requestIdRef.current += 1
    loadingRef.current = false
    if (!enabled) {
      setState(INITIAL_STATE)
      return
    }
    void loadPage(1, "reset")
  }, [enabled, loadPage, queryKey])

  const loadMore = React.useCallback(() => {
    if (!enabled || loadingRef.current) return
    if (state.page >= state.totalPages) return
    void loadPage(state.page + 1, "append")
  }, [enabled, loadPage, state.page, state.totalPages])

  const recordMap = React.useMemo(
    () => new Map(records.map((record) => [record.id, record])),
    [records]
  )

  const pagedRecords = React.useMemo(() => {
    const loadedIds = new Set(state.ids)
    const loadedRecords = state.ids
      .map((id) => recordMap.get(id))
      .filter((record): record is HistoryRecord =>
        record ? matchesParams(record, normalizedParams) : false
      )
    const firstLoaded = loadedRecords[0]
    const liveRecords = records
      .filter(
        (record) =>
          !loadedIds.has(record.id) &&
          matchesParams(record, normalizedParams) &&
          (!firstLoaded ||
            record.createdAt > firstLoaded.createdAt ||
            (record.createdAt === firstLoaded.createdAt &&
              record.id > firstLoaded.id))
      )
      .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)

    return [...liveRecords, ...loadedRecords]
  }, [normalizedParams, recordMap, records, state.ids])

  const isLoadingInitial = state.status === "loading" && state.ids.length === 0
  const isLoadingMore = state.status === "loadingMore"
  const hasMore = state.page < state.totalPages

  return {
    records: pagedRecords,
    page: state.page,
    total: Math.max(state.total, pagedRecords.length),
    totalPages: state.totalPages,
    status: state.status,
    message: state.message,
    hasMore,
    isLoadingInitial,
    isLoadingMore,
    loadMore,
  }
}

function appendUniqueIds(current: number[], incoming: number[]): number[] {
  const seen = new Set(current)
  const next = [...current]
  for (const id of incoming) {
    if (seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next
}

function matchesParams(
  record: HistoryRecord,
  params: MineRecordsParams
): boolean {
  if (params.status && record.status !== params.status) return false
  if (params.favorite !== undefined && record.favorite !== params.favorite) {
    return false
  }
  if (params.projectId === "none" && record.projectId !== undefined) {
    return false
  }
  if (
    params.projectId &&
    params.projectId !== "none" &&
    record.projectId !== Number(params.projectId)
  ) {
    return false
  }
  if (params.q && !record.prompt.toLowerCase().includes(params.q.toLowerCase())) {
    return false
  }
  return true
}
