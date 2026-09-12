/*!
 * consent-analytics.js — 本站 Cookie 与统计 统一同意面板
 *
 * 背景：
 *   本站既用 Cookie 记住偏好（英文界面提示、广告偏好、来源归因），也用
 *   Google Analytics 统计流量。二者都属于「应先征得同意」的范畴，因此不再
 *   静默写入，而是先问一句 —— 一个面板同时覆盖「本站 Cookie」与「GA4」。
 *
 * 策略（2026-09-12 改版，取代 2026-09-10 的单纯 GA4 同意条）：
 *   · 未表态 → 右下角浮出面板，此时一个 Google 请求都不发、
 *              非必要 Cookie（来源归因）一个都不写
 *   · 全部同意 → 注入 gtag.js（G-TR4FT7JPDZ）+ 允许写入非必要 Cookie
 *   · 仅必要   → 永不加载 GA4；只保留运行必需的 Cookie，并清理旧的归因记录
 *   · 已选择   → 180 天内不再打扰，直接按上次的选择执行
 *
 * 存储：
 *   决策写入 Cookie `cb_cookie_consent`（JSON: {choice,ts}），不再是 localStorage。
 *   老访客的 localStorage['cb_ga_consent'] 会自动迁移成 Cookie 并删除，避免重复打扰。
 *
 * 对外接口（供 gtag-config.js 等判断，需在本文件之后加载）：
 *   window.CB_Consent.get()     → '' | 'all' | 'necessary'
 *   window.CB_Consent.isAll()   → true 表示允许非必要 Cookie
 *   window.CB_Consent.onDecide(fn) → 用户做出选择时回调 fn(choice)
 *   window.CB_Consent.open()    → 手动重新呼出面板（改主意时用）
 *   事件：document 上派发 'cb-consent-decided'（detail.choice）与 'cb-consent-closed'
 *
 * 接入方式：
 *   head 中先定义 gtag 队列，再引入本文件（同步引入，别用 defer，尽量早决策）：
 *     <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());</script>
 *     <script src="./js/js/consent-analytics.js"></script>
 *
 * 调试：URL 加 ?ga_consent_test=1 可跳过本地记录强制展示面板（墙内/老访客均可预览）
 *
 * 创建日期：2026-09-10 ｜ 改版：2026-09-12
 */
(function () {
  'use strict';

  var CFG = {
    gaID: 'G-TR4FT7JPDZ',
    gaSrc: 'https://www.googletagmanager.com/gtag/js?id=G-TR4FT7JPDZ',

    cookieName: 'cb_cookie_consent',   // 决策存储（Cookie）
    legacyKey: 'cb_ga_consent',        // 旧版 localStorage 键，自动迁移后删除
    barID: 'cb-consent',
    keepDays: 180,                     // 决策保留天数；0 表示永久
    showDelay: 500                     // 页面加载后延迟弹出，避免抢首屏
  };

  // 调试开关：?ga_consent_test=1
  var TEST = /[?&]ga_consent_test=1/.test(location.search);

  /* ==================== Cookie 读写 ==================== */

  function ckGet(name) {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function ckSet(name, value, days) {
    var exp = days > 0 ? new Date(Date.now() + days * 86400000).toUTCString() : 'Fri, 31 Dec 9999 23:59:59 GMT';
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; Path=/; Expires=' + exp + '; SameSite=Lax' + secure;
  }

  function ckDel(name) {
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = name + '=; Path=/; Max-Age=0; SameSite=Lax' + secure;
  }

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
      var raw = ckGet(CFG.cookieName);
      if (!raw) return '';
      var o = JSON.parse(raw);
      if (!o || !o.choice) return '';
      if (CFG.keepDays > 0 && o.ts && Date.now() - o.ts > CFG.keepDays * 86400000) return '';
      return o.choice;               // 'all' | 'necessary'
    } catch (e) {
      return '';
    }
  }

  function saveDecision(choice) {
    try {
      ckSet(CFG.cookieName, JSON.stringify({ choice: choice, ts: Date.now() }), CFG.keepDays);
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  // 老访客迁移：localStorage 的旧 GA4 决策 → Cookie，迁移后删掉旧的
  function migrateLegacy() {
    if (TEST) return;
    try {
      var raw = localStorage.getItem(CFG.legacyKey);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && o.choice) {
        saveDecision(o.choice === 'granted' ? 'all' : 'necessary');
      }
      localStorage.removeItem(CFG.legacyKey);
    } catch (e) { /* 忽略 */ }
  }

  /* ==================== 对外接口 ==================== */

  window.CB_Consent = {
    get: readDecision,
    isAll: function () { return readDecision() === 'all'; },
    onDecide: function (fn) {
      document.addEventListener('cb-consent-decided', function (e) {
        try { fn(e.detail && e.detail.choice); } catch (err) {}
      });
    },
    open: function () { show(); }      // 改主意时手动呼出
  };

  /* ==================== 决策执行 ==================== */

  function applyDecision(choice) {
    if (choice === 'all') {
      loadGA();                        // 同意 → 加载 GA4，dataLayer 里排队的事件会一并上报
    } else if (choice === 'necessary') {
      // 仅必要：清掉旧的来源归因记录，不留下已声明不保存的数据
      try { localStorage.removeItem('site_user_from'); } catch (e) {}
      document.cookie = 'site_user_from=; Path=/; Max-Age=0; SameSite=Lax';
    }
  }

  migrateLegacy();

  var decision = TEST ? '' : readDecision();
  if (decision) {
    applyDecision(decision);
    return;                            // 已表态：不弹面板
  }

  /* ==================== 面板 UI（卡片式，与站点同套海青令牌） ==================== */

  var CSS =
    '#' + CFG.barID + '{position:fixed;left:50%;bottom:22px;z-index:99997;box-sizing:border-box;' +
      'width:min(560px,calc(100vw - 32px));padding:18px 20px;border-radius:18px;' +
      'background:rgba(255,255,255,.96);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);' +
      'border:1px solid rgba(14,165,233,.22);box-shadow:0 16px 40px rgba(15,23,42,.16);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;' +
      'line-height:1.6;opacity:0;transform:translate(-50%,16px);' +
      'transition:opacity .4s ease,transform .4s ease,bottom .35s ease;}' +
    '#' + CFG.barID + '.on{opacity:1;transform:translate(-50%,0);}' +
    '#' + CFG.barID + ' .cbc-t{font-size:.98rem;font-weight:600;color:#0F172A;margin-bottom:6px;' +
      'display:flex;align-items:center;gap:7px;}' +
    '#' + CFG.barID + ' .cbc-t i{color:#0284C7;font-style:normal;}' +
    '#' + CFG.barID + ' .cbc-d{font-size:.83rem;color:#475569;}' +
    '#' + CFG.barID + ' .cbc-d a{color:#0284C7;text-decoration:none;border-bottom:1px solid rgba(14,165,233,.35);}' +
    '#' + CFG.barID + ' .cbc-more{margin-top:9px;font-size:.79rem;}' +
    '#' + CFG.barID + ' .cbc-more summary{cursor:pointer;color:#0284C7;list-style:none;display:inline-block;}' +
    '#' + CFG.barID + ' .cbc-more summary::-webkit-details-marker{display:none;}' +
    '#' + CFG.barID + ' .cbc-more summary::before{content:"▸ ";}' +
    '#' + CFG.barID + ' .cbc-more[open] summary::before{content:"▾ ";}' +
    '#' + CFG.barID + ' .cbc-more ul{margin:8px 0 0;padding-left:18px;color:#64748B;}' +
    '#' + CFG.barID + ' .cbc-more li{margin:3px 0;}' +
    '#' + CFG.barID + ' .cbc-more code{font-size:.94em;color:#0C4A6E;background:#F1F5F9;' +
      'padding:1px 5px;border-radius:4px;}' +
    '#' + CFG.barID + ' .cbc-btns{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;}' +
    '#' + CFG.barID + ' button{border:none;cursor:pointer;font-family:inherit;font-size:.83rem;' +
      'padding:9px 20px;border-radius:22px;transition:opacity .2s ease,transform .2s ease;}' +
    '#' + CFG.barID + ' .cbc-ok{flex:1;min-width:112px;font-weight:600;color:#fff;background:#0284C7;' +
      'box-shadow:0 4px 14px rgba(2,132,199,.28);}' +
    '#' + CFG.barID + ' .cbc-no{color:#475569;background:rgba(15,23,42,.06);}' +
    '#' + CFG.barID + ' button:hover{opacity:.88;}' +
    '#' + CFG.barID + ' button:active{transform:scale(.97);}' +
    '@media (max-width:560px){#' + CFG.barID + '{padding:15px 16px;bottom:16px;}' +
      '#' + CFG.barID + ' .cbc-d{font-size:.79rem;}' +
      '#' + CFG.barID + ' .cbc-btns button{flex:1;padding:9px 12px;}}';

  var BODY =
    '<div class="cbc-t"><i>🍪</i>本站 Cookie 与统计</div>' +
    '<div class="cbc-d">本站用 Cookie 记住你的偏好、并以 Google Analytics 统计访问情况。' +
      '选择「仅必要」将只保留运行必需的记录，Analytics 不会启动。' +
      '详见 <a href="/doc/all.html#sec-cookie">Cookie 与本地存储</a>。</div>' +
    '<details class="cbc-more"><summary>查看 Cookie 明细</summary><ul>' +
      '<li><b>必要</b>：<code>cb_cookie_consent</code> 同意记录、<code>cb_en_hint</code> 英文界面偏好、<code>cb_userid</code> 访客标识（图片水印用）</li>' +
      '<li><b>功能</b>：<code>ciallo_ad_prefs</code> 广告偏好、<code>turnstile_pass</code> 人机验证</li>' +
      '<li><b>统计</b>：Google Analytics（<code>_ga</code> 等），选择「仅必要」即停用</li>' +
      '</ul></details>' +
    '<div class="cbc-btns">' +
      '<button type="button" class="cbc-ok">全部同意</button>' +
      '<button type="button" class="cbc-no">仅必要</button>' +
    '</div>';

  function closeBar(box) {
    box.className = '';
    setTimeout(function () {
      if (box.parentNode) box.parentNode.removeChild(box);
      // 通知其他浮动组件（如英文提示条）复位位置
      document.dispatchEvent(new CustomEvent('cb-consent-closed'));
    }, 500);
  }

  function decide(box, choice) {
    if (!TEST) saveDecision(choice);
    applyDecision(choice);
    // 先通知外部（gtag-config 等按需写入非必要 Cookie），再收起面板
    document.dispatchEvent(new CustomEvent('cb-consent-decided', { detail: { choice: choice } }));
    closeBar(box);
  }

  function show() {
    if (document.getElementById(CFG.barID)) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);

    var box = document.createElement('div');
    box.id = CFG.barID;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '本站 Cookie 与统计使用同意');
    box.innerHTML = BODY;
    document.body.appendChild(box);

    setTimeout(function () { box.className = 'on'; }, 60);

    box.querySelector('.cbc-ok').addEventListener('click', function () { decide(box, 'all'); });
    box.querySelector('.cbc-no').addEventListener('click', function () { decide(box, 'necessary'); });
  }

  setTimeout(function () {
    if (document.body) {
      show();
    } else {
      document.addEventListener('DOMContentLoaded', show);
    }
  }, CFG.showDelay);
})();
