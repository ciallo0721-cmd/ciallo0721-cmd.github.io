/*!
 * warma-birthday.js — 每年 10 月 26 日限定：Warma 生日彩蛋
 * ------------------------------------------------------------
 * 触发规则（按优先级）：
 *   1. URL 带 ?warma=1  → 强制开启（预览用，写入 sessionStorage，
 *                        本次会话内翻页也生效；?warma=0 关闭并清除）
 *   2. sessionStorage 有 warma_bd=1 → 本次会话继续生效
 *   3. 当天是 10 月 26 日 → 自动开启（彩蛋本体）
 *   4. 其余 364 天 → 直接 return，对站点零影响
 *
 * 激活后做三件事：
 *   - 右上角浮出一张生日卡片（可关闭，不 sticky、不挡正文）
 *   - 全屏 canvas 撒一次彩带，之后维持一段时间的低密度飘落，20 秒后自然结束
 *   - 控制台留一行彩蛋提示
 *
 * 设计约束：
 *   - 单文件自包含，样式内联注入，不依赖任何外部 CSS
 *   - 尊重 prefers-reduced-motion：只出卡片，不撒彩带
 *   - 页面切到后台时暂停动画，回来继续（省 CPU）
 */
(function () {
  'use strict';

  /* ---------- 0. 防御重复注入 ---------- */
  if (window.__warmaBirthdayMounted) return;
  window.__warmaBirthdayMounted = true;

  /* ---------- 1. 判定今天是否过生日 ---------- */
  var now = new Date();
  var isBirthday = now.getMonth() === 9 && now.getDate() === 26; // 10 月 26 日
  var force = null;
  try { force = new URLSearchParams(location.search).get('warma'); } catch (e) {}

  var override = null;
  try {
    if (force === '1' || force === '0') {
      sessionStorage.setItem('warma_bd', force);
      override = force;
    } else {
      override = sessionStorage.getItem('warma_bd');
    }
  } catch (e) {}

  if (override === '0') return;                          // 明确要求关闭
  if (override !== '1' && !isBirthday) return;           // 平时安静躺好

  var CARD_KEY = 'warma_bd_card';
  var cardDismissed = false;
  try { cardDismissed = sessionStorage.getItem(CARD_KEY) === '0'; } catch (e) {}

  var COLORS = ['#FF8A3D', '#FFC93C', '#FF6B9D', '#7BD389', '#5BC0EB', '#FFB067'];

  function init() {
    injectStyle();
    if (!cardDismissed) mountCard();
    if (!prefersReducedMotion()) startConfetti();
    logEgg();
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  /* ---------- 2. 样式 ---------- */
  function injectStyle() {
    if (document.getElementById('wb-style')) return;
    var css =
      '.wb-canvas{position:fixed;top:0;left:0;width:100%;height:100%;' +
        'pointer-events:none;z-index:9998;}' +
      '.wb-card{position:fixed;top:16px;right:16px;z-index:9999;' +
        'width:min(310px,calc(100vw - 32px));box-sizing:border-box;' +
        'padding:14px 16px 13px;border-radius:14px;overflow:hidden;' +
        'background:#fff;border:1px solid #FFE0C2;' +
        'box-shadow:0 10px 30px rgba(255,138,61,.18),0 2px 8px rgba(15,23,42,.06);' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;' +
        'color:#0F172A;text-align:left;' +
        'animation:wb-in .42s cubic-bezier(.22,1,.36,1) both;}' +
      '.wb-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;' +
        'background:linear-gradient(90deg,#FF8A3D,#FFC93C,#FF6B9D,#7BD389,#5BC0EB);}' +
      '.wb-emoji{font-size:22px;line-height:1;margin-bottom:6px;}' +
      '.wb-title{font-size:15px;font-weight:700;letter-spacing:.2px;margin-bottom:4px;}' +
      '.wb-sub{font-size:12px;line-height:1.65;color:#475569;}' +
      '.wb-actions{display:flex;gap:8px;margin-top:11px;}' +
      '.wb-btn{padding:6px 12px;border-radius:999px;border:1px solid #E2E8F0;' +
        'background:#F8FAFC;color:#475569;font-size:12px;line-height:1.5;cursor:pointer;' +
        'font-family:inherit;transition:background .15s,border-color .15s,color .15s;}' +
      '.wb-btn:hover{background:#F1F5F9;border-color:#CBD5E1;color:#0F172A;}' +
      '.wb-btn-main{border-color:#FFB067;background:#FFF7EF;color:#C2530B;font-weight:600;}' +
      '.wb-btn-main:hover{background:#FFEEDD;border-color:#FF8A3D;color:#A94708;}' +
      '.wb-close{position:absolute;top:8px;right:10px;width:22px;height:22px;padding:0;' +
        'border:0;background:transparent;color:#94A3B8;font-size:16px;line-height:22px;' +
        'cursor:pointer;font-family:inherit;}' +
      '.wb-close:hover{color:#475569;}' +
      '@keyframes wb-in{from{opacity:0;transform:translateY(-10px) scale(.97);}' +
        'to{opacity:1;transform:none;}}' +
      /* 窄屏默认缩成小圆，点开才展开，避免压住正文 */
      '.wb-card.is-mini{width:54px;height:54px;padding:0;border-color:#FFB067;border-radius:50%;' +
        'background:#FFF7EF;display:flex;align-items:center;justify-content:center;cursor:pointer;' +
        'box-shadow:0 8px 20px rgba(255,138,61,.28);' +
        'animation:wb-in .42s cubic-bezier(.22,1,.36,1) both,wb-pulse 2.6s ease-in-out .5s infinite;}' +
      '.wb-card.is-mini>*{display:none;}' +
      '.wb-card.is-mini::before{display:none;}' +
      '.wb-card.is-mini::after{content:"🎂";font-size:25px;line-height:1;}' +
      '.wb-card.is-mini:hover{background:#FFEEDD;}' +
      '@keyframes wb-pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.07);}}' +
      '@media (max-width:480px){.wb-card{top:10px;right:10px;left:10px;width:auto;}' +
        /* 小圆挪到右下分享按钮上方，避开页头返回键 */
        '.wb-card.is-mini{top:auto;left:auto;bottom:100px;right:12px;width:54px;height:54px;}' +
        '.wb-card:not(.is-mini){max-height:calc(100vh - 20px);overflow:auto;}}' +
      '@media (prefers-reduced-motion: reduce){' +
        '.wb-card{animation:none;}.wb-card.is-mini{animation:none;}}';
    var style = document.createElement('style');
    style.id = 'wb-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ---------- 3. 右上角浮卡 ---------- */
  function mountCard() {
    var card = document.createElement('div');
    card.className = 'wb-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Warma 生日彩蛋');
    card.innerHTML =
      '<button class="wb-close" type="button" aria-label="关闭">×</button>' +
      '<div class="wb-emoji">🎂</div>' +
      '<div class="wb-title">Warmasama · 生日快乐</div>' +
      '<div class="wb-sub">10 月 26 日，本站在这一年里为她多点一次蜡烛。<br>' +
        '动画、手书、配音、实况、杂谈几乎一人全包的多面创作型 UP 主，' +
        '愿新的一岁脑洞常开喵。</div>' +
      '<div class="wb-actions">' +
        '<button class="wb-btn wb-btn-main" type="button" data-wb="burst">再撒一次 🎉</button>' +
        '<button class="wb-btn" type="button" data-wb="off">收起来了</button>' +
      '</div>';
    document.body.appendChild(card);
    if (window.innerWidth < 480) card.classList.add('is-mini');

    card.addEventListener('click', function (ev) {
      if (card.classList.contains('is-mini')) {
        card.classList.remove('is-mini');
        return;
      }
      var t = ev.target;
      var act = t && t.getAttribute && t.getAttribute('data-wb');
      if ((t && t.classList && t.classList.contains('wb-close')) || act === 'off') {
        dismiss();
        return;
      }
      if (act === 'burst' && window.__wbBurst) window.__wbBurst(70);
    });

    function dismiss() {
      try { sessionStorage.setItem(CARD_KEY, '0'); } catch (e) {}
      card.remove();
      if (window.__wbStopRain) window.__wbStopRain();
    }
  }

  /* ---------- 4. canvas 彩带 ---------- */
  function startConfetti() {
    var canvas = document.createElement('canvas');
    canvas.className = 'wb-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;

    var VW = 0, VH = 0, DPR = 1;
    var parts = [];
    var TARGET_RAIN = 32;               // 持续飘落的粒子数上限
    var rainUntil = Date.now() + 20000; // 20 秒后不再补新粒子
    var rafId = null;
    var lastTs = 0;
    var paused = false;

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      VW = window.innerWidth;
      VH = window.innerHeight;
      canvas.width = Math.floor(VW * DPR);
      canvas.height = Math.floor(VH * DPR);
      canvas.style.width = VW + 'px';
      canvas.style.height = VH + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    function makeParticle(fromTop) {
      var scale = VW < 600 ? 0.8 : 1; // 小屏粒子略小，别糊满屏
      return {
        x: Math.random() * VW,
        y: fromTop ? -20 - Math.random() * VH * 0.35 : -20 - Math.random() * 240,
        w: (5 + Math.random() * 6) * scale,
        h: (8 + Math.random() * 9) * scale,
        vx: (Math.random() - 0.5) * 46,
        vy: 55 + Math.random() * 95,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 4.2,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        dot: Math.random() < 0.22,
        sway: Math.random() * Math.PI * 2,
        swayAmp: 6 + Math.random() * 16,
        alpha: 0.85 + Math.random() * 0.15
      };
    }

    function burst(n) {
      for (var i = 0; i < n; i++) parts.push(makeParticle(true));
      rainUntil = Math.max(rainUntil, Date.now() + 8000);
      kick();
    }
    window.__wbBurst = burst;
    window.__wbStopRain = function () { rainUntil = 0; };

    function tick(ts) {
      rafId = null;
      if (paused) return;
      var dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016;
      lastTs = ts;

      ctx.clearRect(0, 0, VW, VH);

      var alive = 0;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.sway += dt * 2.2;
        p.x += (p.vx + Math.sin(p.sway) * p.swayAmp) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        if (p.y - p.h > VH + 40 || p.x < -80 || p.x > VW + 80) {
          // 还在飘落期内就重生到顶部，否则让粒子自然退场
          if (Date.now() < rainUntil && alive < TARGET_RAIN) {
            parts[alive++] = makeParticle(false);
          }
          continue;
        }
        parts[alive++] = p;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.dot) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      parts.length = alive;
      ctx.globalAlpha = 1;

      if (parts.length) {
        rafId = requestAnimationFrame(tick);
      } else {
        lastTs = 0;
      }
    }

    function kick() {
      if (paused || rafId !== null) return;
      rafId = requestAnimationFrame(tick);
    }

    // 开场：预置持续粒子 + 撒一大波
    for (var i = 0; i < TARGET_RAIN; i++) parts.push(makeParticle(false));
    burst(70);

    document.addEventListener('visibilitychange', function () {
      paused = document.hidden;
      if (paused && rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      } else if (!paused) {
        lastTs = 0;
        if (parts.length) kick();
      }
    });
  }

  /* ---------- 5. 控制台彩蛋 ---------- */
  function logEgg() {
    console.log(
      '%c🎂 10/26 Warmasama 生日快乐 🎂%c\n今天才发现彩蛋？地址栏加个 ?warma=1 也能随时重看。',
      'background:#FF8A3D;color:#fff;font-family:monospace;font-size:13px;padding:2px 6px;border-radius:4px;',
      'color:#C2530B;'
    );
  }

  /* ---------- 6. 挂载 ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
