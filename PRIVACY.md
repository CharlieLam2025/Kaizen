# 拆砖 · 隐私说明

生效日期：2026-08-18

拆砖是一款自带钥匙的 Chrome 扩展。没有拆砖账号，没有开发者服务器，没有统计、广告或遥测。

## 扩展会碰到哪些数据

按你用到的功能，拆砖会在本机处理：

- 当前 YouTube 视频的网址、视频 ID、标题、播放进度
- 字幕文本和时间戳
- 你划的线、金句、笔记、生词、复习卡、书架、跨视频概念
- 你在提问、口播、拆解、翻译、查词时提交的文字
- 你填写的 DeepSeek、Supadata API Key
- 上述内容的本机缓存

## 数据去哪

请求从你的浏览器**直接**发到对应服务，不经过拆砖作者。

### Supadata

扩展把当前视频的 YouTube 网址发到 `https://api.supadata.ai`，用你自己的 Supadata Key 换回字幕。

### DeepSeek

扩展把字幕摘录、你的问题、笔记或口播设置发到 `https://api.deepseek.com`，用你自己的 DeepSeek Key 生成拆解、翻译、词典、图谱、口播和问答。

这两个服务如何保存、使用数据，以它们自己的条款为准。不要把不该外传的内容送进去。

## 存在哪、怎么删

Key、笔记和缓存都写在 Chrome 的扩展本地存储里，不是拆砖云。能打开你这台电脑浏览器配置的人，有可能读到这些内容。请给 Key 设额度，丢了电脑就去官网作废 Key。

删除办法：

- 在侧栏里删单条划线、金句、笔记、生词或复习卡
- 从 Chrome 移除扩展，或清除该扩展的数据
- 在 DeepSeek / Supadata 控制台作废 Key

清掉本机数据，不会自动删掉这两家服务端已经处理过的内容。

## 权限各干什么

- `sidePanel`：在侧边打开拆砖
- `storage`：把设置、Key 和笔记存在本机
- `tabs`：找到正在看的 YouTube 标签
- `scripting`：在 YouTube 页跳转、循环、读进度
- `youtube.com`：识别视频、控制播放
- `api.supadata.ai`：取字幕
- `api.deepseek.com`：做拆解和问答

## 联系

有隐私问题，请到仓库 Issues 留言：https://github.com/CharlieLam2025/chaizhuan/issues
