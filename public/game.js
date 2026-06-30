/* ========================================================================
   摸鱼钓鱼 —— 前端逻辑
   负责：WebSocket 连接、钓鱼状态机、场景动画切换、在线列表渲染。
   注意：钓到什么鱼、能否成功，都由服务器裁判，前端只负责表现与收发。
   ======================================================================== */

(function () {
  'use strict';

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const loginEl = $('login');
  const nameInput = $('nameInput');
  const startBtn = $('startBtn');
  const sceneEl = $('scene');
  const rodEl = $('rod');
  const lineEl = $('line');
  const statusEl = $('status');
  const actionBtn = $('actionBtn');
  const catchPopup = $('catchPopup');
  const announceEl = $('announce');
  const rosterEl = $('roster');
  const onlineCount = $('onlineCount');
  const legendEl = $('legend');
  const myStatsEl = $('myStats');
  const panelEl = $('panel');
  const panelToggle = $('panelToggle');
  const codexBtn = $('codexBtn');
  const codexMask = $('codexMask');
  const inspectMask = $('inspectMask');

  // ---- 状态 ----
  let ws = null;
  let myId = null;
  let myName = null;
  let fishTable = [];
  let rarityLabel = {};
  // 品质由低到高，前端用于图鉴分组与排序
  const RARITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold', 'red'];
  // 个人收集进度：{ fishId: 钓到次数 }，按名字存 localStorage
  let collection = {};
  // 客户端状态机：idle(空闲) -> waiting(已抛竿等咬钩) -> biting(上钩中) -> idle
  let state = 'idle';

  // ---- 登录 ----
  startBtn.addEventListener('click', tryJoin);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryJoin(); });

  function tryJoin() {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    myName = name;
    loadCollection();
    connect();
  }

  // ---- 个人图鉴收集进度（localStorage，按名字隔离）----
  function collectionKey() { return 'fishing.collection.' + myName; }
  function loadCollection() {
    try { collection = JSON.parse(localStorage.getItem(collectionKey())) || {}; }
    catch (_) { collection = {}; }
  }
  function recordCatch(fishId) {
    collection[fishId] = (collection[fishId] || 0) + 1;
    try { localStorage.setItem(collectionKey(), JSON.stringify(collection)); } catch (_) {}
  }

  // ---- WebSocket ----
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'join', name: myName }));
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }
      handle(msg);
    });

    ws.addEventListener('close', () => {
      setStatus('🔌 与服务器断开，正在重连…');
      setTimeout(() => { if (myName) connect(); }, 1500);
    });

    ws.addEventListener('error', () => { /* close 会随后触发重连 */ });
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  // ---- 服务器消息分发 ----
  function handle(msg) {
    switch (msg.type) {
      case 'welcome':
        fishTable = msg.fishTable || [];
        rarityLabel = msg.rarityLabel || {};
        renderLegend();
        break;

      case 'joined':
        myId = msg.id;
        enterGame();
        break;

      case 'casting':
        // 服务器确认抛竿，鱼在 waitMs 后咬钩（前端只显示等待，不知道是什么鱼）
        state = 'waiting';
        setStatus('🎣 静静等待鱼儿上钩…');
        break;

      case 'bite':
        // 上钩！鱼竿抖动，进入收杆窗口
        state = 'biting';
        onBite(msg.windowMs);
        break;

      case 'caught':
        state = 'idle';
        onResult(msg.fish, true);
        break;

      case 'escaped':
        state = 'idle';
        onResult(msg.fish, false);
        break;

      case 'miss':
        state = 'idle';
        resetRod();
        setStatus('🫥 还没上钩就收杆，空军了！');
        enableAction('cast');
        break;

      case 'roster':
        renderRoster(msg.players);
        break;

      case 'announce':
        showToast(msg.text);
        break;
    }
  }

  // ---- 进入游戏 ----
  function enterGame() {
    loginEl.classList.add('hidden');
    sceneEl.classList.remove('hidden');
    setStatus('点击下方按钮抛竿');
    enableAction('cast');
  }

  // ---- 操作按钮：抛竿 / 收杆 ----
  actionBtn.addEventListener('click', () => {
    if (state === 'idle') doCast();
    else if (state === 'biting') doReel();
    // waiting 状态下按钮其实是收杆（提前收=空军，交给服务器判定）
    else if (state === 'waiting') doReel();
  });

  function doCast() {
    send({ type: 'cast' });
    hidePopup();
    // 表现：放线、浮漂入水
    lineEl.classList.add('cast');
    actionBtn.disabled = true;
    actionBtn.textContent = '⏳ 等待中…';
  }

  function doReel() {
    send({ type: 'reel' });
    actionBtn.disabled = true;
  }

  function onBite(windowMs) {
    rodEl.classList.add('shake');
    statusEl.classList.add('bite');
    setStatus('‼️ 上钩了！快收杆！');
    enableAction('reel');
    // 不在前端做超时判定（服务器会发 escaped），但收杆按钮的紧迫动画用 windowMs 体现
  }

  function onResult(fish, success) {
    resetRod();
    if (success) {
      recordCatch(fish.id);
      setStatus(`钓到了 ${fish.emoji} ${fish.name}！`);
      // 金、红品质走特殊检视动画，其余走普通弹窗
      if (fish.rarity === 'gold' || fish.rarity === 'red') {
        showInspect(fish);
      } else {
        showCatch(fish, true);
      }
    } else {
      setStatus('💨 鱼跑了…手慢了！');
      showCatch(fish, false);
    }
    enableAction('cast');
  }

  // ---- 鱼竿/状态复位 ----
  function resetRod() {
    rodEl.classList.remove('shake');
    lineEl.classList.remove('cast');
    statusEl.classList.remove('bite');
  }

  function enableAction(mode) {
    actionBtn.disabled = false;
    if (mode === 'cast') {
      actionBtn.textContent = '🎣 抛竿';
      actionBtn.classList.remove('reel');
    } else {
      actionBtn.textContent = '🔥 收杆！';
      actionBtn.classList.add('reel');
    }
  }

  function setStatus(text) { statusEl.textContent = text; }

  // ---- 渔获弹窗 ----
  function showCatch(fish, success) {
    catchPopup.className = 'catch-popup' + (success ? '' : ' fail');
    if (success) {
      catchPopup.innerHTML = `
        <div class="c-emoji">${fish.emoji}</div>
        <div class="c-name">${fish.name}</div>
        <span class="c-rarity bg-${fish.rarity}">${fish.rarityLabel}</span>
        <div class="c-score">+${fish.score} 分</div>`;
    } else {
      catchPopup.innerHTML = `
        <div class="c-emoji">💨</div>
        <div class="c-name">跑掉了！</div>
        <div class="c-score">是一条 ${fish.rarityLabel}「${fish.name}」${fish.emoji}，下次手快点</div>`;
    }
    catchPopup.classList.remove('hidden');
    clearTimeout(showCatch._t);
    showCatch._t = setTimeout(hidePopup, 2200);
  }
  function hidePopup() { catchPopup.classList.add('hidden'); }

  // ---- 喜报 toast ----
  function showToast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    announceEl.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .5s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 500);
    }, 4000);
  }

  // ---- 在线玩家 / 排行榜 ----
  function renderRoster(players) {
    onlineCount.textContent = players.length;
    rosterEl.innerHTML = '';
    let me = null;

    players.forEach((p, i) => {
      const li = document.createElement('li');
      if (p.id === myId) { li.classList.add('me'); me = p; }
      const rankCls = i < 3 ? 'rank top' : 'rank';
      const rarestDot = p.rarest
        ? `<span class="badge bg-${p.rarest}" title="最高：${p.rarestLabel}"></span>`
        : '';
      const lastCatch = p.log && p.log[0]
        ? `${p.log[0].emoji} ${p.log[0].name}`
        : '还没开张';
      li.innerHTML = `
        <span class="${rankCls}">${i + 1}</span>
        <div class="pinfo">
          <div class="pname">${escapeHtml(p.name)} ${rarestDot}</div>
          <div class="pmeta"><span>🐟 ${p.catches}</span><span>${lastCatch}</span></div>
        </div>
        <span class="pscore">${p.score}</span>`;
      rosterEl.appendChild(li);
    });

    if (me) {
      const rank = players.findIndex((p) => p.id === myId) + 1;
      myStatsEl.innerHTML =
        `🎣 <b>${me.name}</b>　得分 <b>${me.score}</b>　渔获 <b>${me.catches}</b>　排名 <b>#${rank}</b>`;
    }
  }

  function renderLegend() {
    legendEl.innerHTML = RARITY_ORDER
      .map((r) => `<span class="lg"><span class="dot bg-${r}"></span>${rarityLabel[r] || r}</span>`)
      .join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // 稀有鱼有手绘 SVG 动图（fish-art.js），否则回退到 emoji 大字
  function fishArt(fish, fallbackEmoji) {
    const art = window.FISH_ART && window.FISH_ART[fish.id];
    if (art) return `<div class="fish-art">${art()}</div>`;
    return `<span class="fish-emoji-big">${fallbackEmoji}</span>`;
  }

  // ---- 图鉴 ----
  codexBtn.addEventListener('click', openCodex);

  function openCodex() {
    const total = fishTable.length;
    const owned = fishTable.filter((f) => collection[f.id]).length;

    let tiers = '';
    RARITY_ORDER.forEach((r) => {
      const fishes = fishTable.filter((f) => f.rarity === r);
      if (!fishes.length) return;
      const cells = fishes.map((f) => {
        const cnt = collection[f.id] || 0;
        const ownedCls = cnt ? 'owned' : 'locked';
        const cntBadge = cnt ? `<span class="cnt">×${cnt}</span>` : '';
        const lockIcon = cnt ? '' : '<span class="lockicon">❓</span>';
        const hasArt = window.FISH_ART && window.FISH_ART[f.id];
        // 已捕获且有手绘图的，展示 SVG 动图；否则 emoji
        const visual = cnt && hasArt
          ? `<div class="ce ce-art">${window.FISH_ART[f.id]()}</div>`
          : `<div class="ce">${f.emoji}</div>`;
        return `
          <div class="codex-cell ${ownedCls}" style="--cell-color:var(--rarity-${r})">
            ${cntBadge}
            ${visual}
            ${lockIcon}
            <div class="cn">${cnt ? escapeHtml(f.name) : '？？？'}</div>
            <div class="cs">${cnt ? f.score + ' 分' : '未捕获'}</div>
          </div>`;
      }).join('');
      tiers += `
        <div class="codex-tier">
          <div class="codex-tier-head" style="color:var(--rarity-${r})">
            <span class="dot bg-${r}"></span>${rarityLabel[r] || r}
            <span class="tier-rate">收杆窗口越短越难</span>
          </div>
          <div class="codex-grid">${cells}</div>
        </div>`;
    });

    codexMask.innerHTML = `
      <div class="codex">
        <div class="codex-top">
          <h2>📖 渔获图鉴</h2>
          <button class="codex-close" id="codexClose">×</button>
        </div>
        <div class="codex-progress">收集进度：<b>${owned}</b> / ${total} 种　·　品质由低到高：白 → 绿 → 蓝 → 紫 → 金 → 红</div>
        ${tiers}
      </div>`;
    codexMask.classList.remove('hidden');
    $('codexClose').addEventListener('click', closeCodex);
    codexMask.addEventListener('click', (e) => { if (e.target === codexMask) closeCodex(); });
  }
  function closeCodex() { codexMask.classList.add('hidden'); codexMask.innerHTML = ''; }

  // ---- 金/红品质特殊检视动画 ----
  function showInspect(fish) {
    inspectMask.className = 'inspect-mask ' + fish.rarity;
    inspectMask.innerHTML = `
      <div class="inspect-rays"></div>
      <div class="inspect-stage">
        <div class="inspect-ribbon">${fish.rarityLabel}</div>
        <div class="inspect-fish">${fishArt(fish, fish.emoji)}</div>
        <div class="inspect-name">${escapeHtml(fish.name)}</div>
        <div class="inspect-score">+${fish.score} 分</div>
        <div class="inspect-tip">点击任意处继续</div>
      </div>`;
    inspectMask.classList.remove('hidden');

    // 撒粒子
    spawnParticles(fish.rarity);

    const close = () => {
      inspectMask.classList.add('hidden');
      inspectMask.innerHTML = '';
      inspectMask.removeEventListener('click', close);
    };
    inspectMask.addEventListener('click', close);
    clearTimeout(showInspect._t);
    showInspect._t = setTimeout(close, 5000);
  }

  function spawnParticles(rarity) {
    const stage = inspectMask;
    for (let i = 0; i < 24; i++) {
      const p = document.createElement('div');
      p.className = 'inspect-particle';
      p.style.left = (15 + ((i * 71) % 70)) + '%';
      p.style.bottom = (20 + ((i * 37) % 30)) + '%';
      p.style.animationDuration = (1.2 + ((i * 29) % 18) / 10) + 's';
      p.style.animationDelay = ((i % 8) / 10) + 's';
      stage.appendChild(p);
    }
  }

  // ---- 面板收起 ----
  panelToggle.addEventListener('click', () => {
    panelEl.classList.toggle('collapsed');
    panelToggle.textContent = panelEl.classList.contains('collapsed') ? '展开' : '收起';
  });

  // 心跳，防止某些代理掐断空闲连接
  setInterval(() => send({ type: 'ping' }), 25000);
})();
