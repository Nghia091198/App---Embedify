# Deploy Guide

Tất cả lệnh chạy từ thư mục **gốc của project**, không phải từ `deploy/`.

---

## Cấu trúc

```
deploy/
├── Dockerfile          ← multi-stage build: deps → build → runner
├── docker-compose.yml  ← mount .env.production, expose port 8080
├── .dockerignore       ← loại trừ node_modules, dist, .env.local
└── README.md           ← file này
```

---

## Yêu cầu

- VPS: Ubuntu 22.04+, RAM ≥ 1GB
- Cài sẵn: `docker`, `docker compose` (v2), `nginx`, `certbot`
- File `.env.production` ở root project (không commit git)

---

## Lần đầu deploy (init)

```bash
# 1. SSH vào VPS
ssh root@<IP_VPS>

# 2. Clone repo
git clone <REPO_URL> /app/project
cd /app/project

# 3. Tạo .env.production
cp .env.example .env.production
nano .env.production
# Điền đầy đủ: HARAVAN_CLIENT_ID, HARAVAN_CLIENT_SECRET, HARAVAN_REDIRECT_URI,
#              APP_ORIGIN, HARAVAN_WEBHOOK_VERIFY_TOKEN,
#              SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#              VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# 4. Build và chạy
docker compose -f deploy/docker-compose.yml up -d --build

# 5. Kiểm tra container đang chạy
docker compose -f deploy/docker-compose.yml ps

# 6. Xem log
docker compose -f deploy/docker-compose.yml logs --tail=50 app

# 7. Test webhook endpoint
curl https://yourdomain.com/hook
# → {"ok":true,"service":"haravan-seo-webhook"}
```

---

## Deploy cập nhật code mới

```bash
cd /app/project

# Pull code mới
git pull origin main

# Rebuild và restart (không downtime lâu)
docker compose -f deploy/docker-compose.yml up -d --build

# Xem log sau khi deploy
docker compose -f deploy/docker-compose.yml logs --tail=30 app
```

---

## Restart (không build lại)

Dùng khi chỉ thay đổi `.env.production`:

```bash
cd /app/project
docker compose -f deploy/docker-compose.yml down
docker compose -f deploy/docker-compose.yml up -d
```

---

## Build lại hoàn toàn (clean)

Dùng khi có vấn đề cache npm hoặc Rollup:

```bash
cd /app/project
docker compose -f deploy/docker-compose.yml down
docker compose -f deploy/docker-compose.yml build --no-cache
docker compose -f deploy/docker-compose.yml up -d
```

---

## Xem log realtime

```bash
docker compose -f deploy/docker-compose.yml logs -f app
```

---

## Vào trong container debug

```bash
docker compose -f deploy/docker-compose.yml exec app sh
```

---

## Nginx config mẫu

Tạo file `/etc/nginx/sites-available/yourdomain.com`:

```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass         http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }
}
```

```bash
# Bật site
ln -s /etc/nginx/sites-available/yourdomain.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Cấp SSL
certbot --nginx -d yourdomain.com
```

---

## Checklist sau deploy

- [ ] `curl https://yourdomain.com/hook` → 200 OK
- [ ] `curl https://yourdomain.com/api/auth/me` → 401 (không có session) hoặc JSON
- [ ] Login qua Haravan OAuth thành công
- [ ] Log hiện `session_upsert_ok` sau khi login
- [ ] Subscribe webhook: `curl -X POST https://webhook.haravan.com/api/subscribe -H "Authorization: Bearer <token>" -d '{}'` → `{"error":false}`
- [ ] Send Test trên Partners Dashboard → log hiện `webhook_app_uninstalled`

---

## Troubleshoot

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| Container không start | `.env.production` thiếu biến | Kiểm tra `docker compose logs app` |
| 502 Bad Gateway | Container chưa start xong | Đợi 15s, healthcheck tự retry |
| OAuth redirect về localhost | `HARAVAN_REDIRECT_URI` sai | Sửa về `https://yourdomain.com/api/haravan/oauth/callback` |
| Webhook 401 | `HARAVAN_CLIENT_SECRET` sai hoặc `wh_api` scope chưa bật | Kiểm tra Partners Dashboard |
| Build lỗi Rollup | Thiếu native binary | `--no-cache` rebuild |
