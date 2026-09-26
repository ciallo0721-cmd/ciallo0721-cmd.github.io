/* ==========================================================================
   bili-watch.js — B 站更新监控页共用核心
   --------------------------------------------------------------------------
   服务页面：/iswarmaupdate/、/ispopcornradioupdate/
   提供：快照读取 · 中继转发 · 实时拉取（含 wbi 签名）· 格式化 · 截图

   【数据从哪来】
     1) 主数据：同源快照 ../data/bili-watch.json
        —— 由「实用工具/bili_watch.py」生成（本地手动或 GitHub Actions 定时）。
           同源读取，没有跨域问题，秒开。
     2) 实时兜底：经中继直接问 B 站接口
        —— 浏览器 fetch 带 Origin 会被 B 站 403，必须经中转；公共中继不稳定，
           所以推荐自建（部署 istaffylive/bili-proxy-worker.js），把地址填进 SELF_RELAY。

   【为什么没有「全部投稿列表」】
     /x/space/wbi/arc/search 已被强风控锁死（未登录 + wbi 签名 + ticket 均 -352），
     所以数据范围是「该 UP 的合集 / 系列内的视频」，另配真实截图兜底。
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 配置 ---------- */
  var SNAPSHOT = '../data/bili-watch.json';

  /* 自建中转（推荐）：部署 istaffylive/bili-proxy-worker.js 到 Cloudflare Worker，
     把地址填在下面（结尾带 /），例如 'https://bili-proxy.abc.workers.dev/'。
     留空则只用公共中继。 */
  var SELF_RELAY = '';

  var SHOT_API = 'https://api.microlink.io/';
  var SHOT_BUDGET = 40000;      // 截图整体预算：40 秒
  var RELAY_TIMEOUT = 14000;
  var RELAY_TRIES = 2;

  var MIXIN_TAB = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
    26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
    20, 34, 44, 52];

  /* ---------- 小工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function q(id) { return document.querySelector(id); }

  /* ==========================================================================
     MD5（算法与 Python hashlib 完全一致，已用 abc / 长句 / UTF-8 校验）
     ========================================================================== */
  function md5(str) {
    function safeAdd(x, y) {
      var lsw = (x & 0xFFFF) + (y & 0xFFFF);
      var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
      return (msw << 16) | (lsw & 0xFFFF);
    }
    function rol(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
    function cmn(q, a, b, x, s, t) { return safeAdd(rol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }

    function binlMD5(x, len) {
      x[len >> 5] |= 0x80 << (len % 32);
      x[(((len + 64) >>> 9) << 4) + 14] = len;
      var i, olda, oldb, oldc, oldd, a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
      for (i = 0; i < x.length; i += 16) {
        olda = a; oldb = b; oldc = c; oldd = d;
        a = ff(a, b, c, d, x[i], 7, -680876936);
        d = ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = ff(c, d, a, b, x[i + 2], 17, 606105819);
        b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = ff(a, b, c, d, x[i + 4], 7, -176418897);
        d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = ff(c, d, a, b, x[i + 6], 17, -1473231341);
        b = ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
        d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = ff(c, d, a, b, x[i + 10], 17, -42063);
        b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = ff(a, b, c, d, x[i + 12], 7, 1804603682);
        d = ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
        b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
        a = gg(a, b, c, d, x[i + 1], 5, -165796510);
        d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = gg(c, d, a, b, x[i + 11], 14, 643717713);
        b = gg(b, c, d, a, x[i], 20, -373897302);
        a = gg(a, b, c, d, x[i + 5], 5, -701558691);
        d = gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = gg(c, d, a, b, x[i + 15], 14, -660478335);
        b = gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = gg(a, b, c, d, x[i + 9], 5, 568446438);
        d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = gg(c, d, a, b, x[i + 3], 14, -187363961);
        b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = gg(a, b, c, d, x[i + 13], 5, -1444681467);
        d = gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = gg(c, d, a, b, x[i + 7], 14, 1735328473);
        b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
        a = hh(a, b, c, d, x[i + 5], 4, -378558);
        d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = hh(c, d, a, b, x[i + 11], 16, 1839030562);
        b = hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = hh(a, b, c, d, x[i + 1], 4, -1530992060);
        d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = hh(c, d, a, b, x[i + 7], 16, -155497632);
        b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = hh(a, b, c, d, x[i + 13], 4, 681279174);
        d = hh(d, a, b, c, x[i], 11, -358537222);
        c = hh(c, d, a, b, x[i + 3], 16, -722521979);
        b = hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = hh(a, b, c, d, x[i + 9], 4, -640364487);
        d = hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = hh(c, d, a, b, x[i + 15], 16, 530742520);
        b = hh(b, c, d, a, x[i + 2], 23, -995338651);
        a = ii(a, b, c, d, x[i], 6, -198630844);
        d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
        b = ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = ii(a, b, c, d, x[i + 12], 6, 1700485571);
        d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = ii(c, d, a, b, x[i + 10], 15, -1051523);
        b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
        d = ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = ii(c, d, a, b, x[i + 6], 15, -1560198380);
        b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = ii(a, b, c, d, x[i + 4], 6, -145523070);
        d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = ii(c, d, a, b, x[i + 2], 15, 718787259);
        b = ii(b, c, d, a, x[i + 9], 21, -343485551);
        a = safeAdd(a, olda); b = safeAdd(b, oldb); c = safeAdd(c, oldc); d = safeAdd(d, oldd);
      }
      return [a, b, c, d];
    }
    function binl2rstr(input) {
      var i, output = '';
      for (i = 0; i < input.length * 32; i += 8) {
        output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF);
      }
      return output;
    }
    function rstr2binl(input) {
      var i, output = [];
      output[(input.length >> 2) - 1] = undefined;
      for (i = 0; i < output.length; i += 1) { output[i] = 0; }
      for (i = 0; i < input.length * 8; i += 8) {
        output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
      }
      return output;
    }
    function rstr2hex(input) {
      var hexTab = '0123456789abcdef', output = '', x, i;
      for (i = 0; i < input.length; i += 1) {
        x = input.charCodeAt(i);
        output += hexTab.charAt((x >>> 4) & 0x0F) + hexTab.charAt(x & 0x0F);
      }
      return output;
    }
    var utf = unescape(encodeURIComponent(str));
    return rstr2hex(binl2rstr(binlMD5(rstr2binl(utf), utf.length * 8)));
  }

  /* ==========================================================================
     中继
     ========================================================================== */
  function unwrapAllOrigins(txt) {
    var j = JSON.parse(txt);
    if (j && typeof j.contents === 'string' && j.contents.length > 20) return j.contents;
    throw new Error('allorigins 包装异常');
  }

  var RELAYS = (SELF_RELAY ? [{
    name: '自建中转',
    wrap: function (u) { return SELF_RELAY + '?u=' + encodeURIComponent(u); }
  }] : []).concat([
    { name: 'allorigins', wrap: function (u) { return 'https://api.allorigins.win/get?url=' + encodeURIComponent(u); }, unwrap: unwrapAllOrigins },
    { name: 'allorigins-raw', wrap: function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); } },
    { name: 'cors.lol', wrap: function (u) { return 'https://api.cors.lol/?url=' + encodeURIComponent(u); } },
    { name: 'codetabs', wrap: function (u) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u); } },
    { name: 'corsproxy', wrap: function (u) { return 'https://corsproxy.io/?url=' + encodeURIComponent(u); } },
    { name: 'corsfix', wrap: function (u) { return 'https://proxy.corsfix.com/?' + u; } }
  ]);

  var relayState = { sticky: '', route: '' };

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
        if (!txt || txt.length < 10) { reject(new Error('空响应')); return; }
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
    return rawText(relay.wrap(url)).then(function (txt) {
      return relay.unwrap ? relay.unwrap(txt) : txt;
    }).catch(function (err) {
      if (tries <= 1) throw err;
      return new Promise(function (res) { setTimeout(res, 700); })
        .then(function () { return tryRelay(relay, url, tries - 1); });
    });
  }

  function relayFetch(url, label) {
    var order = RELAYS.slice();
    if (relayState.sticky) {
      order.sort(function (a, b) {
        return (a.name === relayState.sticky ? -1 : 0) - (b.name === relayState.sticky ? -1 : 0);
      });
    }
    var i = 0, tried = [];

    function next() {
      if (i >= order.length) {
        return Promise.reject(new Error('可用通路耗尽（' + tried.join(' / ') + '）'));
      }
      var relay = order[i++];
      return tryRelay(relay, url, RELAY_TRIES).then(function (txt) {
        relayState.sticky = relay.name;
        relayState.route = relay.name;
        return { text: txt, relay: relay.name };
      }).catch(function () {
        tried.push(relay.name);
        return next();
      });
    }

    return next().then(function (r) {
      return r;
    }, function (err) {
      relayState.route = '';
      err.label = label || '';
      throw err;
    });
  }

  function relayJson(url, label) {
    return relayFetch(url, label).then(function (r) {
      var j;
      try { j = JSON.parse(r.text); } catch (e) { throw new Error('返回非 JSON'); }
      return { json: j, relay: r.relay };
    });
  }

  /* ==========================================================================
     wbi 签名（B 站 2024 起对部分接口的校验）
     ========================================================================== */
  var wbiCache = { key: '', at: 0 };

  function wbiKey() {
    if (wbiCache.key && Date.now() - wbiCache.at < 600000) {
      return Promise.resolve(wbiCache.key);
    }
    return relayJson('https://api.bilibili.com/x/web-interface/nav', 'nav').then(function (r) {
      var img = ((r.json.data || {}).wbi_img) || {};
      if (!img.img_url) throw new Error('nav 未返回 wbi_img');
      var iu = img.img_url.split('/').pop().split('.')[0];
      var su = img.sub_url.split('/').pop().split('.')[0];
      var raw = iu + su;
      var key = '';
      for (var i = 0; i < MIXIN_TAB.length && MIXIN_TAB[i] < raw.length; i++) key += raw[MIXIN_TAB[i]];
      key = key.slice(0, 32);
      wbiCache.key = key;
      wbiCache.at = Date.now();
      return key;
    });
  }

  function signQuery(params) {
    return wbiKey().then(function (key) {
      var p = {}, k;
      for (k in params) if (params.hasOwnProperty(k)) p[k] = String(params[k]);
      p.wts = String(Math.floor(Date.now() / 1000));
      var keys = Object.keys(p).sort();
      var parts = [];
      for (var i = 0; i < keys.length; i++) {
        parts.push(keys[i] + '=' + encodeURIComponent(p[keys[i]]));
      }
      var q = parts.join('&');
      p.w_rid = md5(q + key);
      keys = Object.keys(p).sort();
      parts = [];
      for (var j = 0; j < keys.length; j++) {
        parts.push(keys[j] + '=' + encodeURIComponent(p[keys[j]]));
      }
      return parts.join('&');
    });
  }

  /* ==========================================================================
     业务接口（全部经中继）
     ========================================================================== */
  var api = {
    /* UP 档案：昵称 / 头像 / 粉丝 / 获赞 */
    card: function (mid) {
      return relayJson('https://api.bilibili.com/x/web-interface/card?mid=' + mid, 'card')
        .then(function (r) {
          var d = r.json.data || {};
          var c = d.card || {};
          if (!c.mid) throw new Error('card 返回异常');
          return {
            mid: c.mid, name: c.name, face: c.face, sign: c.sign || '',
            fans: d.follower || 0, likes: d.like_num || 0
          };
        });
    },

    /* 该 UP 的全部合集 + 预览（免签名） */
    seasons: function (mid) {
      return relayJson('https://api.bilibili.com/x/polymer/web-space/home/seasons_series'
        + '?mid=' + mid + '&page_num=1&page_size=20', 'seasons')
        .then(function (r) {
          if (r.json.code !== 0) throw new Error('code=' + r.json.code);
          var box = ((r.json.data || {}).items_lists) || {};
          return (box.seasons_list || []).map(function (s) {
            var m = s.meta || {};
            return {
              season_id: m.season_id, title: m.title, total: m.total,
              cover: m.cover, archives: (s.archives || []).map(function (a) {
                return { bvid: a.bvid, title: a.title, pubdate: a.pubdate, duration: a.duration, cover: a.pic };
              })
            };
          });
        });
    },

    /* 合集完整列表（需 wbi 签名；经中继转发，签名写在 URL 里） */
    seasonArchives: function (mid, seasonId, pageSize) {
      var params = {
        mid: mid, season_id: seasonId,
        sort_reverse: 'true', page_num: 1, page_size: pageSize || 30
      };
      return signQuery(params).then(function (qs) {
        return relayJson('https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?'
          + qs, 'seasonArchives');
      }).then(function (r) {
        if (r.json.code !== 0) throw new Error('code=' + r.json.code);
        var arcs = ((r.json.data || {}).archives) || [];
        return arcs.map(function (a) {
          return {
            bvid: a.bvid, title: a.title, pubdate: a.pubdate, duration: a.duration,
            cover: a.pic, views: (a.stat || {}).view || 0
          };
        }).sort(function (a, b) { return (b.pubdate || 0) - (a.pubdate || 0); });
      });
    }
  };

  /* ==========================================================================
     快照读取（同源）
     ========================================================================== */
  function snapshot() {
    var url = SNAPSHOT + '?t=' + Date.now();
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (j) {
      if (!j || !j.ups) throw new Error('快照结构异常');
      return j;
    });
  }

  /* ==========================================================================
     格式化
     ========================================================================== */
  var util = {
    clock: function (d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); },

    date: function (ts) {
      if (!ts) return '—';
      var d = new Date(ts * 1000);
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    },

    datetime: function (ts) {
      if (!ts) return '—';
      var d = new Date(ts * 1000);
      return util.date(ts) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    },

    /* 距今多久：今天 / 昨天 / N 天前 / N 个月前 / 日期 */
    ago: function (ts) {
      if (!ts) return '未知';
      var diff = Date.now() - ts * 1000;
      if (diff < 0) return '刚刚';
      var day = diff / 86400000;
      if (day < 1) {
        var h = Math.floor(diff / 3600000);
        if (h < 1) return '刚刚';
        return h + ' 小时前';
      }
      if (day < 2) return '昨天';
      if (day < 31) return Math.floor(day) + ' 天前';
      if (day < 365) return Math.floor(day / 30) + ' 个月前';
      return util.date(ts);
    },

    days: function (ts) {
      if (!ts) return Infinity;
      return (Date.now() - ts * 1000) / 86400000;
    },

    /* 1503353 → 150.3 万 */
    num: function (n) {
      n = Number(n) || 0;
      if (n >= 100000000) return (n / 100000000).toFixed(1) + ' 亿';
      if (n >= 10000) return (n / 10000).toFixed(1) + ' 万';
      return String(n);
    },

    /* 675 → 11:15 */
    dur: function (sec) {
      sec = Math.floor(Number(sec) || 0);
      var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      if (h > 0) return h + ':' + pad2(m) + ':' + pad2(s);
      return m + ':' + pad2(s);
    },

    /* 两个时间点相差多少天 */
    gapDays: function (a, b) {
      if (!a || !b) return 0;
      return Math.abs(a - b) / 86400;
    },

    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },

    vurl: function (bvid) { return 'https://www.bilibili.com/video/' + bvid; },
    surl: function (mid) { return 'https://space.bilibili.com/' + mid; },
    slurl: function (mid, sid) { return 'https://space.bilibili.com/' + mid + '/lists/' + sid + '?type=season'; }
  };

  /* ==========================================================================
     状态判定
     ========================================================================== */
  function stateOf(ts, cfg) {
    cfg = cfg || {};
    var fresh = cfg.fresh == null ? 3 : cfg.fresh;      // ≤N 天 = 刚更新
    var recent = cfg.recent == null ? 30 : cfg.recent;
    var idle = cfg.idle == null ? 180 : cfg.idle;
    var d = util.days(ts);
    if (!isFinite(d)) return 'unknown';
    if (d <= fresh) return 'fresh';
    if (d <= recent) return 'recent';
    if (d <= idle) return 'idle';
    return 'stale';
  }

  /* ==========================================================================
     日志
     ========================================================================== */
  var LOG_MAX = 40;

  function log(listEl, msg, tone) {
    if (!listEl) return;
    var li = document.createElement('li');
    var t = document.createElement('time');
    t.textContent = util.clock(new Date());
    var span = document.createElement('span');
    span.textContent = msg;
    if (tone) span.className = tone === 'ok' ? 'log-ok' : 'log-bad';
    li.appendChild(t);
    li.appendChild(span);
    listEl.insertBefore(li, listEl.firstChild);
    while (listEl.children.length > LOG_MAX) listEl.removeChild(listEl.lastChild);
  }

  /* ==========================================================================
     截图（microlink，40 秒预算）
     ========================================================================== */
  var shotState = { busy: false, tick: null };

  var SHOT_IDS = ['shotImg', 'shotLoading', 'shotLoadingText', 'shotTimer',
    'shotBar', 'shotBarFill', 'shotNote', 'btnShotRefresh'];

  function shotDom() {
    var d = {};
    for (var i = 0; i < SHOT_IDS.length; i++) d[SHOT_IDS[i]] = $(SHOT_IDS[i]);
    return d;
  }

  function startShotClock(d, started) {
    if (!d.shotTimer || !d.shotBar || !d.shotBarFill) return;
    d.shotTimer.hidden = false;
    d.shotBar.hidden = false;
    d.shotBarFill.style.width = '0%';
    d.shotTimer.textContent = '预计 10 秒内出结果 · 已等待 0 秒';
    shotState.tick = setInterval(function () {
      var ms = Date.now() - started;
      var sec = Math.floor(ms / 1000);
      var pct = Math.min(96, ms / SHOT_BUDGET * 100);
      d.shotBarFill.style.width = pct.toFixed(1) + '%';
      d.shotTimer.textContent = ms >= SHOT_BUDGET
        ? '已等待 ' + sec + ' 秒 · 已超过 40 秒，正在收尾…'
        : '预计 10 秒内出结果 · 已等待 ' + sec + ' 秒';
    }, 250);
  }

  function stopShotClock(d) {
    if (shotState.tick) { clearInterval(shotState.tick); shotState.tick = null; }
    if (d.shotTimer) d.shotTimer.hidden = true;
    if (d.shotBar) d.shotBar.hidden = true;
  }

  function takeShot(pageUrl, hint, onLog) {
    if (shotState.busy) return;
    shotState.busy = true;

    var d = shotDom();
    if (d.shotImg) d.shotImg.hidden = true;
    if (d.shotLoading) d.shotLoading.hidden = false;
    if (d.shotLoadingText) d.shotLoadingText.textContent = '正在让远端渲染服务截取页面…';
    if (d.shotNote) d.shotNote.textContent = '';
    if (d.btnShotRefresh) d.btnShotRefresh.disabled = true;

    var started = Date.now();
    startShotClock(d, started);

    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var budgetTimer = setTimeout(function () { if (ctrl) ctrl.abort(); }, SHOT_BUDGET);

    var url = SHOT_API +
      '?url=' + encodeURIComponent(pageUrl) +
      '&screenshot=true&meta=false' +
      '&screenshot.type=jpeg&screenshot.quality=82' +
      '&viewport.width=1440&viewport.height=900' +
      '&waitUntil=domcontentloaded';

    fetch(url, ctrl ? { cache: 'no-store', signal: ctrl.signal } : { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (data) {
        if (!data || data.status !== 'success' || !data.data || !data.data.screenshot) {
          throw new Error((data && data.message) || '渲染服务返回失败');
        }
        var shot = data.data.screenshot;
        return new Promise(function (resolve, reject) {
          var probe = new Image();
          var done = false;
          var left = SHOT_BUDGET - (Date.now() - started);
          var to = setTimeout(function () {
            if (done) return;
            done = true;
            reject(new Error('超过 40 秒仍未出图'));
          }, left > 1000 ? left : 1000);
          probe.onload = function () {
            if (done) return;
            done = true;
            clearTimeout(to);
            if (d.shotImg) { d.shotImg.src = probe.src; d.shotImg.hidden = false; }
            if (d.shotLoading) d.shotLoading.hidden = true;
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
        stopShotClock(d);
        var cost = Math.round((Date.now() - started) / 1000);
        if (d.shotNote) {
          d.shotNote.textContent = '截图时间 ' + util.clock(new Date()) +
            ' · ' + shot.width + '×' + shot.height + ' · ' + shot.size_pretty +
            ' · 耗时 ' + cost + ' 秒';
        }
        if (onLog) onLog('已生成截图（' + shot.size_pretty + '，耗时 ' + cost + ' 秒）', 'ok');
      }).catch(function (err) {
        stopShotClock(d);
        if (d.shotLoading) d.shotLoading.hidden = false;
        var aborted = (err && err.name === 'AbortError');
        var raw = (err && err.message) || '未知错误';
        /* 406 / 429 / 403 基本都是截图服务限流，说人话 */
        var limited = /HTTP (403|406|429)/.test(raw);
        /* 408 = 渲染服务 30 秒内没打开页面（B 站空间页必现），跟等待时长无关 */
        var stuck = /HTTP 408/.test(raw);
        var friendly = aborted ? '等待超过 40 秒仍未出图'
          : stuck ? '渲染服务 30 秒内没能打开该页面（HTTP 408），换个截图目标再试'
            : limited ? '截图服务限流了（' + raw + '），等一会儿再点一次'
              : raw;
        if (d.shotLoadingText) {
          d.shotLoadingText.textContent = '截图失败：' + friendly + '（可点「重新截图」重试）';
        }
        if (onLog) onLog('截图失败：' + friendly, 'bad');
      }).then(function () {
        clearTimeout(budgetTimer);
        shotState.busy = false;
        if (d.btnShotRefresh) d.btnShotRefresh.disabled = false;
      });
  }

  /* ==========================================================================
     小部件渲染
     ========================================================================== */
  /* 视频条目 */
  function videoItem(v, opts) {
    opts = opts || {};
    var li = document.createElement('li');
    li.className = 'video-item' + (opts.isNew ? ' is-new' : '');
    var a = document.createElement('a');
    a.className = 'video-link';
    a.href = util.vurl(v.bvid);
    a.target = '_blank';
    a.rel = 'noopener';

    var img = document.createElement('img');
    img.className = 'video-cover';
    img.loading = 'lazy';
    img.alt = v.title || '';
    /* B 站图床防盗链：带本站 Referer 会 403，必须 no-referrer */
    img.referrerPolicy = 'no-referrer';
    img.onerror = function () { this.style.visibility = 'hidden'; };
    img.src = v.cover || '';

    var body = document.createElement('span');
    body.className = 'video-body';

    var t = document.createElement('span');
    t.className = 'video-title';
    t.textContent = v.title || '(无标题)';

    var meta = document.createElement('span');
    meta.className = 'video-meta';
    var bits = [];
    bits.push('<i class="fas fa-calendar"></i>' + util.date(v.pubdate) + '（' + util.ago(v.pubdate) + '）');
    if (v.duration) bits.push('<i class="fas fa-clock"></i>' + util.dur(v.duration));
    if (v.views) bits.push('<i class="fas fa-play"></i>' + util.num(v.views));
    meta.innerHTML = bits.join('');

    body.appendChild(t);
    body.appendChild(meta);
    a.appendChild(img);
    a.appendChild(body);
    li.appendChild(a);

    if (opts.isNew) {
      var badge = document.createElement('span');
      badge.className = 'video-new';
      badge.textContent = 'NEW';
      li.appendChild(badge);
    }
    return li;
  }

  /* 新窗口打开链接 */
  function linkBtn(href, text, icon) {
    var a = document.createElement('a');
    a.className = 'btn btn-ghost btn-sm';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = util.esc(text) + ' <i class="fas fa-' + (icon || 'external-link-alt') + '"></i>';
    return a;
  }

  /* ==========================================================================
     导出
     ========================================================================== */
  window.BW = {
    SNAPSHOT: SNAPSHOT,
    md5: md5,
    snapshot: snapshot,
    relayFetch: relayFetch,
    relayJson: relayJson,
    api: api,
    util: util,
    stateOf: stateOf,
    log: log,
    takeShot: takeShot,
    videoItem: videoItem,
    linkBtn: linkBtn,
    relayRoute: function () { return relayState.route; },
    hasSelfRelay: !!SELF_RELAY
  };
})();
