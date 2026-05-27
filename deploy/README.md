# shadraw 生产部署

单台 VPS,docker compose 跑一个 all-in-one 二进制 (Go + 内嵌 Vite 产物) 加
Postgres + MinIO,宿主机 nginx 做反代和 TLS。

前端代码 build 后被 `//go:embed` 进 Go 二进制 (`internal/web/dist`),所以
运行期没有独立的 Node 进程,nginx 只需要 1 个 upstream。

## ⚠️ 构建在哪里跑

**默认走 prebuilt 模式**:`vite build` 在**本地** (你的 Mac / dev 机) 完成,
产物 `internal/web/dist/` 通过 rsync 推到 VPS。VPS 只跑 Go build + distroless
打包。原因:vite build 峰值要 1.5-2GB 内存,小内存 VPS (1-2GB) 在 docker 里
跑必然 OOM。本地 build 速度 < 10s,完全无痛。

如果你的 VPS 内存 > 4GB 且不在意 build 时间,可以把
`deploy/docker-compose.prod.yml` 的 `dockerfile:` 从 `Dockerfile.prebuilt`
换回 `Dockerfile` (三阶段,VPS 自己 build 前端)。

## VPS 上的目录布局

```
~/shadraw-studio/        # monorepo (本仓库, 同时是 Go module root)
├── cmd/ internal/ migrations/  # Go API + 内嵌前端
├── web/                 # Vite + React SPA 源码
├── internal/web/dist/   # ← 前端 build 产物(local rsync 上来,gitignored)
├── Dockerfile           # 三阶段 (前端 + 后端 + runtime,VPS 资源够才用)
├── Dockerfile.prebuilt  # ★ 两阶段 (跳过前端,生产默认用这个)
├── docker-compose.yml   # 本地开发 stack
└── deploy/              # ← 在这里跑 ./deploy.sh (生产 compose + 脚本)
```

## 首次部署

### 步骤 1 (本地一次性): 装 deps + build 前端

```bash
# 本地仓库根目录
./deploy/build-frontend.sh
# 产物落在 internal/web/dist/ (~30MB),后续 sync-dist.sh 推这个目录
```

### 步骤 2 (VPS): 准备环境

```bash
ssh user@vps

# 装 Docker + Docker Compose plugin (Ubuntu)
apt install docker.io docker-compose-plugin

# 克隆仓库
git clone https://github.com/imliusx/shadraw-studio.git /opt/shadraw-studio
cd /opt/shadraw-studio/deploy

# 配 env (强密码 / JWT_SECRET / MASTER_KEY / SITE_URL / ADMIN_EMAIL)
cp .env.prod.example .env
vim .env

# DNS A 记录把 your-domain.com 指向 VPS IP
exit
```

### 步骤 3 (本地): 推前端 dist 到 VPS

```bash
./deploy/sync-dist.sh user@vps
# rsync 增量同步 internal/web/dist/ → /opt/shadraw-studio/internal/web/dist/
```

### 步骤 4 (VPS): 启动

```bash
ssh user@vps
cd /opt/shadraw-studio/deploy
./deploy.sh up
# docker build 只跑 Go (40s) + 拉 distroless (m.daocloud.io 国内镜像快)
# 全部起来后 api 监听 127.0.0.1:8088
```

### 步骤 5 (VPS): 配宿主 nginx (见下一节)

## nginx 反代

api 容器把 8088 端口绑在宿主机 loopback 上,**外部不可达**,只能通过宿主机
nginx 访问。前端 + API 都从同一个 upstream 出,所以 nginx 只要 1 条
`location /`:

| 服务 | 宿主端口 | nginx 上游 |
|---|---|---|
| api (Go + 内嵌 SPA) | `127.0.0.1:8088` | `location /` |
| Postgres | (仅 docker 内网) | 不暴露 |
| MinIO | (仅 docker 内网) | 不暴露 |

nginx server 块的核心:

```nginx
location / {
    proxy_pass         http://127.0.0.1:8088;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;   # 生图请求可能比较久
}
```

API (`/api/v1/*`)、健康检查 (`/healthz`)、SPA 路由 (`/`, `/gallery`,
`/admin` ...) 全部由 Go server 内部分流:`/api/*` 走业务 handler,其余路径
走 embed FS,未命中静态资源时 fallback 到 `index.html` 让前端 react-router
接管。

`server_name` 与 `.env` 里的 `SITE_URL` 域名保持一致即可 (协议由 nginx
决定)。

## 访问地址

部署完成后,直接打开 `SITE_URL` 即可 (例如 `https://shadraw.example.com`)。
前端在根路径,API 走 `/api/v1/*`,健康检查 `/healthz`,都在同一个 host 上。

## 升级

### 后端代码改了 (Go)

```bash
# VPS
cd /opt/shadraw-studio && git pull
cd deploy && ./deploy.sh up   # docker rebuild 第一阶段 (Go), 不重 build 前端
```

### 前端代码改了 (Vite)

```bash
# 本地
./deploy/build-frontend.sh --skip-install   # 5-10 秒
./deploy/sync-dist.sh user@vps              # rsync 增量

# VPS
ssh user@vps 'cd /opt/shadraw-studio/deploy && ./deploy.sh up'
```

前端 + 后端都改了:跑前端 build → sync → ssh git pull → deploy.sh up,跟单独
改前端类似,只是 VPS 上 docker 会同时 rebuild Go 阶段。

## 其他常用命令

```
./deploy.sh ps      # 看服务状态
./deploy.sh logs    # 跟踪日志
./deploy.sh down    # 停服,卷保留
```

## 数据迁移

本地数据迁到 VPS (首次上线 / 灾难恢复) 见
[`docs/deploy-migration.md`](../docs/deploy-migration.md),含一键脚本
`./deploy/data-export.sh` + `./deploy/data-restore.sh`。

## 数据备份 (日常)

- Postgres:
  ```
  docker compose -f docker-compose.prod.yml exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
    | gzip > backup-$(date +%F).sql.gz
  ```
- MinIO: 数据在 docker named volume `shadraw_miniodata`。例如:
  ```
  docker run --rm -v shadraw_miniodata:/data -v "$(pwd)":/backup alpine \
    tar czf "/backup/minio-$(date +%F).tgz" /data
  ```

## 故障排查

- 容器没起:`./deploy.sh ps` + `./deploy.sh logs`
- `docker build` 报 `internal/web/dist/index.html missing`:本地忘了跑
  `build-frontend.sh + sync-dist.sh`,VPS 上 dist 目录是空的
- `docker build` 拉 distroless 超时:用的是 `gcr.io` 而不是
  `m.daocloud.io`;Dockerfile.prebuilt 默认 daocloud,如果改回 gcr.io
  需要梯子或者改成其他镜像
- nginx 502:确认 api 容器在跑 (`docker compose ps`) 且监听的是
  `127.0.0.1:8088` (`ss -tlnp | grep 8088`)
- 前端能开但 API 报 404:检查 nginx 是不是被改成了"按路径分流"。同源方案
  下,nginx 只要 1 条 `location /`,API 路径由 Go 自己识别;额外加
  `location /api/` 也无害,但别忘了它也指向同一个 `127.0.0.1:8088`
- 刷新非根路径返回 404:不是 Go 的问题就是 nginx 的 `try_files` 在搞乱
  事 — 删掉相关指令,让 Go 来处理 SPA fallback
- 升级后页面没变:浏览器缓存,可以 hard refresh,或者确认镜像确实重建了
  (`docker images | grep shadraw`)
- VPS 内存吃满 / OOM:99% 是用了 `Dockerfile` 而不是 `Dockerfile.prebuilt`,
  vite build 在小 VPS 上必死;检查 `deploy/docker-compose.prod.yml` 的
  `dockerfile:` 字段
