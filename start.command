#!/bin/zsh
# Double-click to open Abide. Serves the notebook on this Mac only (127.0.0.1:5180).
# Keep the port the same: your notebook's data belongs to this exact address.
cd "$(dirname "$0")"
if ! curl -s -o /dev/null http://127.0.0.1:5180/; then
  nohup python3 scripts/serve.py 5180 >/dev/null 2>&1 &
  sleep 0.6
fi
open "http://127.0.0.1:5180/"
