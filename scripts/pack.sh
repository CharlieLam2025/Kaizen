#!/usr/bin/env bash
# macOS / Linux packer. Same keep-list as pack.ps1.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
node "$root/scripts/pack.mjs"
