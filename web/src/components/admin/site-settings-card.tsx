import * as React from "react"
import { Globe2 } from "lucide-react"
import { toast } from "sonner"

import { useConfig } from "@/providers/app-state-provider"
import { adminApi } from "@/lib/api/admin-client"
import { ApiError } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

const MAX_TITLE_LENGTH = 64

export function SiteSettingsCard() {
  const { refreshAppConfig } = useConfig()
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [siteTitle, setSiteTitle] = React.useState("")
  const [savedTitle, setSavedTitle] = React.useState("")

  const trimmedTitle = siteTitle.trim()
  const titleError = titleValidationError(siteTitle)
  const dirty = trimmedTitle !== savedTitle

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const cfg = await adminApi.getSiteSettings()
      setSiteTitle(cfg.siteTitle)
      setSavedTitle(cfg.siteTitle)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const timeout = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(timeout)
  }, [reload])

  const handleSave = React.useCallback(async () => {
    if (titleError) return
    setSaving(true)
    try {
      const cfg = await adminApi.updateSiteSettings({ siteTitle: trimmedTitle })
      setSiteTitle(cfg.siteTitle)
      setSavedTitle(cfg.siteTitle)
      await refreshAppConfig()
      toast.success("已保存站点标题")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }, [refreshAppConfig, titleError, trimmedTitle])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe2 />
          站点设置
        </CardTitle>
        <CardDescription>
          设置浏览器标题、顶部品牌和登录页显示的网站名称。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field data-invalid={Boolean(titleError)}>
            <FieldLabel htmlFor="site-title">网站标题</FieldLabel>
            <Input
              id="site-title"
              value={siteTitle}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(event) => setSiteTitle(event.target.value)}
              aria-invalid={Boolean(titleError)}
              placeholder="shadraw"
            />
            {titleError ? (
              <FieldError>{titleError}</FieldError>
            ) : (
              <FieldDescription>
                最多 {MAX_TITLE_LENGTH} 个字符。
              </FieldDescription>
            )}
          </Field>
          <Field orientation="horizontal" className="justify-start">
            <Button
              onClick={handleSave}
              disabled={saving || Boolean(titleError) || !dirty}
            >
              {saving ? <Spinner /> : null}
              {saving ? "保存中..." : "保存"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => void reload()}
              disabled={saving || !dirty}
            >
              重置
            </Button>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function titleValidationError(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return "网站标题不能为空"
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return `网站标题不能超过 ${MAX_TITLE_LENGTH} 个字符`
  }
  return null
}
