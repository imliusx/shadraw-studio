import { tokenStorage, type StoredTokens } from "./auth-storage"

type Envelope<T> = {
  data: T | null
  error: { code: string; message: string; fields?: Record<string, string> } | null
}

let refreshPromise: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  try {
    const resp = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    })
    if (!resp.ok) {
      tokenStorage.clear()
      return false
    }
    const env = (await resp.json()) as Envelope<{
      tokens: StoredTokens & { expiresIn: number }
    }>
    if (!env.data?.tokens.accessToken) {
      tokenStorage.clear()
      return false
    }
    tokenStorage.write({
      accessToken: env.data.tokens.accessToken,
    })
    return true
  } catch {
    tokenStorage.clear()
    return false
  }
}

export function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}
