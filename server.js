'use strict';

/**
 * 摸鱼钓鱼 —— 零依赖服务器
 *
 * 一个文件同时做两件事：
 *   1. 用 http 模块托管 public/ 下的静态前端
 *   2. 手写 WebSocket（RFC 6455）实现多人实时联机
 *
 * 不依赖任何 npm 包，确保 `node server.js` 开箱即用，方便配合
 * 内网穿透（frp / ngrok / cpolar 等）让同事访问。
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// 鱼种配置：品质决定出现概率与收杆时间窗口（品质越高越难、分值越高）。
// 服务器是唯一裁判，所有「钓到什么鱼」由服务器随机决定，避免前端作弊。
//
// 六档品质（由低到高）：white 白 / green 绿 / blue 蓝 / purple 紫 / gold 金 / red 红
const FISH_TABLE = [
  // —— 白色·杂物与最常见（0~5 分）——
  { id: 'boot',      name: '破靴子',     rarity: 'white',  weight: 20,  score: 0,    emoji: '🥾' },
  { id: 'seaweed',   name: '海草',       rarity: 'white',  weight: 20,  score: 1,    emoji: '🌿' },
  { id: 'can',       name: '空易拉罐',   rarity: 'white',  weight: 20,  score: 0,    emoji: '🥫' },
  { id: 'shell',     name: '小贝壳',     rarity: 'white',  weight: 20,  score: 3,    emoji: '🐚' },

  // —— 绿色·普通小鱼（8~18 分）——
  { id: 'whitebait', name: '小白条',     rarity: 'green',  weight: 30,  score: 8,    emoji: '🐟' },
  { id: 'crucian',   name: '鲫鱼',       rarity: 'green',  weight: 30,  score: 12,   emoji: '🐟' },
  { id: 'shrimp',    name: '小河虾',     rarity: 'green',  weight: 30,  score: 10,   emoji: '🦐' },
  { id: 'loach',     name: '泥鳅',       rarity: 'green',  weight: 30,   score: 18,   emoji: '🐍' },

  // —— 蓝色·有点意思（25~45 分）——
  { id: 'carp',      name: '鲤鱼',       rarity: 'blue',   weight: 33,   score: 25,   emoji: '🐠' },
  { id: 'catfish',   name: '鲶鱼',       rarity: 'blue',   weight: 33,   score: 35,   emoji: '🐡' },
  { id: 'crab',      name: '大闸蟹',     rarity: 'blue',   weight: 33,   score: 45,   emoji: '🦀' },

  // —— 紫色·稀有（70~110 分）——
  { id: 'bass',      name: '鲈鱼',       rarity: 'purple', weight: 10, score: 70,   emoji: '🐟' },
  { id: 'turtle',    name: '老甲鱼',     rarity: 'purple', weight: 10, score: 90,   emoji: '🐢' },
  { id: 'squid',     name: '墨鱼',       rarity: 'purple', weight: 10,   score: 110,  emoji: '🦑' },

  // —— 金色·史诗（200~320 分）——
  { id: 'pufferfish',name: '河豚',       rarity: 'gold',   weight: 1, score: 200,  emoji: '🐡' },
  { id: 'goldfish',  name: '黄金鱼',     rarity: 'gold',   weight: 1, score: 280,  emoji: '🟡' },
  { id: 'octopus',   name: '黄金章鱼',   rarity: 'gold',   weight: 1, score: 320,  emoji: '🐙' },

  // —— 红色·传说（600~1000 分）——
  { id: 'koi',       name: '彩色锦鲤',   rarity: 'red',    weight: 0.5,score: 600,  emoji: '🎏' },
  { id: 'dragon',    name: '锦鲤之王',   rarity: 'red',    weight: 0.5,score: 800,  emoji: '🐉' },
  { id: 'whale',     name: '深海鲸王',   rarity: 'red',    weight: 0.5,score: 1000, emoji: '🐋' },
];

// 每个品质对应的「收杆时间窗口」（毫秒）。统一吧
const RARITY_WINDOW = {
  white:  5000,
  green:  5000,
  blue:   5000,
  purple: 5000,
  gold:   5000,
  red:    5000,
};

const RARITY_LABEL = {
  white:  '白·杂物',
  green:  '绿·普通',
  blue:   '蓝·精良',
  purple: '紫·稀有',
  gold:   '金·史诗',
  red:    '红·传说',
};

// ---------------------------------------------------------------------------
// 静态文件服务
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // 只服务 GET，且做最基础的路径穿越防护
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------------------------------------------------------------------------
// 手写 WebSocket（RFC 6455）
// ---------------------------------------------------------------------------

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** 在线客户端集合：socket -> player 状态 */
const clients = new Map();

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash('sha1')
    .update(key + WS_MAGIC)
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );

  onConnection(socket);
});

function onConnection(socket) {
  const player = {
    id: crypto.randomBytes(6).toString('hex'),
    name: null,
    joinedAt: Date.now(),
    score: 0,
    catches: 0,
    rarest: null, // 记录钓到过的最高稀有度鱼
    log: [],      // 最近几条渔获 {fishId, name, emoji, rarity, score, ts}
    // 当前抛竿状态（服务器侧裁判用）
    pending: null, // { fish, biteAt, windowMs }
  };
  clients.set(socket, player);

  let buffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    // 一个 TCP 包里可能含多帧，循环解析
    let frame;
    while ((frame = decodeFrame(buffer))) {
      buffer = frame.rest;
      if (frame.opcode === 0x8) {
        // close
        cleanup();
        return;
      }
      if (frame.opcode === 0x9) {
        // ping -> pong
        sendRaw(socket, encodeFrame(frame.payload, 0xa));
        continue;
      }
      if (frame.opcode === 0x1) {
        handleMessage(socket, player, frame.payload.toString('utf8'));
      }
    }
  });

  socket.on('close', cleanup);
  socket.on('error', cleanup);

  function cleanup() {
    if (clients.has(socket)) {
      clients.delete(socket);
      broadcastRoster();
    }
    try { socket.destroy(); } catch (_) {}
  }

  // 告诉客户端鱼种表与稀有度信息，避免前后端硬编码不一致
  send(socket, {
    type: 'welcome',
    you: player.id,
    fishTable: FISH_TABLE,
    rarityLabel: RARITY_LABEL,
  });
}

// ---------------------------------------------------------------------------
// 业务消息处理
// ---------------------------------------------------------------------------

function handleMessage(socket, player, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (_) {
    return;
  }

  switch (msg.type) {
    case 'join': {
      const name = String(msg.name || '').trim().slice(0, 16);
      if (!name) return;
      player.name = name;
      send(socket, { type: 'joined', id: player.id, name: player.name });
      broadcastRoster();
      break;
    }

    case 'cast': {
      // 玩家抛竿：服务器决定钓到什么鱼以及咬钩时间
      if (!player.name) return;
      if (player.pending) return; // 已经在钓了

      const fish = rollFish();
      const waitMs = 1500 + Math.floor(seededRandom() * 4000); // 1.5~5.5s 后咬钩
      const windowMs = RARITY_WINDOW[fish.rarity] || 1500;

      player.pending = { fish, windowMs, biteScheduled: true };
      // 通知该玩家：开始等待（不告诉是什么鱼）
      send(socket, { type: 'casting', waitMs });

      setTimeout(() => {
        if (!clients.has(socket) || !player.pending) return;
        player.pending.biteAt = Date.now();
        player.pending.biteScheduled = false;
        send(socket, { type: 'bite', windowMs }); // 上钩，鱼竿抖动
        // 超过窗口未收杆则脱钩
        setTimeout(() => {
          if (player.pending && !player.pending.biteScheduled && !player.pending.resolved) {
            const escaped = player.pending.fish;
            player.pending = null;
            send(socket, { type: 'escaped', fish: publicFish(escaped) });
          }
        }, windowMs + 200);
      }, waitMs);
      break;
    }

    case 'reel': {
      // 玩家收杆：判断是否在咬钩窗口内
      if (!player.pending || player.pending.biteScheduled) {
        // 还没上钩就收杆 -> 空军
        if (player.pending) player.pending = null;
        send(socket, { type: 'miss', reason: 'early' });
        return;
      }
      const elapsed = Date.now() - player.pending.biteAt;
      const fish = player.pending.fish;
      player.pending.resolved = true;
      player.pending = null;

      if (elapsed <= (RARITY_WINDOW[fish.rarity] || 1500)) {
        // 成功！
        player.score += fish.score;
        player.catches += 1;
        if (isRarer(fish.rarity, player.rarest)) player.rarest = fish.rarity;
        const entry = {
          fishId: fish.id, name: fish.name, emoji: fish.emoji,
          rarity: fish.rarity, score: fish.score, ts: Date.now(),
        };
        player.log.unshift(entry);
        player.log = player.log.slice(0, 8);

        send(socket, { type: 'caught', fish: publicFish(fish) });
        // 金、红品质全场广播喜报
        if (fish.rarity === 'gold' || fish.rarity === 'red') {
          broadcast({
            type: 'announce',
            text: `🎉 ${player.name} 钓到了 ${RARITY_LABEL[fish.rarity]}「${fish.name}」${fish.emoji}！`,
          });
        }
        broadcastRoster();
      } else {
        send(socket, { type: 'escaped', fish: publicFish(fish) });
      }
      break;
    }

    case 'ping':
      send(socket, { type: 'pong' });
      break;
  }
}

// ---------------------------------------------------------------------------
// 渔获概率 / 稀有度
// ---------------------------------------------------------------------------

const RARITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold', 'red'];

function isRarer(rarity, current) {
  if (!current) return true;
  return RARITY_ORDER.indexOf(rarity) > RARITY_ORDER.indexOf(current);
}

function rollFish() {
  const total = FISH_TABLE.reduce((s, f) => s + f.weight, 0);
  let r = seededRandom() * total;
  for (const f of FISH_TABLE) {
    r -= f.weight;
    if (r <= 0) return f;
  }
  return FISH_TABLE[0];
}

// crypto 强随机的 [0,1)
function seededRandom() {
  return crypto.randomBytes(4).readUInt32BE(0) / 0xffffffff;
}

function publicFish(f) {
  return {
    id: f.id, name: f.name, emoji: f.emoji,
    rarity: f.rarity, rarityLabel: RARITY_LABEL[f.rarity], score: f.score,
  };
}

// ---------------------------------------------------------------------------
// 广播
// ---------------------------------------------------------------------------

function rosterSnapshot() {
  const players = [];
  for (const p of clients.values()) {
    if (!p.name) continue;
    players.push({
      id: p.id,
      name: p.name,
      score: p.score,
      catches: p.catches,
      rarest: p.rarest,
      rarestLabel: p.rarest ? RARITY_LABEL[p.rarest] : null,
      log: p.log,
    });
  }
  // 按分数降序，方便当排行榜看
  players.sort((a, b) => b.score - a.score);
  return players;
}

function broadcastRoster() {
  broadcast({ type: 'roster', players: rosterSnapshot() });
}

function broadcast(obj) {
  const frame = encodeFrame(Buffer.from(JSON.stringify(obj)), 0x1);
  for (const socket of clients.keys()) sendRaw(socket, frame);
}

function send(socket, obj) {
  sendRaw(socket, encodeFrame(Buffer.from(JSON.stringify(obj)), 0x1));
}

function sendRaw(socket, frame) {
  try {
    socket.write(frame);
  } catch (_) {
    /* 连接已断开，由 close/error 处理清理 */
  }
}

// ---------------------------------------------------------------------------
// WebSocket 帧编解码
// ---------------------------------------------------------------------------

/** 把 payload 编码为一个服务器->客户端帧（不掩码）。opcode 默认文本。 */
function encodeFrame(payload, opcode = 0x1) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | opcode; // FIN + opcode
  return Buffer.concat([header, payload]);
}

/**
 * 解析一个来自客户端的帧（必定带掩码）。
 * 返回 { opcode, payload, rest } 或 null（数据不完整时）。
 */
function decodeFrame(buf) {
  if (buf.length < 2) return null;

  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let offset = 2;

  if (len === 126) {
    if (buf.length < offset + 2) return null;
    len = buf.readUInt16BE(offset);
    offset += 2;
  } else if (len === 127) {
    if (buf.length < offset + 8) return null;
    len = Number(buf.readBigUInt64BE(offset));
    offset += 8;
  }

  let mask;
  if (masked) {
    if (buf.length < offset + 4) return null;
    mask = buf.slice(offset, offset + 4);
    offset += 4;
  }

  if (buf.length < offset + len) return null;

  const payload = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    payload[i] = masked ? buf[offset + i] ^ mask[i & 3] : buf[offset + i];
  }

  return { opcode, payload, rest: buf.slice(offset + len) };
}

// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`🎣 摸鱼钓鱼服务器已启动`);
  console.log(`   本机访问:   http://localhost:${PORT}`);
  console.log(`   局域网访问: http://<你的内网IP>:${PORT}`);
  console.log(`   配合 frp/ngrok/cpolar 内网穿透即可让同事访问。`);
});
