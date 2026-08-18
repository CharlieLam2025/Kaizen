# 打一份给朋友装的 zip：不含 .git、概念稿、旧图标变体。
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $root "dist"
$stage = Join-Path $dist "chaizhuan"
$zip = Join-Path $dist "chaizhuan.zip"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

$keep = @(
  "manifest.json",
  "background.js",
  "content.js",
  "panel.html",
  "panel.css",
  "panel.js",
  "export.html",
  "export.css",
  "export.js",
  "README.md",
  "PRIVACY.md"
)

foreach ($name in $keep) {
  Copy-Item (Join-Path $root $name) (Join-Path $stage $name)
}

New-Item -ItemType Directory -Force -Path (Join-Path $stage "icons") | Out-Null
foreach ($size in 16, 48, 128) {
  Copy-Item (Join-Path $root "icons\icon$size.png") (Join-Path $stage "icons\icon$size.png")
}

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -Force
Write-Host "packed $zip"
