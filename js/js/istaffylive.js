/* ==========================================================================
   istaffylive.js —「永雏塔菲开播了吗」纯静态状态检测
   --------------------------------------------------------------------------
   房间：https://live.bilibili.com/22603245
   （broadcast_type / is_room_feed / spm_id_from / live_from 均为跟踪参数，已剔除）

   为什么必须走公共中继：
     本页部署在纯静态托管上，浏览器 fetch 会在请求里带上 Origin，
     B 站网关对该 Origin 一律返回 403（实测 api.live.bilibili.com 也如此），
     因此只能经公共 CORS 中继读取，多路自动切换 + 失败重试 + 保留上次结果。

   判定优先级（与页面说明一致）：
     1. 页面可见文本「未开播」→ 未开播
     2. 页面可见文本「直播中」/ 超级留言 → 已开播
     3. 回落到页面内 live_status / 接口 live_status：1 直播中，2 轮播中，0 未开播
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  var ROOM_ID   = 22603245;
  var PAGE_URL  = 'https://live.bilibili.com/' + ROOM_ID;
  var API_URL   = 'https://api.live.bilibili.com/room/v1/Room/get_info?room_id=' + ROOM_ID;
  var FRAME_URL = 'https://live.bilibili.com/blanc/' + ROOM_ID;
  var SHOT_API  = 'https://api.microlink.io/';

  var RELAY_TIMEOUT = 14000;   // 单次中继请求超时
  var RELAY_TRIES   = 2;       // 单个中继重试次数（公共中继常间歇性 5xx）
  var LOG_MAX       = 40;

  /* 公共 CORS 中继链，按顺序尝试；上次成功的会被提到最前 */
  var RELAYS = [
    { name: 'allorigins', wrap: function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); } },
    { name: 'corsfix',    wrap: function (u) { return 'https://proxy.corsfix.com/?' + u; } },
    { name: 'cors.lol',   wrap: function (u) { return 'https://api.cors.lol/?url=' + encodeURIComponent(u); } },
    { name: 'codetabs',   wrap: function (u) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u); } },
    { name: 'corsproxy',  wrap: function (u) { return 'https://corsproxy.io/?url=' + encodeURIComponent(u); } }
  ];

  var TEXT = {
    checking: { badge: '检测中…', title: '正在确认塔菲的开播状态', text: '正在读取直播间页面与接口，请稍候。' },
    live:    { badge: '直播中',   title: '塔菲正在直播！',       text: '检测到直播间处于直播状态，快去看看吧。' },
    round:   { badge: '轮播中',   title: '塔菲没有直播，但房间在轮播', text: '轮播的是往期内容，不是实时开播。' },
    offline: { badge: '未开播',   title: '塔菲现在没有开播',     text: '直播间处于待机状态，先收藏一下，开播了再来。' },
    unknown: { badge: '状态未知', title: '暂时读不到直播间状态', text: '所有公共数据通路都失败了，稍后再试或点「立即检测」。' }
  };

  /* ---------- 运行时状态 ---------- */
  var state = {
    interval: 60000,
    pauseHidden: true,
    stickyRelay: '',
    route: '',
    timer: null,
    nextAt: 0,
    inflight: false,
    last: null,          // { kind, title, startMs, online, at }
    mode: 'live',
    frameInited: false,
    shotBusy: false,
    shotAt: 0,
    dom: {}
  };

  /* ---------- 小工具 ---------- */
  function $(id) { return document.getElementById(id); }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fmtClock(d) {
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function fmtDuration(ms) {
    if (!(ms > 0)) return '—';
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var ss = s % 60;
    return (h > 0 ? h + ' 小时 ' : '') + m + ' 分 ' + pad2(ss) + ' 秒';
  }

  function fmtCountdown(ms) {
    if (ms <= 0) return '正在检测…';
    var s = Math.ceil(ms / 1000);
    if (s >= 60) return Math.floor(s / 60) + ' 分 ' + pad2(s % 60) + ' 秒';
    return s + ' 秒';
  }

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, String(val));
    } catch (e) { /* 隐私模式忽略 */ }
    return null;
  }

  function addLog(msg, tone) {
    var list = state.dom.logList;
    if (!list) return;
    var li = document.createElement('li');
    var t = document.createElement('time');
    t.textContent = fmtClock(new Date());
    var span = document.createElement('span');
    span.textContent = msg;
    if (tone) span.className = tone === 'ok' ? 'log-ok' : 'log-bad';
    li.appendChild(t);
    li.appendChild(span);
    list.insertBefore(li, list.firstChild);
    while (list.children.length > LOG_MAX) list.removeChild(list.lastChild);
  }

  /* ---------- 中继请求 ---------- */
  function relayOrder() {
    var list = RELAYS.slice();
    if (!state.stickyRelay) return list;
    list.sort(function (a, b) {
      return (a.name === state.stickyRelay ? -1 : 0) - (b.name === state.stickyRelay ? -1 : 0);
    });
    return list;
  }

  function rawText(url) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var ctl = (typeof AbortController === 'function') ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        if (ctl) { try { ctl.abort(); } catch (e) {} }
        reject(new Error('超时'));
      }, RELAY_TIMEOUT);

      var opts = { cache: 'no-store', credentials: 'omit', redirect: 'follow' };
      if (ctl) opts.signal = ctl.signal;

      fetch(url, opts).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      }).then(function (txt) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!txt || txt.length < 20) { reject(new Error('空响应')); return; }
        resolve(txt);
      }).catch(function (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function tryRelay(relay, url, tries) {
    return rawText(relay.wrap(url)).catch(function (err) {
      if (tries <= 1) throw err;
      return new Promise(function (res) { setTimeout(res, 700); })
        .then(function () { return tryRelay(relay, url, tries - 1); });
    });
  }

  /* 依次尝试中继，全部失败才 reject */
  function relayFetch(url, label) {
    var order = relayOrder();
    var i = 0;
    var tried = [];

    function next() {
      if (i >= order.length) {
        return Promise.reject(new Error('可用通路耗尽（' + tried.join(' / ') + '）'));
      }
      var relay = order[i++];
      return tryRelay(relay, url, RELAY_TRIES).then(function (txt) {
        state.stickyRelay = relay.name;
        state.route = relay.name;
        return { text: txt, relay: relay.name };
      }).catch(function () {
        tried.push(relay.name);
        return next();
      });
    }

    return next().then(function (r) {
      setRoute(r.relay);
      return r;
    }, function (err) {
      setRoute('');
      err.label = label;
      throw err;
    });
  }

  function setRoute(name) {
    var el = state.dom.sigRoute;
    if (!el) return;
    var v = el.querySelector('.sig-v');
    if (!v) return;
    if (name) {
      v.textContent = '数据通路：' + name;
      el.className = 'sig is-ok';
    } else {
      v.textContent = '数据通路：全部失败';
      el.className = 'sig is-bad';
    }
  }

  /* ---------- 页面解析 ---------- */
  function analyzePage(html) {
    var out = {
      ok: false, status: null, startMs: 0,
      offline: false, living: false, round: false, sc: false
    };
    if (!html || typeof html !== 'string') return out;

    /* live_status：优先取属于本房间的那一段，避免命中其它数据 */
    var own = html.match(/"room_id"\s*:\s*"?22603245"?[\s\S]{0,900}?"live_status"\s*:\s*(\d)/);
    if (own) out.status = Number(own[1]);
    if (out.status === null) {
      var any = html.match(/"live_status"\s*:\s*(\d)/);
      if (any) out.status = Number(any[1]);
    }

    var st = html.match(/"live_start_time"\s*:\s*(\d+)/);
    if (st) out.startMs = Number(st[1]) * 1000;

    /* 可见文本：剔除 script/style，否则会命中 jump_url 里的 app 跳转串 */
    var text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ');

    out.offline = /未开播|尚未开播|暂未开播/.test(text);
    out.living  = /直播中|正在直播/.test(text);
    out.round   = /轮播/.test(text);
    out.sc      = /醒目留言|超级留言|超级聊天|SuperChat/.test(text) ||
                  /"super_chat_message"\s*:\s*\{/.test(html);

    out.ok = (out.status !== null) || out.offline || out.living || out.sc;
    return out;
  }

  /* ---------- 判定 ---------- */
  function decide(page, api) {
    if (page) {
      if (page.living || page.sc) return 'live';
      if (page.offline) return 'offline';
      if (page.round) return 'round';
    }
    var ls = null;
    if (api && typeof api.live_status === 'number') ls = api.live_status;
    else if (page && page.status !== null) ls = page.status;

    if (ls === 1) return 'live';
    if (ls === 0) return 'offline';
    if (ls === 2) return 'round';
    return 'unknown';
  }

  /* ---------- 主检测流程 ---------- */
  function check(manual) {
    if (state.inflight) return Promise.resolve();
    state.inflight = true;

    var card = state.dom.statusCard;
    if (!state.last) {
      setCard('checking', TEXT.checking || {}, '正在读取直播间页面与接口…');
    } else {
      card.className = 'status-card';
      card.setAttribute('data-state', 'checking');
    }

    updateNavBtn(true);

    var page = null, api = null, fails = [];

    return relayFetch(PAGE_URL, '页面').then(function (r) {
      page = analyzePage(r.text);
      if (!page.ok) { page = null; fails.push('页面内容无法识别'); }
      return null;
    }).catch(function (err) {
      fails.push('页面抓取失败：' + err.message);
      return null;
    }).then(function () {
      return relayFetch(API_URL, '接口');
    }).then(function (r) {
      try {
        var json = JSON.parse(r.text);
        if (json && json.code === 0 && json.data) api = json.data;
        else fails.push('接口返回 code=' + (json && json.code));
      } catch (e) {
        fails.push('接口返回非 JSON');
      }
      return null;
    }).catch(function (err) {
      fails.push('接口抓取失败：' + err.message);
      return null;
    }).then(function () {
      state.inflight = false;
      updateNavBtn(false);

      var kind = decide(page, api);
      var title = (api && api.title) || '';
      var online = (api && typeof api.online === 'number') ? api.online : 0;
      var startMs = 0;
      if (kind === 'live') {
        startMs = (page && page.startMs) || parseDatetime(api && api.live_time);
      }

      render(kind, { title: title, online: online, startMs: startMs, page: page, api: api, fails: fails });
      schedule();
    });
  }

  function parseDatetime(s) {
    if (!s || typeof s !== 'string') return 0;
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return 0;
    if (Number(m[1]) < 2000) return 0;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]),
                     Number(m[4]), Number(m[5]), Number(m[6]));
    var t = d.getTime();
    return (t > 0 && t <= Date.now()) ? t : 0;
  }

  /* ---------- 渲染 ---------- */
  function setCard(stateName, cfg, overrideText) {
    var card = state.dom.statusCard;
    card.className = 'status-card';
    card.setAttribute('data-state', stateName);
    state.dom.statusBadge.textContent = cfg.badge || '检测中…';
    state.dom.statusTitle.textContent = cfg.title || '正在确认塔菲的开播状态';
    state.dom.statusText.textContent = overrideText || cfg.text || '';
  }

  function render(kind, info) {
    var cfg = TEXT[kind] || TEXT.unknown;
    var now = new Date();

    state.last = {
      kind: kind,
      title: info.title,
      startMs: info.startMs,
      online: info.online,
      at: now
    };

    setCard(kind, cfg);
    state.dom.lastCheck.textContent = fmtClock(now);
    state.dom.onlineCount.textContent = (kind === 'live' && info.online > 0)
      ? info.online.toLocaleString('zh-CN') : '—';

    /* 标题优先用房间标题 */
    if (info.title) {
      state.dom.statusTitle.textContent = (kind === 'live' ? '直播中 · ' : '') + info.title;
    }

    /* 信号标签 */
    var sp = state.dom.sigPage, sa = state.dom.sigApi;
    var pv = sp.querySelector('.sig-v'), av = sa.querySelector('.sig-v');

    if (info.page) {
      var bits = [];
      if (info.page.living) bits.push('直播中');
      if (info.page.offline) bits.push('未开播');
      if (info.page.sc) bits.push('超级留言');
      if (info.page.status !== null) bits.push('live_status=' + info.page.status);
      pv.textContent = '页面文本：' + (bits.length ? bits.join(' / ') : '未命中关键词');
      sp.className = 'sig is-ok';
    } else {
      pv.textContent = '页面文本：读取失败';
      sp.className = 'sig is-bad';
    }

    if (info.api) {
      av.textContent = '接口状态：live_status=' + info.api.live_status;
      sa.className = 'sig is-ok';
    } else {
      av.textContent = '接口状态：读取失败';
      sa.className = 'sig is-bad';
    }

    /* 日志 */
    if (kind === 'unknown') {
      addLog('检测失败：' + (info.fails.join('；') || '未知原因'), 'bad');
    } else {
      addLog('判定「' + cfg.badge + '」' +
             (info.title ? '，房间标题：' + info.title : '') +
             (info.fails.length ? '（部分通路失败：' + info.fails.join('；') + '）' : ''),
             info.fails.length ? 'bad' : 'ok');
    }

    tickMeta();
  }

  /* 每秒刷新时长 / 倒计时 */
  function tickMeta() {
    var last = state.last;
    if (last && last.kind === 'live' && last.startMs) {
      var ms = Date.now() - last.startMs;
      state.dom.liveDuration.textContent = ms > 0 ? fmtDuration(ms) : '刚刚开播';
    } else {
      state.dom.liveDuration.textContent = '—';
    }

    var nv = state.dom.sigNext.querySelector('.sig-v');
    if (!state.interval) {
      nv.textContent = '下次检测：仅手动';
      state.dom.sigNext.className = 'sig';
    } else if (state.nextAt) {
      nv.textContent = '下次检测：' + fmtCountdown(state.nextAt - Date.now());
      state.dom.sigNext.className = 'sig';
    }
  }

  function updateNavBtn(busy) {
    var btn = state.dom.btnCheckNow;
    if (!btn) return;
    btn.disabled = !!busy;
    var label = btn.querySelector('span');
    if (label) label.textContent = busy ? '检测中…' : '立即检测';
  }

  /* ---------- 轮询调度 ---------- */
  function schedule() {
    clearTimeout(state.timer);
    state.timer = null;
    if (!state.interval) { state.nextAt = 0; tickMeta(); return; }
    state.nextAt = Date.now() + state.interval;
    state.timer = setTimeout(function () {
      if (state.pauseHidden && document.hidden) { schedule(); return; }
      check(false);
    }, state.interval);
    tickMeta();
  }

  /* ---------- 查看模式 ---------- */
  function setMode(mode, silent) {
    state.mode = (mode === 'shot') ? 'shot' : 'live';

    var isShot = state.mode === 'shot';
    state.dom.tabLive.className = 'win-tab' + (isShot ? '' : ' is-on');
    state.dom.tabLive.setAttribute('aria-selected', isShot ? 'false' : 'true');
    state.dom.tabShot.className = 'win-tab' + (isShot ? ' is-on' : '');
    state.dom.tabShot.setAttribute('aria-selected', isShot ? 'true' : 'false');

    state.dom.shotPane.hidden = !isShot;
    state.dom.btnShotRefresh.disabled = !isShot;
    state.dom.footHint.textContent = isShot
      ? '截图来自第三方渲染服务，可能有延迟或验证浮层'
      : '官方嵌入播放器，未开播时显示等待画面';

    if (isShot) {
      /* 停掉播放器，避免后台继续拉流 */
      if (state.frameInited) {
        state.dom.liveFrame.src = 'about:blank';
        state.frameInited = false;
      }
      if (!state.shotAt) takeShot();
    } else if (!state.frameInited) {
      state.dom.liveFrame.src = FRAME_URL;
      state.frameInited = true;
    }

    store('ista_live_mode', state.mode);
    if (!silent) addLog('切换到' + (isShot ? '截图模式' : '实时画面'), null);
  }

  /* ---------- 截图 ---------- */
  function takeShot() {
    if (state.shotBusy) return;
    state.shotBusy = true;

    state.dom.shotImg.hidden = true;
    state.dom.shotLoading.hidden = false;
    state.dom.shotLoadingText.textContent = '正在让远端渲染服务截取直播间页面…';
    state.dom.shotNote.textContent = '';
    state.dom.btnShotRefresh.disabled = true;

    var url = SHOT_API +
      '?url=' + encodeURIComponent(PAGE_URL) +
      '&screenshot=true&meta=false' +
      '&screenshot.type=jpeg&screenshot.quality=82' +
      '&viewport.width=1440&viewport.height=810' +
      '&waitUntil=domcontentloaded';

    fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      if (!data || data.status !== 'success' || !data.data || !data.data.screenshot) {
        throw new Error((data && data.message) || '渲染服务返回失败');
      }
      var shot = data.data.screenshot;
      return new Promise(function (resolve, reject) {
        var img = state.dom.shotImg;
        var probe = new Image();
        var done = false;
        var to = setTimeout(function () {
          if (done) return;
          done = true;
          reject(new Error('截图图片加载超时'));
        }, 25000);
        probe.onload = function () {
          if (done) return;
          done = true;
          clearTimeout(to);
          img.src = probe.src;
          img.hidden = false;
          state.dom.shotLoading.hidden = true;
          resolve(shot);
        };
        probe.onerror = function () {
          if (done) return;
          done = true;
          clearTimeout(to);
          reject(new Error('截图图片加载失败'));
        };
        probe.src = shot.url;
      });
    }).then(function (shot) {
      state.shotAt = Date.now();
      state.dom.shotNote.textContent = '截图时间 ' + fmtClock(new Date()) +
        ' · ' + shot.width + '×' + shot.height + ' · ' + shot.size_pretty;
      addLog('已生成直播间截图（' + shot.size_pretty + '）', 'ok');
    }).catch(function (err) {
      state.dom.shotLoading.hidden = false;
      state.dom.shotLoadingText.textContent = '截图失败：' + err.message + '（可点「重新截图」重试）';
      addLog('截图失败：' + err.message, 'bad');
    }).then(function () {
      state.shotBusy = false;
      if (state.mode === 'shot') state.dom.btnShotRefresh.disabled = false;
    });
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    state.dom.btnCheckNow.addEventListener('click', function () { check(true); });
    state.dom.tabLive.addEventListener('click', function () { setMode('live'); });
    state.dom.tabShot.addEventListener('click', function () { setMode('shot'); });
    state.dom.btnShotRefresh.addEventListener('click', function () { takeShot(); });

    state.dom.btnClearLog.addEventListener('click', function () {
      state.dom.logList.innerHTML = '';
      addLog('日志已清空', null);
    });

    state.dom.selInterval.addEventListener('change', function () {
      state.interval = Number(this.value) || 0;
      store('ista_live_interval', state.interval);
      addLog(state.interval ? '轮询间隔改为 ' + (state.interval / 1000) + ' 秒' : '已关闭自动轮询', null);
      schedule();
    });

    state.dom.chkPause.addEventListener('change', function () {
      state.pauseHidden = !!this.checked;
      store('ista_live_pause', state.pauseHidden ? '1' : '0');
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && state.interval && state.nextAt && Date.now() > state.nextAt + 2000) {
        check(false);
      }
    });

    window.addEventListener('online', function () { addLog('网络已恢复', null); });
    window.addEventListener('offline', function () { addLog('网络已断开，轮询会失败', 'bad'); });
  }

  /* ---------- 初始化 ---------- */
  function cacheDom() {
    var ids = ['statusCard', 'statusBadge', 'statusTitle', 'statusText', 'liveDuration',
               'onlineCount', 'lastCheck', 'sigPage', 'sigApi', 'sigRoute', 'sigNext',
               'windowAddr', 'tabLive', 'tabShot', 'liveFrame', 'shotPane', 'shotLoading',
               'shotLoadingText', 'shotImg', 'shotNote', 'footHint', 'btnShotRefresh',
               'selInterval', 'chkPause', 'btnCheckNow', 'btnClearLog', 'logList'];
    for (var i = 0; i < ids.length; i++) state.dom[ids[i]] = $(ids[i]);
  }

  function restorePrefs() {
    var iv = store('ista_live_interval');
    state.interval = (iv === null || iv === '') ? 60000 : (Number(iv) || 0);
    var pause = store('ista_live_pause');
    state.pauseHidden = (pause === null) ? true : (pause === '1');
  }

  function applyPrefsToUI() {
    state.dom.selInterval.value = String(state.interval);
    state.dom.chkPause.checked = state.pauseHidden;
  }

  function init() {
    cacheDom();
    restorePrefs();
    applyPrefsToUI();
    bindEvents();

    setMode(store('ista_live_mode') || 'live', true);

    setInterval(tickMeta, 1000);

    addLog('页面就绪，房间号 ' + ROOM_ID, null);
    check(true);
    schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
