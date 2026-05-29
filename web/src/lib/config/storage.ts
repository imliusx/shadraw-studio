import type { Config } from "@/components/workbench/types"
import { RESPONSE_IMAGE_MODEL } from "@/lib/api/models"

const STORAGE_KEY = "shadraw-ui:config"
const LEGACY_STORAGE_KEY = "imagener:config"

export const DEFAULT_CONFIG: Config = {
  baseUrl: "",
  apiKey: "",
  model: RESPONSE_IMAGE_MODEL,
  siteTitle: "shadraw",
  registrationEnabled: true,
}

export function loadConfig(): Config {
  if (typeof window === "undefined") return DEFAULT_CONFIG
  let raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      window.localStorage.setItem(STORAGE_KEY, legacy)
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      raw = legacy
    }
  }
  if (!raw) return DEFAULT_CONFIG
  try {
    const parsed = JSON.parse(raw) as Partial<Config>
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model:
        typeof parsed.model === "string" && parsed.model
          ? parsed.model
          : DEFAULT_CONFIG.model,
      siteTitle:
        typeof parsed.siteTitle === "string" && parsed.siteTitle.trim()
          ? parsed.siteTitle
          : DEFAULT_CONFIG.siteTitle,
      registrationEnabled:
        typeof parsed.registrationEnabled === "boolean"
          ? parsed.registrationEnabled
          : DEFAULT_CONFIG.registrationEnabled,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveConfig(config: Config): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}
