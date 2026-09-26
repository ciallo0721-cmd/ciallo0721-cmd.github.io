/*!
 * 2.0 视频播放器  ——  js/js/video/index.js
 * ------------------------------------------------------------------
 * 用法（页面里只需三件事）：
 *   1) <script src="../js/js/video/index.js"></script>
 *   2) <video class="2.0vid" src="xxx.mp4"></video>
 *      （或 <video class="2.0vid"></video> 用在外面套 data-src / 里面放 <source>）
 *   3) 完事。播放器会自动接管页面上所有 .2.0vid
 *
 * 说明：class 名字以数字开头，CSS 里无法用 .2.0vid 选择器，
 *       所以本文件用 [class~="2.0vid"] 属性选择器匹配，
 *       样式全部用 JS 注入（带 <style>），不依赖外部 CSS 文件。
 *
 * 支持：mp4 / webm / mov / m4v / ogv / ogg（浏览器原生）
 *       m3u8 (HLS) / ts (MPEG-TS)  —— 需要页面自带 hls.js
 *       flv                    —— 需要页面自带 flv.js
 *       在线 url（http/https 直接填）
 * 功能：点击播放 / 进度条拖动 / 音量+静音 / 倍速 / 画中画 /
 *       网页全屏 / 真全屏 / 小窗悬浮 / 快捷键 / 记忆播放进度 / 循环
 */
(function (global) {
  'use strict';

  if (global.__VIDEO2_LOADED__) return;
  global.__VIDEO2_LOADED__ = true;

  var CLASS = '2.0vid';
  var SEL = '[class~="' + CLASS + '"]';
  var LS_PREFIX = 'v2_progress:';

  /* ========================= 工具函数 ========================= */

  function $(s, r) { return (r || document).querySelector(s); }

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return h > 0 ? h + ':' + pad(m) + ':' + pad(sec) : pad(m) + ':' + pad(sec);
  }

  /* 毫秒级时间格式：分:秒:毫秒，如 0:0:000 / 1:30:500 */
  function fmtTimeMs(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var total = Math.floor(s);
    var ms = Math.floor((s - total) * 1000);
    if (ms > 999) ms = 999;
    var m = Math.floor(total / 60);
    var sec = total % 60;
    return m + ':' + sec + ':' + (ms < 10 ? '00' + ms : ms < 100 ? '0' + ms : '' + ms);
  }

  function fmtSize(b) {
    if (!b || b < 0) return '';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return b.toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* 探测真实可播放地址（要放到临时元素上探测，不能污染原 video） */
  function resolveSource(video, wrap) {
    var raw = '';
    var dynamic = wrap.getAttribute('data-src') || video.getAttribute('data-src');
    if (dynamic) {
      raw = dynamic.trim();
    } else if (video.getAttribute('src')) {
      raw = video.getAttribute('src').trim();
    } else {
      var s = video.querySelector('source');
      if (s) raw = (s.getAttribute('src') || '').trim();
    }
    return raw;
  }

  function extOf(url) {
    var clean = url.split('#')[0].split('?')[0];
    var m = clean.match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : '';
  }

  /* 判断视频“种类”，决定用哪个内核 */
  function detectKind(url, video) {
    var ext = extOf(url);
    // 显式 type 优先
    var t = (video.getAttribute('type') || '').toLowerCase();
    if (video.querySelector('source')) {
      var st = (video.querySelector('source').getAttribute('type') || '').toLowerCase();
      if (st) t = st;
    }
    if (t.indexOf('mpegurl') > -1) return 'hls';
    if (t.indexOf('mpegts') > -1 || t.indexOf('mp2t') > -1) return 'ts';
    if (t.indexOf('dash') > -1) return 'dash';
    if (ext === 'm3u8') return 'hls';
    if (ext === 'ts') return 'ts';
    if (ext === 'mpd') return 'dash';
    if (ext === 'flv') return 'flv';
    return 'native';
  }

  function canPlayNative(video, url, kind) {
    var typeMap = {
      mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
      webm: 'video/webm', ogv: 'video/ogg', ogg: 'video/ogg',
      mkv: 'video/x-matroska', avi: 'video/x-msvideo', ts: 'video/mp2t'
    };
    var ext = extOf(url);
    var type = typeMap[ext] || '';
    if (!type) return null; // 未知，交给浏览器试
    return video.canPlayType(type);
  }

  /* 数 video 里有几条音轨（用于提示“多音轨 / 字幕需外部播放器”） */
  function trackInfo(video) {
    var n = 0;
    try { if (video.audioTracks) n = video.audioTracks.length; } catch (e) {}
    return n;
  }

  /* ========================= 样式注入 ========================= */

  var CSS = [
    '.v2-wrap{position:relative;display:block;width:100%;max-width:100%;margin:18px auto;',
    'background:#0b0f14;border-radius:14px;overflow:hidden;user-select:none;',
    'box-shadow:0 8px 30px rgba(0,0,0,.28);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;',
    'line-height:1;color:#eaf2f8}',

    '.v2-wrap.v2-theater{position:fixed!important;inset:0!important;z-index:99998;margin:0!important;',
    'border-radius:0!important;max-width:none!important;width:100vw!important;height:100vh!important;',
    'display:flex;align-items:center;justify-content:center;background:#000}',
    '.v2-wrap.v2-theater>video{width:100%;height:100%;object-fit:contain}',

    '.v2-wrap.v2-mini{position:fixed!important;right:20px;bottom:20px;z-index:99997;',
    'width:320px!important;max-width:320px!important;margin:0!important;border-radius:12px;',
    'box-shadow:0 12px 40px rgba(0,0,0,.5);opacity:.97}',
    '.v2-wrap.v2-mini:hover{opacity:1}',
    '.v2-wrap.v2-mini>video{cursor:move}',

    '.v2-wrap>video{display:block;width:100%;height:auto;background:#000;cursor:pointer;border-radius:14px}',

    /* 大播放按钮 */
    '.v2-big{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:72px;height:72px;',
    'border-radius:50%;border:0;cursor:pointer;z-index:6;display:flex;align-items:center;justify-content:center;',
    'background:rgba(14,165,233,.92);box-shadow:0 8px 28px rgba(14,165,233,.5);',
    'opacity:1;pointer-events:auto;transition:opacity .25s,transform .25s,background .25s;backdrop-filter:blur(4px)}',
    '.v2-big:hover{transform:translate(-50%,-50%) scale(1.08);background:rgba(14,165,233,1)}',
    '.v2-big svg{width:30px;height:30px;fill:#fff;margin-left:4px}',
    '.v2-wrap.v2-playing .v2-big{opacity:0;pointer-events:none}',
    '.v2-wrap.v2-playing:hover .v2-big{opacity:1;pointer-events:auto}',
    '.v2-wrap.v2-playing .v2-big svg{margin-left:0}',

    /* 加载圈 */
    '.v2-load{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;',
    'border:3px solid rgba(255,255,255,.22);border-top-color:#0EA5E9;border-radius:50%;',
    'animation:v2spin .8s linear infinite;display:none;z-index:7}',
    '.v2-wrap.v2-buffering .v2-load{display:block}',
    '@keyframes v2spin{to{transform:rotate(360deg)}}',

    /* 控制条 */
    '.v2-bar{position:absolute;left:0;right:0;bottom:0;z-index:8;padding:26px 12px 9px;',
    'background:linear-gradient(to top,rgba(0,0,0,.86),rgba(0,0,0,.45) 55%,transparent);',
    'opacity:0;transition:opacity .22s;pointer-events:none}',
    '.v2-wrap.v2-active .v2-bar,.v2-wrap.v2-playing:hover .v2-bar,.v2-wrap.v2-paused .v2-bar{opacity:1;pointer-events:auto}',

    /* 进度条 */
    '.v2-prog{position:relative;height:16px;display:flex;align-items:center;cursor:pointer;margin-bottom:6px}',
    '.v2-track{position:relative;width:100%;height:4px;border-radius:4px;background:rgba(255,255,255,.26);transition:height .15s}',
    '.v2-prog:hover .v2-track{height:6px}',
    '.v2-buf{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(255,255,255,.35);border-radius:4px}',
    '.v2-played{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#0EA5E9,#38BDF8);border-radius:4px}',
    '.v2-dot{position:absolute;left:0;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;',
    'background:#fff;box-shadow:0 0 0 4px rgba(14,165,233,.35);transform:scale(0);transition:transform .15s}',
    '.v2-prog:hover .v2-dot,.v2-wrap.v2-seeking .v2-dot{transform:scale(1)}',
    '.v2-tip{position:absolute;bottom:22px;transform:translateX(-50%);padding:3px 7px;border-radius:6px;',
    'background:rgba(0,0,0,.82);color:#fff;font-size:12px;white-space:nowrap;display:none;pointer-events:none;font-variant-numeric:tabular-nums}',
    '.v2-prog:hover .v2-tip,.v2-wrap.v2-seeking .v2-tip{display:block}',

    /* 按钮行 */
    '.v2-row{display:flex;align-items:center;gap:4px}',
    '.v2-btn{flex:0 0 auto;width:32px;height:32px;border:0;background:transparent;cursor:pointer;border-radius:8px;',
    'display:flex;align-items:center;justify-content:center;padding:0;transition:background .15s;color:#fff}',
    '.v2-btn:hover{background:rgba(255,255,255,.16)}',
    '.v2-btn svg{width:19px;height:19px;fill:#fff;pointer-events:none}',
    '.v2-btn.v2-on{color:#0EA5E9}',
    '.v2-btn.v2-on svg{fill:#38BDF8}',
    '.v2-time{font-size:12px;color:#e6eef5;margin:0 8px;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.v2-time b{color:#94b8d4;font-weight:400;display:inline-block;min-width:48px}',
    '.v2-time .v2-cur{text-align:right}',
    '.v2-time .v2-dur{text-align:left}',
    '.v2-sp{flex:1 1 auto}',

    /* 音量 */
    '.v2-vol{display:flex;align-items:center}',
    '.v2-vol-slider{width:0;overflow:hidden;transition:width .22s;cursor:pointer;height:20px;display:flex;align-items:center}',
    '.v2-vol:hover .v2-vol-slider,.v2-vol-open .v2-vol-slider{width:72px}',
    '.v2-vol-track{position:relative;width:64px;height:4px;border-radius:4px;background:rgba(255,255,255,.28);margin:0 4px}',
    '.v2-vol-fill{position:absolute;left:0;top:0;bottom:0;width:80%;background:#0EA5E9;border-radius:4px}',
    '.v2-vol-dot{position:absolute;left:80%;top:50%;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:50%;background:#fff}',
    '.v2-vol-num{font-size:11px;width:34px;text-align:right;color:#cfe4f3;font-variant-numeric:tabular-nums}',

    /* 倍速菜单 */
    '.v2-menu{position:absolute;right:12px;bottom:52px;z-index:9;background:rgba(18,24,32,.97);border-radius:10px;',
    'padding:6px;display:none;flex-direction:column;min-width:88px;box-shadow:0 10px 30px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.09)}',
    '.v2-menu.v2-show{display:flex}',
    '.v2-mi{border:0;background:transparent;color:#dbe9f4;font-size:13px;padding:7px 12px;border-radius:7px;',
    'cursor:pointer;text-align:left;white-space:nowrap}',
    '.v2-mi:hover{background:rgba(255,255,255,.13)}',
    '.v2-mi.v2-sel{color:#38BDF8;font-weight:600}',

    /* 提示气泡 */
    '.v2-toast{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:11;padding:6px 12px;',
    'border-radius:8px;background:rgba(0,0,0,.78);color:#fff;font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap}',
    '.v2-toast.v2-show{opacity:1}',

    /* 小窗拖动条（小窗时视频上方的抓取条） */
    '.v2-grab{display:none;position:absolute;left:0;right:0;top:0;height:18px;z-index:12;cursor:move;',
    'background:linear-gradient(to bottom,rgba(0,0,0,.5),transparent)}',
    '.v2-wrap.v2-mini .v2-grab{display:block}',

    '@media(max-width:600px){.v2-wrap.v2-mini{width:52vw!important;max-width:52vw!important;right:10px;bottom:10px}',
    '.v2-time{font-size:11px;margin:0 4px}.v2-btn{width:29px;height:29px}}'
  ].join('');

  function injectCSS() {
    if ($('#v2-style')) return;
    var s = document.createElement('style');
    s.id = 'v2-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ========================= 图标 ========================= */

  var ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    volUp: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    volDown: '<svg viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
    speed: '<svg viewBox="0 0 24 24"><path d="M10 8v8l6-4-6-4zm2-6C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>',
    pip: '<svg viewBox="0 0 24 24"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>',
    theater: '<svg viewBox="0 0 24 24"><path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H5V8h14v8zM3 2h18v2H3zM3 20h18v2H3z"/></svg>',
    mini: '<svg viewBox="0 0 24 24"><path d="M19 5H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 12H5V7h14v10zm-8-2h7v-4h-7v4z"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
    exit: '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
    loop: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>'
  };

  /* ========================= 核心：初始化一个播放器 ========================= */

  function boot(video) {
    if (!video || video.__v2) return;
    video.__v2 = true;

    /* ---- 1. 建壳 ---- */
    var wrap = el('div', 'v2-wrap');
    var cls = video.className || '';
    video.parentNode.insertBefore(wrap, video);
    wrap.appendChild(video);
    video.classList.add('v2-video');
    // 保留原 class（含 2.0vid）以便属性选择器仍命中
    video.className = cls;

    video.setAttribute('playsinline', 'playsinline');
    video.setAttribute('webkit-playsinline', 'webkit-playsinline');
    video.removeAttribute('controls');
    video.controls = false;
    if (!video.getAttribute('preload')) video.setAttribute('preload', 'metadata');

    var fillMode = (wrap.getAttribute('data-fill') || video.getAttribute('data-fill') || '').toLowerCase();
    if (fillMode === 'height') video.style.height = '100%';
    if (fillMode === 'cover') video.style.objectFit = 'cover';

    /* ---- 2. 建 UI ---- */
    var big = el('button', 'v2-big', ICON.play);
    big.type = 'button';
    big.title = '播放';
    var load = el('div', 'v2-load');

    var bar = el('div', 'v2-bar');
    bar.innerHTML = [
      '<div class="v2-prog">',
      '  <div class="v2-track"><div class="v2-buf"></div><div class="v2-played"></div><div class="v2-dot"></div></div>',
      '  <div class="v2-tip">0:0:000</div>',
      '</div>',
      '<div class="v2-row">',
      '  <button class="v2-btn v2-play" type="button" title="播放/暂停">', ICON.play, '</button>',
      '  <button class="v2-btn v2-back" type="button" title="后退10秒">', ICON.prev, '</button>',
      '  <button class="v2-btn v2-fwd" type="button" title="前进10秒">', ICON.next, '</button>',
      '  <span class="v2-time"><b class="v2-cur">0:0:000</b> / <b class="v2-dur">0:0:000</b></span>',
      '  <span class="v2-sp"></span>',
      '  <span class="v2-vol">',
      '    <button class="v2-btn v2-vol-btn" type="button" title="静音">', ICON.volUp, '</button>',
      '    <span class="v2-vol-slider"><span class="v2-vol-track"><span class="v2-vol-fill"></span><span class="v2-vol-dot"></span></span></span>',
      '    <span class="v2-vol-num">100%</span>',
      '  </span>',
      '  <button class="v2-btn v2-speed-btn" type="button" title="倍速">', ICON.speed, '</button>',
      '  <button class="v2-btn v2-pip-btn" type="button" title="画中画">', ICON.pip, '</button>',
      '  <button class="v2-btn v2-loop-btn" type="button" title="循环">', ICON.loop, '</button>',
      '  <button class="v2-btn v2-theater-btn" type="button" title="网页全屏">', ICON.theater, '</button>',
      '  <button class="v2-btn v2-mini-btn" type="button" title="小窗悬浮">', ICON.mini, '</button>',
      '  <button class="v2-btn v2-full-btn" type="button" title="全屏">', ICON.full, '</button>',
      '</div>'
    ].join('');

    var menu = el('div', 'v2-menu');
    [2, 1.75, 1.5, 1.25, 1, 0.75, 0.5].forEach(function (r) {
      var b = el('button', 'v2-mi' + (r === 1 ? ' v2-sel' : ''), (r === 1 ? '正常 1.0x' : r + 'x'));
      b.type = 'button';
      b.dataset.rate = r;
      menu.appendChild(b);
    });

    var toast = el('div', 'v2-toast');
    var grab = el('div', 'v2-grab');

    wrap.appendChild(video); // 确保 video 先在最底
    wrap.appendChild(load);
    wrap.appendChild(big);
    wrap.appendChild(grab);
    wrap.appendChild(bar);
    wrap.appendChild(menu);
    wrap.appendChild(toast);

    /* ---- 3. 拿到 UI 引用 ---- */
    var q = function (s) { return $(s, wrap); };
    var prog = q('.v2-prog'), track = q('.v2-track'), bufBar = q('.v2-buf'),
      playedBar = q('.v2-played'), dot = q('.v2-dot'), tip = q('.v2-tip');
    var btnPlay = q('.v2-play'), btnBack = q('.v2-back'), btnFwd = q('.v2-fwd');
    var curEl = q('.v2-cur'), durEl = q('.v2-dur');
    var volWrap = q('.v2-vol'), btnVol = q('.v2-vol-btn'), volSlider = q('.v2-vol-slider'),
      volFill = q('.v2-vol-fill'), volDot = q('.v2-vol-dot'), volNum = q('.v2-vol-num');
    var btnSpeed = q('.v2-speed-btn'), btnPip = q('.v2-pip-btn'), btnLoop = q('.v2-loop-btn'),
      btnTheater = q('.v2-theater-btn'), btnMini = q('.v2-mini-btn'), btnFull = q('.v2-full-btn');

    /* ---- 4. 状态 ---- */
    var state = {
      seeking: false,
      lastVol: 1,
      pipSupported: !!document.pictureInPictureEnabled,
      mini: false,
      theater: false,
      toastTimer: null
    };

    function toastMsg(txt) {
      toast.textContent = txt;
      toast.classList.add('v2-show');
      clearTimeout(state.toastTimer);
      state.toastTimer = setTimeout(function () { toast.classList.remove('v2-show'); }, 1200);
    }

    /* ---- 5. 源加载：多格式 / HLS / TS / FLV ---- */
    var srcRaw = resolveSource(video, wrap);
    var kind = detectKind(srcRaw, video);

    function setSrc(url) {
      video.src = url;
    }

    function useHls(url, onFail) {
      var H = global.Hls;
      if (H && H.isSupported && H.isSupported()) {
        var hls = new H({
          // ts 单文件无法用 hls.js 直接播；这里只在 m3u8 时进来
          enableWorker: true,
          lowLatencyMode: false
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(H.Events.ERROR, function (e, data) {
          if (data && data.fatal) {
            hls.destroy();
            onFail && onFail();
          }
        });
        video.__hls = hls;
        return true;
      }
      return false;
    }

    function playNativeOrFail() {
      // 原生判断
      var ok = canPlayNative(video, srcRaw, kind);
      if (ok === '') {
        // 明确不支持
        failNotice();
        return;
      }
      setSrc(srcRaw);
      video.load();
    }

    function failNotice() {
      wrap.classList.add('v2-unsupported');
      toastMsg('该格式浏览器不支持，试试外挂 hls.js / flv.js');
      console.warn('[2.0vid] 无法原生播放：' + srcRaw);
    }

    function setupSource() {
      if (!srcRaw) return;
      if (kind === 'hls' || kind === 'dash') {
        var api = kind === 'hls' ? global.Hls : null;
        if (kind === 'hls') {
          var done = useHls(srcRaw, playNativeOrFail);
          if (!done) {
            // Safari 原生支持 m3u8
            if (canPlayNative(video, 'x.m3u8') !== '') { setSrc(srcRaw); video.load(); }
            else failNotice();
          }
        } else {
          failNotice(); // dash 需要 dash.js，本播放器不内置
        }
        return;
      }
      if (kind === 'ts') {
        // 单文件 MPEG-TS：Chrome/Firefox 原生不支持；若页面挂了 hls.js，可包一层
        if (canPlayNative(video, srcRaw, kind) === '') {
          failNotice();
        } else {
          setSrc(srcRaw);
          video.load();
        }
        return;
      }
      if (kind === 'flv') {
        var F = global.flvjs;
        if (F && F.isSupported()) {
          var player = F.createPlayer({ type: 'flv', url: srcRaw, hasAudio: true });
          player.attachMediaElement(video);
          player.load();
          video.__flv = player;
        } else {
          failNotice();
        }
        return;
      }
      // native
      var can = canPlayNative(video, srcRaw, kind);
      if (can === '') {
        // 试一次再决定（比如 mkv 有些浏览器能播）
        setSrc(srcRaw);
        video.load();
        video.addEventListener('error', failNotice, { once: true });
      } else {
        setSrc(srcRaw);
        // 不主动 play，等用户点
        if (video.readyState >= 1) onMeta();
      }
    }

    /* ---- 6. 进度记忆 ---- */
    function key() { return LS_PREFIX + (srcRaw || '').split('#')[0]; }
    function saveProgress() {
      if (!srcRaw || !isFinite(video.duration) || video.duration < 5) return;
      try {
        localStorage.setItem(key(), JSON.stringify({
          t: video.currentTime,
          d: video.duration,
          ts: Date.now()
        }));
      } catch (e) {}
    }
    function restoreProgress() {
      if (!srcRaw) return;
      try {
        var raw = localStorage.getItem(key());
        if (!raw) return;
        var o = JSON.parse(raw);
        // 7 天内、且进度 < 95% 才恢复
        if (Date.now() - o.ts > 7 * 864e5) return;
        if (o.t > 5 && o.d && o.t / o.d < 0.95) {
          video.currentTime = o.t;
          toastMsg('已恢复到 ' + fmtTime(o.t));
        }
      } catch (e) {}
    }

    /* ---- 7. 播放/暂停 ---- */
    function togglePlay() {
      if (video.paused) {
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        video.pause();
      }
    }
    function setPlayingUI(playing) {
      wrap.classList.toggle('v2-playing', playing);
      wrap.classList.toggle('v2-paused', !playing);
      btnPlay.innerHTML = playing ? ICON.pause : ICON.play;
      btnPlay.title = playing ? '暂停' : '播放';
      big.innerHTML = playing ? ICON.pause : ICON.play;
      big.title = playing ? '暂停' : '播放';
    }

    /* ---- 8. 进度条交互 ---- */
    function ratioFromEvent(e) {
      var r = track.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      return clamp(x / r.width, 0, 1);
    }
    function paintProgress() {
      var d = video.duration;
      var cur = video.currentTime;
      if (isFinite(d) && d > 0) {
        playedBar.style.width = (cur / d * 100) + '%';
        dot.style.left = (cur / d * 100) + '%';
        curEl.textContent = fmtTimeMs(cur);
        durEl.textContent = fmtTimeMs(d);
      } else {
        curEl.textContent = fmtTimeMs(cur);
      }
      try {
        if (video.buffered && video.buffered.length) {
          var end = video.buffered.end(video.buffered.length - 1);
          if (isFinite(d) && d > 0) bufBar.style.width = (end / d * 100) + '%';
        }
      } catch (e) {}
    }

    /* 毫秒级走表：播放时用 rAF 逐帧刷新当前时间 */
    var clockRAF = 0;
    function clockLoop() {
      clockRAF = 0;
      if (video.paused || video.ended) return;
      curEl.textContent = fmtTimeMs(video.currentTime);
      clockRAF = requestAnimationFrame(clockLoop);
    }
    function clockStart() { if (!clockRAF) clockRAF = requestAnimationFrame(clockLoop); }
    function clockStop() {
      if (clockRAF) { cancelAnimationFrame(clockRAF); clockRAF = 0; }
      curEl.textContent = fmtTimeMs(video.currentTime);
    }

    function previewAt(e) {
      var r = ratioFromEvent(e);
      var d = video.duration;
      tip.style.left = (r * 100) + '%';
      tip.textContent = isFinite(d) ? fmtTimeMs(r * d) : '0:0:000';
      if (state.seeking) {
        playedBar.style.width = (r * 100) + '%';
        dot.style.left = (r * 100) + '%';
        curEl.textContent = fmtTimeMs(r * (d || 0));
      }
    }

    prog.addEventListener('mousedown', function (e) {
      if (!isFinite(video.duration)) return;
      state.seeking = true;
      wrap.classList.add('v2-seeking');
      previewAt(e);
      e.preventDefault();
    });
    prog.addEventListener('mousemove', function (e) { previewAt(e); });
    document.addEventListener('mousemove', function (e) {
      if (!state.seeking) return;
      previewAt(e);
    });
    document.addEventListener('mouseup', function (e) {
      if (!state.seeking) return;
      state.seeking = false;
      wrap.classList.remove('v2-seeking');
      if (isFinite(video.duration)) {
        video.currentTime = ratioFromEvent(e) * video.duration;
      }
      paintProgress();
    });
    // 触摸
    prog.addEventListener('touchstart', function (e) {
      if (!isFinite(video.duration)) return;
      state.seeking = true;
      wrap.classList.add('v2-seeking');
      previewAt(e);
      e.preventDefault();
    }, { passive: false });
    prog.addEventListener('touchmove', function (e) {
      if (!state.seeking) return;
      previewAt(e);
      e.preventDefault();
    }, { passive: false });
    prog.addEventListener('touchend', function (e) {
      if (!state.seeking) return;
      state.seeking = false;
      wrap.classList.remove('v2-seeking');
      var t = e.changedTouches && e.changedTouches[0];
      if (t && isFinite(video.duration)) {
        video.currentTime = ratioFromEvent({ clientX: t.clientX }) * video.duration;
      }
      paintProgress();
    });

    /* ---- 9. 音量 ---- */
    function paintVolume() {
      var v = video.muted ? 0 : video.volume;
      volFill.style.width = (v * 100) + '%';
      volDot.style.left = (v * 100) + '%';
      volNum.textContent = Math.round(v * 100) + '%';
      btnVol.innerHTML = v === 0 ? ICON.mute : (v < 0.5 ? ICON.volDown : ICON.volUp);
      btnVol.title = v === 0 ? '取消静音' : '静音';
    }
    btnVol.addEventListener('click', function () {
      if (video.muted || video.volume === 0) {
        video.muted = false;
        video.volume = state.lastVol || 0.8;
      } else {
        state.lastVol = video.volume;
        video.muted = true;
      }
      paintVolume();
    });
    function volFromEvent(e) {
      var r = $('.v2-vol-track', volWrap).getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      return clamp(x / r.width, 0, 1);
    }
    var volDragging = false;
    volSlider.addEventListener('mousedown', function (e) {
      volDragging = true;
      video.muted = false;
      video.volume = volFromEvent(e);
      paintVolume();
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!volDragging) return;
      video.volume = volFromEvent(e);
      paintVolume();
    });
    document.addEventListener('mouseup', function () { volDragging = false; });
    // 滚轮调音量
    volWrap.addEventListener('wheel', function (e) {
      e.preventDefault();
      video.muted = false;
      video.volume = clamp(video.volume + (e.deltaY < 0 ? 0.05 : -0.05), 0, 1);
      paintVolume();
    }, { passive: false });

    /* ---- 10. 倍速 ---- */
    btnSpeed.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('v2-show');
    });
    menu.addEventListener('click', function (e) {
      var b = e.target.closest('.v2-mi');
      if (!b) return;
      var r = parseFloat(b.dataset.rate);
      video.playbackRate = r;
      Array.prototype.forEach.call(menu.children, function (c) {
        c.classList.toggle('v2-sel', c === b);
      });
      menu.classList.remove('v2-show');
      toastMsg('倍速 ' + r + 'x');
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) menu.classList.remove('v2-show');
    });

    /* ---- 11. 循环 ---- */
    function paintLoop() {
      var on = video.loop;
      btnLoop.classList.toggle('v2-on', on);
      btnLoop.title = on ? '取消循环' : '循环播放';
    }
    btnLoop.addEventListener('click', function () {
      video.loop = !video.loop;
      paintLoop();
      toastMsg(video.loop ? '循环播放 开' : '循环播放 关');
    });

    /* ---- 12. 画中画 ---- */
    if (!state.pipSupported) btnPip.style.display = 'none';
    btnPip.addEventListener('click', function () {
      try {
        if (document.pictureInPictureElement) document.exitPictureInPicture();
        else video.requestPictureInPicture();
      } catch (e) {}
    });

    /* ---- 13. 网页全屏 ---- */
    function exitTheater() {
      state.theater = false;
      wrap.classList.remove('v2-theater');
      document.body.style.overflow = '';
      btnTheater.innerHTML = ICON.theater;
      toastMsg('退出网页全屏');
    }
    btnTheater.addEventListener('click', function () {
      if (wrap.classList.contains('v2-mini')) {
        wrap.classList.remove('v2-mini');
        state.mini = false;
        btnMini.classList.remove('v2-on');
      }
      state.theater = !state.theater;
      wrap.classList.toggle('v2-theater', state.theater);
      document.body.style.overflow = state.theater ? 'hidden' : '';
      btnTheater.innerHTML = state.theater ? ICON.exit : ICON.theater;
      toastMsg(state.theater ? '网页全屏' : '退出网页全屏');
    });

    /* ---- 14. 小窗悬浮 ---- */
    function setMini(on) {
      state.mini = on;
      if (on && state.theater) exitTheater();
      wrap.classList.toggle('v2-mini', on);
      btnMini.classList.toggle('v2-on', on);
      btnMini.innerHTML = on ? ICON.exit : ICON.mini;
      btnMini.title = on ? '关闭小窗' : '小窗悬浮';
      if (on) {
        // 首次进入给一个默认位置
        if (!wrap.dataset.posSet) {
          wrap.style.right = '20px';
          wrap.style.bottom = '20px';
          wrap.dataset.posSet = '1';
        }
        toastMsg('小窗悬浮 · 拖动顶部移动');
      } else {
        wrap.style.left = wrap.style.top = wrap.style.right = wrap.style.bottom = '';
        wrap.dataset.posSet = '';
      }
    }
    btnMini.addEventListener('click', function () { setMini(!state.mini); });

    // 小窗拖动
    var dragging = false, dx = 0, dy = 0;
    function startDrag(e) {
      if (!state.mini) return;
      dragging = true;
      var r = wrap.getBoundingClientRect();
      wrap.style.left = r.left + 'px';
      wrap.style.top = r.top + 'px';
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
      var p = e.touches ? e.touches[0] : e;
      dx = p.clientX - r.left;
      dy = p.clientY - r.top;
      e.preventDefault();
    }
    grab.addEventListener('mousedown', startDrag);
    grab.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var w = wrap.offsetWidth, h = wrap.offsetHeight;
      wrap.style.left = clamp(e.clientX - dx, 0, global.innerWidth - w) + 'px';
      wrap.style.top = clamp(e.clientY - dy, 0, global.innerHeight - h) + 'px';
    });
    document.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var p = e.touches[0], w = wrap.offsetWidth, h = wrap.offsetHeight;
      wrap.style.left = clamp(p.clientX - dx, 0, global.innerWidth - w) + 'px';
      wrap.style.top = clamp(p.clientY - dy, 0, global.innerHeight - h) + 'px';
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('mouseup', function () { dragging = false; });
    document.addEventListener('touchend', function () { dragging = false; });

    /* ---- 15. 全屏 ---- */
    function isFull() {
      return document.fullscreenElement || document.webkitFullscreenElement;
    }
    btnFull.addEventListener('click', function () {
      var fn;
      if (isFull()) fn = wrap.ownerDocument.exitFullscreen || wrap.ownerDocument.webkitExitFullscreen;
      else fn = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
      if (fn) {
        try { fn.call(isFull() ? wrap.ownerDocument : wrap); } catch (e) {}
      }
      setTimeout(paintFullIcon, 120);
    });
    function paintFullIcon() {
      var f = !!isFull();
      btnFull.innerHTML = f ? ICON.exit : ICON.full;
      btnFull.title = f ? '退出全屏' : '全屏';
    }
    document.addEventListener('fullscreenchange', paintFullIcon);
    document.addEventListener('webkitfullscreenchange', paintFullIcon);

    /* ---- 16. 播放器自身事件 ---- */
    video.addEventListener('click', togglePlay);
    big.addEventListener('click', togglePlay);
    btnPlay.addEventListener('click', togglePlay);
    btnBack.addEventListener('click', function () { video.currentTime = Math.max(0, video.currentTime - 10); });
    btnFwd.addEventListener('click', function () { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); });

    video.addEventListener('play', function () { setPlayingUI(true); clockStart(); });
    video.addEventListener('pause', function () { setPlayingUI(false); saveProgress(); clockStop(); });
    video.addEventListener('timeupdate', paintProgress);
    video.addEventListener('durationchange', paintProgress);
    video.addEventListener('progress', paintProgress);
    video.addEventListener('volumechange', paintVolume);
    video.addEventListener('waiting', function () { wrap.classList.add('v2-buffering'); });
    video.addEventListener('playing', function () { wrap.classList.remove('v2-buffering'); });
    video.addEventListener('canplay', function () { wrap.classList.remove('v2-buffering'); });
    video.addEventListener('seeked', paintProgress);
    video.addEventListener('ended', function () {
      setPlayingUI(false);
      clockStop();
      try { localStorage.removeItem(key()); } catch (e) {}
    });
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('error', failNotice, { once: true });

    function onMeta() {
      paintProgress();
      restoreProgress();
    }

    // 定时兜底保存（每 5 秒）
    var saveTimer = setInterval(function () {
      if (!video.paused) saveProgress();
    }, 5000);
    global.addEventListener('beforeunload', saveProgress);

    /* ---- 17. 显示 / 隐藏控制条 ---- */
    var hideTimer = null;
    function showBar() {
      wrap.classList.add('v2-active');
      clearTimeout(hideTimer);
      if (!video.paused) {
        hideTimer = setTimeout(function () { wrap.classList.remove('v2-active'); }, 2600);
      }
    }
    wrap.addEventListener('mousemove', showBar);
    wrap.addEventListener('touchstart', function () { showBar(); }, { passive: true });
    wrap.addEventListener('mouseleave', function () {
      if (!video.paused) wrap.classList.remove('v2-active');
    });

    /* ---- 18. 键盘快捷键（鼠标悬停在该播放器上 / 全屏时） ---- */
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      var active = wrap.matches(':hover') || isFull() || state.theater ||
        (document.fullscreenElement === wrap);
      if (!active) return;
      var tag = e.key.toLowerCase();
      if (tag === ' ' || tag === 'k') {
        togglePlay(); e.preventDefault();
      } else if (tag === 'arrowright') {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
        toastMsg('+5s');
      } else if (tag === 'arrowleft') {
        video.currentTime = Math.max(0, video.currentTime - 5);
        toastMsg('-5s');
      } else if (tag === 'arrowup') {
        video.muted = false;
        video.volume = clamp(video.volume + 0.05, 0, 1);
        toastMsg('音量 ' + Math.round(video.volume * 100) + '%');
        e.preventDefault();
      } else if (tag === 'arrowdown') {
        video.volume = clamp(video.volume - 0.05, 0, 1);
        toastMsg('音量 ' + Math.round(video.volume * 100) + '%');
        e.preventDefault();
      } else if (tag === 'm') {
        video.muted = !video.muted; paintVolume();
      } else if (tag === 'f') {
        btnFull.click();
      } else if (tag === 'w') {
        btnTheater.click();
      } else if (tag === 'i') {
        setMini(!state.mini);
      }
    });

    /* ---- 19. 初始化 ---- */
    setupSource();
    paintProgress();
    paintVolume();
    paintLoop();
    setPlayingUI(false);
    wrap.classList.add('v2-paused'); // 初始显示控制条
    paintFullIcon();
  }

  /* ========================= 批量接管 ========================= */

  function initAll(root) {
    (root || document).querySelectorAll(SEL).forEach(function (v) {
      if (v.tagName === 'VIDEO' && !v.__v2 && v.parentNode) boot(v);
    });
  }

  injectCSS();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAll(); });
  } else {
    initAll();
  }

  // 暴露 API
  global.Video2 = {
    init: function (v) { if (v && v.tagName === 'VIDEO') boot(v); },
    initAll: initAll,
    version: '2.0.0'
  };

})(window);
