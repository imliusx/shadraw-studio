# shadraw-studio

Monorepo for the shadraw AI image generation product.

- `backend/` — Go (Gin) API server. Builds to a single binary that also embeds the frontend.
- `frontend/` — Vite + React + React Router SPA. Builds to static files consumed by the backend.
- `deploy/` — docker-compose, Dockerfile and operational docs. See [`deploy/README.md`](deploy/README.md).
