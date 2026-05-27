import { NextRequest } from "next/server"

export const runtime = "nodejs"

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

const PROXY_TIMEOUT_MS = 300_000

function getTargetUrl(request: NextRequest): URL | Response {
  const rawTarget = request.nextUrl.searchParams.get("target")
  if (!rawTarget) {
    return Response.json({ error: "Missing target URL" }, { status: 400 })
  }

  try {
    const target = new URL(rawTarget)
    if (target.protocol !== "https:" && target.protocol !== "http:") {
      return Response.json({ error: "Unsupported target URL" }, { status: 400 })
    }
    return target
  } catch {
    return Response.json({ error: "Invalid target URL" }, { status: 400 })
  }
}

function buildForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers()
  for (const [key, value] of request.headers) {
    const normalized = key.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(normalized)) continue
    headers.set(key, value)
  }
  return headers
}

function buildResponseHeaders(upstream: Response): Headers {
  const headers = new Headers()
  for (const [key, value] of upstream.headers) {
    const normalized = key.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(normalized)) continue
    headers.set(key, value)
  }
  return headers
}

async function proxy(request: NextRequest): Promise<Response> {
  const target = getTargetUrl(request)
  if (target instanceof Response) return target

  const method = request.method
  const body =
    method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer()

  const upstream = await fetch(target, {
    method,
    headers: buildForwardHeaders(request),
    body,
    signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
  })

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: buildResponseHeaders(upstream),
  })
}

export async function GET(request: NextRequest): Promise<Response> {
  return proxy(request)
}

export async function POST(request: NextRequest): Promise<Response> {
  return proxy(request)
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204 })
}
