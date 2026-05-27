# syntax=docker/dockerfile:1.6
#
# Multi-stage build for shadraw all-in-one image.
# Build context is the monorepo root (contains web/ and the Go module at root).
#
# Stage 1: build frontend (Vite) -> /src/web/dist
# Stage 2: build backend (Go) and embed /src/web/dist into the binary
# Stage 3: distroless runtime image with the binary + migrations

# --- Stage 1: frontend builder -------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /src/web

# Install deps with a clean, lockfile-pinned install for reproducible builds.
COPY web/package.json web/package-lock.json* ./
RUN npm ci

# Copy the rest of the frontend source and build the SPA.
COPY web/ ./
RUN npm run build
# Produces: /src/web/dist

# --- Stage 2: backend builder --------------------------------------------------
FROM golang:1.26-alpine AS backend-builder
WORKDIR /src

RUN apk add --no-cache git ca-certificates

# Cache go module downloads in a dedicated layer.
COPY go.mod go.sum* ./
RUN go mod download

# Copy only the Go source trees needed for `go build ./cmd/server` so the
# build context's web/, deploy/, docs/ etc. don't bust the layer cache.
# Then drop the freshly-built frontend dist into the embed path so
# `//go:embed all:dist` in internal/web picks it up.
COPY cmd ./cmd
COPY internal ./internal
COPY migrations ./migrations
COPY --from=frontend-builder /src/web/dist ./internal/web/dist

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /out/server ./cmd/server

# --- Stage 3: runtime ----------------------------------------------------------
# Default to DaoCloud's mirror so the build works on networks that can't reach
# gcr.io directly (Aliyun mainland regions, etc.). Override with --build-arg
# for environments where gcr.io is fast (`docker build --build-arg
# RUNTIME_IMAGE=gcr.io/distroless/static:nonroot ...`).
ARG RUNTIME_IMAGE=m.daocloud.io/gcr.io/distroless/static:nonroot
FROM ${RUNTIME_IMAGE}
WORKDIR /app
COPY --from=backend-builder /out/server /app/server
COPY migrations /app/migrations

EXPOSE 8088
USER nonroot:nonroot
ENTRYPOINT ["/app/server"]
