# 拆砖

把 YouTube 视频当成一本书来读：双语字幕、划线笔记、生词本，再按知识块拆开揉碎。

一句话：**把视频拆成能记住的砖。**

许可证：[MIT](LICENSE)。自己申请 DeepSeek 和 Supadata 的 Key，数据只存在你这台电脑。

## 你能做什么

- **阅读器**：原文 / 双语 / 中文。像微信读书一样在字幕上划线、写笔记、查词、存进生词本。
- **生词**：词典卡含音标、发音、中英释义、用法、三条例句；存过的词会在全文标绿。
- **拆砖**：色块时间轴、知识管理式拆解（默认 DeepSeek V4 Pro）、关键词复述、带着问题去找答案、按你的理解写成口播。某一块可单曲循环。
- **跟随播放**：阅读器默认跟着视频滚；点时间戳或输入 `12:30` 可跳转。
- **问视频**：问整支、问某一块、或划一句再问。答案带可点击时间戳。
- **笔记页**：本视频的划线、笔记，以及跨视频生词本。

## 安装

1. `chrome://extensions` 打开开发者模式，加载本文件夹。
2. 点工具栏图标。**第一次会进入全屏设置**，按页面说明申请并填写两个 Key。
3. 看完小教程（可跳过，顶栏「教程」可重看）。
4. 打开有字幕的 YouTube 视频，阅读器会自动铺开。

给朋友：在本目录运行 `powershell -File scripts/pack.ps1`，把 `dist/chaizhuan.zip` 发给他。他解压后按上面第 1 步加载**解压后的文件夹**（不要加载 zip 本身），再自己申请两个 Key。

开源或上架前请先看 [PRIVACY.md](PRIVACY.md)。Chrome 商店需要一份可公开打开的隐私页网址；把这个文件放到 GitHub 仓库里就能当链接用。商店审核期间建议先选 **不公开（Unlisted）**，用链接给朋友装，通过后再公开。

## 申请 Key

两个都要填。Key 只存在本机。

### DeepSeek（拆解、翻译、查词、提问）

1. 打开 [API Keys 页面](https://platform.deepseek.com/api_keys)
2. 点 Create new API key，立刻复制
3. 文档：[api-docs.deepseek.com](https://api-docs.deepseek.com/)

### Supadata（字幕）

字幕**只走 Supadata**，不再先试 YouTube 直连。

1. 打开 [注册页](https://dash.supadata.ai/auth/sign-up)，走完引导即可拿到 Key
2. 控制台：[dash.supadata.ai](https://dash.supadata.ai/)
3. 定价：[supadata.ai/pricing](https://supadata.ai/pricing)

## 项目结构

| 文件 | 职责 |
| --- | --- |
| `panel.html/css/js` | 阅读器、引导、拆砖、提问、笔记 |
| `background.js` | Supadata 字幕 + DeepSeek（拆块、拆解、词典、学习包、口播、翻译、问答） |
| `content.js` | 只负责跳转播放和读取进度 |

扩展重载后请再点一次工具栏图标。已打开的 YouTube 页一般不用刷新。
