import * as React from "react"
import { motion } from "motion/react"
import type { Layout } from "react-resizable-panels"
import { toast } from "sonner"
import {
  ArrowUp,
  BadgeCheck,
  Check,
  Eraser,
  Hourglass,
  Loader2,
  SlidersHorizontal,
} from "lucide-react"
import { Codex, OpenAI } from "@lobehub/icons"

import {
  useConfig,
  useGenerate,
} from "@/providers/app-state-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"
import {
  RESPONSE_IMAGE_MODEL,
  modelOptions,
} from "@/lib/api/models"

import {
  backgroundOptions,
  imageRatioOptions,
  imageRatioToSize,
  moderationOptions,
  outputFormatOptions,
  qualityOptions,
  type ImageRatioLabel,
} from "./data"
import {
  ReferenceImageUploader,
  readImageFileAsDataUrl,
} from "./reference-image-uploader"
import type {
  ImageBackground,
  ImageModeration,
  ImageOutputFormat,
  ImageParams,
  ImageQuality,
} from "./types"

const MAX_REFERENCE_IMAGES = 4
const DEFAULT_SIDEBAR_CONTROL_LAYOUT: Layout = {
  parameters: 72,
  input: 28,
}

type ModelIconComponent = React.ComponentType<{ size?: number | string }>

const QUALITY_LABELS: Record<ImageQuality, string> = {
  auto: "自动",
  high: "高",
  medium: "中",
  low: "低",
}

const BACKGROUND_LABELS: Record<ImageBackground, string> = {
  auto: "自动背景",
  transparent: "透明背景",
  opaque: "不透明背景",
}

const MODERATION_LABELS: Record<ImageModeration, string> = {
  auto: "标准审核",
  low: "低强度审核",
}

const OUTPUT_FORMAT_LABELS: Record<ImageOutputFormat, string> = {
  png: "PNG 格式",
  jpeg: "JPEG 格式",
  webp: "WebP 格式",
}

function getModelIcon(value: string | undefined): ModelIconComponent {
  switch (value) {
    case RESPONSE_IMAGE_MODEL:
      return Codex
    default:
      return OpenAI
  }
}

type ParameterMode = "dropdown" | "sidebar"

type SelectParameterKey =
  | "background"
  | "moderation"

type SelectParameterDefinition = {
  key: SelectParameterKey
  label: string
  options: Array<{ value: string; label: string; shortLabel?: string }>
}

const SELECT_PARAMETER_DEFINITIONS: SelectParameterDefinition[] = [
  {
    key: "background",
    label: "背景处理",
    options: backgroundOptions.map((background) => ({
      value: background,
      label: BACKGROUND_LABELS[background],
      shortLabel:
        background === "auto"
          ? "自动"
          : background === "transparent"
            ? "透明"
            : "不透明",
    })),
  },
  {
    key: "moderation",
    label: "内容审核",
    options: moderationOptions.map((moderation) => ({
      value: moderation,
      label: MODERATION_LABELS[moderation],
      shortLabel: moderation === "auto" ? "标准" : "低",
    })),
  },
]

function getSelectParameterValue(
  imageParams: ImageParams,
  key: SelectParameterKey
): string {
  return imageParams[key]
}

function getSelectParameterPatch(
  key: SelectParameterKey,
  value: string
): Partial<ImageParams> {
  switch (key) {
    case "background":
      return { background: value as ImageBackground }
    case "moderation":
      return { moderation: value as ImageModeration }
  }
}

type ControlPanelProps = {
  variant?: "stacked" | "sidebar"
  prompt: string
  setPrompt: (value: string) => void
  imageParams: ImageParams
  setImageParams: React.Dispatch<React.SetStateAction<ImageParams>>
  imageRatio: ImageRatioLabel
  setImageRatio: React.Dispatch<React.SetStateAction<ImageRatioLabel>>
  referenceImages: string[]
  setReferenceImages: React.Dispatch<React.SetStateAction<string[]>>
}

export function ControlPanel({
  variant = "stacked",
  prompt,
  setPrompt,
  imageParams,
  setImageParams,
  imageRatio,
  setImageRatio,
  referenceImages,
  setReferenceImages,
}: ControlPanelProps) {
  const { config, updateConfig } = useConfig()
  const { submit, runningCount, waitingCount } = useGenerate()
  const { fadeInUp } = useMotionVariants()

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const [referenceError, setReferenceError] = React.useState<string | null>(null)
  const [sidebarLayout, setSidebarLayout] = React.useState<Layout>(
    DEFAULT_SIDEBAR_CONTROL_LAYOUT
  )

  const openPicker = React.useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFiles = React.useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList)
      if (files.length === 0) return
      setReferenceError(null)
      const accepted: string[] = []
      for (const file of files) {
        const result = await readImageFileAsDataUrl(file)
        if (result.ok) {
          accepted.push(result.dataUrl)
        } else {
          setReferenceError(result.error)
          break
        }
      }
      if (accepted.length === 0) return
      setReferenceImages((prev) => {
        const next = [...prev, ...accepted].slice(0, MAX_REFERENCE_IMAGES)
        if (prev.length + accepted.length > MAX_REFERENCE_IMAGES) {
          setReferenceError(`最多 ${MAX_REFERENCE_IMAGES} 张参考图,多余的已忽略`)
        }
        return next
      })
    },
    [setReferenceImages]
  )

  const handleRemoveReference = React.useCallback(
    (index: number) => {
      setReferenceImages((prev) => prev.filter((_, i) => i !== index))
      setReferenceError(null)
    },
    [setReferenceImages]
  )

  const [submitting, setSubmitting] = React.useState(false)

  const handleGenerate = React.useCallback(async () => {
    if (submitting) return
    if (prompt.trim().length === 0) return
    setSubmitting(true)
    // Hold the loading state for at least 400ms so the spinner is perceivable
    // even when the backend round-trip is sub-100ms.
    const minDelay = new Promise((r) => setTimeout(r, 400))
    try {
      const [result] = await Promise.all([
        submit({ prompt, imageParams, referenceImages }),
        minDelay,
      ])
      if (result.ok) {
        setPrompt("")
        toast.success("已提交生成任务")
      } else {
        toast.error(result.message)
      }
    } finally {
      setSubmitting(false)
    }
  }, [submitting, prompt, imageParams, referenceImages, submit, setPrompt])

  const updateImageParams = React.useCallback(
    (patch: Partial<ImageParams>) => {
      setImageParams((prev) => ({ ...prev, ...patch }))
    },
    [setImageParams]
  )

  const generateDisabled = prompt.trim().length === 0 || submitting

  const selectedModelLabel = config.model
    ? modelOptions.find((option) => option.value === config.model)?.label ??
      config.model
    : "未配置"
  const selectedRatioLabel = imageRatio
  const selectedQualityLabel = QUALITY_LABELS[imageParams.quality]
  const selectedOutputFormatLabel =
    OUTPUT_FORMAT_LABELS[imageParams.output_format]

  const inputArea = (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col gap-3 px-4 pb-4 pt-4",
        variant === "sidebar" ? "h-full justify-end pt-5" : "flex-1"
      )}
    >
      {variant !== "sidebar" ? (
        <div
          className="flex min-w-0 flex-wrap items-center gap-1"
          aria-label="当前图片参数"
        >
          {[
            { key: "model", label: selectedModelLabel },
            { key: "ratio", label: selectedRatioLabel },
            { key: "quality", label: selectedQualityLabel },
            { key: "format", label: selectedOutputFormatLabel },
          ].map((item) => (
            <Badge
              key={item.key}
              variant="secondary"
              className="h-4 gap-0.5 px-1.5 text-[10px] text-muted-foreground"
              title={item.label}
            >
              <BadgeCheck data-icon="inline-start" />
              <span>{item.label}</span>
            </Badge>
          ))}
        </div>
      ) : null}
      <div
        className={cn(
          "relative flex min-h-20 flex-col overflow-hidden rounded-lg border border-input bg-transparent transition-colors dark:bg-input/30",
          variant === "sidebar" ? "min-h-28 flex-1" : "flex-1",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          referenceError && "border-destructive ring-3 ring-destructive/20",
          dragOver && "border-ring bg-accent/40"
        )}
        onDragOver={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return
          setDragOver(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          const files = event.dataTransfer.files
          if (files && files.length > 0) void handleFiles(files)
        }}
      >
        <Textarea
          id="prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="field-sizing-fixed min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-3 pb-3 pt-2.5 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
          placeholder="描述你想生成的图片..."
        />
        <div className="flex flex-col gap-1.5 px-2 pb-2 pt-2">
          {runningCount > 0 || waitingCount > 0 ? (
            <QueueStatusBadge running={runningCount} waiting={waitingCount} />
          ) : null}
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex shrink-0 items-center gap-0.5">
              <ReferenceImageUploader
                values={referenceImages}
                onRemove={handleRemoveReference}
                onPick={openPicker}
                max={MAX_REFERENCE_IMAGES}
              />
              <IconParam
                icon={React.createElement(getModelIcon(config.model), {
                  size: 16,
                })}
                ariaLabel="选择模型"
                tooltip={`模型: ${selectedModelLabel}`}
              >
                {modelOptions.map((option) => {
                  const ModelIcon = getModelIcon(option.value)
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => updateConfig({ model: option.value })}
                    >
                      <ModelIcon size={16} />
                      <span>{option.label}</span>
                      <Check
                        className={cn(
                          "ml-auto",
                          config.model === option.value
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </DropdownMenuItem>
                  )
                })}
              </IconParam>
              {variant !== "sidebar" ? (
                <IconParam
                  icon={<SlidersHorizontal />}
                  ariaLabel="选择图片参数"
                  tooltip={`参数: ${selectedRatioLabel} · ${selectedQualityLabel}`}
                >
                  <ParameterDropdownContent
                    imageParams={imageParams}
                    updateImageParams={updateImageParams}
                    imageRatio={imageRatio}
                    setImageRatio={setImageRatio}
                  />
                </IconParam>
              ) : null}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={prompt.length === 0}
                    aria-label="清空提示词"
                    onClick={() => setPrompt("")}
                  >
                    <Eraser />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">清空提示词</TooltipContent>
              </Tooltip>
              <Button
                type="button"
                size="icon"
                disabled={generateDisabled}
                onClick={() => void handleGenerate()}
                aria-label="提交任务"
                className="rounded-full hover:bg-primary/80"
              >
                {submitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowUp strokeWidth={2.5} />
                )}
              </Button>
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = event.target.files
              ? Array.from(event.target.files)
              : []
            event.target.value = ""
            if (files.length > 0) void handleFiles(files)
          }}
        />
      </div>
      {referenceError ? (
        <p className="text-xs text-destructive">{referenceError}</p>
      ) : null}
    </div>
  )

  return (
    <motion.section
      variants={fadeInUp}
      initial="hidden"
      animate="show"
      className="flex h-full min-w-0 flex-col overflow-hidden"
    >
      {variant === "sidebar" ? (
        <ResizablePanelGroup
          id={`control-panel-${variant}-layout`}
          orientation="vertical"
          defaultLayout={sidebarLayout}
          onLayoutChanged={setSidebarLayout}
          resizeTargetMinimumSize={{ fine: 10, coarse: 28 }}
          className="h-full min-h-0"
        >
          <ResizablePanel
            id="parameters"
            defaultSize={`${sidebarLayout.parameters}%`}
            minSize="12%"
            className="min-h-0"
          >
            <ParameterSidebar
              imageParams={imageParams}
              updateImageParams={updateImageParams}
              imageRatio={imageRatio}
              setImageRatio={setImageRatio}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="input"
            defaultSize={`${sidebarLayout.input}%`}
            minSize="16%"
            className="min-h-0 bg-background"
          >
            {inputArea}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        inputArea
      )}
    </motion.section>
  )
}

function IconParam({
  icon,
  ariaLabel,
  tooltip,
  align = "start",
  children,
}: {
  icon: React.ReactNode
  ariaLabel: string
  tooltip: React.ReactNode
  align?: "start" | "end" | "center"
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={ariaLabel}
            >
              {icon}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align={align} className="w-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ParameterDropdownContent({
  imageParams,
  updateImageParams,
  imageRatio,
  setImageRatio,
}: {
  imageParams: ImageParams
  updateImageParams: (patch: Partial<ImageParams>) => void
  imageRatio: ImageRatioLabel
  setImageRatio: React.Dispatch<React.SetStateAction<ImageRatioLabel>>
}) {
  return (
    <>
      <ParameterFields
        mode="dropdown"
        imageParams={imageParams}
        updateImageParams={updateImageParams}
        imageRatio={imageRatio}
        setImageRatio={setImageRatio}
      />
    </>
  )
}

function ParameterSidebar({
  imageParams,
  updateImageParams,
  imageRatio,
  setImageRatio,
}: {
  imageParams: ImageParams
  updateImageParams: (patch: Partial<ImageParams>) => void
  imageRatio: ImageRatioLabel
  setImageRatio: React.Dispatch<React.SetStateAction<ImageRatioLabel>>
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center px-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">参数</p>
        </div>
      </div>
      <ScrollArea className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <FieldGroup className="gap-5 px-4 pb-4 pt-2">
          <ParameterFields
            mode="sidebar"
            imageParams={imageParams}
            updateImageParams={updateImageParams}
            imageRatio={imageRatio}
            setImageRatio={setImageRatio}
          />
        </FieldGroup>
      </ScrollArea>
    </div>
  )
}

function ParameterFields({
  mode,
  imageParams,
  updateImageParams,
  imageRatio,
  setImageRatio,
}: {
  mode: ParameterMode
  imageParams: ImageParams
  updateImageParams: (patch: Partial<ImageParams>) => void
  imageRatio: ImageRatioLabel
  setImageRatio: React.Dispatch<React.SetStateAction<ImageRatioLabel>>
}) {
  return (
    <>
      {mode === "dropdown" ? (
        <RatioSizeDropdownField
          ratio={imageRatio}
          setRatio={setImageRatio}
          updateImageParams={updateImageParams}
        />
      ) : (
        <RatioSizeButtonField
          ratio={imageRatio}
          setRatio={setImageRatio}
          updateImageParams={updateImageParams}
        />
      )}
      {mode === "dropdown" ? <DropdownMenuSeparator /> : null}
      {mode === "dropdown" ? (
        <ImageQualityDropdownField
          quality={imageParams.quality}
          updateImageParams={updateImageParams}
        />
      ) : (
        <ImageQualityButtonField
          quality={imageParams.quality}
          updateImageParams={updateImageParams}
        />
      )}
      {SELECT_PARAMETER_DEFINITIONS.map((definition) => (
        <React.Fragment key={definition.key}>
          {mode === "dropdown" ? <DropdownMenuSeparator /> : null}
          <SelectParameterField
            mode={mode}
            definition={definition}
            imageParams={imageParams}
            updateImageParams={updateImageParams}
          />
        </React.Fragment>
      ))}
      {mode === "dropdown" ? <DropdownMenuSeparator /> : null}
      {mode === "dropdown" ? (
        <OutputFormatDropdownField
          value={imageParams.output_format}
          updateImageParams={updateImageParams}
        />
      ) : (
        <OutputFormatRadioField
          value={imageParams.output_format}
          updateImageParams={updateImageParams}
        />
      )}
      {mode === "dropdown" ? <DropdownMenuSeparator /> : null}
      <OutputCompressionField
        mode={mode}
        value={imageParams.output_compression}
        onChange={(outputCompression) =>
          updateImageParams({ output_compression: outputCompression })
        }
      />
    </>
  )
}

function RatioSizeDropdownField({
  ratio,
  setRatio,
  updateImageParams,
}: {
  ratio: ImageRatioLabel
  setRatio: React.Dispatch<React.SetStateAction<ImageRatioLabel>>
  updateImageParams: (patch: Partial<ImageParams>) => void
}) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>图片比例</DropdownMenuLabel>
      {imageRatioOptions.map((option) => (
        <DropdownMenuItem
          key={option.label}
          onSelect={() => {
            setRatio(option.label)
            updateImageParams({ size: imageRatioToSize(option.label) })
          }}
        >
          <RatioIcon ratio={option.label} active={ratio === option.label} />
          <span>{option.label}</span>
          <Check
            className={cn(
              "ml-auto",
              ratio === option.label ? "opacity-100" : "opacity-0"
            )}
          />
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  )
}

function RatioSizeButtonField({
  ratio,
  setRatio,
  updateImageParams,
}: {
  ratio: ImageRatioLabel
  setRatio: React.Dispatch<React.SetStateAction<ImageRatioLabel>>
  updateImageParams: (patch: Partial<ImageParams>) => void
}) {
  return (
    <Field>
      <FieldLabel className="text-xs text-muted-foreground">
        图片比例
      </FieldLabel>
      <ToggleGroup
        type="single"
        value={ratio}
        onValueChange={(value) => {
          const nextRatio = imageRatioOptions.find(
            (option) => option.label === value
          )?.label
          if (!nextRatio) return
          setRatio(nextRatio)
          updateImageParams({ size: imageRatioToSize(nextRatio) })
        }}
        className="grid w-full grid-cols-6 gap-1"
      >
        {imageRatioOptions.map((option) => (
          <ToggleGroupItem
            key={option.label}
            value={option.label}
            variant="outline"
            className="h-11 min-w-0 flex-col gap-0.5 rounded-md px-0 text-[10px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <RatioIcon ratio={option.label} active={ratio === option.label} />
            <span>{option.label}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  )
}

function ImageQualityDropdownField({
  quality,
  updateImageParams,
}: {
  quality: ImageQuality
  updateImageParams: (patch: Partial<ImageParams>) => void
}) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>图片质量</DropdownMenuLabel>
      {qualityOptions.map((option) => (
        <DropdownMenuItem
          key={option}
          onSelect={() => updateImageParams({ quality: option })}
        >
          <span>{QUALITY_LABELS[option]}</span>
          <Check
            className={cn(
              "ml-auto",
              quality === option ? "opacity-100" : "opacity-0"
            )}
          />
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  )
}

function ImageQualityButtonField({
  quality,
  updateImageParams,
}: {
  quality: ImageQuality
  updateImageParams: (patch: Partial<ImageParams>) => void
}) {
  return (
    <Field>
      <FieldLabel className="text-xs text-muted-foreground">
        图片质量
      </FieldLabel>
      <ToggleGroup
        type="single"
        value={quality}
        onValueChange={(value) => {
          if (qualityOptions.includes(value as ImageQuality)) {
            updateImageParams({ quality: value as ImageQuality })
          }
        }}
        variant="outline"
        className="w-full"
        spacing={0}
      >
        {qualityOptions.map((option) => (
          <ToggleGroupItem
            key={option}
            value={option}
            className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {QUALITY_LABELS[option]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  )
}

function SelectParameterField({
  mode,
  definition,
  imageParams,
  updateImageParams,
}: {
  mode: ParameterMode
  definition: SelectParameterDefinition
  imageParams: ImageParams
  updateImageParams: (patch: Partial<ImageParams>) => void
}) {
  const value = getSelectParameterValue(imageParams, definition.key)
  const onValueChange = (nextValue: string) =>
    updateImageParams(getSelectParameterPatch(definition.key, nextValue))

  if (mode === "dropdown") {
    return (
      <DropdownMenuGroup>
        <DropdownMenuLabel>{definition.label}</DropdownMenuLabel>
        {definition.options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onValueChange(option.value)}
          >
            <span>{option.label}</span>
            <Check
              className={cn(
                "ml-auto",
                value === option.value ? "opacity-100" : "opacity-0"
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    )
  }

  return (
    <ButtonParameterField
      definition={definition}
      value={value}
      onValueChange={onValueChange}
    />
  )
}

function OutputFormatDropdownField({
  value,
  updateImageParams,
}: {
  value: ImageOutputFormat
  updateImageParams: (patch: Partial<ImageParams>) => void
}) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>输出格式</DropdownMenuLabel>
      {outputFormatOptions.map((option) => (
        <DropdownMenuItem
          key={option}
          onSelect={() => updateImageParams({ output_format: option })}
        >
          <span>{OUTPUT_FORMAT_LABELS[option]}</span>
          <Check
            className={cn(
              "ml-auto",
              value === option ? "opacity-100" : "opacity-0"
            )}
          />
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  )
}

function OutputFormatRadioField({
  value,
  updateImageParams,
}: {
  value: ImageOutputFormat
  updateImageParams: (patch: Partial<ImageParams>) => void
}) {
  return (
    <Field>
      <FieldLabel className="text-xs text-muted-foreground">
        输出格式
      </FieldLabel>
      <RadioGroup
        value={value}
        onValueChange={(nextValue) =>
          updateImageParams({ output_format: nextValue as ImageOutputFormat })
        }
        className="grid grid-cols-3 gap-3"
      >
        {outputFormatOptions.map((option) => (
          <div
            key={option}
            className="flex items-center gap-3"
          >
            <RadioGroupItem id={`output-format-${option}`} value={option} />
            <Label
              htmlFor={`output-format-${option}`}
              className="cursor-pointer text-sm font-medium"
            >
              {option.toUpperCase()}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </Field>
  )
}

function OutputCompressionField({
  mode,
  value,
  onChange,
}: {
  mode: ParameterMode
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
  const displayValue = value ?? "自动"

  if (mode === "dropdown") {
    return (
      <div className="grid gap-2 px-1.5 py-1">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>输出压缩质量</span>
          <span className="font-mono">{displayValue}</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[value ?? 100]}
          onValueChange={(nextValue) =>
            onChange(nextValue[0] === 100 ? undefined : nextValue[0])
          }
        />
      </div>
    )
  }

  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel className="text-xs text-muted-foreground">
          输出压缩质量
        </FieldLabel>
        <span className="text-xs font-medium text-muted-foreground">
          {displayValue}
        </span>
      </div>
      <Slider
        min={0}
        max={100}
        step={1}
        value={[value ?? 100]}
        onValueChange={(nextValue) =>
          onChange(nextValue[0] === 100 ? undefined : nextValue[0])
        }
      />
    </Field>
  )
}

function ButtonParameterField({
  definition,
  value,
  onValueChange,
}: {
  definition: SelectParameterDefinition
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel className="text-xs text-muted-foreground">
        {definition.label}
      </FieldLabel>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(nextValue) => {
          if (definition.options.some((option) => option.value === nextValue)) {
            onValueChange(nextValue)
          }
        }}
        variant="outline"
        className="w-full"
        spacing={0}
      >
        {definition.options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="min-w-0 flex-1 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            title={option.label}
          >
            {option.shortLabel ?? option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  )
}

function RatioIcon({ ratio, active }: { ratio: string; active: boolean }) {
  const isAuto = ratio === "auto"
  const [width, height] = isAuto ? [0, 0] : ratio.split(":").map(Number)
  const isPortrait = !isAuto && height > width
  const isSquare = !isAuto && width === height
  const isWide = !isAuto && width > height

  return (
    <span
      className={cn(
        "flex size-4 items-center justify-center",
        active ? "text-primary-foreground" : "text-muted-foreground"
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          "rounded-[2px] border-2 border-current",
          (isSquare || isAuto) && "size-3.5",
          isAuto && "border-dashed",
          isPortrait && "h-4 w-2.5",
          isWide && "h-2.5 w-4"
        )}
      />
    </span>
  )
}

function QueueStatusBadge({
  running,
  waiting,
}: {
  running: number
  waiting: number
}) {
  if (running === 0 && waiting === 0) return null

  const infoClasses =
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300"
  const warningClasses =
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300"

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-w-0 flex-wrap items-center gap-1.5"
    >
      {running > 0 ? (
        <Badge variant="outline" className={cn("gap-1.5", infoClasses)}>
          <Loader2 className="animate-spin" />
          <span>{running} 进行中</span>
        </Badge>
      ) : null}
      {waiting > 0 ? (
        <Badge variant="outline" className={cn("gap-1.5", warningClasses)}>
          <Hourglass />
          <span>{waiting} 排队</span>
        </Badge>
      ) : null}
    </div>
  )
}
