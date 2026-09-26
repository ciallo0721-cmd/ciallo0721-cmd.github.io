/* ==========================================================================
   iswarmaupdate.js —「沃玛更新了吗」页面逻辑
   --------------------------------------------------------------------------
   数据：../data/bili-watch.json（由 实用工具/bili_watch.py 生成）
   监控：106320250（warma养鸽场）、53456（Warma）
   依赖：../js/js/bili-watch.js（BW 核心）
   ========================================================================== */
(function () {
  'use strict';

  var NEW_DAYS = 7;          // 多少天内的视频标 NEW
  var STORE_KEY = 'iswarma_shot_target';

  var snap = null;
  var dom = {};
  var busy = false;

  function $(id) { return document.getElementById(id); }
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, String(v));
    } catch (e) { /* 隐私模式忽略 */ }
    return null;
  }

  /* ---------- 缓存 DOM ---------- */
  function cacheDom() {
    var ids = ['statusCard', 'statusBadge', 'statusTitle', 'statusText', 'lastUpdate',
      'seasonCount', 'videoCount', 'sigSource', 'sigSnap', 'sigWatch', 'sigRoute',
      'windowAddr', 'shotImg', 'shotLoading', 'shotLoadingText', 'shotTimer',
      'shotBar', 'shotBarFill', 'shotNote', 'btnShotRefresh', 'footHint',
      'selShotTarget', 'chkOnlyNew', 'btnReload', 'btnProbe', 'btnClearLog',
      'logList', 'upList'];
    for (var i = 0; i < ids.length; i++) dom[ids[i]] = $(ids[i]);
  }

  function logIt(msg, tone) { BW.log(dom.logList, msg, tone); }

  /* ---------- 状态卡 ---------- */
  var TEXT = {
    fresh: { badge: '刚更新', title: '沃玛更新了！' },
    recent: { badge: '近期更新', title: '沃玛最近有更新' },
    idle: { badge: '沉寂中', title: '沃玛有一阵子没更新了' },
    stale: { badge: '很久没动静', title: '沃玛很久没更新了' },
    unknown: { badge: '状态未知', title: '暂时读不到更新状态' }
  };

  function setCard(state, badge, title, text) {
    dom.statusCard.className = 'status-card';
    dom.statusCard.setAttribute('data-state', state);
    dom.statusBadge.textContent = badge;
    dom.statusTitle.textContent = title;
    dom.statusText.textContent = text;
  }

  /* ---------- 渲染：状态总览 ---------- */
  function renderStatus() {
    var ups = snap.ups || {};
    var keys = Object.keys(ups);
    if (!keys.length) {
      setCard('unknown', '无数据', '快照里没有任何账号',
        '请先运行「实用工具/bili_watch.py」重新生成数据。');
      return;
    }

    var top = null, topUp = null;
    for (var i = 0; i < keys.length; i++) {
      var u = ups[keys[i]];
      if (u.latest && (!top || (u.latest.pubdate || 0) > (top.latest.pubdate || 0))) {
        top = u; topUp = u.latest;
      }
    }

    if (!top || !topUp) {
      setCard('unknown', '无更新记录', '快照里没有带时间的视频',
        '合集可能为空，或抓取时接口未返回数据。');
      dom.lastUpdate.textContent = '—';
      return;
    }

    var ts = topUp.pubdate || 0;
    var state = BW.stateOf(ts, { fresh: 3, recent: 30, idle: 180 });
    var cfg = TEXT[state] || TEXT.unknown;

    setCard(state, cfg.badge, topUp.title || '（无标题）',
      '来自 ' + top.name + ' · ' + (topUp.season_title || '合集') +
      ' · ' + BW.util.datetime(ts) + '（' + BW.util.ago(ts) + '）');

    dom.lastUpdate.textContent = BW.util.ago(ts);

    var sc = 0, vc = 0;
    for (var j = 0; j < keys.length; j++) {
      sc += ups[keys[j]].season_count || (ups[keys[j]].seasons || []).length;
      vc += ups[keys[j]].archive_in_seasons || 0;
    }
    dom.seasonCount.textContent = String(sc);
    dom.videoCount.textContent = BW.util.num(vc);
  }

  /* ---------- 渲染：信号行 ---------- */
  function renderSignals() {
    var gen = snap.generated_at || 0;
    dom.sigSource.className = 'sig is-ok';
    dom.sigSource.querySelector('.sig-v').textContent = '数据源：同源快照';

    dom.sigSnap.className = 'sig is-ok';
    dom.sigSnap.querySelector('.sig-v').textContent =
      '快照时间：' + BW.util.datetime(gen) + '（' + BW.util.ago(gen) + '）';

    var n = Object.keys(snap.ups || {}).length;
    dom.sigWatch.className = 'sig';
    dom.sigWatch.querySelector('.sig-v').textContent = '监控对象：' + n + ' 个账号';

    if (BW.hasSelfRelay) {
      dom.sigRoute.className = 'sig is-ok';
      dom.sigRoute.querySelector('.sig-v').textContent = '实时通路：自建中转可用';
    } else {
      dom.sigRoute.className = 'sig';
      dom.sigRoute.querySelector('.sig-v').textContent = '实时通路：公共中继（不稳，可自建）';
    }

    if ((snap.errors || []).length) {
      logIt('抓取快照时有告警：' + snap.errors.join('；'), 'bad');
    }
  }

  /* ---------- 渲染：账号卡 ---------- */
  function buildUpSection(key) {
    var u = snap.ups[key];
    var wrap = document.createElement('div');
    wrap.className = 'up-section';

    var head = document.createElement('div');
    head.className = 'up-section-head';
    var h2 = document.createElement('h2');
    h2.textContent = u.name || ('UID ' + u.mid);
    var line = document.createElement('div');
    line.className = 'panel-line';
    head.appendChild(h2);
    head.appendChild(line);
    wrap.appendChild(head);

    var card = document.createElement('article');
    card.className = 'up-card';

    /* —— 头部 —— */
    var uh = document.createElement('div');
    uh.className = 'up-head';

    var face = document.createElement('img');
    face.className = 'up-face';
    face.alt = u.name || '';
    face.loading = 'lazy';
    /* B 站图床有防盗链：带本站 Referer 会 403，必须声明 no-referrer */
    face.referrerPolicy = 'no-referrer';
    face.onerror = function () { this.style.visibility = 'hidden'; };
    face.src = u.face || '';
    uh.appendChild(face);

    var idBox = document.createElement('div');
    idBox.className = 'up-id';
    var nameEl = document.createElement('h3');
    nameEl.className = 'up-name';
    nameEl.textContent = u.name || ('UID ' + u.mid);
    if (u.level) {
      var lv = document.createElement('span');
      lv.className = 'up-lv';
      lv.textContent = 'LV' + u.level;
      nameEl.appendChild(lv);
    }
    idBox.appendChild(nameEl);

    var sign = document.createElement('p');
    sign.className = 'up-sign';
    sign.textContent = u.sign || '（这位 UP 没有填签名）';
    idBox.appendChild(sign);

    var tags = document.createElement('div');
    tags.className = 'up-tags';
    var tagList = ['UID ' + u.mid];
    if (u.official) tagList.push(u.official);
    tagList.push((u.seasons || []).length + ' 个合集');
    if (u.latest) tagList.push('最近更新 ' + BW.util.ago(u.latest.pubdate));
    for (var t = 0; t < tagList.length; t++) {
      var tg = document.createElement('span');
      tg.className = 'up-tag';
      tg.textContent = tagList[t];
      tags.appendChild(tg);
    }
    idBox.appendChild(tags);
    uh.appendChild(idBox);

    uh.appendChild(BW.linkBtn(BW.util.surl(u.mid), '空间', 'external-link-alt'));
    card.appendChild(uh);

    /* —— 统计 —— */
    var stats = document.createElement('div');
    stats.className = 'up-stats';
    var statDefs = [
      ['粉丝', BW.util.num(u.fans)],
      ['获赞', BW.util.num(u.likes)],
      ['合集', String((u.seasons || []).length)],
      ['收录视频', BW.util.num(u.archive_in_seasons || 0)]
    ];
    for (var s = 0; s < statDefs.length; s++) {
      var st = document.createElement('div');
      st.className = 'stat';
      var k = document.createElement('span');
      k.className = 'stat-k';
      k.textContent = statDefs[s][0];
      var v = document.createElement('strong');
      v.className = 'stat-v';
      v.textContent = statDefs[s][1];
      st.appendChild(k);
      st.appendChild(v);
      stats.appendChild(st);
    }
    card.appendChild(stats);

    /* —— 合集列表（按最新一期倒序） —— */
    var listBox = document.createElement('div');
    listBox.className = 'season-list';

    var seasons = (u.seasons || []).slice();
    seasons.sort(function (a, b) {
      var at = (a.archives && a.archives[0]) ? a.archives[0].pubdate : 0;
      var bt = (b.archives && b.archives[0]) ? b.archives[0].pubdate : 0;
      return (bt || 0) - (at || 0);
    });

    if (!seasons.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = '<i class="fas fa-folder-open"></i>这个账号还没有公开合集';
      listBox.appendChild(empty);
    }

    for (var i = 0; i < seasons.length; i++) {
      listBox.appendChild(buildSeason(seasons[i]));
    }
    card.appendChild(listBox);

    wrap.appendChild(card);
    return wrap;
  }

  function buildSeason(s) {
    var arcs = (s.archives || []).slice();
    var latestTs = arcs.length ? (arcs[0].pubdate || 0) : 0;
    var isNew = BW.util.days(latestTs) <= NEW_DAYS;

    var det = document.createElement('details');
    det.className = 'season';
    if (dom.chkOnlyNew && dom.chkOnlyNew.checked) det.open = true;

    var sum = document.createElement('summary');
    sum.className = 'season-head';

    var cover = document.createElement('img');
    cover.className = 'season-cover';
    cover.loading = 'lazy';
    cover.alt = s.title || '';
    /* 同上：B 站图床防盗链，必须 no-referrer */
    cover.referrerPolicy = 'no-referrer';
    cover.onerror = function () { this.style.visibility = 'hidden'; };
    cover.src = s.cover || (arcs[0] && arcs[0].cover) || '';
    sum.appendChild(cover);

    var title = document.createElement('span');
    title.className = 'season-title';
    title.textContent = s.title || '未命名合集';
    sum.appendChild(title);

    if (isNew) {
      var badge = document.createElement('span');
      badge.className = 'season-badge';
      badge.textContent = 'NEW';
      sum.appendChild(badge);
    }

    var meta = document.createElement('span');
    meta.className = 'season-meta';
    meta.textContent = s.total + ' 期 · 最近 ' + (latestTs ? BW.util.ago(latestTs) : '未知');
    sum.appendChild(meta);

    var chev = document.createElement('i');
    chev.className = 'fas fa-chevron-down';
    sum.appendChild(chev);

    det.appendChild(sum);

    if (!arcs.length) {
      var e = document.createElement('div');
      e.className = 'empty';
      e.textContent = '这个合集暂时读不到视频列表';
      det.appendChild(e);
    } else {
      var ul = document.createElement('ul');
      ul.className = 'video-list';
      for (var i = 0; i < arcs.length; i++) {
        ul.appendChild(BW.videoItem(arcs[i], {
          isNew: BW.util.days(arcs[i].pubdate) <= NEW_DAYS
        }));
      }
      det.appendChild(ul);

      var foot = document.createElement('div');
      foot.className = 'video-more';
      foot.textContent = '共 ' + s.total + ' 期，本页显示 ' + arcs.length + ' 条';
      det.appendChild(foot);
    }
    return det;
  }

  function renderUps() {
    dom.upList.innerHTML = '';
    var keys = Object.keys(snap.ups || {});
    /* 先展示养鸽场（小号），再主号 */
    keys.sort(function (a, b) {
      return a === '106320250' ? -1 : (b === '106320250' ? 1 : String(a) < String(b) ? -1 : 1);
    });
    for (var i = 0; i < keys.length; i++) {
      dom.upList.appendChild(buildUpSection(keys[i]));
    }
  }

  /* ---------- 载入快照 ---------- */
  function load(first) {
    setCard('checking', '载入中…', '正在读取更新快照', '数据文件与页面同源，通常一次就好。');
    return BW.snapshot().then(function (j) {
      snap = j;
      renderStatus();
      renderSignals();
      renderUps();
      renderShotTargets();
      if (first) refreshShot();
      logIt('已读取快照：' + Object.keys(j.ups || {}).length + ' 个账号 · 生成于 '
        + BW.util.datetime(j.generated_at), 'ok');
      if (!first) logIt('快照已重新读取', 'ok');
    }).catch(function (err) {
      setCard('unknown', '读取失败', '读不到快照文件',
        '路径 ' + BW.SNAPSHOT + ' 读取失败：' + err.message + '。请先运行抓取脚本生成数据。');
      dom.sigSource.className = 'sig is-bad';
      dom.sigSource.querySelector('.sig-v').textContent = '数据源：读取失败';
      logIt('快照读取失败：' + err.message, 'bad');
    });
  }

  /* ---------- 实时探测（需要可用中继） ---------- */
  function probe() {
    if (busy || !snap) return;
    busy = true;
    var btn = dom.btnProbe;
    btn.disabled = true;
    btn.querySelector('span').textContent = '探测中…';
    logIt('开始实时探测（经中继直接问 B 站）…');

    var mids = Object.keys(snap.ups || {});
    var chain = Promise.resolve();

    mids.forEach(function (mid) {
      chain = chain.then(function () {
        return BW.api.card(mid).then(function (c) {
          var old = snap.ups[mid] || {};
          var diff = Number(c.fans) - Number(old.fans || 0);
          var tail = diff === 0 ? '与快照一致'
            : '快照为 ' + BW.util.num(old.fans) + '，' + (diff > 0 ? '多了 ' : '少了 ') + BW.util.num(Math.abs(diff));
          logIt(c.name + '：粉丝 ' + BW.util.num(c.fans) + '，' + tail, diff === 0 ? null : 'ok');
        }).catch(function (err) {
          logIt('UID ' + mid + ' 档案探测失败：' + err.message, 'bad');
        });
      });
      chain = chain.then(function () {
        return BW.api.seasons(mid).then(function (list) {
          var old = (snap.ups[mid] || {}).seasons || [];
          var oldMap = {};
          old.forEach(function (s) { oldMap[String(s.season_id)] = s; });
          var changed = 0;
          list.forEach(function (s) {
            var o = oldMap[String(s.season_id)];
            if (!o) { logIt('发现新合集：' + s.title + '（快照里没有）', 'ok'); changed++; return; }
            if (Number(s.total) > Number(o.total)) {
              logIt('合集「' + s.title + '」期数 ' + o.total + ' → ' + s.total + '，可能有新内容', 'ok');
              changed++;
            }
          });
          if (!changed) logIt('UID ' + mid + ' 的合集结构与快照一致，暂未发现新内容');
        }).catch(function (err) {
          logIt('UID ' + mid + ' 合集探测失败：' + err.message
            + '（若所有通路都失败，可在 js/js/bili-watch.js 里填 SELF_RELAY 自建中转）', 'bad');
        });
      });
    });

    chain.then(function () {
      var route = BW.relayRoute();
      if (route) {
        dom.sigRoute.className = 'sig is-ok';
        dom.sigRoute.querySelector('.sig-v').textContent = '实时通路：' + route;
        logIt('本次实时通路：' + route, 'ok');
      } else {
        dom.sigRoute.className = 'sig is-bad';
        dom.sigRoute.querySelector('.sig-v').textContent = '实时通路：全部失败';
      }
    }).then(function () {
      busy = false;
      btn.disabled = false;
      btn.querySelector('span').textContent = '实时探测';
    });
  }

  /* ---------- 截图 ---------- */
  /* 截图目标 = 各合集「最新一期」的移动端视频页。
     为什么不截空间页：实测第三方渲染服务打开 space.bilibili.com 会被
     B 站反爬挂住（页面资源永不结束），30 秒服务端硬超时 → HTTP 408。
     换 m.bilibili.com 的单集视频页是轻量页，3~5 秒就能出完整内容。 */
  function shotUrl(bvid) {
    return 'https://m.bilibili.com/video/' + bvid;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderShotTargets() {
    var sel = dom.selShotTarget;
    if (!sel || !snap || !snap.ups) return;
    var keep = sel.value || store(STORE_KEY) || '';
    var mids = Object.keys(snap.ups);
    mids.sort(function (a, b) {
      return a === '106320250' ? -1 : (b === '106320250' ? 1 : String(a) < String(b) ? -1 : 1);
    });
    var frag = '';
    for (var i = 0; i < mids.length; i++) {
      var u = snap.ups[mids[i]];
      var seasons = u.seasons || [];
      var opts = '';
      for (var k = 0; k < seasons.length; k++) {
        var s = seasons[k];
        var a = (s.archives || [])[0];
        if (!a || !a.bvid) continue;
        opts += '<option value="' + shotUrl(a.bvid) + '">'
          + esc(s.title) + ' · 最新一期</option>';
      }
      if (opts) frag += '<optgroup label="' + esc(u.name || mids[i]) + '">' + opts + '</optgroup>';
    }
    if (!frag) return;
    sel.innerHTML = frag;
    for (var n = 0; n < sel.options.length; n++) {
      if (sel.options[n].value === keep) { sel.value = keep; break; }
    }
  }

  function currentTarget() {
    return (dom.selShotTarget && dom.selShotTarget.value) || '';
  }

  function refreshShot() {
    var url = currentTarget();
    if (!url) return;
    dom.windowAddr.textContent = url.replace(/^https?:\/\//, '');
    BW.takeShot(url, null, logIt);
  }

  /* ---------- 事件 ---------- */
  function bind() {
    dom.btnReload.addEventListener('click', function () {
      dom.btnReload.disabled = true;
      dom.btnReload.querySelector('span').textContent = '读取中…';
      load(false).then(function () {
        dom.btnReload.disabled = false;
        dom.btnReload.querySelector('span').textContent = '重新读取快照';
      }, function () {
        dom.btnReload.disabled = false;
        dom.btnReload.querySelector('span').textContent = '重新读取快照';
      });
    });

    dom.btnProbe.addEventListener('click', probe);
    dom.btnShotRefresh.addEventListener('click', refreshShot);

    dom.selShotTarget.addEventListener('change', function () {
      store(STORE_KEY, this.value);
      refreshShot();
    });

    dom.chkOnlyNew.addEventListener('change', function () {
      var open = !!this.checked;
      var list = dom.upList.querySelectorAll('details.season');
      for (var i = 0; i < list.length; i++) list[i].open = open;
      logIt(open ? '已展开全部合集' : '已折叠全部合集');
    });

    dom.btnClearLog.addEventListener('click', function () {
      dom.logList.innerHTML = '';
      logIt('日志已清空');
    });

    window.addEventListener('online', function () { logIt('网络已恢复'); });
    window.addEventListener('offline', function () { logIt('网络已断开', 'bad'); });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    cacheDom();
    /* 截图目标由快照动态生成，见 renderShotTargets() */
    /* 分享链接可用 ?open=1 让合集默认全展开 */
    if (/[?&]open=1/.test(location.search) && dom.chkOnlyNew) {
      dom.chkOnlyNew.checked = true;
    }
    bind();

    logIt('页面就绪，准备读取更新快照');
    load(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
