import type { HistoryRecord } from "@/components/workbench/types"
import { errorToShortMessage } from "@/lib/api/errors"

let isProcessing = false

export type SchedulerDeps = {
  getNextWaiting: () => HistoryRecord | undefined
  callApi: (record: HistoryRecord) => Promise<string>
  onStart: (id: number) => void
  onSuccess: (id: number, base64: string) => void
  onFailure: (id: number, error: string) => void
}

export function startQueue(deps: SchedulerDeps): void {
  if (isProcessing) return
  const next = deps.getNextWaiting()
  if (!next) return

  isProcessing = true
  deps.onStart(next.id)

  deps
    .callApi(next)
    .then((base64) => {
      deps.onSuccess(next.id, base64)
    })
    .catch((error: unknown) => {
      deps.onFailure(next.id, errorToShortMessage(error))
    })
    .finally(() => {
      isProcessing = false
      startQueue(deps)
    })
}
