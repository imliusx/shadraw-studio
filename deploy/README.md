# shadraw 生产部署

生产只保留 **binary + systemd** 模式：前端在本地构建并嵌入 Go 二进制，本地交叉编译出 linux/amd64 可执行文件；VPS 只运行 Postgres + MinIO 依赖容器，API 由 systemd 管理。

## 部署形态

```txt
host nginx (TLS, 80/443)
  -> 127.0.0.1:8088 (shadraw-api systemd service)
       -> localhost:5432 (Postgres docker dependency)
       -> localhost:9000 (MinIO docker dependency)
```

- 前端 `vite build` 产物会复制到 `internal/web/dist/` 并通过 `//go:embed` 进入 Go 二进制。
- 线上没有 Node 进程，也没有 API 容器。
- Docker 只负责依赖服务：Postgres、MinIO、MinIO bucket bootstrap。

## 文件职责

| 文件 | 用途 |
|---|---|
| `build-binary.sh` | 本地构建前端并交叉编译 `bin/server-linux-amd64` |
| `deploy-binary.sh` | rsync 二进制、迁移文件、systemd unit、依赖 compose 到 VPS |
| `docker-compose.deps.yml` | VPS 上只启动 Postgres + MinIO |
| `shadraw-api.service` | systemd 服务单元 |
| `.env.prod.example` | VPS `.env` 模板 |
| `data-export.sh` / `data-restore.sh` | 本地数据导出和 VPS 数据恢复 |

## 首次部署

### 1. 本地构建二进制

在本地仓库根目录执行：

```bash
./deploy/build-binary.sh
```

输出：

```txt
bin/server-linux-amd64
```

### 2. 上传到 VPS

```bash
./deploy/deploy-binary.sh user@vps /opt/shadraw-studio
```

第二个参数可省略，默认就是 `/opt/shadraw-studio`。

该脚本会上传：

- `bin/server-linux-amd64`
- `migrations/`
- `deploy/docker-compose.deps.yml`
- `deploy/shadraw-api.service`
- `deploy/.env.prod.example`
- `deploy/data-restore.sh`

### 3. VPS 配置 `.env`

```bash
ssh user@vps
cd /opt/shadraw-studio
[ -f .env ] || cp .env.prod.example .env
vim .env
```

关键字段：

| 字段 | 说明 |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | 依赖容器和 `DB_DSN` 必须一致 |
| `DB_DSN` | binary 模式固定使用 `localhost:5432` |
| `JWT_SECRET` | 至少 32 字符 |
| `ADMIN_EMAIL` | 首次引导 admin 邮箱 |
| `MASTER_KEY` | 32 bytes base64，用于解密上游 API Key；数据迁移时必须和源环境一致 |
| `S3_ENDPOINT` | binary 模式固定使用 `http://localhost:9000` |
| `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | MinIO bucket 和凭据 |

### 4. 启动依赖容器

```bash
docker compose -f docker-compose.deps.yml --env-file .env up -d
```

### 5. 安装并启动 systemd 服务

```bash
sudo cp shadraw-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable shadraw-api
sudo systemctl restart shadraw-api
sudo systemctl status shadraw-api
```

查看日志：

```bash
sudo journalctl -u shadraw-api -f
```

健康检查：

```bash
curl http://127.0.0.1:8088/healthz
```

## nginx 反代

`shadraw-api` 只监听宿主机本地端口，由 nginx 对外暴露：

```nginx
location / {
    proxy_pass         http://127.0.0.1:8088;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
}
```

API (`/api/v1/*`)、健康检查 (`/healthz`) 和 SPA 路由都由同一个 Go server 处理。

## 升级

本地：

```bash
git pull
./deploy/build-binary.sh
./deploy/deploy-binary.sh user@vps /opt/shadraw-studio
```

VPS：

```bash
ssh user@vps
cd /opt/shadraw-studio
sudo systemctl restart shadraw-api
sudo journalctl -u shadraw-api -n 50 --no-pager
```

如果只改 `.env`：

```bash
sudo systemctl restart shadraw-api
```

如果只需要重启依赖：

```bash
docker compose -f docker-compose.deps.yml --env-file .env restart
```

## 数据迁移 / 恢复

本地数据迁到 VPS 见 [`docs/deploy-migration.md`](../docs/deploy-migration.md)。常用流程：

```bash
# 本地导出并复制到 VPS
./deploy/data-export.sh --scp user@vps

# VPS 恢复
ssh user@vps 'cd /opt/shadraw-studio && ./data-restore.sh'
```

`data-restore.sh` 会识别 binary 模式，停止/重启 `shadraw-api` systemd 服务，并只操作 `docker-compose.deps.yml` 里的依赖容器。

## 常用命令

```bash
# VPS: 依赖状态
docker compose -f docker-compose.deps.yml --env-file .env ps

# VPS: API 状态
sudo systemctl status shadraw-api

# VPS: API 日志
sudo journalctl -u shadraw-api -f

# VPS: 重启 API
sudo systemctl restart shadraw-api
```

卸载和清理步骤见 [`uninstall.md`](./uninstall.md)。

## 故障排查

- `shadraw-api` 起不来：看 `sudo journalctl -u shadraw-api -n 100 --no-pager`。
- 数据库连不上：确认 `docker compose -f docker-compose.deps.yml --env-file .env ps` 里 `db` healthy，且 `DB_DSN` 使用 `localhost:5432`。
- 图片加载失败：确认 `S3_ENDPOINT=http://localhost:9000`、bucket 名和数据库记录一致。
- admin 上游配置解密失败：确认 `MASTER_KEY` 和导出数据的源环境一致。
- nginx 502：确认 `curl http://127.0.0.1:8088/healthz` 在 VPS 本机成功。
