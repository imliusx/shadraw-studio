// In-browser token storage. MVP 阶段把 access + refresh 都放在 localStorage,
// 风险是 XSS 可拿到 token; 等正式上线再迁到 httpOnly cookie。

const ACCESS_KEY = "shadraw.access"
const REFRESH_KEY = "shadraw.refresh"

export type StoredTokens = {
  accessToken: string
  refreshToken: string
}

export const tokenStorage = {
  read(): StoredTokens | null {
    if (typeof window === "undefined") return null
    const access = window.localStorage.getItem(ACCESS_KEY)
    const refresh = window.localStorage.getItem(REFRESH_KEY)
    if (!access || !refresh) return null
    return { accessToken: access, refreshToken: refresh }
  },
  write(tokens: StoredTokens) {
    if (typeof window === "undefined") return
    window.localStorage.setItem(ACCESS_KEY, tokens.accessToken)
    window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
  },
  clear() {
    if (typeof window === "undefined") return
    window.localStorage.removeItem(ACCESS_KEY)
    window.localStorage.removeItem(REFRESH_KEY)
  },
}
