#!/bin/sh
# 在 src/dist 開一個本機伺服器給無頭瀏覽器測
cd "$(dirname "$0")/../src/dist" && exec python3 -m http.server 8765 --bind 127.0.0.1
