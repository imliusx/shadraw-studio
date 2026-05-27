import * as React from "react"
import { toast } from "sonner"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { adminApi, type UpstreamConfigDTO } from "@/lib/api/admin-client"
import { ApiError } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/password-input"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export function UpstreamConfigCard() {
  const [config, setConfig] = React.useState<UpstreamConfigDTO | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)

  const [baseUrl, setBaseUrl] = React.useState("")
  const [apiKey, setApiKey] = React.useState("")
  // Tracks the apiKey value initially loaded from the backend (masked). If the
  // user leaves the field untouched we treat it as "no change" on save.
  const initialApiKeyRef = React.useRef("")
  const [models, setModels] = React.useState("")
  const [concurrency, setConcurrency] = React.useState(4)
  const [testModel, setTestModel] = React.useState<string>("")
  const [testModelOpen, setTestModelOpen] = React.useState(false)

  const enabledModelsList = React.useMemo(
    () =>
      models
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [models]
  )

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, rt] = await Promise.all([
        adminApi.getUpstream(),
        adminApi.getRuntime(),
      ])
      setConfig(cfg)
      setBaseUrl(cfg.baseUrl ?? "")
      setModels((cfg.enabledModels ?? []).join(", "))
      setConcurrency(rt.workerConcurrency)
      const initial = cfg.apiKeyMasked ?? ""
      setApiKey(initial)
      initialApiKeyRef.current = initial
      if (cfg.enabledModels && cfg.enabledModels.length > 0) {
        const preferred = cfg.enabledModels.includes("gpt-image-2")
          ? "gpt-image-2"
          : cfg.enabledModels[0]
        setTestModel((cur) => cur || preferred || "")
      }
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
    setSaving(true)
    try {
      const payload: Parameters<typeof adminApi.updateUpstream>[0] = {
        baseUrl,
        enabledModels: enabledModelsList,
      }
      // Treat the field as unchanged if it still matches whatever was last
      // loaded; only send apiKey when the user actually edited it.
      if (apiKey !== initialApiKeyRef.current) {
        payload.apiKey = apiKey === "" ? null : apiKey
      }
      const next = await adminApi.updateUpstream(payload)
      setConfig(next)
      // Keep the visible input value untouched (so the user still sees the key
      // they just typed). Page-refresh will fall back to the masked value from
      // the backend.
      initialApiKeyRef.current = apiKey
      toast.success("已保存上游配置")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }, [baseUrl, apiKey, enabledModelsList])

  const handleTest = React.useCallback(async () => {
    setTesting(true)
    try {
      const res = await adminApi.testUpstream(testModel || undefined)
      if (res.ok) {
        const parts: string[] = []
        if (res.elapsedMs) parts.push(`${(res.elapsedMs / 1000).toFixed(1)}s`)
        if (res.imageBytes)
          parts.push(`${Math.round(res.imageBytes / 1024)} KB`)
        const detail = parts.length > 0 ? ` (${parts.join(", ")})` : ""
        toast.success(`上游可用${detail}`)
      } else {
        toast.error(`连接失败: ${res.message || `HTTP ${res.status}`}`, {
          duration: 8000,
        })
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "测试失败")
    } finally {
      setTesting(false)
    }
  }, [testModel])

  const handleConcurrency = React.useCallback(async (value: number) => {
    setConcurrency(value)
    try {
      await adminApi.updateRuntime(value)
      toast.success(`Worker 并发度已更新为 ${value}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "更新失败")
    }
  }, [])

  if (loading) {
    return (
      <Card className="gap-4 p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </Card>
    )
  }

  return (
    <div className="grid gap-6">
      <Card className="gap-4 p-6">
        <div>
          <h3 className="text-base font-semibold">上游 OpenAI 兼容接口</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            所有用户的生图请求都通过此配置发往上游；API Key 加密存储，不会以原值返回。
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="upstream-baseurl">Base URL</Label>
          <Input
            id="upstream-baseurl"
            placeholder="https://api.openai.com"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="upstream-apikey">API Key</Label>
          <PasswordInput
            id="upstream-apikey"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="upstream-models">启用模型（逗号分隔）</Label>
          <Input
            id="upstream-models"
            placeholder="gpt-image-2, gpt-5.3-codex"
            value={models}
            onChange={(e) => setModels(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner /> : null}
            {saving ? "保存中..." : "保存"}
          </Button>
          <Button variant="ghost" onClick={() => void reload()}>
            重置
          </Button>
        </div>
      </Card>

      <Card className="gap-4 p-6">
        <div>
          <h3 className="text-base font-semibold">连通性测试</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            选择一个已启用的模型，会真实调用一次最小生图请求验证全链路（约 10–30s）。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu open={testModelOpen} onOpenChange={setTestModelOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-60 justify-between font-normal"
                disabled={enabledModelsList.length === 0}
              >
                {testModel ? (
                  testModel
                ) : (
                  <span className="text-muted-foreground">
                    {enabledModelsList.length === 0
                      ? "请先填写启用模型并保存"
                      : "选择测试模型"}
                  </span>
                )}
                <ChevronsUpDown className="opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60" align="start">
              {enabledModelsList.map((m) => (
                <DropdownMenuItem key={m} onSelect={() => setTestModel(m)}>
                  <span>{m}</span>
                  <Check
                    className={cn(
                      "ml-auto",
                      testModel === m ? "opacity-100" : "opacity-0"
                    )}
                  />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || enabledModelsList.length === 0 || !testModel}
          >
            {testing ? <Loader2 className="size-4 animate-spin" /> : null}
            {testing ? "调用中…(约 10–30s)" : "测试连通性"}
          </Button>
        </div>
      </Card>

      <Card className="gap-4 p-6">
        <div>
          <h3 className="text-base font-semibold">Worker 并发度</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            同时调用上游的最大并发数。修改后立即生效，无需重启。
          </p>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-sm">
            <span>当前并发：</span>
            <span className="font-mono">{concurrency}</span>
          </div>
          <Slider
            min={1}
            max={16}
            step={1}
            value={[concurrency]}
            onValueChange={(v) => setConcurrency(v[0] ?? 1)}
            onValueCommit={(v) => void handleConcurrency(v[0] ?? 1)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>16</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
