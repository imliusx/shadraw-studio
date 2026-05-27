# syntax=docker/dockerfile:1.6
#
# Multi-stage build for shadraw all-in-one image.
# Build context is the monorepo root (parent of backend/ and frontend/),
# so all COPY paths are prefixed accordingly.
#
# Stage 1: build frontend (Vite) -> /src/frontend/dist
# Stage 2: build backend (Go) and embed /src/frontend/dist into the binary
# Stage 3: distroless runtime image with the binary + migrations

# --- Stage 1: frontend builder -------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /src/frontend

# Install deps with a clean, lockfile-pinned install for reproducible builds.
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Copy the rest of the frontend source and build the SPA.
COPY frontend/ ./
RUN npm run build
# Produces: /src/frontend/dist

# --- Stage 2: backend builder --------------------------------------------------
FROM golang:1.26-alpine AS backend-builder
WORKDIR /src/backend

RUN apk add --no-cache git ca-certificates

# Cache go module downloads in a dedicated layer.
COPY backend/go.mod backend/go.sum* ./
RUN go mod download

# Copy backend source, then drop the freshly-built frontend dist into the
# embed path so `//go:embed all:dist` in internal/web picks it up.
COPY backend/ ./
COPY --from=frontend-builder /src/frontend/dist ./internal/web/dist

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /out/server ./cmd/server

# --- Stage 3: runtime ----------------------------------------------------------
FROM gcr.io/distroless/static:nonroot
WORKDIR /app
COPY --from=backend-builder /out/server /app/server
COPY backend/migrations /app/migrations

EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/server"]
