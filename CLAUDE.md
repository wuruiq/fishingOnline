# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 运行与调试

```bash
node server.js            # 启动，默认 3000 端口，同时托管前端与 WebSocket
PORT=8080 node server.js  # 换端口
```

无构建步骤、无依赖、无测试框架。改完直接重启 `node server.js` 验证。
浏览器开多个标签页输入不同名字即可在本机模拟多人联机。

## 架构要点

这是一个**零依赖**的多人钓鱼游戏，整个后端是单文件 `server.js`，前端是 `public/` 下的原生三件套。理解时需要抓住几个跨文件的关键设计：

- **单进程双职责**：`server.js` 用 `http` 模块托管 `public/` 静态文件，并在同一端口通过 `server.on('upgrade')` 手写实现 WebSocket（RFC 6455）——握手用 SHA1+魔术字符串，帧用 `encodeFrame`/`decodeFrame` 手动编解码（客户端→服务器帧必带掩码，服务器→客户端帧不掩码）。没有用 `ws` 等任何库，**新增功能时不要引入依赖**，否则破坏「开箱即跑」的卖点。

- **服务器是唯一裁判**：钓到什么鱼（`rollFish` 按 `FISH_TABLE` 权重随机）、咬钩时机、收杆是否在窗口内（`RARITY_WINDOW`），全部在服务器判定。前端 `game.js` 只发 `cast`/`reel` 意图并做表现，**不能**自己决定结果。任何涉及游戏数值/概率的改动都在 `server.js`，不要在前端复制一份。

- **客户端-服务器消息协议**（JSON over WebSocket）是前后端唯一契约，改动需两端同步：
  - 上行：`join{name}` / `cast` / `reel` / `ping`
  - 下行：`welcome{fishTable,rarityLabel}`（连接即下发鱼表，前端不硬编码）/ `joined` / `casting{waitMs}` / `bite{windowMs}` / `caught{fish}` / `escaped{fish}` / `miss` / `roster{players}` / `announce{text}` / `pong`

- **钓鱼状态机**横跨两端且必须对应：服务器侧每个 player 有 `pending` 对象（含 `fish`/`biteAt`/`windowMs`/`biteScheduled`/`resolved`）；前端 `game.js` 有 `state`（`idle`→`waiting`→`biting`→`idle`）。`casting`/`bite`/`caught`/`escaped` 消息驱动两端状态迁移，改一端务必改另一端。

- **在线列表 = 广播 roster**：玩家状态变化（join/离线/钓到鱼）时调用 `broadcastRoster()`，把全体快照（按分数降序，附带 `rarest` 最高品质、最近渔获 `log`）推给所有人。前端 `renderRoster` 据此渲染列表与排行。

- **品质体系**集中在 `server.js` 顶部，六档键名由低到高为 `white/green/blue/purple/gold/red`：`FISH_TABLE`（20 种鱼，每档多种，含 weight/score/rarity）、`RARITY_WINDOW`（品质→收杆毫秒窗口，越高越短=成功率越低）、`RARITY_LABEL`、`RARITY_ORDER`（比较品质高低）。调整难度/鱼种只动这几个表。前端 `game.js` 顶部也有一份 `RARITY_ORDER` 用于图鉴排序，键名必须与服务器一致；配色对应 `style.css` 里 `--rarity-*` 变量和 `.bg-*` 类。

- **图鉴与个人收集**：前端 `game.js` 用 `localStorage`（key `fishing.collection.<名字>`）记录每种鱼的捕获次数 `collection`，纯客户端、不进服务器。`openCodex()` 按 `RARITY_ORDER` 分组渲染 `fishTable`，未捕获的显示问号。

- **金/红特殊检视动画**：`caught` 且 `fish.rarity` 为 `gold`/`red` 时，`onResult` 走 `showInspect()`（全屏遮罩 + 旋转光芒 + 粒子），其余品质走普通 `showCatch()` 弹窗。服务器对同样这两档广播 `announce` 喜报。三处「哪些品质算高级」的判断（前端动画、服务器广播）需保持一致。

- **稀有鱼手绘动图**：`public/fish-art.js` 暴露 `window.FISH_ART`，键为鱼的 `id`，值为返回内联 SVG 字符串的函数（动画用 SMIL `<animate>`/`<animateTransform>` 自带，不依赖 CSS）。目前覆盖 6 种金/红鱼。`game.js` 的 `fishArt()` 帮助函数：有手绘图就用 SVG，否则回退 emoji；检视动画与图鉴（仅已捕获格子）都走它。新增手绘鱼只需在 `FISH_ART` 加一个同 `id` 的条目，无需改动 `game.js`。`fish-art.js` 必须在 `game.js` 之前加载（见 `index.html`）。

- **弧形鱼竿**：`index.html` 中 `.rod` 内是一段 SVG（弧形 `path` + 竿梢环 + 卷线轮），钓线 `.rod-line` 用绝对定位的百分比（`left:31%; top:10.5%`）对齐到 SVG 竿梢坐标（viewBox `56,38`）；改动竿身曲线（`d` 属性）或 viewBox 时需同步这两个百分比，否则线和竿梢会错位。

## 部署

为内网穿透场景设计：本机 `node server.js` 后用 frp/ngrok/cpolar 映射端口即可。前端按 `location.protocol` 自动在 `ws`/`wss` 间切换，https 隧道无需改代码。
