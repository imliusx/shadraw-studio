# shadraw 卸载与清理

本文记录 binary + systemd 部署模式下的卸载步骤。默认生产部署目录：

```bash
/opt/shadraw-studio
```

如果你当初部署到了其他目录，把命令里的路径替换成实际路径。

## 先确认目标机器

```bash
ssh user@your-vps
cd /opt/shadraw-studio
```

确认当前目录下有这些文件：

```bash
ls
```

常见文件包括：

- `server-linux-amd64`
- `.env`
- `docker-compose.deps.yml`
- `shadraw-api.service`
- `migrations/`

## 只停用应用，保留数据

这种方式会停止 API 服务并取消开机自启，但保留：

- `/opt/shadraw-studio`
- `.env`
- Postgres 数据卷
- MinIO 数据卷

执行：

```bash
sudo systemctl stop shadraw-api
sudo systemctl disable shadraw-api
sudo rm -f /etc/systemd/system/shadraw-api.service
sudo systemctl daemon-reload
```

如果还想停掉 Postgres 和 MinIO，但保留数据卷：

```bash
cd /opt/shadraw-studio
docker compose -f docker-compose.deps.yml --env-file .env down
```

以后恢复时可以重新执行：

```bash
cd /opt/shadraw-studio
docker compose -f docker-compose.deps.yml --env-file .env up -d
sudo cp shadraw-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable shadraw-api
sudo systemctl restart shadraw-api
```

## 彻底卸载并删除数据

危险：下面命令会删除数据库和对象存储数据。执行前确认不再需要线上数据。

建议先备份 `.env`：

```bash
cp /opt/shadraw-studio/.env ~/shadraw-env.backup
```

停止并移除 systemd 服务：

```bash
sudo systemctl stop shadraw-api
sudo systemctl disable shadraw-api
sudo rm -f /etc/systemd/system/shadraw-api.service
sudo systemctl daemon-reload
```

停止依赖容器并删除 Docker volumes：

```bash
cd /opt/shadraw-studio
docker compose -f docker-compose.deps.yml --env-file .env down -v
```

删除应用目录：

```bash
cd /
rm -rf /opt/shadraw-studio
```

## 如果配置过 nginx

先找到站点配置：

```bash
ls /etc/nginx/sites-enabled
ls /etc/nginx/sites-available
ls /etc/nginx/conf.d
```

删除对应站点配置，例如：

```bash
rm -f /etc/nginx/sites-enabled/shadraw
rm -f /etc/nginx/sites-available/shadraw
rm -f /etc/nginx/conf.d/shadraw.conf
nginx -t
systemctl reload nginx
```

实际文件名可能不是 `shadraw`，以服务器上真实文件为准。

## 如果配置过 certbot 证书

查看证书：

```bash
certbot certificates
```

删除指定证书：

```bash
certbot delete --cert-name your-domain.com
```

把 `your-domain.com` 替换成 `certbot certificates` 输出里的证书名。

## 清理后确认

```bash
systemctl status shadraw-api
docker ps
docker volume ls
ls /opt/shadraw-studio
```

预期结果：

- `shadraw-api` 不存在或 inactive
- `docker ps` 里没有 `shadraw-db` / `shadraw-minio`
- 如果执行了彻底卸载，`/opt/shadraw-studio` 不存在

## 关键提醒

- `docker compose down` 会停容器但保留数据卷。
- `docker compose down -v` 会删除 Postgres 和 MinIO 数据卷。
- `.env` 里有 `MASTER_KEY`、数据库密码、MinIO 密钥；要么安全备份，要么彻底删除。
- 只想临时下线时，用“只停用应用，保留数据”。
