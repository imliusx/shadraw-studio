import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  AuthError,
  authApi,
  type AuthUser as ApiAuthUser,
  type ChangePasswordPayload,
  type LoginPayload,
  type RegisterPayload,
  type UpdateProfilePayload,
} from "@/lib/api/auth-client"

export type AuthUser = {
  id: string
  displayName: string
  email: string
  avatarSeed: string
  avatarUrl?: string
  role: "admin" | "user"
}

export type AuthStatus = "idle" | "submitting" | "error"

export type LoginInput = LoginPayload
export type RegisterInput = RegisterPayload

type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  error: string | null
  isInitializing: boolean
  login: (input: LoginInput) => Promise<boolean>
  register: (input: RegisterInput) => Promise<boolean>
  logout: () => Promise<void>
  updateProfile: (input: UpdateProfilePayload) => Promise<AuthUser>
  uploadAvatar: (file: File) => Promise<AuthUser>
  deleteAvatar: () => Promise<AuthUser>
  changePassword: (input: ChangePasswordPayload) => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toUser(api: ApiAuthUser): AuthUser {
  const localPart = api.email.split("@")[0] || api.email
  const avatarUrl = api.avatarUrl
    ? `${api.avatarUrl}${api.avatarUrl.includes("?") ? "&" : "?"}v=${Date.now()}`
    : undefined
  return {
    id: api.id,
    email: api.email,
    displayName: api.displayName || localPart,
    avatarSeed: api.displayName || localPart,
    avatarUrl,
    role: api.role === "admin" ? "admin" : "user",
  }
}

function messageFromError(err: unknown): string {
  if (err instanceof AuthError) {
    if (err.fields) {
      const first = Object.values(err.fields)[0]
      if (first) return first
    }
    return err.message
  }
  if (err instanceof Error) return err.message
  return "未知错误"
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Restore session on mount: rotate the HttpOnly refresh cookie into a fresh
  // in-memory access token, then fetch the current user.
  useEffect(() => {
    let cancelled = false
    async function restore() {
      try {
        await authApi.refresh()
        const me = await authApi.me()
        if (cancelled) return
        setUser(toUser(me))
      } catch {
        // No valid refresh cookie; keep the user signed out.
      } finally {
        if (!cancelled) setIsInitializing(false)
      }
    }
    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (input: LoginInput): Promise<boolean> => {
    setStatus("submitting")
    setError(null)
    try {
      const resp = await authApi.login(input)
      setUser(toUser(resp.user))
      setStatus("idle")
      return true
    } catch (err) {
      setStatus("error")
      setError(messageFromError(err))
      return false
    }
  }, [])

  const register = useCallback(async (input: RegisterInput): Promise<boolean> => {
    setStatus("submitting")
    setError(null)
    try {
      const resp = await authApi.register(input)
      setUser(toUser(resp.user))
      setStatus("idle")
      return true
    } catch (err) {
      setStatus("error")
      setError(messageFromError(err))
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
    setStatus("idle")
    setError(null)
  }, [])

  const updateProfile = useCallback(async (input: UpdateProfilePayload) => {
    const next = toUser(await authApi.updateProfile(input))
    setUser(next)
    return next
  }, [])

  const uploadAvatar = useCallback(async (file: File) => {
    const next = toUser(await authApi.uploadAvatar(file))
    setUser(next)
    return next
  }, [])

  const deleteAvatar = useCallback(async () => {
    const next = toUser(await authApi.deleteAvatar())
    setUser(next)
    return next
  }, [])

  const changePassword = useCallback(async (input: ChangePasswordPayload) => {
    await authApi.changePassword(input)
    setUser(null)
    setStatus("idle")
    setError(null)
  }, [])

  const clearError = useCallback(() => {
    setStatus((prev) => (prev === "error" ? "idle" : prev))
    setError(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      error,
      isInitializing,
      login,
      register,
      logout,
      updateProfile,
      uploadAvatar,
      deleteAvatar,
      changePassword,
      clearError,
    }),
    [
      user,
      status,
      error,
      isInitializing,
      login,
      register,
      logout,
      updateProfile,
      uploadAvatar,
      deleteAvatar,
      changePassword,
      clearError,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
