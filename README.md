# shadraw-studio

面向设计师、内容创作者和 AI 图片爱好者的在线 AI 生图工作台。提示词、模型、风格、比例可调,历史 / 收藏 / 项目分组齐备,前后端在同一仓库内统一发布。

## 目录结构

```
shadraw-studio/
├── cmd/             Go 入口 (cmd/server 主服务, cmd/migrate-blobs 工具)
├── internal/        Go 业务包 (auth / record / blob / web embed ...)
├── migrations/      SQL 迁移
├── web/             Vite + React 19 + React Router 的 SPA, build 产物 embed 进二进制
├── deploy/          binary + systemd 生产部署脚本与文档
├── docs/            后端 API / DB / 模块文档 (见 [docs/backend.md](docs/backend.md) 和 [docs/deploy-migration.md](docs/deploy-migration.md))
├── go.mod           Go module 根 (module github.com/liusx/shadraw)
├── Dockerfile       容器镜像构建文件 (开发/备用)
└── docker-compose.yml  本地依赖 stack (Postgres + MinIO + api)
```

## 技术栈

- 后端: Go 1.26 · Gin · PostgreSQL · MinIO (S3 兼容对象存储) · JWT 鉴权
- 前端: Vite · React 19 · React Router v7 · TypeScript · Tailwind CSS v4 · shadcn/ui · Radix UI · Motion · Lucide React
- 部署: 本地交叉编译 Go 二进制 · systemd · Docker Compose 依赖服务 · nginx 反代

## 快速开始 (本地开发)

### 1. 准备依赖服务 (Postgres + MinIO)

```bash
docker compose up -d db minio
```

### 2. 启动后端 API (端口 8088)

```bash
cp .env.example .env        # 按需修改 DB / MinIO / JWT 配置
go run ./cmd/server
```

本地开发默认会自动加载仓库根目录 `.env`；生产环境请设置 `APP_ENV=production`，由 systemd / Docker 显式注入环境变量。

### 3. 启动前端 dev server (端口 3001)

```bash
cd web
npm install
npm run dev
```

打开浏览器访问 `http://localhost:3001`。前端在开发模式下走 Vite dev server,`/api/*` 请求由 Vite proxy 转发到后端 `http://localhost:8088`,无需配置 CORS、无需额外环境变量。

### 常用命令

| 目录   | 命令                    | 说明                       |
| ------ | ----------------------- | -------------------------- |
| 根     | `go run ./cmd/server`   | 起 API server              |
| 根     | `go build ./cmd/server` | 编译 (会 embed 前端 dist) |
| 根     | `make test`             | 跑 Go 单测 (race + cover)  |
| 根     | `make lint`             | `golangci-lint run`        |
| `web`  | `npm run dev`           | Vite dev server (HMR)      |
| `web`  | `npm run build`         | 产出 `web/dist/`           |
| `web`  | `npm run typecheck`     | `tsc --noEmit`             |
| `web`  | `npm run lint`          | ESLint                     |

## 生产部署

生产环境只保留 binary + systemd 模式:本地 `vite build` 后嵌入 Go 二进制,本地交叉编译 linux/amd64,通过 `deploy/deploy-binary.sh` 推到 VPS。VPS 用 Docker Compose 只跑 Postgres + MinIO 依赖,API 由 systemd 管理并监听 `127.0.0.1:8088`,宿主 nginx 单 `upstream` 反代即可。详细步骤、环境变量与 nginx 模板见 [`deploy/README.md`](deploy/README.md)。

## 架构亮点

- **单进程 / 单端口**: 前端 `vite build` 产物拷入 `internal/web/dist/`,Go 通过 `//go:embed` 把整个 SPA 嵌入二进制。线上 systemd 服务既响应 `/api/v1/*` 业务接口,也响应根路径下的静态资源与 SPA 路由 fallback。
- **nginx 单 upstream**: 不再需要为前端独立配置 `location /` 与后端 `location /api/`,宿主反代一条 `proxy_pass http://127.0.0.1:8088;` 即可。
- **无 CORS / 无环境基址**: 前端使用同源相对路径调用 API,删除了 `NEXT_PUBLIC_API_BASE` 与后端 CORS 中间件,运行时配置面更小。
- **扁平 monorepo**: Go module 在仓库根,前端在 `web/`,生产发布使用本地交叉编译的单个 Go 二进制。
