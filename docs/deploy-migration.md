# 本地数据迁移到 VPS

把本地开发环境产生的 Postgres 数据 + MinIO 对象存储迁到 VPS 部署。**首次上线** 或 **本地 → 线上回灌** 时按这套流程走。

> ⚠️ 本文档假设你已经在 VPS 上完成 [`deploy/README.md`](../deploy/README.md) 描述的 binary + systemd 初始部署 (`deploy-binary.sh` 上传、配 `.env`、依赖容器和 `shadraw-api` systemd 服务跑通空数据)。本文档接着把本地数据灌进去。

---

## TL;DR (用脚本)

```bash
# 1. 本地导出 + 直接 scp 到 VPS
./deploy/data-export.sh --scp user@vps

# 2. SSH 上 VPS 跑还原
ssh user@vps 'cd /opt/shadraw-studio && ./data-restore.sh'
```

`data-restore.sh` 会弹一次确认提示 (因为是覆盖操作),输入 `yes` 继续。完了自动 tail api 日志,Ctrl+C 退出。

后面的章节是上面两条命令背后的全过程拆解,需要排错 / 自定义路径 / 理解发生了什么时翻下面。

---

> 🔥 **最容易踩的坑:`MASTER_KEY` 必须和导出端一致**。
> dump 里 `upstream_configs` 表的 apiKey 是用 master key 做 AES-GCM 加密的。
> 不一致时 API 启动 41ms 就崩,日志写 `cipher: message authentication failed`。
> 详见下方[关键对齐项](#关键对齐项-)章节。导入前**先拷贝本地 .env 的 MASTER_KEY 到目标 .env**,
> 再跑 restore,可避免 99% 的迁移失败。

---

## 0. 数据分布

本地工作区 (`shadraw-studio/`) 有三个数据目录,都是 `.gitignore` 的:

| 目录 | 内容 | 是否迁移 |
|---|---|---|
| `pgdata/` | Postgres 全部业务数据 (用户/记录/项目/收藏/上游配置/admin) | ✅ 必迁 |
| `minio-data/` | MinIO 对象 (生图结果图片) | ✅ 必迁 |
| `data/images.local-backup-*` | 早期 `BLOB_DRIVER=local` 时代的历史快照 | 一般不迁 (见末尾) |

---

## 1. 本地导出

在工作区根目录:

```bash
# 确认本地 db + minio 在跑 (没启动就 docker compose up -d db minio)
docker compose ps

mkdir -p backup
STAMP=$(date +%Y-%m-%d)

# Postgres: pg_dump 用 custom format (-Fc), 给 pg_restore 用,支持压缩 + 并行
docker compose exec -T db \
  pg_dump -U shadraw -Fc shadraw \
  > "backup/shadraw-pg-${STAMP}.dump"

# MinIO: 直接 tar 数据目录 (MinIO 把对象作为文件存,tar 安全)
tar czf "backup/shadraw-minio-${STAMP}.tgz" -C minio-data .

ls -lh backup/
```

预期输出:

```
shadraw-pg-2026-05-28.dump     27M     # Postgres 数据
shadraw-minio-2026-05-28.tgz  419M     # MinIO 对象
```

`backup/` 在 `.gitignore` 里,不会进 git。

## 2. 拷到 VPS

```bash
# 替换 user / vps 为你的实际 SSH 配置
scp backup/shadraw-pg-*.dump      user@vps:~/shadraw-studio/
scp backup/shadraw-minio-*.tgz    user@vps:~/shadraw-studio/
```

419MB 的 tar 文件在普通家庭网络上传需要几分钟到十几分钟。

## 3. 在 VPS 上还原

SSH 上 VPS:

```bash
ssh user@vps
cd /opt/shadraw-studio

COMPOSE="docker compose -f docker-compose.deps.yml --env-file .env"

# 步骤 3.1: 停 API,避免 restore 时应用同时读写数据库
sudo systemctl stop shadraw-api || true

# 步骤 3.2: 只起依赖
$COMPOSE up -d db minio

# 步骤 3.3: 等 db ready
until $COMPOSE exec -T db pg_isready -U shadraw -d shadraw; do sleep 1; done

# 步骤 3.4: Postgres 还原
# --clean --if-exists: 先 drop 同名对象再 restore (相当于覆盖)
cat ~/shadraw-studio/shadraw-pg-*.dump | \
  $COMPOSE exec -T db pg_restore -U shadraw -d shadraw --clean --if-exists

# 步骤 3.5: MinIO 还原 (停 minio → 解 tar 进 named volume → 起 minio)
$COMPOSE stop minio

# named volume 名: shadraw_miniodata (或类似 compose project 前缀)
# 用 docker volume ls 确认实际名字
VOLUME=$(docker volume ls --format "{{.Name}}" | grep miniodata | head -1)
echo "MinIO volume: $VOLUME"

docker run --rm \
  -v "${VOLUME}":/data \
  -v "$HOME/shadraw-studio":/backup \
  alpine sh -c "cd /data && tar xzf /backup/shadraw-minio-*.tgz"

$COMPOSE start minio

# 步骤 3.6: 启动 API (会做 migrations,因为表已经在数据库里,会显示 no-change)
sudo systemctl start shadraw-api

# 步骤 3.7: 看 API 启动日志确认无报错
sudo journalctl -u shadraw-api -f
```

健康的 api 日志大致长这样:

```
INFO migrations: applied N migrations
INFO admin bootstrap: existing admin verified email=...
INFO worker pool started workers=4
INFO http server starting addr=:8088
```

如果看到 `admin bootstrap: created new admin` 而你期望的是 "existing admin verified",说明 pg_restore 出问题了 (db 实际是空的)。

## 4. 验证

浏览器打开你的域名,**用本地的账号密码登录**:

- [ ] 登录成功
- [ ] 历史记录列表完整 (条数与本地一致)
- [ ] 任意一条历史记录的图片能加载出来
- [ ] 收藏 / 项目 / 设置 / admin 内容都在
- [ ] 暗色模式 / 移动端响应式正常

## 5. 清理 (验证通过后)

```bash
# 本地
rm backup/shadraw-pg-*.dump backup/shadraw-minio-*.tgz

# VPS
ssh user@vps "rm ~/shadraw-studio/shadraw-pg-*.dump ~/shadraw-studio/shadraw-minio-*.tgz"
```

---

## 关键对齐项 ⚠️

VPS 的 `deploy/.env` 里有几个值**必须和本地一致**,否则迁数据会失败或者出错:

| 字段 | 强约束? | 不一致的后果 |
|---|---|---|
| `POSTGRES_USER` | ✅ 必须一致 (本地默认 `shadraw`) | dump 里的 owner 对不上,restore 报错 |
| `POSTGRES_DB` | ✅ 必须一致 (本地默认 `shadraw`) | restore 命令的 `-d` 找不到目标库 |
| `S3_BUCKET` | ✅ 必须一致 (本地默认 `shadraw`) | DB 里图片记录的 key 找不到对象,画廊显示但加载不出 |
| `MASTER_KEY` | ✅ 必须一致 | apiKey 用 master key 做 AES-GCM 加密,换了就解不开 admin upstream 配置 |
| `JWT_SECRET` | ⚠️ 不一致也行 | 用户需要重新登录一次 (旧 access/refresh token 失效) |
| `S3_ACCESS_KEY_ID` / `SECRET` | ❌ 可不一致 | MinIO root user 由 env 设,两边独立无关 |
| `ADMIN_EMAIL` | ❌ 可不一致 | restore 后,本地的 admin 账号才是有效的;VPS `.env` 的 ADMIN_EMAIL 只在数据库**空**时启动会被引导成 admin |

## 常见问题

### `pg_restore` 报 "role shadraw does not exist"

VPS 的 `.env` 里 `POSTGRES_USER` 不是 `shadraw`。要么改成 `shadraw`,要么在 restore 时多传 `--no-owner --role <your_user>`。

### 图片列表能出来,但点开是 broken image

99% 是 `S3_BUCKET` 名字两边不一致。DB 里存的对象 key 是 `images/user-N/xxx.png`,bucket 名错了就拿不到。

### `pg_restore` 报很多 `errors ignored on restore: NN`

如果 NN 比较小 (个位数) 且都是 `already exists` 之类,通常是 schema 版本差异的良性提示,可以忽略。如果上百条,说明 schema 不兼容,需要先确认两边 migration 版本一致。

### MinIO 解 tar 后,控制台看不到 bucket

确认 named volume 名字对。`docker volume ls` 里应该有 `shadraw-studio_miniodata` (或类似的 compose project 前缀)。tar 解错地方等于没解。

---

## 关于早期本地图片备份

`data/images.local-backup-*` 是 `BLOB_DRIVER=local` 切到 MinIO 之前的快照。一般情况下:

- 切换时已经用 `cmd/migrate-blobs` 把本地图片传到 MinIO 了 → 这个备份就是冗余
- 没用 `migrate-blobs` 直接切的 → 那些图片在 DB 里有记录但 MinIO 里没有,需要补上

补传步骤:

```bash
# 本地,先把备份目录改回标准位置
mv data/images.local-backup-20260527 data/images-staging

# dry-run 看会上传哪些
S3_ENDPOINT=http://localhost:9000 S3_BUCKET=shadraw \
S3_ACCESS_KEY_ID=shadraw S3_SECRET_ACCESS_KEY=shadrawsecret \
go run ./cmd/migrate-blobs -dry-run -data-dir ./data-staging

# 真传 (确认 dry-run 列出来的都是想传的)
S3_ENDPOINT=http://localhost:9000 S3_BUCKET=shadraw \
S3_ACCESS_KEY_ID=shadraw S3_SECRET_ACCESS_KEY=shadrawsecret \
go run ./cmd/migrate-blobs -data-dir ./data-staging
```

补完之后再做步骤 1 的 MinIO tar,VPS 那边就齐了。
