import * as React from "react"
import { Globe2, KeyRound, UserPlus } from "lucide-react"
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
  FieldTitle,
  FieldContent,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"

const MAX_TITLE_LENGTH = 64

export function SiteSettingsCard() {
  const { refreshAppConfig } = useConfig()
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [siteTitle, setSiteTitle] = React.useState("")
  const [savedTitle, setSavedTitle] = React.useState("")
  const [registrationEnabled, setRegistrationEnabled] = React.useState(true)
  const [savedRegistrationEnabled, setSavedRegistrationEnabled] =
    React.useState(true)
  const [demoLoginEnabled, setDemoLoginEnabled] = React.useState(false)
  const [savedDemoLoginEnabled, setSavedDemoLoginEnabled] =
    React.useState(false)

  const trimmedTitle = siteTitle.trim()
  const titleError = titleValidationError(siteTitle)
  const dirty =
    trimmedTitle !== savedTitle ||
    registrationEnabled !== savedRegistrationEnabled ||
    demoLoginEnabled !== savedDemoLoginEnabled

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const cfg = await adminApi.getSiteSettings()
      setSiteTitle(cfg.siteTitle)
      setSavedTitle(cfg.siteTitle)
      setRegistrationEnabled(cfg.registrationEnabled)
      setSavedRegistrationEnabled(cfg.registrationEnabled)
      setDemoLoginEnabled(cfg.demoLoginEnabled)
      setSavedDemoLoginEnabled(cfg.demoLoginEnabled)
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
      const cfg = await adminApi.updateSiteSettings({
        siteTitle: trimmedTitle,
        registrationEnabled,
        demoLoginEnabled,
      })
      setSiteTitle(cfg.siteTitle)
      setSavedTitle(cfg.siteTitle)
      setRegistrationEnabled(cfg.registrationEnabled)
      setSavedRegistrationEnabled(cfg.registrationEnabled)
      setDemoLoginEnabled(cfg.demoLoginEnabled)
      setSavedDemoLoginEnabled(cfg.demoLoginEnabled)
      await refreshAppConfig()
      toast.success("已保存站点设置")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }, [
    demoLoginEnabled,
    refreshAppConfig,
    titleError,
    trimmedTitle,
    registrationEnabled,
  ])

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
          <Field
            orientation="horizontal"
            className="items-start justify-between rounded-lg border p-3"
          >
            <FieldContent>
              <FieldTitle className="flex items-center gap-2">
                <UserPlus />
                开放注册
              </FieldTitle>
              <FieldDescription>
                关闭后，新访客无法自助创建账号，现有用户仍可登录。
              </FieldDescription>
            </FieldContent>
            <Switch
              checked={registrationEnabled}
              onCheckedChange={setRegistrationEnabled}
              disabled={saving}
              aria-label="开放注册"
            />
          </Field>
          <Field
            orientation="horizontal"
            className="items-start justify-between rounded-lg border p-3"
          >
            <FieldContent>
              <FieldTitle className="flex items-center gap-2">
                <KeyRound />
                演示登录预填
              </FieldTitle>
              <FieldDescription>
                打开后，登录页会默认填入演示账号和密码。
              </FieldDescription>
            </FieldContent>
            <Switch
              checked={demoLoginEnabled}
              onCheckedChange={setDemoLoginEnabled}
              disabled={saving}
              aria-label="演示登录预填"
            />
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
              onClick={() => {
                setSiteTitle(savedTitle)
                setRegistrationEnabled(savedRegistrationEnabled)
                setDemoLoginEnabled(savedDemoLoginEnabled)
              }}
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
