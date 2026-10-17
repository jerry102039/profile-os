#!/usr/bin/env python3
"""
在任一台 Proxmox VE 節點上用 cron 執行，把叢集的「統計數字」推到 Cloudflare Worker。

只推節點名稱、上線狀態、CPU / 記憶體比例、運作時間，以及 VM / 容器數量。
不會送出 IP、VM 名稱或任何設定。

環境變數：
  STATUS_URL    例如 https://<worker 名稱>.<你的帳號>.workers.dev/status
  STATUS_TOKEN  跟 Worker 的 TOKEN secret 一樣
  CLUSTER_NAME  （選填）顯示用的叢集名稱，預設 homelab

cron 範例（每分鐘一次）：
  * * * * * STATUS_URL=... STATUS_TOKEN=... /usr/bin/python3 /root/push-status.py
"""
import json
import os
import subprocess
import urllib.request


def pvesh(path):
    out = subprocess.run(
        ["pvesh", "get", path, "--output-format", "json"],
        check=True, capture_output=True, text=True,
    ).stdout
    return json.loads(out)


def ceph_health():
    try:
        out = subprocess.run(["ceph", "health", "--format", "json"], capture_output=True, text=True, timeout=10).stdout
        return json.loads(out).get("status", "UNKNOWN")
    except Exception:
        return "N/A"


def main():
    resources = pvesh("/cluster/resources")
    nodes, vms, cts = [], {"running": 0, "total": 0}, {"running": 0, "total": 0}
    for r in resources:
        t = r.get("type")
        if t == "node":
            maxcpu = r.get("maxcpu") or 1
            maxmem = r.get("maxmem") or 1
            nodes.append({
                "name": r.get("node", "?"),
                "online": r.get("status") == "online",
                "cpu": round(float(r.get("cpu", 0)), 3) if maxcpu else 0,
                "mem": round(float(r.get("mem", 0)) / maxmem, 3),
                "uptime": int(r.get("uptime", 0)),
            })
        elif t in ("qemu", "lxc") and not r.get("template"):
            bucket = vms if t == "qemu" else cts
            bucket["total"] += 1
            if r.get("status") == "running":
                bucket["running"] += 1

    payload = {
        "cluster": os.environ.get("CLUSTER_NAME", "homelab"),
        "ceph": ceph_health(),
        "nodes": sorted(nodes, key=lambda n: n["name"]),
        "vms": vms,
        "cts": cts,
    }
    req = urllib.request.Request(
        os.environ["STATUS_URL"],
        data=json.dumps(payload).encode(),
        method="PUT",
        headers={"Authorization": f"Bearer {os.environ['STATUS_TOKEN']}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        res.read()


if __name__ == "__main__":
    main()
