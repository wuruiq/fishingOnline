/* ========================================================================
   稀有鱼种的手绘动画图（内联 SVG + SMIL 自带动画）
   仅为金/红品质的 6 种鱼绘制精美动图，用于「检视动画」和「图鉴」。
   每个函数返回一段 SVG 字符串；viewBox 统一 0 0 200 160。
   普通鱼仍用 emoji，保持轻量。
   ======================================================================== */
(function () {
  'use strict';

  // 通用：水中气泡（多用于背景点缀）
  function bubbles(color) {
    return `
      <g fill="${color}" opacity="0.5">
        <circle cx="30" cy="120" r="3">
          <animate attributeName="cy" values="120;20" dur="3s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;.6;0" dur="3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="170" cy="130" r="4">
          <animate attributeName="cy" values="130;30" dur="3.6s" begin="0.6s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;.5;0" dur="3.6s" begin="0.6s" repeatCount="indefinite"/>
        </circle>
        <circle cx="150" cy="120" r="2.5">
          <animate attributeName="cy" values="120;25" dur="2.8s" begin="1.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;.6;0" dur="2.8s" begin="1.2s" repeatCount="indefinite"/>
        </circle>
      </g>`;
  }

  /**
   * 通用大鱼模板：一条造型简洁的大鱼，靠传入的颜色染色。
   * opt: { id, light, mid, dark, stroke, bubble, halo, sparkle }
   *   light/mid/dark 组成身体渐变；stroke 描边；其余为点缀色。
   */
  function bigFish(opt) {
    const g = `g_${opt.id}`;
    return `
      <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${g}b" x1="0" y1="0" x2="0.5" y2="1">
            <stop offset="0" stop-color="${opt.light}"/>
            <stop offset="0.55" stop-color="${opt.mid}"/>
            <stop offset="1" stop-color="${opt.dark}"/>
          </linearGradient>
          <radialGradient id="${g}h" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="${opt.halo}" stop-opacity="0.55"/>
            <stop offset="1" stop-color="${opt.halo}" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="100" cy="80" r="80" fill="url(#${g}h)"/>
        ${bubbles(opt.bubble)}
        <g transform="translate(102 80)">
          <!-- 整体上下浮游（相对位移，叠加在基准 translate 之上） -->
          <animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0" dur="3.4s" repeatCount="indefinite" additive="sum"/>

          <!-- 大扇形尾鳍（摆动） -->
          <path d="M-48 0 Q-86 -34 -92 -38 Q-78 0 -92 38 Q-86 34 -48 0 Z"
                fill="url(#${g}b)" opacity="0.9">
            <animateTransform attributeName="transform" type="rotate" values="-9 -48 0;9 -48 0;-9 -48 0" dur="1.8s" repeatCount="indefinite"/>
          </path>

          <!-- 背鳍 -->
          <path d="M-22 -30 Q4 -56 30 -30 Q6 -30 -22 -30 Z" fill="url(#${g}b)" opacity="0.85">
            <animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="2.2s" repeatCount="indefinite"/>
          </path>
          <!-- 腹鳍 -->
          <path d="M-10 26 Q0 50 22 44 Q8 30 0 26 Z" fill="url(#${g}b)" opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" values="6 0 26;-10 0 26;6 0 26" dur="1.8s" repeatCount="indefinite"/>
          </path>

          <!-- 身体（大） -->
          <ellipse cx="0" cy="0" rx="58" ry="36" fill="url(#${g}b)" stroke="${opt.stroke}" stroke-width="2"/>

          <!-- 鳞片高光纹 -->
          <path d="M-26 -18 q14 18 0 36 M-4 -22 q16 22 0 44 M18 -18 q14 18 0 36 M38 -12 q10 12 0 24"
                stroke="#ffffff" stroke-width="1.2" fill="none" opacity="0.4"/>

          <!-- 头部分隔 + 眼 -->
          <path d="M40 -22 Q50 0 40 22" stroke="${opt.stroke}" stroke-width="1.5" fill="none" opacity="0.5"/>
          <circle cx="46" cy="-8" r="7" fill="#fff" stroke="${opt.stroke}" stroke-width="1"/>
          <circle cx="48" cy="-8" r="3.4" fill="#1a1a1a"/>
          <circle cx="49.5" cy="-9.5" r="1.2" fill="#fff"/>
          <!-- 微笑嘴 -->
          <path d="M48 8 Q56 12 58 6" stroke="${opt.stroke}" stroke-width="1.8" fill="none" stroke-linecap="round"/>

          ${opt.sparkle ? `
          <g fill="${opt.sparkle}">
            <path d="M-14 -20 l2.4 7 l7 2.4 l-7 2.4 l-2.4 7 l-2.4 -7 l-7 -2.4 l7 -2.4 Z"><animate attributeName="opacity" values="0;1;0" dur="1.9s" repeatCount="indefinite"/></path>
            <path d="M22 16 l1.8 5 l5 1.8 l-5 1.8 l-1.8 5 l-1.8 -5 l-5 -1.8 l5 -1.8 Z"><animate attributeName="opacity" values="0;1;0" dur="2.3s" begin=".7s" repeatCount="indefinite"/></path>
          </g>` : ''}
        </g>
      </svg>`;
  }

  const ART = {
    // 河豚 —— 鼓气一胀一缩，尖刺，憨态
    pufferfish: () => `
      <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="pufBody" cx="40%" cy="35%" r="70%">
            <stop offset="0" stop-color="#ffe9a8"/><stop offset="0.6" stop-color="#f6c453"/><stop offset="1" stop-color="#d99728"/>
          </radialGradient>
        </defs>
        ${bubbles('#fff3c4')}
        <g transform="translate(100 82)">
          <g>
            <animateTransform attributeName="transform" type="scale" values="1;1.12;1" dur="2.4s" repeatCount="indefinite" additive="sum"/>
            <!-- 尖刺 -->
            <g fill="#e7a93a">
              ${Array.from({length: 16}).map((_, i) => {
                const a = (i / 16) * Math.PI * 2;
                const x1 = Math.cos(a) * 44, y1 = Math.sin(a) * 44;
                const x2 = Math.cos(a) * 60, y2 = Math.sin(a) * 60;
                const px = Math.cos(a + 0.12) * 44, py = Math.sin(a + 0.12) * 44;
                return `<path d="M${x1} ${y1} L${x2} ${y2} L${px} ${py} Z"/>`;
              }).join('')}
            </g>
            <circle r="46" fill="url(#pufBody)" stroke="#c8821f" stroke-width="2"/>
            <!-- 肚皮纹 -->
            <ellipse cx="0" cy="20" rx="34" ry="20" fill="#fff6dd" opacity="0.7"/>
            <!-- 眼睛 -->
            <circle cx="-16" cy="-10" r="9" fill="#fff"/><circle cx="-14" cy="-9" r="4.5" fill="#222"/>
            <circle cx="16" cy="-10" r="9" fill="#fff"/><circle cx="18" cy="-9" r="4.5" fill="#222"/>
            <!-- 嘟嘴 -->
            <path d="M-7 12 Q0 20 7 12 Q0 16 -7 12 Z" fill="#d2691e"/>
          </g>
        </g>
      </svg>`,

    // 黄金鱼 —— 金光闪烁，长尾摆动
    goldfish: () => `
      <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="goldB" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#fff4c2"/><stop offset="0.5" stop-color="#f5c518"/><stop offset="1" stop-color="#caa106"/>
          </linearGradient>
        </defs>
        ${bubbles('#fff0b8')}
        <g transform="translate(95 80)">
          <!-- 尾鳍 -->
          <g transform="translate(-40 0)">
            <path d="M0 0 Q-46 -30 -58 -34 Q-40 0 -58 34 Q-46 30 0 0 Z" fill="url(#goldB)" opacity="0.92">
              <animateTransform attributeName="transform" type="rotate" values="-8 0 0;8 0 0;-8 0 0" dur="1.4s" repeatCount="indefinite"/>
            </path>
          </g>
          <!-- 身体 -->
          <ellipse cx="0" cy="0" rx="48" ry="30" fill="url(#goldB)" stroke="#b8860b" stroke-width="2"/>
          <!-- 鳞片高光 -->
          <path d="M-20 -16 q14 16 0 32 M0 -22 q16 22 0 44 M20 -16 q14 16 0 32" stroke="#fff" stroke-width="1.5" fill="none" opacity="0.4"/>
          <!-- 背鳍 -->
          <path d="M-6 -28 Q6 -50 26 -30 Q14 -28 -6 -28 Z" fill="#e6b800"/>
          <!-- 眼 -->
          <circle cx="30" cy="-6" r="7" fill="#fff"/><circle cx="32" cy="-6" r="3.5" fill="#1a1a1a"/>
          <!-- 闪光 -->
          <g opacity="0">
            <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/>
            <path d="M-6 -8 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 l9 -3 Z" fill="#fffbe6" transform="translate(6 -2)"/>
          </g>
        </g>
      </svg>`,

    // 黄金章鱼 —— 触手波动
    octopus: () => `
      <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="octB" cx="45%" cy="30%" r="70%">
            <stop offset="0" stop-color="#ffe9a8"/><stop offset="0.7" stop-color="#eab308"/><stop offset="1" stop-color="#a8780a"/>
          </radialGradient>
        </defs>
        ${bubbles('#fff0b8')}
        <g transform="translate(100 70)">
          <!-- 触手 -->
          <g stroke="url(#octB)" stroke-width="9" stroke-linecap="round" fill="none">
            ${[-36, -22, -8, 8, 22, 36].map((x, i) => `
              <path d="M${x} 22 q${x < 0 ? -10 : 10} 28 ${x < 0 ? -4 : 4} 52">
                <animate attributeName="d"
                  values="M${x} 22 q${x<0?-10:10} 28 ${x<0?-4:4} 52;M${x} 22 q${x<0?-2:2} 30 ${x<0?-14:14} 50;M${x} 22 q${x<0?-10:10} 28 ${x<0?-4:4} 52"
                  dur="${2 + i * 0.2}s" repeatCount="indefinite"/>
              </path>`).join('')}
          </g>
          <!-- 头 -->
          <path d="M-42 6 Q-42 -52 0 -52 Q42 -52 42 6 Q20 26 0 26 Q-20 26 -42 6 Z" fill="url(#octB)" stroke="#9a6c08" stroke-width="2"/>
          <circle cx="-16" cy="-10" r="8" fill="#fff"/><circle cx="-15" cy="-9" r="4" fill="#222"/>
          <circle cx="16" cy="-10" r="8" fill="#fff"/><circle cx="17" cy="-9" r="4" fill="#222"/>
          <path d="M-8 8 Q0 14 8 8" stroke="#7a5408" stroke-width="2" fill="none"/>
        </g>
      </svg>`,

    // 彩色锦鲤 —— 简洁大鱼，红白染色
    koi: () => bigFish({
      id: 'koi',
      light: '#ffffff', mid: '#ffb3b8', dark: '#ef4444',
      stroke: '#d92b3a', bubble: '#ffd6d6', halo: '#ffd0d0',
      sparkle: '',
    }),

    // 锦鲤之王 —— 同款大鱼，金色染色 + 流光星点
    dragon: () => bigFish({
      id: 'king',
      light: '#fff6cf', mid: '#f7c948', dark: '#e0851f',
      stroke: '#c2410c', bubble: '#ffe1a8', halo: '#ffe39a',
      sparkle: '#fffbe6',
    }),

    // 深海鲸王 —— 巨鲸喷水，鱼鳍摆动
    whale: () => `
      <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="whB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#3b82f6"/><stop offset="0.6" stop-color="#1d4ed8"/><stop offset="1" stop-color="#0b2a6b"/>
          </linearGradient>
        </defs>
        ${bubbles('#bcdcff')}
        <!-- 喷水柱 -->
        <g transform="translate(70 44)">
          <path d="M0 0 Q-6 -26 0 -40 Q6 -26 0 0 Z" fill="#bcdcff" opacity="0.8">
            <animateTransform attributeName="transform" type="scale" values="1 0.4;1 1;1 0.4" dur="2.2s" repeatCount="indefinite" additive="sum"/>
          </path>
          <circle cx="-4" cy="-40" r="3" fill="#dbeafe"><animate attributeName="cy" values="-40;-54" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="2.2s" repeatCount="indefinite"/></circle>
          <circle cx="5" cy="-36" r="2.5" fill="#dbeafe"><animate attributeName="cy" values="-36;-50" dur="2.2s" begin=".3s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="2.2s" begin=".3s" repeatCount="indefinite"/></circle>
        </g>
        <g transform="translate(100 92)">
          <!-- 尾鳍 -->
          <path d="M-62 0 Q-92 -22 -98 -28 Q-86 0 -98 26 Q-92 20 -62 0 Z" fill="url(#whB)">
            <animateTransform attributeName="transform" type="rotate" values="-8 -62 0;8 -62 0;-8 -62 0" dur="2s" repeatCount="indefinite"/>
          </path>
          <!-- 身体 -->
          <path d="M-64 0 Q-40 -40 20 -36 Q66 -32 64 0 Q66 30 18 32 Q-40 36 -64 0 Z" fill="url(#whB)" stroke="#0b2a6b" stroke-width="2"/>
          <!-- 腹部浅色 -->
          <path d="M-50 10 Q-10 34 50 20 Q40 30 10 31 Q-40 34 -50 10 Z" fill="#9ec6ff" opacity="0.75"/>
          <!-- 胸鳍 -->
          <path d="M-6 18 Q-2 38 16 36 Q4 24 -6 18 Z" fill="#15357a">
            <animateTransform attributeName="transform" type="rotate" values="-6 -2 20;8 -2 20;-6 -2 20" dur="2s" repeatCount="indefinite"/>
          </path>
          <!-- 眼 + 微笑 -->
          <circle cx="40" cy="-6" r="5" fill="#fff"/><circle cx="41" cy="-6" r="2.6" fill="#06121f"/>
          <path d="M30 12 Q44 20 58 10" stroke="#0b2a6b" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        </g>
      </svg>`,
  };

  // 暴露到全局，供 game.js 取用
  window.FISH_ART = ART;
})();
