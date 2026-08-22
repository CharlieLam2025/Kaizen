#!/usr/bin/env node
// Cross-platform packer. Same keep-list as pack.ps1.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const stage = path.join(dist, "kaizen");
const zip = path.join(dist, "kaizen.zip");

const keep = [
  "manifest.json",
  "background.js",
  "content.js",
  "panel.html",
  "panel.css",
  "panel.js",
  "word-level.js",
  "achieve.js",
  "card-studio.js",
  "site.js",
  "i18n.js",
  "i18n-dict.js",
  "export.html",
  "export.css",
  "export.js",
  "README.md",
  "PRIVACY.md",
];

fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(zip, { force: true });
fs.mkdirSync(stage, { recursive: true });
for (const name of keep) fs.copyFileSync(path.join(root, name), path.join(stage, name));
fs.mkdirSync(path.join(stage, "icons"), { recursive: true });
for (const size of [16, 48, 128]) {
  fs.copyFileSync(path.join(root, "icons", `icon${size}.png`), path.join(stage, "icons", `icon${size}.png`));
}
fs.mkdirSync(path.join(stage, "packs"), { recursive: true });
fs.copyFileSync(path.join(root, "packs", "english-freq.txt"), path.join(stage, "packs", "english-freq.txt"));

const staged = path.join(stage, "*");
const win = process.platform === "win32";
if (win) {
  const ps = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `Compress-Archive -Path '${staged}' -DestinationPath '${zip}' -Force`],
    { stdio: "inherit" },
  );
  if (ps.status) process.exit(ps.status);
} else {
  const z = spawnSync("zip", ["-r", "-q", zip, "."], { cwd: stage, stdio: "inherit" });
  if (z.status) process.exit(z.status);
}
console.log(`packed ${zip}`);
