import type { RecordDTO } from "@/lib/api/records-client"
import { toUserFacingErrorMessage } from "@/lib/api/errors"
import { DEFAULT_IMAGE_PARAMS } from "@/components/workbench/data"
import type { HistoryRecord, ImageParams } from "@/components/workbench/types"

export function dtoToRecord(dto: RecordDTO, base64?: string): HistoryRecord {
  const imageParams = normalizeImageParams(dto.imageParams)
  return {
    id: Number(dto.id),
    prompt: dto.prompt,
    model: dto.model,
    imageParams,
    status: dto.status,
    base64,
    favorite: dto.favorite,
    isPublic: dto.isPublic,
    promptPublic: dto.promptPublic ?? true,
    error: dto.error ? toUserFacingErrorMessage(dto.error) : undefined,
    upstreamError: dto.upstreamError,
    projectId: dto.projectId ? Number(dto.projectId) : undefined,
    createdAt: dto.createdAt ? Date.parse(dto.createdAt) : Date.now(),
    startedAt: dto.startedAt ? Date.parse(dto.startedAt) : undefined,
    completedAt: dto.completedAt ? Date.parse(dto.completedAt) : undefined,
    publishedAt: dto.publishedAt ? Date.parse(dto.publishedAt) : undefined,
  }
}

export function dtoToRecordPatch(dto: RecordDTO): Partial<HistoryRecord> {
  const imageParams = normalizeImageParams(dto.imageParams)
  return {
    prompt: dto.prompt,
    model: dto.model,
    imageParams,
    status: dto.status,
    favorite: dto.favorite,
    isPublic: dto.isPublic,
    promptPublic: dto.promptPublic ?? true,
    error: dto.error ? toUserFacingErrorMessage(dto.error) : undefined,
    upstreamError: dto.upstreamError,
    projectId: dto.projectId ? Number(dto.projectId) : undefined,
    startedAt: dto.startedAt ? Date.parse(dto.startedAt) : undefined,
    completedAt: dto.completedAt ? Date.parse(dto.completedAt) : undefined,
    publishedAt: dto.publishedAt ? Date.parse(dto.publishedAt) : undefined,
  }
}

export function normalizeImageParams(params?: Partial<ImageParams>): ImageParams {
  const incoming = (params ?? {}) as Partial<ImageParams> & { n?: unknown }
  const outputCompression =
    typeof incoming.output_compression === "number" &&
    Number.isFinite(incoming.output_compression)
      ? Math.trunc(incoming.output_compression)
      : undefined
  const partialImages =
    typeof incoming.partial_images === "number" &&
    Number.isFinite(incoming.partial_images)
      ? Math.trunc(incoming.partial_images)
      : undefined

  return {
    size: incoming.size ?? DEFAULT_IMAGE_PARAMS.size,
    quality: incoming.quality ?? DEFAULT_IMAGE_PARAMS.quality,
    background: incoming.background ?? DEFAULT_IMAGE_PARAMS.background,
    moderation: incoming.moderation ?? DEFAULT_IMAGE_PARAMS.moderation,
    output_format: incoming.output_format ?? DEFAULT_IMAGE_PARAMS.output_format,
    output_compression: outputCompression,
    partial_images: partialImages,
    stream: incoming.stream,
    input_fidelity: incoming.input_fidelity,
    mask: incoming.mask,
    response_format: incoming.response_format,
    style: incoming.style,
    user: incoming.user,
  }
}
