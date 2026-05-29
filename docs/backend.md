# shadraw 后端模块

Go 实现的 API 服务,负责生图工作流、用户/Admin、记录、对象存储集成,以及向浏览器吐 embed 的前端 SPA。

## 技术栈

| 维度 | 选型 |
|---|---|
| HTTP | Gin (`github.com/gin-gonic/gin`) |
| ORM | GORM v2 + pgx driver |
| DB | Postgres 16 |
| Migration | `golang-migrate/migrate` |
| Auth | JWT (HS256, access 15min) + HttpOnly refresh cookie (sha256 入库, 7d) + bcrypt |
| Log | 标准库 `log/slog`(JSON handler) |
| Validation | `go-playground/validator/v10` (gin 集成) |
| Blob | local 文件系统 或 S3 兼容对象存储 (MinIO) |
| Embed | `//go:embed` 把 web/dist 打进二进制 (见 `internal/web/embed.go`) |

## 目录 (monorepo 根)

```
shadraw-studio/
├── cmd/
│   ├── server/main.go        # 入口、装配
│   └── migrate-blobs/        # 本地 → S3 图片迁移工具
├── internal/
│   ├── app/                  # 启动引导 (migrations + ensureAdmin)
│   ├── auth/                 # JWT / bcrypt / Service / Handler / RequireAuth
│   ├── user/                 # User model + Repository
│   ├── config/               # 读 env (必填校验)
│   ├── crypto/               # AES-GCM (apiKey 加密)
│   ├── httpx/                # 响应外壳 / 错误码 / 中间件 / 限流 / 校验
│   ├── record/               # 生图记录 / 收藏 / 可见性
│   ├── admin/                # 管理员配置 / 用户管理 / 站点设置
│   ├── upstream/             # 上游 AI 服务调用
│   ├── worker/               # 异步生图 worker pool
│   ├── blob/                 # S3 client
│   ├── store/                # GORM Postgres 连接
│   └── web/                  # //go:embed dist + SPA fallback handler
├── migrations/               # 001-015 SQL up/down 文件
├── docs/                     # api.md / db.md / backend.md (本文件)
├── data/                     # 本地 blob 存储 (BLOB_DRIVER=local 时)
├── docker-compose.yml        # dev 用 (db + minio + minio-init + api)
├── Dockerfile                # production 三阶段 (web build → go build → distroless)
└── Makefile                  # 开发命令
```

## 本地起步

最快路径——dev 用 docker compose 起依赖,Go 进程直接 `go run`:

```bash
cp .env.example .env
# 填上 JWT_SECRET (32+ 字符)、ADMIN_EMAIL、MASTER_KEY (32 字节 base64)

docker compose up -d db minio    # 仅起依赖
go run ./cmd/server               # 主机直接跑 Go,方便调试
# 首次启动会看到一条 ADMIN BOOTSTRAP 日志,里面有 admin 临时密码 — 拷下来后立即登录改密码

curl localhost:8088/healthz
```

完整 docker compose 起 (包含 api 容器,模拟生产):

```bash
docker compose up --build
```

## Env 变量

| Key | 必填 | 说明 |
|---|---|---|
| `PORT` | | 监听端口 (默认 8088) |
| `LOG_LEVEL` | | debug/info/warn/error (默认 info) |
| `DB_DSN` | ✅ | Postgres 连接串 |
| `JWT_SECRET` | ✅ | ≥32 字符随机串,HS256 签名密钥 |
| `ADMIN_EMAIL` | ✅ | 首位管理员邮箱,启动时引导 |
| `MASTER_KEY` | ✅ | 32 字节 base64,AES-GCM 加密 apiKey 用 |
| `BLOB_DRIVER` | | 图片存储驱动:`local` 或 `s3`,默认 `local` |
| `DATA_DIR` | | 运行时数据目录,默认 `./data` |
| `S3_ENDPOINT` | `BLOB_DRIVER=s3` 时必填 | S3 兼容 endpoint,例如 `http://localhost:9000` / `http://minio:9000` |
| `S3_REGION` | | S3 region,MinIO 可用默认 `us-east-1` |
| `S3_BUCKET` | `BLOB_DRIVER=s3` 时必填 | 图片对象所在 bucket |
| `S3_ACCESS_KEY_ID` | `BLOB_DRIVER=s3` 时必填 | S3 / MinIO access key |
| `S3_SECRET_ACCESS_KEY` | `BLOB_DRIVER=s3` 时必填 | S3 / MinIO secret key |
| `S3_USE_PATH_STYLE` | | path-style URL,MinIO 默认 `true` |

> 同源 SPA 部署后已**不需要** `CORS_ORIGINS`,backend 不再注册 CORS middleware。

## 图片存储

默认使用本地文件系统,生成图写入 `DATA_DIR/images/user-<id>/<record-uuid>.<ext>`,DB 只存相对路径。

使用 MinIO / S3:

```bash
BLOB_DRIVER=s3
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=shadraw
S3_ACCESS_KEY_ID=shadraw
S3_SECRET_ACCESS_KEY=shadrawsecret
S3_USE_PATH_STYLE=true
```

`docker compose up --build` 会启动 MinIO + `minio-init`,自动建默认 bucket。MinIO 控制台 `http://localhost:9001`。
API 在 Docker 内部时 `S3_ENDPOINT=http://minio:9000`,API 直接在宿主跑时 `http://localhost:9000`。

### 切存储驱动的迁移工具

切换存储驱动不会自动迁移旧图片。已有本地图片可以用 `cmd/migrate-blobs` 复制到 bucket,迁移保留数据库里已存的相对路径 (`images/user-13/a.png` 上传为对象 key `images/user-13/a.png`,无需改 DB):

```bash
# 真迁移
S3_ENDPOINT=http://localhost:9000 \
S3_BUCKET=shadraw \
S3_ACCESS_KEY_ID=shadraw \
S3_SECRET_ACCESS_KEY=shadrawsecret \
go run ./cmd/migrate-blobs -data-dir ./data

# 只预览
go run ./cmd/migrate-blobs -dry-run -data-dir ./data

# 校验对象存在且大小一致
S3_ENDPOINT=http://localhost:9000 \
S3_BUCKET=shadraw \
S3_ACCESS_KEY_ID=shadraw \
S3_SECRET_ACCESS_KEY=shadrawsecret \
go run ./cmd/migrate-blobs -verify-only -data-dir ./data
```

可重复运行,同名对象会被覆盖。确认成功前**不要**删本地 `data/images`。

## 接口

完整请求 / 响应 / 错误见 [`docs/api.md`](./api.md)。表结构和迁移规则见 [`docs/db.md`](./db.md)。

## 规范

- 接口:统一响应外壳、错误码白名单、状态码语义、ID 字符串化、时间 UTC。
- 数据库:snake_case 命名、TIMESTAMPTZ、CITEXT 邮箱、CHECK 替代 ENUM、可逆迁移、不写 seed。
- 测试:service mock 单测 + handler 集成测试,auth / blob / record / worker 模块各自带测试。

## 开发命令

```bash
make run          # 本地启动 (DB 须先用 docker compose up -d db 起好)
make test         # go test ./... + race + cover
make lint         # golangci-lint
make migrate-up   # apply migrations
make migrate-down # rollback 1
make migrate-new NAME=add_xxx  # 新建 migration
```
