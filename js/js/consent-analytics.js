/*!
 * consent-analytics.js — GA4 同意提示条
 *
 * 背景：
 *   Google Analytics 会写入 Cookie 追踪访客，属于「需要征得同意」的分析工具。
 *   因此本站不再一进页面就加载 gtag.js，而是先问一句，同意后再加载。
 *
 * 策略（2026-09-10 定）：
 *   · 未表态 → 底部弹出提示条，此时一个请求都不发往 Google
 *   · 同意   → 注入 gtag.js（G-TR4FT7JPDZ），完整 GA4 统计
 *   · 拒绝   → 永不加载 GA4；站点仅保留 Umami 的无 Cookie 匿名访问计数
 *              （Umami 在 index.html 中独立加载，不写 Cookie、不采集个人标识）
 *   · 已选择 → 180 天内不再打扰，直接按上次的选择执行
 *
 * 为什么可以延迟加载而不丢数据：
 *   head 里已定义 window.gtag 队列（push 到 dataLayer），gtag-config.js 发出的
 *   page_view 等事件会先排队；gtag.js 注入后 Google 会自动消费队列 —— 这正是
 *   官方异步 snippet 的工作原理，同意后的首屏事件同样能上报。
 *
 * 接入方式：
 *   head 中先定义 gtag 队列，再引入本文件（同步引入，别用 defer，尽量早决策）：
 *     <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());</script>
 *     <script src="./js/js/consent-analytics.js"></script>
 *
 * 调试：URL 加 ?ga_consent_test=1 可跳过本地记录强制展示提示条（墙内/老访客均可预览）
 *
 * 创建日期：2026-09-10
 */
(function () {
  'use strict';

  var CFG = {
    gaID: 'G-TR4FT7JPDZ',
    gaSrc: 'https://www.googletagmanager.com/gtag/js?id=G-TR4FT7JPDZ',
    storeKey: 'cb_ga_consent',
    barID: 'cb-consent',
    keepDays: 180,        // 选择保留时长（天）；设为 0 表示永久
    showDelay: 500        // 页面加载后延迟弹出，避免抢首屏
  };

  // 调试开关：?ga_consent_test=1
  var TEST = /[?&]ga_consent_test=1/.test(location.search);

  /* ==================== 前置判断 ==================== */

  // 翻译代理域名下不弹（脚本会被翻译框架二次执行，避免套娃）
  if (location.hostname.indexOf('translate.goog') !== -1) return;

  // 爬虫 / 无头环境跳过（爬虫不写 Cookie，也不该被弹窗干扰收录）
  if (!TEST && /bot|crawler|spider|crawl|googlebot|bingbot|baiduspider|headless/i.test(navigator.userAgent || '')) return;

  var gaLoaded = false;

  /* ==================== GA4 加载 ==================== */

  function loadGA() {
    if (gaLoaded) return;
    gaLoaded = true;
    try {
      var s = document.createElement('script');
      s.async = true;
      s.src = CFG.gaSrc;
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { /* 加载失败不影响页面 */ }
  }

  /* ==================== 决策读写 ==================== */

  function readDecision() {
    try {
      var raw = localStorage.getItem(CFG.storeKey);
      if (!raw) return '';
      var o = JSON.parse(raw);
      if (!o || !o.choice) return '';
      if (CFG.keepDays > 0 && o.ts && Date.now() - o.ts > CFG.keepDays * 86400000) return '';
      return o.choice;               // 'granted' | 'denied'
    } catch (e) {
      return '';
    }
  }

  function saveDecision(choice) {
    try {
      localStorage.setItem(CFG.storeKey, JSON.stringify({ choice: choice, ts: Date.now() }));
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  // 老访客：按已有选择直接执行，不弹条
  var decision = TEST ? '' : readDecision();
  if (decision === 'granted') {
    loadGA();
    return;
  }
  if (decision === 'denied') {
    return;                          // 已拒绝过：不加载 GA4，也不再打扰
  }

  /* ==================== 提示条 UI ==================== */

  var CSS =
    '#' + CFG.barID + '{position:fixed;left:0;right:0;bottom:0;z-index:99997;box-sizing:border-box;' +
      'padding:14px 22px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px 18px;' +
      'background:rgba(255,255,255,.96);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
      'border-top:1px solid rgba(236,72,153,.2);box-shadow:0 -6px 24px rgba(120,60,110,.12);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;' +
      'transform:translateY(100%);transition:transform .45s ease;}' +
    '#' + CFG.barID + '.on{transform:translateY(0);}' +
    '#' + CFG.barID + ' .cbc-txt{font-size:.82rem;color:#4a4f60;line-height:1.65;max-width:660px;}' +
    '#' + CFG.barID + ' .cbc-txt b{color:#1f2233;font-weight:600;}' +
    '#' + CFG.barID + ' .cbc-txt a{color:#ec4899;text-decoration:none;border-bottom:1px solid rgba(236,72,153,.35);}' +
    '#' + CFG.barID + ' .cbc-btns{display:flex;gap:8px;flex-shrink:0;}' +
    '#' + CFG.barID + ' button{border:none;cursor:pointer;font-family:inherit;font-size:.82rem;' +
      'padding:9px 18px;border-radius:22px;transition:opacity .2s ease,transform .2s ease;}' +
    '#' + CFG.barID + ' .cbc-ok{font-weight:600;color:#fff;background:linear-gradient(135deg,#ec4899,#2575fc);' +
      'box-shadow:0 4px 14px rgba(236,72,153,.32);}' +
    '#' + CFG.barID + ' .cbc-no{color:#7b8093;background:rgba(0,0,0,.05);}' +
    '#' + CFG.barID + ' button:hover{opacity:.88;}' +
    '#' + CFG.barID + ' button:active{transform:scale(.97);}' +
    '@media (max-width:560px){#' + CFG.barID + '{padding:12px 16px;gap:8px;}' +
      '#' + CFG.barID + ' .cbc-txt{font-size:.78rem;}' +
      '#' + CFG.barID + ' .cbc-btns{width:100%;justify-content:center;}}';

  var BODY =
    '<div class="cbc-txt"><b>允许使用 Google Analytics 吗？</b>' +
      '它通过 Cookie 记录访问与来源，用于统计站点流量。拒绝则停用 GA4，' +
      '站点仅保留无 Cookie 的匿名访问计数。详见 <a href="/doc/privacy.html">隐私政策</a>。</div>' +
    '<div class="cbc-btns">' +
      '<button type="button" class="cbc-ok">同意</button>' +
      '<button type="button" class="cbc-no">不用了</button>' +
    '</div>';

  function closeBar(box) {
    box.className = '';
    setTimeout(function () {
      if (box.parentNode) box.parentNode.removeChild(box);
      // 通知其他浮动组件（如英文提示条）复位位置
      document.dispatchEvent(new CustomEvent('cb-consent-closed'));
    }, 500);
  }

  function show() {
    if (document.getElementById(CFG.barID)) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);

    var box = document.createElement('div');
    box.id = CFG.barID;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Google Analytics 使用同意');
    box.innerHTML = BODY;
    document.body.appendChild(box);

    setTimeout(function () { box.className = 'on'; }, 60);

    box.querySelector('.cbc-ok').addEventListener('click', function () {
      if (!TEST) saveDecision('granted');
      loadGA();                       // 同意 → 加载 GA4，dataLayer 里排队的事件会一并上报
      closeBar(box);
    });

    box.querySelector('.cbc-no').addEventListener('click', function () {
      if (!TEST) saveDecision('denied');
      closeBar(box);                  // 拒绝 → 不加载 GA4（Umami 匿名计数不受影响）
    });
  }

  setTimeout(function () {
    if (document.body) {
      show();
    } else {
      document.addEventListener('DOMContentLoaded', show);
    }
  }, CFG.showDelay);
})();
