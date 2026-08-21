# Kaizen 口令同步

给已经认识的人用：建一个 `Kaizen-XXXX` 口令，进组后能看到大家看过哪些视频。只存称呼、任务、视频标题和进度，没有 Key，没有笔记。

```powershell
npx wrangler login
npx wrangler kv namespace create GROUPS
# 把 id 写进 wrangler.toml
npx wrangler deploy
```

部署后得到 `https://kaizen-kouling.<你的账号>.workers.dev`，填进 Kaizen 侧栏「库 → 搭子」的同步地址。
