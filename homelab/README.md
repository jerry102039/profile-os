# 把 homelab 狀態接到網站

網站上的 `monitor.app` 預設讀 `public/status.json`（示範資料，會標成「示範資料」）。
照下面三步接上真的叢集後，就會顯示 **LIVE**。

```
Proxmox 節點 ──(cron, PUT + token)──▶ Cloudflare Worker + KV ◀──(GET)── 網站
```

網站永遠不會連進你的內網；是 homelab 主動把整理過的統計數字推出去，Worker 也只保留白名單欄位。

## 1. 部署 Worker

```bash
cd homelab
npx wrangler login
npx wrangler kv namespace create STATUS     # 把 id 貼進 wrangler.toml
npx wrangler secret put TOKEN               # 自己產一組長亂碼，例如 openssl rand -hex 32
npx wrangler deploy
```

## 2. 在 Proxmox 節點上排程推送

```bash
scp push-status.py root@pve-01:/root/
# 在節點上：
crontab -e
* * * * * STATUS_URL=https://<worker 名稱>.<帳號>.workers.dev/status STATUS_TOKEN=<token> /usr/bin/python3 /root/push-status.py
```

## 3. 讓網站讀 Worker

在專案根目錄的 `.env`（或部署平台的環境變數）設定：

```
PUBLIC_STATUS_URL=https://<worker 名稱>.<帳號>.workers.dev/status
```

重新 build 部署即可。
