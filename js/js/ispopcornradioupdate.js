/* ==========================================================================
   ispopcornradioupdate.js —「爆米花电台更新了吗」页面逻辑
   --------------------------------------------------------------------------
   数据：../data/bili-watch.json 的 popcorn 段
        （合集 5906893《视频播客-爆米花电台》，归属 UID 106320250 warma养鸽场）
   依赖：../js/js/bili-watch.js（BW 核心）
   ========================================================================== */
(function () {
  'use strict';

  var NEW_DAYS = 14;         // 14 天内的新一期标 NEW
  var PACE = { fresh: 14, recent: 90, idle: 365 };
  /* 截图目标 = 最新一期的移动端视频页（原因见页面底部「关于截图模式」）。
     空间页 / 合集页会被 B 站反爬挂死触发 408，单集视频页是轻量页，可直接截。 */
  var PAGE_URL = '';

  function setShotTarget() {
    var a = (snap && snap.popcorn && (snap.popcorn.archives || [])[0]) || null;
    PAGE_URL = (a && a.bvid) ? ('https://m.bilibili.com/video/' + a.bvid) : '';
    if (dom.windowAddr) {
      dom.windowAddr.textContent = PAGE_URL
        ? PAGE_URL.replace(/^https?:\/\//, '')
        : '等待快照…';
    }
  }

  function refreshShot() {
    if (!PAGE_URL) return;
    BW.takeShot(PAGE_URL, null, logIt);
  }

  var snap = null;
  var dom = {};
  var busy = false;

  function $(id) { return document.getElementById(id); }

  function cacheDom() {
    var ids = ['statusCard', 'statusBadge', 'statusTitle', 'statusText', 'lastEp', 'lastDay',
      'totalEp', 'sigSource', 'sigSnap', 'sigOwner', 'sigRoute', 'windowAddr',
      'shotImg', 'shotLoading', 'shotLoadingText', 'shotTimer', 'shotBar', 'shotBarFill',
      'shotNote', 'btnShotRefresh', 'paceGrid', 'timeline', 'btnReload', 'btnClearLog', 'logList'];
    for (var i = 0; i < ids.length; i++) dom[ids[i]] = $(ids[i]);
  }

  function logIt(msg, tone) { BW.log(dom.logList, msg, tone); }

  /* ---------- 状态文案 ---------- */
  var TEXT = {
    fresh: { badge: '刚更新', title: '爆米花电台更新了！' },
    recent: { badge: '近期更新', title: '最近有一期新的' },
    idle: { badge: '有一阵子了', title: '有阵子没更新了' },
    stale: { badge: '年更预定', title: '挺久没动静了' },
    unknown: { badge: '状态未知', title: '暂时读不到更新状态' }
  };

  function setCard(state, badge, title, text) {
    dom.statusCard.className = 'status-card';
    dom.statusCard.setAttribute('data-state', state);
    dom.statusBadge.textContent = badge;
    dom.statusTitle.textContent = title;
    dom.statusText.textContent = text;
  }

  /* ---------- 期号：优先从标题里抠，抠不到就用总数推 ---------- */
  function epNo(a, index, total) {
    var m = String(a.title || '').match(/电台\s*0*(\d+)/);
    if (m) return Number(m[1]);
    return Math.max(1, total - index);
  }

  /* ---------- 统计 ---------- */
  function computeStats(arcs) {
    var st = {
      count: arcs.length, avgGap: 0, minGap: 0, maxGap: 0,
      gaps: [], totalDur: 0, totalView: 0, newest: 0, oldest: 0
    };
    if (!arcs.length) return st;
    st.newest = arcs[0].pubdate || 0;
    st.oldest = arcs[arcs.length - 1].pubdate || 0;
    for (var i = 0; i < arcs.length; i++) {
      st.totalDur += Number(arcs[i].duration) || 0;
      st.totalView += Number(arcs[i].views) || 0;
    }
    for (var j = 0; j < arcs.length - 1; j++) {
      var gap = (arcs[j].pubdate || 0) - (arcs[j + 1].pubdate || 0);
      if (gap > 0) st.gaps.push(gap / 86400);
    }
    if (st.gaps.length) {
      var sum = 0, mi = st.gaps[0], ma = st.gaps[0];
      for (var k = 0; k < st.gaps.length; k++) {
        sum += st.gaps[k];
        if (st.gaps[k] < mi) mi = st.gaps[k];
        if (st.gaps[k] > ma) ma = st.gaps[k];
      }
      st.avgGap = sum / st.gaps.length;
      st.minGap = mi;
      st.maxGap = ma;
    }
    return st;
  }

  function fmtDays(d) {
    if (!isFinite(d) || d <= 0) return '—';
    if (d < 1) return '<1 天';
    if (d < 60) return Math.round(d) + ' 天';
    return (d / 30).toFixed(1) + ' 个月';
  }

  /* 只给统计卡当副标题用：永远返回「约 N 个月前 / N 年前」，不会和主值重复 */
  function fmtAgoShort(ts) {
    if (!ts) return '';
    var d = (Date.now() - ts * 1000) / 86400000;
    if (d < 1) return '就是今天';
    if (d < 60) return '约 ' + Math.round(d) + ' 天前';
    if (d < 730) return '约 ' + Math.round(d / 30) + ' 个月前';
    return '约 ' + (d / 365).toFixed(1) + ' 年前';
  }

  function fmtLong(sec) {
    sec = Math.floor(sec || 0);
    var h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    if (h > 0) return h + ' 小时 ' + m + ' 分';
    return m + ' 分';
  }

  /* ---------- 渲染：状态总览 ---------- */
  function renderStatus(p) {
    var arcs = p.archives || [];
    if (!arcs.length) {
      setCard('unknown', '无数据', '合集里暂时读不到视频',
        '可能接口没返回内容，稍后重新读取试试。');
      dom.lastEp.textContent = '—';
      dom.lastDay.textContent = '—';
      dom.totalEp.textContent = String(p.total || 0);
      return;
    }
    var top = arcs[0];
    var ts = top.pubdate || 0;
    var state = BW.stateOf(ts, PACE);
    var cfg = TEXT[state] || TEXT.unknown;
    var no = epNo(top, 0, p.total || arcs.length);

    setCard(state, cfg.badge, '第 ' + no + ' 期 · ' + (top.title || '（无标题）'),
      '发布于 ' + BW.util.datetime(ts) + '（' + BW.util.ago(ts) + '）· 共 ' + p.total + ' 期');

    dom.lastEp.textContent = '第 ' + no + ' 期';
    dom.lastDay.textContent = Math.floor(BW.util.days(ts)) + ' 天';
    dom.totalEp.textContent = String(p.total || arcs.length);
  }

  /* ---------- 渲染：信号 ---------- */
  function renderSignals(p) {
    var gen = snap.generated_at || 0;
    dom.sigSource.className = 'sig is-ok';
    dom.sigSource.querySelector('.sig-v').textContent = '数据源：同源快照';

    dom.sigSnap.className = 'sig is-ok';
    dom.sigSnap.querySelector('.sig-v').textContent =
      '快照时间：' + BW.util.datetime(gen) + '（' + BW.util.ago(gen) + '）';

    var ownerName = (p.owner && p.owner.name) || ('UID ' + p.mid);
    dom.sigOwner.className = 'sig';
    dom.sigOwner.querySelector('.sig-v').textContent = '所属账号：' + ownerName;

    if (BW.hasSelfRelay) {
      dom.sigRoute.className = 'sig is-ok';
      dom.sigRoute.querySelector('.sig-v').textContent = '实时通路：自建中转可用';
    } else {
      dom.sigRoute.className = 'sig';
      dom.sigRoute.querySelector('.sig-v').textContent = '实时通路：公共中继（不稳，可自建）';
    }
  }

  /* ---------- 渲染：更新节奏 ---------- */
  function renderPace(p) {
    var arcs = p.archives || [];
    var st = computeStats(arcs);
    dom.paceGrid.innerHTML = '';

    var pred = null, predText = '—', predSub = '';
    if (st.newest && st.avgGap > 0) {
      pred = st.newest + Math.round(st.avgGap * 86400);
      var left = (pred * 1000 - Date.now()) / 86400000;
      predText = BW.util.date(pred);
      predSub = left > 0 ? '约 ' + Math.round(left) + ' 天后' : '已过 ' + Math.round(-left) + ' 天';
    }

    var cells = [
      ['总期数', String(p.total || arcs.length), ''],
      ['平均间隔', st.avgGap ? fmtDays(st.avgGap) : '—',
        st.gaps.length ? '共 ' + st.gaps.length + ' 次间隔' : ''],
      ['最短间隔', st.minGap ? fmtDays(st.minGap) : '—', ''],
      ['最长间隔', st.maxGap ? fmtDays(st.maxGap) : '—', ''],
      ['单期总时长', arcs.length ? fmtLong(st.totalDur) : '—',
        arcs.length ? '平均 ' + fmtLong(st.totalDur / arcs.length) : ''],
      ['总播放', BW.util.num(st.totalView), arcs.length ? '平均 ' + BW.util.num(st.totalView / arcs.length) + ' / 期' : ''],
      ['起步日期', st.oldest ? BW.util.date(st.oldest) : '—', fmtAgoShort(st.oldest)],
      ['下一期预测', predText, predSub || (st.avgGap ? '按平均 ' + fmtDays(st.avgGap) + ' 推算' : '')]
    ];

    for (var i = 0; i < cells.length; i++) {
      var st1 = document.createElement('div');
      st1.className = 'stat';
      var k = document.createElement('span');
      k.className = 'stat-k';
      k.textContent = cells[i][0];
      var v = document.createElement('strong');
      v.className = 'stat-v';
      v.textContent = cells[i][1];
      if (cells[i][2]) {
        var small = document.createElement('small');
        small.textContent = cells[i][2];
        v.appendChild(small);
      }
      st1.appendChild(k);
      st1.appendChild(v);
      dom.paceGrid.appendChild(st1);
    }

    return st;
  }

  /* ---------- 渲染：时间线 ---------- */
  function renderTimeline(p, st) {
    var arcs = p.archives || [];
    dom.timeline.innerHTML = '';

    if (!arcs.length) {
      var e = document.createElement('div');
      e.className = 'empty';
      e.innerHTML = '<i class="fas fa-music"></i>还没有可展示的期数';
      dom.timeline.appendChild(e);
      return;
    }

    for (var i = 0; i < arcs.length; i++) {
      var a = arcs[i];
      var isNew = BW.util.days(a.pubdate) <= NEW_DAYS;
      var gapDays = (i < arcs.length - 1)
        ? BW.util.gapDays((a.pubdate || 0), (arcs[i + 1].pubdate || 0)) : 0;

      var li = document.createElement('li');
      li.className = 'tl-item' + (isNew ? ' is-new' : '');

      var dot = document.createElement('span');
      dot.className = 'tl-dot';
      li.appendChild(dot);

      var body = document.createElement('div');
      body.className = 'tl-body';

      var head = document.createElement('div');
      head.className = 'tl-head';

      var ep = document.createElement('span');
      ep.className = 'tl-ep';
      ep.textContent = '第 ' + epNo(a, i, p.total || arcs.length) + ' 期';
      head.appendChild(ep);

      var date = document.createElement('time');
      date.className = 'tl-date';
      date.textContent = BW.util.date(a.pubdate);
      head.appendChild(date);

      if (gapDays) {
        var gap = document.createElement('span');
        gap.className = 'tl-gap';
        gap.textContent = '距上一期 ' + fmtDays(gapDays);
        head.appendChild(gap);
      }
      body.appendChild(head);

      var link = document.createElement('a');
      link.className = 'tl-link';
      link.href = BW.util.vurl(a.bvid);
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = a.title || '（无标题）';
      body.appendChild(link);

      var meta = document.createElement('div');
      meta.className = 'tl-meta';
      var bits = [];
      if (a.duration) bits.push('<i class="fas fa-clock"></i>时长 ' + BW.util.dur(a.duration));
      if (a.views) bits.push('<i class="fas fa-play"></i>播放 ' + BW.util.num(a.views));
      bits.push('<i class="fas fa-calendar"></i>' + BW.util.ago(a.pubdate));
      meta.innerHTML = bits.join('');
      body.appendChild(meta);

      li.appendChild(body);
      dom.timeline.appendChild(li);
    }
  }

  /* ---------- 载入 ---------- */
  function load(first) {
    setCard('checking', '载入中…', '正在读取更新快照', '数据文件与页面同源，通常一次就好。');
    return BW.snapshot().then(function (j) {
      snap = j;
      var p = j.popcorn;
      if (!p) {
        setCard('unknown', '无数据', '快照里没有爆米花电台',
          '请运行「实用工具/bili_watch.py」重新生成数据。');
        logIt('快照中缺少 popcorn 段', 'bad');
        return;
      }
      renderStatus(p);
      renderSignals(p);
      var st = renderPace(p);
      renderTimeline(p, st);
      logIt('已读取爆米花电台：' + (p.archives || []).length + ' 期'
        + (st.gaps.length ? '，平均 ' + fmtDays(st.avgGap) + ' 一更' : ''), 'ok');
      setShotTarget();
      if (first) refreshShot();
      if (!first) logIt('快照已重新读取', 'ok');
    }).catch(function (err) {
      setCard('unknown', '读取失败', '读不到快照文件',
        '路径 ' + BW.SNAPSHOT + ' 读取失败：' + err.message + '。请先运行抓取脚本生成数据。');
      dom.sigSource.className = 'sig is-bad';
      dom.sigSource.querySelector('.sig-v').textContent = '数据源：读取失败';
      logIt('快照读取失败：' + err.message, 'bad');
    });
  }

  /* ---------- 实时探测 ---------- */
  function probe() {
    if (busy || !snap || !snap.popcorn) return;
    busy = true;
    var btn = dom.btnReload;
    btn.disabled = true;
    logIt('开始实时探测：直接问 B 站要这个合集的完整列表…');

    var p = snap.popcorn;
    BW.api.seasonArchives(p.mid, p.season_id, 30).then(function (list) {
      var old = (p.archives || []).length;
      if (list.length > old) {
        logIt('合集期数 ' + old + ' → ' + list.length + '，看起来有新一期了：'
          + (list[0].title || ''), 'ok');
      } else {
        logIt('实时列表 ' + list.length + ' 条，与快照（' + old + ' 条）一致', 'ok');
      }
      var route = BW.relayRoute();
      if (route) {
        dom.sigRoute.className = 'sig is-ok';
        dom.sigRoute.querySelector('.sig-v').textContent = '实时通路：' + route;
      }
    }).catch(function (err) {
      logIt('实时探测失败：' + err.message
        + '（可在 js/js/bili-watch.js 里填 SELF_RELAY 自建中转）', 'bad');
      dom.sigRoute.className = 'sig is-bad';
      dom.sigRoute.querySelector('.sig-v').textContent = '实时通路：全部失败';
    }).then(function () {
      busy = false;
      btn.disabled = false;
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    cacheDom();

    dom.btnReload.addEventListener('click', function () {
      /* 有中转就实时探测，否则纯重新读快照 */
      if (BW.hasSelfRelay) probe();
      else load(false);
    });
    dom.btnShotRefresh.addEventListener('click', refreshShot);
    dom.btnClearLog.addEventListener('click', function () {
      dom.logList.innerHTML = '';
      logIt('日志已清空');
    });

    window.addEventListener('online', function () { logIt('网络已恢复'); });
    window.addEventListener('offline', function () { logIt('网络已断开', 'bad'); });

    logIt('页面就绪，监控合集 5906893');
    load(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
