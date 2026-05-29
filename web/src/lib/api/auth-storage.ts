// In-browser access-token storage. Refresh tokens live in an HttpOnly cookie;
// access tokens stay in memory only so XSS cannot read long-lived credentials.

const ACCESS_KEY = "shadraw.access"
const REFRESH_KEY = "shadraw.refresh"

export type StoredTokens = {
  accessToken: string
}

let memoryTokens: StoredTokens | null = null

function clearLegacyLocalStorage() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(ACCESS_KEY)
  window.localStorage.removeItem(REFRESH_KEY)
}

export const tokenStorage = {
  read(): StoredTokens | null {
    clearLegacyLocalStorage()
    return memoryTokens
  },
  write(tokens: StoredTokens) {
    clearLegacyLocalStorage()
    memoryTokens = { accessToken: tokens.accessToken }
  },
  clear() {
    memoryTokens = null
    clearLegacyLocalStorage()
  },
}
