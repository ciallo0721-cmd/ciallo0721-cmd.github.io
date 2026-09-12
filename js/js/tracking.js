/*!
 * tracking.js — ciallo0721-cmd 站点访客追踪水印模块
 *
 * 功能：
 *   1. 为每个访客分配稳定 userid（格式：cialloblog-{os}-{随机4位}-{年份}）
 *      - 例：cialloblog-11-3f2a-2026（Windows 11）
 *      - 例：cialloblog-07-a91c-2026（Windows 7，个位数补零）
 *      - 例：cialloblog-nt-10.0-5b2e-2026（只能拿到 NT 版本时）
 *      - 例：cialloblog-mc-15-77d0-2026 / cialloblog-lx-ubuntu-1c4f-2026
 *   2. 页面生成隐形水印（userid + OS + IP 哈希），用于 bug 反馈 / 内容截图溯源
 *   3. IP 使用 SHA-256 加盐哈希（不可逆），不会明文出现
 *
 * 重要说明（请读完）：
 *   - 公网 IP 通过第三方接口 api.ip.sb/geoip 获取（免费、支持 CORS）。
 *     该请求只发生在浏览器侧，接口失败/超时时自动降级为 WebRTC 内网 IP 哈希，
 *     再失败则显示占位 ip-xxxxxxxxxxxx。
 *   - IP 一律经 SHA-256 加盐哈希（不可逆），水印中不会出现明文 IP。
 *   - 注意：必须在 _headers 的 CSP connect-src 里放行 https://api.ip.sb，
 *     否则 fetch 会被浏览器 CORS/CSP 拦截（本项目已配置）。
 *   - 若担心第三方接口可用性，可自行部署 Cloudflare Worker 做服务端查询，
 *     代码见文件底部注释。
 *
 * 使用方法：
 *   - 在页面 </body> 前引入：<script src="./js/js/tracking.js"></script>
 *   - 想让某个站内链接自动带上 userid 参数：给 <a> 加 data-track 属性
 *   - 想让表单提交时带上 userid：给 <form> 加 data-track-form 属性
 *   - 调试：控制台输入 window.CB_Tracking 查看
 */
(function () {
  'use strict';

  var CONFIG = {
    storeKey: 'cb_userid',          // localStorage 存储键（与 cookie 同名，双写兜底）
    cookieDays: 3650,               // cookie 过期天数（10 年，固定 userid）
    salt: 'ciallo-blog-salt-v1',    // IP 哈希固定盐（服务端版请替换为私密盐）
    publicIPAPI: 'https://api.ip.sb/geoip', // 公网 IP 查询接口（免费 + CORS 全开）
    ipTimeout: 5000,                // 公网 IP 查询超时（毫秒）
    ipHashLen: 12,                  // IP 哈希显示长度（hex 字符数）
    wmOpacity: 0.035,               // 水印不透明度（0.035 = 隐形但截图放大可见）
    wmColor: '0,0,0',               // 水印 RGB 颜色
    wmZIndex: 2147483646,           // 水印层级
    wmMinDataLen: 600,              // 水印 dataURL 最短长度（低于此值视为被隐私特性抹白）
    trackAttr: 'data-track',        // 链接自动拼接 userid 的属性
    trackFormAttr: 'data-track-form' // 表单自动注入 userid 的属性
  };

  var currentUserID = '';
  var osCodeStr = '';
  var lastIPHash = 'ip-xxxxxxxxxxxx';
  var wmEl = null;
  var wmTimer = null;
  var wmStatus = 'pending';        // pending | ok | no-context | blank | blocked | error

  // 统一告警出口：水印失败只在控制台提示，绝不中断页面其他功能
  function wmWarn(msg) {
    try {
      if (window.console && console.warn) console.warn('[tracking/watermark] ' + msg);
    } catch (e) {}
  }

  /* ==================== 工具函数 ==================== */

  function randHex(len) {
    try {
      var a = new Uint16Array(Math.ceil(len / 4));
      crypto.getRandomValues(a);
      return a[0].toString(16).padStart(len, '0').slice(0, len);
    } catch (e) {
      // crypto 不可用（极旧浏览器 / 非安全上下文）时降级，保证水印仍能生成
      var s = '';
      for (var i = 0; i < len; i++) s += Math.floor(Math.random() * 16).toString(16);
      return s;
    }
  }

  function getParam(name) {
    try {
      return new URLSearchParams(location.search).get(name) || '';
    } catch (e) { return ''; }
  }

  // cookie 读写（userid 持久化兜底，与 localStorage 双写）
  function getCookie(name) {
    try {
      var m = document.cookie.match(
        new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/+^])/g, '\\$1') + '=([^;]*)')
      );
      return m ? decodeURIComponent(m[1] || '') : '';
    } catch (e) { return ''; }
  }

  function setCookie(name, value, days) {
    try {
      var d = new Date();
      d.setTime(d.getTime() + days * 864e5);
      document.cookie = name + '=' + encodeURIComponent(value) +
        '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax';
    } catch (e) {}
  }

  function sha256Hex(str) {
    if (crypto && crypto.subtle) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
        .then(function (buf) {
          var bytes = new Uint8Array(buf), s = '';
          for (var i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
          return s;
        })
        .catch(function () { return Promise.resolve(fnv1a(str)); });
    }
    return Promise.resolve(fnv1a(str)); // 非 https 环境兜底
  }

  // FNV-1a 简易哈希（仅非 https / 无 WebCrypto 时兜底）
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  /* ==================== OS 识别 ==================== */

  // NT 版本号 -> 品牌版本（用户规则：具体版本用数字，个位数补零；拿不到用 nt-x.x）
  function mapNT(nt) {
    var table = {
      '11.0': '11', '10.0': '10', '6.3': '81', '6.2': '08', '6.1': '07',
      '6.0': '06', '5.2': 'nt-5.2', '5.1': '05', '5.0': '00',
      '4.90': 'me', '4.10': '98', '4.0': '98'
    };
    return table[nt] || ('nt-' + nt);
  }

  function fmtMac(v) {
    var p = v.split('_');
    if (parseInt(p[0], 10) >= 11) return p[0];      // macOS 11+ -> mc-11
    return p[0] + (p[1] ? p[1] : '0');              // 10.15 -> 1015
  }

  function detectOSFromUA() {
    var ua = navigator.userAgent || '';

    if (/Android/i.test(ua)) {
      var am = ua.match(/Android\s([\d.]+)/);
      return { family: 'ad', ver: am ? am[1].split('.')[0] : null };
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
      var im = ua.match(/OS\s(\d+)_/);
      return { family: 'io', ver: im ? im[1] : null };
    }
    if (/Windows/i.test(ua)) {
      var nt = ua.match(/Windows NT ([\d.]+)/);
      if (/Windows 98/.test(ua)) return { family: 'win', ver: '98', nt: '4.10' };
      if (nt) return { family: 'win', ver: mapNT(nt[1]), nt: nt[1] };
      return { family: 'win', ver: 'nt-xxxx' };
    }
    if (/Mac OS X/i.test(ua) || /Macintosh/i.test(ua)) {
      var mv = ua.match(/Mac OS X ([\d_]+)/);
      return { family: 'mac', ver: mv ? fmtMac(mv[1]) : null };
    }
    if (/Linux/i.test(ua)) {
      var names = ['Ubuntu', 'Debian', 'Fedora', 'Arch', 'Manjaro', 'Mint', 'openSUSE', 'Kali'];
      for (var i = 0; i < names.length; i++) {
        if (ua.indexOf(names[i]) >= 0) return { family: 'lx', ver: names[i].toLowerCase() };
      }
      return { family: 'lx', ver: null };
    }
    return { family: 'ot', ver: null };
  }

  // 高熵 API 精确区分 Win10 / Win11（UA 里都是 NT 10.0）
  function refineOS(os) {
    return new Promise(function (resolve) {
      try {
        var uad = navigator.userAgentData;
        if (!uad || !uad.getHighEntropyValues) return resolve(os);
        uad.getHighEntropyValues(['platformVersion']).then(function (h) {
          if (os.family === 'win' && os.nt === '10.0' && h.platformVersion) {
            var major = parseInt(h.platformVersion.split('.')[0], 10);
            if (major >= 13) os.ver = '11'; // platformVersion 13+ 即 Windows 11
          }
          resolve(os);
        }).catch(function () { resolve(os); });
      } catch (e) { resolve(os); }
    });
  }

  function osCode(os) {
    if (os.family === 'win') return os.ver || 'nt-xxxx';
    if (os.family === 'mac') return 'mc-' + (os.ver || 'xxxx');
    if (os.family === 'lx') return 'lx-' + (os.ver || 'xxxx');
    if (os.family === 'ad') return 'ad-' + (os.ver || 'xxxx');
    if (os.family === 'io') return 'io-' + (os.ver || 'xxxx');
    return 'ot-xxxx';
  }

  /* ==================== IP（公网 + 内网）哈希 ==================== */

  // 第三方接口获取公网 IP（需 CORS 放行，超时/失败返回 null）
  function getPublicIP(timeout) {
    return new Promise(function (resolve) {
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var t = setTimeout(function () { if (ctrl) ctrl.abort(); resolve(null); }, timeout || CONFIG.ipTimeout);
      fetch(CONFIG.publicIPAPI, { signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          clearTimeout(t);
          if (j && typeof j.ip === 'string' && j.ip) resolve(j.ip);
          else resolve(null);
        })
        .catch(function () { clearTimeout(t); resolve(null); });
    });
  }

  function getLocalIP(timeout) {
    return new Promise(function (resolve) {
      var done = function (v) { clearTimeout(t); resolve(v); };
      var t = setTimeout(function () { done(null); }, timeout || 1200);
      try {
        var pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pc.createDataChannel('');
        pc.onicecandidate = function (e) {
          if (!e.candidate) { done(null); return; }
          var m = /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/.exec(e.candidate.candidate);
          if (m) { try { pc.close(); } catch (x) {} done(m[1]); }
        };
        pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
          .catch(function () { done(null); });
      } catch (e) { done(null); }
    });
  }

  // 生成 IP 哈希：SHA-256(盐 + IP)，取前 12 位 hex
  function buildIPHash(ip) {
    if (!ip) return Promise.resolve('ip-xxxxxxxxxxxx');
    return sha256Hex(CONFIG.salt + ':' + ip).then(function (h) {
      return 'ip-' + h.slice(0, CONFIG.ipHashLen);
    });
  }

  /* ==================== userid 管理 ==================== */

  var USERID_RE = /^cialloblog-[a-z0-9]+(?:-[a-z0-9.]+)?-[0-9a-f]{4}-\d{4}$/i;

  function validID(id) {
    return !!id && USERID_RE.test(id);
  }

  // 双写：localStorage + cookie（10 年）同步持久化，保证 userid 固定
  function persistID(id) {
    try { localStorage.setItem(CONFIG.storeKey, id); } catch (e) {}
    setCookie(CONFIG.storeKey, id, CONFIG.cookieDays);
  }

  // 优先级：URL ?userid= 参数 > localStorage > cookie > 新建
  function loadOrCreateUserID(code) {
    var fresh = false;
    var urlId = getParam('userid');
    if (validID(urlId)) {
      persistID(urlId);
      return { id: urlId, fresh: false };
    }
    var saved = '';
    try { saved = localStorage.getItem(CONFIG.storeKey) || ''; } catch (e) {}
    if (!validID(saved)) saved = getCookie(CONFIG.storeKey);
    if (validID(saved)) {
      persistID(saved); // 读到任一处就同步到另一处，保证一致
      return { id: saved, fresh: false };
    }

    var id = 'cialloblog-' + code + '-' + randHex(4) + '-' + new Date().getFullYear();
    persistID(id);
    return { id: id, fresh: true };
  }

  /* ==================== 隐形水印 ==================== */

  function buildWatermark(userid, code, ipHash) {
    lastIPHash = ipHash;
    try {
      var W = 380, H = 190;
      var canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) {
        wmStatus = 'no-context';
        wmWarn('拿不到 canvas 2d 上下文，本次跳过水印（页面其他功能不受影响）');
        return false;
      }
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-Math.PI / 7); // 约 -25.7 度
      ctx.fillStyle = 'rgba(' + CONFIG.wmColor + ',0.55)';
      ctx.font = '14px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(userid, 0, -10);
      ctx.fillText(code + ' | ' + ipHash, 0, 12);

      // 读回校验：确认文字真的写进了像素，也能发现读回被屏蔽的情况
      var painted = 0;
      try {
        var px = ctx.getImageData(0, 0, W, H).data;
        for (var i = 3; i < px.length; i += 4) { if (px[i] > 0) painted++; }
      } catch (e) {
        painted = -1; // 读回被拒，交给下面的 dataURL 长度兜底判断
      }
      if (painted === 0) {
        wmStatus = 'blank';
        wmWarn('canvas 像素读回为空，绘制未生效');
        return false;
      }

      var url = canvas.toDataURL('image/png');
      // 空白 PNG 的 dataURL 极短；被 Brave / Firefox 指纹防护抹白时会明显偏小
      if (!url || url.indexOf('data:image/png') !== 0 || url.length < CONFIG.wmMinDataLen) {
        wmStatus = 'blocked';
        wmWarn('canvas 内容疑似被浏览器隐私保护屏蔽（Brave / Firefox 指纹防护等），水印将不可见');
        return false;
      }

      if (wmEl) wmEl.remove();
      wmEl = document.createElement('div');
      wmEl.id = 'cb-watermark';
      wmEl.setAttribute('aria-hidden', 'true');
      wmEl.style.cssText =
        'position:fixed;left:0;top:0;width:100vw;height:100vh;' +
        'pointer-events:none;z-index:' + CONFIG.wmZIndex + ';' +
        'background-image:url("' + url + '");background-repeat:repeat;' +
        'background-size:' + W + 'px ' + H + 'px;' +
        'opacity:' + CONFIG.wmOpacity + ';user-select:none;';
      document.documentElement.appendChild(wmEl);
      wmStatus = 'ok';
      return true;
    } catch (e) {
      wmStatus = 'error';
      wmWarn('水印绘制异常：' + (e && e.message ? e.message : e));
      return false;
    }
  }

  // 防删除/防隐藏：MutationObserver + 定时器双重保险
  function guardWatermark(rebuild) {
    var lastCheck = 0;
    var check = function () {
      var now = Date.now();
      if (now - lastCheck < 500) return;   // 节流：文章页 DOM 变动频繁，避免高频强制重排
      lastCheck = now;
      try {
        if (!wmEl || !wmEl.isConnected) { rebuild(); return; }
        var cs = window.getComputedStyle(wmEl);
        if (cs.display === 'none' || cs.visibility === 'hidden' ||
            parseFloat(cs.opacity || '1') < 0.001) {
          rebuild();
        }
      } catch (e) { /* 忽略，避免影响页面 */ }
    };
    try {
      new MutationObserver(check)
        .observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    if (wmTimer) clearInterval(wmTimer);
    wmTimer = setInterval(check, 5000);
  }

  /* ==================== 链接 / 表单自动携带 userid ==================== */

  function getTrackUrl(url) {
    if (!url || /^(javascript:|#)/.test(url) || !currentUserID) return url;
    try {
      var u = new URL(url, location.href);
      if (u.origin !== location.origin) return url; // 只拼接站内链接
      if (!u.searchParams.has('userid')) u.searchParams.set('userid', currentUserID);
      return u.toString();
    } catch (e) { return url; }
  }

  function attachTrackers() {
    // data-track 链接
    var links = document.querySelectorAll('a[' + CONFIG.trackAttr + ']');
    for (var i = 0; i < links.length; i++) {
      if (links[i].dataset.tracked) continue;
      links[i].dataset.tracked = '1';
      links[i].href = getTrackUrl(links[i].href);
    }
    // data-track-form 表单（避免干扰第三方评论组件，只有显式标记才注入）
    var forms = document.querySelectorAll('form[' + CONFIG.trackFormAttr + ']');
    for (var j = 0; j < forms.length; j++) {
      if (forms[j].querySelector('input[name="userid"]')) continue;
      var inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = 'userid';
      inp.value = currentUserID;
      forms[j].appendChild(inp);
    }
  }

  /* ==================== 地址栏参数同步 ==================== */

  // 把 userid / userfrom 同步进地址栏 URL（history.replaceState，不刷新页面、保留现有参数）
  // 这样用户复制地址栏链接时，追踪参数就带在链接里了
  function syncParamsToURL() {
    if (!currentUserID || !history.replaceState) return;
    try {
      var u = new URL(location.href);
      var changed = false;

      if (u.searchParams.get('userid') !== currentUserID) {
        u.searchParams.set('userid', currentUserID);
        changed = true;
      }

      // 来源参数 userfrom（与 gtag-config.js 的来源检测共用 localStorage 键）
      if (!u.searchParams.has('userfrom')) {
        var uf = '';
        try {
          uf = (typeof window.getUserFrom === 'function')
            ? (window.getUserFrom() || '')
            : (localStorage.getItem('site_user_from') || '');
        } catch (e) { uf = ''; }
        if (uf) { u.searchParams.set('userfrom', uf); changed = true; }
      }

      if (changed) history.replaceState(null, '', u.toString());
    } catch (e) {}
  }

  /* ==================== IP 哈希（按会话缓存） ==================== */

  // 全站铺开后每个页面都查一次第三方接口既慢又浪费 → 同一会话内只查一次
  var IP_CACHE_KEY = 'cb_iphash';

  function resolveIPHash() {
    try {
      var cached = sessionStorage.getItem(IP_CACHE_KEY);
      if (cached) return Promise.resolve(cached);
    } catch (e) {}
    return getPublicIP().then(function (ip) {
      if (ip) return buildIPHash(ip);            // 优先公网 IP
      return getLocalIP().then(buildIPHash);     // 失败降级内网 IP
    }).then(function (h) {
      // 只缓存有效结果，失败占位不要固化
      if (h && h.indexOf('xxxxxxxxxxxx') < 0) {
        try { sessionStorage.setItem(IP_CACHE_KEY, h); } catch (e) {}
      }
      return h;
    });
  }

  /* ==================== 初始化 ==================== */

  function init() {
    // 若服务端注入了 <meta name="cb-ip-hash">（Cloudflare Worker 方案），优先使用
    var meta = document.querySelector('meta[name="cb-ip-hash"]');
    if (meta && meta.getAttribute('content')) {
      lastIPHash = 'ip-' + meta.getAttribute('content').slice(0, CONFIG.ipHashLen);
    }

    var os = detectOSFromUA();
    osCodeStr = osCode(os);
    var r = loadOrCreateUserID(osCodeStr);
    currentUserID = r.id;

    // 先画一个初步水印，避免空白期
    buildWatermark(currentUserID, osCodeStr, lastIPHash);
    guardWatermark(function () {
      buildWatermark(currentUserID, osCodeStr, lastIPHash);
    });
    syncParamsToURL(); // 先把 userid/userfrom 写进地址栏

    // 异步完善：精确 OS（Win10/11）+ IP 哈希，完成后重绘水印并挂载追踪器
    Promise.all([
      refineOS(os).then(function (o2) {
        var c2 = osCode(o2);
        if (c2 !== osCodeStr && r.fresh) {
          // 仅本次新建的 id 才更新 OS 段；历史 id 保持稳定不动
          osCodeStr = c2;
          currentUserID = 'cialloblog-' + osCodeStr + '-' + randHex(4) + '-' + new Date().getFullYear();
          persistID(currentUserID);
        } else {
          osCodeStr = c2;
        }
      }),
      resolveIPHash()
    ]).then(function (res) {
      buildWatermark(currentUserID, osCodeStr, res[1]);
      syncParamsToURL(); // OS 精确识别后 id 可能已更新，地址栏同步一次
      attachTrackers();
    });

    // 页面加载完后把新出现的 data-track 链接也挂上
    if (document.readyState === 'complete') {
      attachTrackers();
    } else {
      window.addEventListener('load', attachTrackers);
    }
  }

  // 用 try 包住：任何意外只在控制台报一声，绝不连累宿主页面的其他脚本
  try {
    init();
  } catch (e) {
    wmWarn('初始化失败：' + (e && e.message ? e.message : e));
  }

  /* 调试 / 站长自查入口 */
  window.CB_Tracking = {
    get userid() { return currentUserID; },
    get os() { return osCodeStr; },
    get ipHash() { return lastIPHash; },
    getTrackUrl: getTrackUrl,
    get watermarked() { return !!(wmEl && wmEl.isConnected); },
    get status() { return wmStatus; }   // pending / ok / no-context / blank / blocked / error
  };

  /* =====================================================================
   * [可选升级] 服务端公网 IP 哈希（Cloudflare Worker 版）
   * 在 Worker 的 fetch 处理 HTML 响应时注入以下两行（ipHash 为 SHA-256
   * 加服务端私密盐后的结果，取前 12 位）：
   *
   *   const text = await response.text();
   *   const ipHash = await sha256(cfConnectingIP + SERVER_SALT); // 取前12位
   *   return new Response(text.replace('<head>',
   *     '<head><meta name="cb-ip-hash" content="' + ipHash + '">'), ...);
   *
   * 前端 tracking.js 检测到 <meta name="cb-ip-hash"> 时优先使用它：
   *
   *   var meta = document.querySelector('meta[name="cb-ip-hash"]');
   *   if (meta && meta.content) { lastIPHash = 'ip-' + meta.content.slice(0,12); }
   *
   * 注意：用了服务端版后，把本文件 CONFIG.salt 替换为服务端私密盐，
   * 否则两边的哈希对不上。
   * ===================================================================== */
})();
