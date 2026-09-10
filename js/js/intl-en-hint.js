/*!
 * intl-en-hint.js — 海外访客「英文界面」提示条
 *
 * 用途：
 *   探测访客是否处于墙外（能否直连 YouTube），若是，则在页面右下角滑入
 *   一条「切换到英文界面」的提示。用户主动点击才跳转到 Google 翻译代理版，
 *   不自动重定向，墙内访客完全无感。
 *
 * 行为：
 *   1. 探测失败 / 超时（墙内）→ 静默退出，不产生 DOM、不再发请求
 *   2. 探测成功（墙外）→ 右下角滑入提示条（可关闭，不挡内容）
 *        · Switch to English → 跳转 translate.goog 英文版
 *        · No, thanks         → 关闭，30 天内不再提示
 *   3. 爬虫 UA 直接跳过（插件/Googlebot 从美国 IP 抓取，不应被弹窗干扰）
 *   4. 已在 translate.goog 域名下直接退出，避免「翻译页再弹提示」的套娃
 *
 * 接入方式（放在 tracking.js 之后）：
 *   <script src="./js/js/intl-en-hint.js" defer></script>
 *
 * 依赖：可选依赖 window.CB_Tracking.userid 取访客 ID，
 *       取不到时回退到 fallbackUserID，不影响功能。
 *
 * 创建日期：2026-09-10
 */
(function () {
  'use strict';

  var CFG = {
    // Google 翻译代理版（translate.goog 会把 ciallo0721-cmd.top 写成 ciallo0721--cmd-top）
    targetBase: 'https://ciallo0721--cmd-top.translate.goog/',
    // 翻译参数 + 渠道参数；userid 会动态替换为当前访客 ID
    targetQuery: '?_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=zh-CN&_x_tr_pto=wapp&from=cn&touch=false&userid=',
    fallbackUserID: 'cialloblog-10-1a85-2026',

    probeFetch: 'https://www.youtube.com/generate_204', // 连通性探测（no-cors）
    probeImg: 'https://www.youtube.com/favicon.ico',    // 兜底探测（img 不受 CORS 限制）
    probeTimeout: 3000,   // 探测总超时（毫秒），墙内用户不干等
    showDelay: 800,       // 探测成功后再延迟一点弹，避免抢首屏

    storeKey: 'cb_en_hint',
    muteDays: 30,         // 点「不用了」后的静默天数
    barID: 'cb-en-hint'
  };

  /* ==================== 前置判断 ==================== */

  // 调试开关：URL 带 ?en_hint_test=1 时跳过探测，强制展示提示条（墙内也能预览）
  var FORCE = /[?&]en_hint_test=1/.test(location.search);

  // ① 已在翻译代理域名下 → 退出（脚本会被翻译框架再次执行）
  if (location.hostname.indexOf('translate.goog') !== -1) return;

  // ② 爬虫 / 无头环境 → 退出
  if (!FORCE && /bot|crawler|spider|crawl|googlebot|bingbot|baiduspider|headless/i.test(navigator.userAgent || '')) return;

  // ③ 用户已经做过选择 → 退出
  if (!FORCE && readChoice()) return;

  function readChoice() {
    try {
      var raw = localStorage.getItem(CFG.storeKey);
      if (!raw) return '';
      var o = JSON.parse(raw);
      if (!o || !o.choice) return '';
      if (o.choice === 'switch') return 'switch';                      // 已切过英文，回来就别再烦
      if (o.choice === 'dismiss' && o.ts &&
          Date.now() - o.ts < CFG.muteDays * 86400000) return 'dismiss';
      return '';
    } catch (e) {
      return '';
    }
  }

  function saveChoice(choice) {
    try {
      localStorage.setItem(CFG.storeKey, JSON.stringify({ choice: choice, ts: Date.now() }));
    } catch (e) { /* 隐私模式等场景忽略 */ }
  }

  /* ==================== 墙外探测 ==================== */

  // 任一探测成功即判定为「可访问 YouTube」，两者都失败或超时则视为墙内
  function probeOutside() {
    return new Promise(function (resolve) {
      var settled = false;

      function finish(result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }

      var timer = setTimeout(function () { finish(false); }, CFG.probeTimeout);

      // ① fetch no-cors：能握手成功说明链路通
      try {
        var opt = { mode: 'no-cors', cache: 'no-store', credentials: 'omit' };
        var ctrl = window.AbortController ? new AbortController() : null;
        if (ctrl) {
          opt.signal = ctrl.signal;
          setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, CFG.probeTimeout);
        }
        fetch(CFG.probeFetch, opt).then(function () { finish(true); }, function () {});
      } catch (e) { /* 老浏览器无 fetch，靠 ② 兜底 */ }

      // ② Image 探测：不受 CORS / CSP connect-src 限制
      try {
        var img = new Image();
        img.onload = function () { finish(true); };
        img.onerror = function () {};
        img.src = CFG.probeImg + '?_=' + Date.now();
      } catch (e) {}
    });
  }

  /* ==================== 构造跳转地址 ==================== */

  function buildTarget() {
    var uid = CFG.fallbackUserID;
    try {
      if (window.CB_Tracking && window.CB_Tracking.userid) uid = window.CB_Tracking.userid;
    } catch (e) {}
    return CFG.targetBase + CFG.targetQuery + encodeURIComponent(uid);
  }

  /* ==================== 提示条 UI ==================== */

  var CSS =
    '#' + CFG.barID + '{position:fixed;right:20px;bottom:20px;z-index:99998;width:296px;' +
      'max-width:calc(100vw - 40px);box-sizing:border-box;padding:16px 18px;border-radius:16px;' +
      'background:rgba(255,255,255,.94);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
      'border:1px solid rgba(236,72,153,.22);box-shadow:0 12px 34px rgba(120,60,110,.18);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;' +
      'line-height:1.55;opacity:0;transform:translateY(24px);' +
      'transition:opacity .45s ease,transform .45s ease,bottom .35s ease;}' +
    '#' + CFG.barID + '.on{opacity:1;transform:translateY(0);}' +
    '#' + CFG.barID + ' .ceh-t{font-size:.95rem;font-weight:600;color:#1f2233;margin-bottom:5px;}' +
    '#' + CFG.barID + ' .ceh-d{font-size:.82rem;color:#5b6070;}' +
    '#' + CFG.barID + ' .ceh-d span{display:block;font-size:.76rem;color:#8a90a0;margin-top:2px;}' +
    '#' + CFG.barID + ' .ceh-b{display:flex;gap:8px;align-items:center;margin-top:13px;}' +
    '#' + CFG.barID + ' button{border:none;cursor:pointer;font-family:inherit;transition:opacity .2s ease,transform .2s ease;}' +
    '#' + CFG.barID + ' .ceh-go{flex:1;padding:9px 14px;border-radius:22px;font-size:.85rem;font-weight:600;color:#fff;' +
      'background:linear-gradient(135deg,#ec4899,#2575fc);box-shadow:0 4px 14px rgba(236,72,153,.35);}' +
    '#' + CFG.barID + ' .ceh-no{padding:9px 12px;border-radius:22px;font-size:.82rem;color:#7b8093;background:rgba(0,0,0,.05);}' +
    '#' + CFG.barID + ' button:hover{opacity:.88;}' +
    '#' + CFG.barID + ' button:active{transform:scale(.97);}';

  var BODY =
    '<div class="ceh-t">English version available</div>' +
    '<div class="ceh-d">Looks like you can access YouTube from here. Want to read this site in English?' +
      '<span>检测到你在墙外～ 要换成英文界面吗？</span></div>' +
    '<div class="ceh-b">' +
      '<button type="button" class="ceh-go">Switch to English</button>' +
      '<button type="button" class="ceh-no">No, thanks</button>' +
    '</div>';

  function show() {
    if (document.getElementById(CFG.barID)) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);

    var box = document.createElement('div');
    box.id = CFG.barID;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'English version available');
    box.innerHTML = BODY;
    document.body.appendChild(box);

    // 底部若有 GA4 同意条，整体上移避免两条叠在一起
    var cbar = document.getElementById('cb-consent');
    if (cbar) box.style.bottom = (cbar.offsetHeight + 22) + 'px';
    document.addEventListener('cb-consent-closed', function () {
      box.style.bottom = '';
    });

    setTimeout(function () { box.className = 'on'; }, 60);

    box.querySelector('.ceh-go').addEventListener('click', function () {
      if (!FORCE) saveChoice('switch');
      // GA4 埋点：切英文成功点击（gtag 未加载时静默跳过）
      try {
        if (typeof gtag === 'function') {
          gtag('event', 'en_switch_click', { event_category: 'intl', event_label: 'index' });
        }
      } catch (e) {}
      location.href = buildTarget();
    });

    box.querySelector('.ceh-no').addEventListener('click', function () {
      if (!FORCE) saveChoice('dismiss');
      box.className = '';
      setTimeout(function () {
        if (box.parentNode) box.parentNode.removeChild(box);
      }, 500);
    });
  }

  /* ==================== 启动 ==================== */

  function launch() {
    if (document.body) {
      show();
    } else {
      document.addEventListener('DOMContentLoaded', show);
    }
  }

  // 调试模式：直接展示，不探测、不写本地记录
  if (FORCE) {
    setTimeout(launch, 300);
    return;
  }

  probeOutside().then(function (outside) {
    if (!outside) return;   // 墙内：什么都不做
    setTimeout(launch, CFG.showDelay);
  });
})();
