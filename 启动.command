#!/bin/bash
# 宝可梦联盟 MOBA 启动器
cd "$(dirname "$0")"
# 找一个可用端口(避免与其它本地服务器冲突)
PORT=""
for p in 8723 8724 8725 8726 8727; do
  if lsof -i :$p >/dev/null 2>&1; then
    # 端口被占用:确认是否正在服务本目录
    if curl -sf "http://localhost:$p/index.html" 2>/dev/null | grep -q "宝可梦联盟"; then
      PORT=$p; break
    fi
  else
    PORT=$p
    (python3 -m http.server $p >/dev/null 2>&1 &)
    sleep 1
    break
  fi
done
if [ -z "$PORT" ]; then echo "没有可用端口(8723-8727均被占用)"; exit 1; fi
open "http://localhost:$PORT/index.html"
echo "🔴⚪ 宝可梦联盟已启动: http://localhost:$PORT"
echo "如需停止服务器: lsof -ti:$PORT | xargs kill"
