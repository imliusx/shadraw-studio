# shadraw 生产部署

单台 VPS,docker compose 跑一个 all-in-one 二进制 (Go + 内嵌 Vite 产物)
加 Postgres + MinIO,宿主机 nginx 做反代和 TLS。

前端代码 build 后被 `//go:embed` 进 Go 二进制 (`internal/web/dist`),
所以运行期没有独立的 Node 进程,nginx 只需要 1 个 upstream。

## VPS 上的目录布局

```
~/shadraw-studio/        # monorepo (本仓库, 同时是 Go module root)
├── cmd/ internal/ migrations/  # Go API + 内嵌前端
├── web/                 # Vite + React SPA (build 时 embed 进二进制)
├── Dockerfile           # 三阶段构建 (web -> Go -> distroless)
├── docker-compose.yml   # 本地开发 stack
└── deploy/              # ← 在这里跑 ./deploy.sh (生产 compose + 脚本)
```

`docker-compose.prod.yml` 的 build context 是 monorepo 根 (`..`),Dockerfile
是根目录的 `Dockerfile` (三阶段,先 build web 前端再 build Go 后端再打 distroless)。

## 首次部署

1. 在 VPS 上装 Docker + Docker Compose plugin (Ubuntu: `apt install docker.io docker-compose-plugin`)
2. 克隆仓库:
   ```
   git clone https://github.com/imliusx/shadraw-studio.git ~/shadraw-studio
   ```
3. 配置环境变量:
   ```
   cd ~/shadraw-studio/deploy
   cp .env.prod.example .env
   # 编辑 .env: 生成随机的 JWT_SECRET / MASTER_KEY / POSTGRES_PASSWORD / S3_SECRET_ACCESS_KEY
   # 填入 SITE_URL=https://your-domain.com, ADMIN_EMAIL
   ```
4. DNS A 记录把 `your-domain.com` 指向 VPS IP
5. 一键启动:
   ```
   ./deploy.sh
   ```
6. 配置宿主机 nginx (见下一节)

## nginx 反代

api 容器把 8080 端口绑在宿主机 loopback 上,**外部不可达**,只能通过宿主机
nginx 访问。前端 + API 都从同一个 upstream 出,所以 nginx 只要 1 条
`location /`:

| 服务 | 宿主端口 | nginx 上游 |
|---|---|---|
| api (Go + 内嵌 SPA) | `127.0.0.1:8080` | `location /` |
| Postgres | (仅 docker 内网) | 不暴露 |
| MinIO | (仅 docker 内网) | 不暴露 |

nginx server 块的核心:

```nginx
location / {
    proxy_pass         http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;   # 生图请求可能比较久
}
```

API (`/api/v1/*`)、健康检查 (`/healthz`)、SPA 路由 (`/`, `/gallery`,
`/admin` ...) 全部由 Go server 内部分流:`/api/*` 走业务 handler,其余
路径走 embed FS,未命中静态资源时 fallback 到 `index.html` 让前端
react-router 接管。

`server_name` 与 `.env` 里的 `SITE_URL` 域名保持一致即可 (协议由 nginx
决定)。

## 访问地址

部署完成后,直接打开 `SITE_URL` 即可 (例如 `https://shadraw.example.com`)。
前端在根路径,API 走 `/api/v1/*`,健康检查 `/healthz`,都在同一个 host
上。

## 升级

```
cd ~/shadraw-studio && git pull
cd ~/shadraw-studio/deploy
./deploy.sh
```

`deploy.sh` 默认走 `up -d --build`,只重建有变更的镜像。前端代码改了也
走同一条 — Dockerfile 第一阶段会重新 `npm ci && npm run build`。

## 其他常用命令

```
./deploy.sh ps      # 看服务状态
./deploy.sh logs    # 跟踪日志
./deploy.sh down    # 停服,卷保留
```

## 数据备份

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
- nginx 502:确认 api 容器在跑 (`docker compose ps`) 且监听的是 `127.0.0.1:8080`
  (`ss -tlnp | grep 8080`)
- 前端能开但 API 报 404:检查 nginx 是不是被改成了"按路径分流"。同源
  方案下,nginx 只要 1 条 `location /`,API 路径由 Go 自己识别;额外加
  `location /api/` 也无害,但别忘了它也指向同一个 `127.0.0.1:8080`
- 刷新非根路径返回 404:不是 Go 的问题就是 nginx 的 `try_files` 在搞乱
  事 — 删掉相关指令,让 Go 来处理 SPA fallback
- 升级后页面没变:浏览器缓存,可以 hard refresh,或者确认镜像确实重建
  了 (`docker images | grep shadraw`)
