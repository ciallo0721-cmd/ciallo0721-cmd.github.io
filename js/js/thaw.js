/**
 * 解冻倒计时 · 共用脚本
 * 三个页面（isChristmasThaw / isHalloweenThaw / isSpringThaw）共用，
 * 差异全部由页面里的 window.THAW_CONFIG 提供。
 *
 * 进度定义：progress = 1 - 剩余时间 / 解冻窗口，
 * 窗口 = 目标日往前数 N 天（N 由 windowDays 给出）。
 */
(function () {
  'use strict';

  var CFG = window.THAW_CONFIG || {};
  var DAY = 86400000;
  var STAGE_CUTS = [0.125, 0.375, 0.625, 0.875]; // 四分位：进度落在哪一段 → 0/25/50/75/100%
  var PCTS = [0, 25, 50, 75, 100];

  var el = {
    days: document.getElementById('cdDays'),
    hms: document.getElementById('cdHMS'),
    date: document.getElementById('cdDate'),
    label: document.getElementById('cdLabelName'),
    pct: document.getElementById('pctText'),
    fill: document.getElementById('meterFill'),
    ticks: document.getElementById('meterTicks'),
    stageName: document.getElementById('meterStageName'),
    stageHint: document.getElementById('meterStageHint'),
    strip: document.getElementById('stageStrip'),
    img: document.getElementById('mediaImg'),
    plate: document.getElementById('mediaPlate'),
    platePct: document.getElementById('platePct'),
    plateName: document.getElementById('plateName'),
    plateNote: document.getElementById('plateNote'),
    capName: document.getElementById('capName'),
    capNote: document.getElementById('capNote'),
    addr: document.getElementById('mediaAddr'),
    factTarget: document.getElementById('factTarget'),
    factLeft: document.getElementById('factLeft'),
    factWindow: document.getElementById('factWindow'),
    factStart: document.getElementById('factStart'),
    factStage: document.getElementById('factStage'),
    factTick: document.getElementById('factTick')
  };

  var stages = (CFG.stages || []).slice(0, 5);
  var state = { preview: -1, shown: -1, target: null, start: null };

  /* ---------- 工具 ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function parseDate(str) {
    var p = String(str).split('-');
    return new Date(+p[0], (+p[1]) - 1, +p[2], 0, 0, 0, 0);
  }

  function fmtDate(d) {
    var w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + w;
  }

  function fmtShort(d) {
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* 选出「最近一个尚未过完」的目标日，同时给出它在 targets 里的下标 */
  function pickTarget() {
    var list = (CFG.targets && CFG.targets.length) ? CFG.targets : [CFG.target];
    var now = Date.now();
    for (var i = 0; i < list.length; i++) {
      var d = parseDate(list[i]);
      if (d.getTime() + DAY > now) return { date: d, idx: i };
    }
    return { date: parseDate(list[list.length - 1]), idx: list.length - 1 };
  }

  /* ---------- 阶段条 ---------- */
  function buildStrip() {
    if (!el.strip) return;
    var html = '';
    stages.forEach(function (s, i) {
      var thumb;
      if (s.img) {
        thumb = '<img src="' + s.img + '" alt="' + s.name + ' 阶段示意图" loading="lazy" decoding="async">';
      } else {
        thumb = '<i class="fas fa-' + (s.icon || CFG.stripIcon || 'ghost') + ' thumb-icon"></i>';
      }
      html += '<button type="button" class="stage-card" data-stage="' + i + '" aria-label="预览 ' + s.pct + '% ' + s.name + '">' +
        '<span class="stage-thumb">' + thumb + '</span>' +
        '<span class="stage-meta"><b>' + s.pct + '%</b><span>' + s.name + '</span></span>' +
        '</button>';
    });
    el.strip.innerHTML = html;
    el.strip.addEventListener('click', function (e) {
      var card = e.target.closest('.stage-card');
      if (!card) return;
      var idx = +card.getAttribute('data-stage');
      state.preview = (state.preview === idx) ? -1 : idx;
      renderStage(true);
    });
  }

  /* ---------- 进度条刻度 ---------- */
  function buildTicks() {
    if (!el.ticks) return;
    var html = '';
    for (var i = 1; i < 4; i++) html += '<i style-mark="' + (i * 25) + '"></i>';
    el.ticks.innerHTML = html;
    var nodes = el.ticks.children;
    for (var j = 0; j < nodes.length; j++) {
      nodes[j].classList.add('tick');
      nodes[j].setAttribute('data-at', nodes[j].getAttribute('style-mark'));
      nodes[j].removeAttribute('style-mark');
    }
    reflowTicks();
  }

  function reflowTicks() {
    if (!el.ticks) return;
    var nodes = el.ticks.children;
    for (var i = 0; i < nodes.length; i++) {
      var at = nodes[i].getAttribute('data-at');
      nodes[i].classList.add('at-' + at);
    }
  }

  /* ---------- 渲染阶段 ---------- */
  function stageIndexFor(progress) {
    if (progress <= STAGE_CUTS[0]) return 0;
    if (progress <= STAGE_CUTS[1]) return 1;
    if (progress <= STAGE_CUTS[2]) return 2;
    if (progress <= STAGE_CUTS[3]) return 3;
    return 4;
  }

  function renderStage(force) {
    var idx = state.preview >= 0 ? state.preview : state.live;
    var s = stages[idx];
    if (!s) return;

    /* 阶段条高亮 */
    if (el.strip) {
      var cards = el.strip.children;
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.toggle('is-active', i === state.live && state.preview < 0);
        cards[i].classList.toggle('is-preview', i === state.preview);
      }
    }

    if (state.shown === idx && !force) return;
    state.shown = idx;

    /* 图片 / 文字态 */
    if (s.img) {
      if (el.img) {
        if (el.img.getAttribute('data-src') !== s.img) {
          el.img.setAttribute('data-src', s.img);
          el.img.src = s.img;
        }
        el.img.hidden = false;
        el.img.classList.remove('is-fresh');
        void el.img.offsetWidth;
        el.img.classList.add('is-fresh');
      }
      if (el.plate) el.plate.hidden = true;
    } else {
      if (el.img) el.img.hidden = true;
      if (el.plate) {
        el.plate.hidden = false;
        if (el.platePct) el.platePct.textContent = s.pct + '%';
        if (el.plateName) el.plateName.textContent = s.name;
        if (el.plateNote) el.plateNote.textContent = s.note || '';
      }
    }

    /* 说明条 */
    if (el.capName) el.capName.textContent = s.pct + '% · ' + s.name;
    if (el.capNote) el.capNote.textContent = state.preview >= 0 ? '预览中，点同一张卡片回到当前进度' : (s.note || '');
    if (el.addr) {
      el.addr.textContent = (CFG.mediaAddr || 'thaw://season') + '/' + s.pct + '%';
    }
    if (el.factStage) el.factStage.textContent = s.pct + '% · ' + s.name;
  }

  /* ---------- 主循环 ---------- */
  function tick() {
    var now = Date.now();
    var target = state.target;
    var remain = target.getTime() - now;
    if (remain < 0) remain = 0;

    var days = Math.floor(remain / DAY);
    var rest = remain - days * DAY;
    var hh = Math.floor(rest / 3600000);
    var mm = Math.floor((rest % 3600000) / 60000);
    var ss = Math.floor((rest % 60000) / 1000);

    if (el.days) el.days.textContent = days;
    if (el.hms) el.hms.textContent = pad(hh) + ':' + pad(mm) + ':' + pad(ss);

    var total = state.totalMs || (CFG.windowDays || 60) * DAY;
    var progress = clamp(1 - remain / total, 0, 1);
    var pct = Math.round(progress * 100);

    if (el.pct) el.pct.textContent = pct + '%';
    if (el.fill) el.fill.style.width = pct + '%';

    var live = stageIndexFor(progress);
    var liveChanged = live !== state.live;
    state.live = live;

    var s = stages[live];
    if (el.stageName) el.stageName.textContent = (s ? s.name : '—');
    if (el.stageHint) {
      el.stageHint.innerHTML = remain <= 0
        ? '<b>就在今天</b> · 已经彻底解冻了'
        : '窗口共 ' + Math.round(total / DAY) + ' 天 · 已过 ' + Math.round((total - remain) / DAY) + ' 天';
    }
    if (el.factLeft) el.factLeft.textContent = days + ' 天 ' + pad(hh) + ':' + pad(mm) + ':' + pad(ss);
    if (el.factTick) el.factTick.textContent = pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()) + ':' + pad(new Date().getSeconds());

    if (liveChanged || state.shown < 0) renderStage(false);
  }

  /* ---------- 初始化 ---------- */
  function init() {
    var picked = pickTarget();
    state.target = picked.date;

    /* 窗口起点：优先用 windowStarts[idx]（比如「上一个春节」），否则按 windowDays 反推 */
    var wsList = CFG.windowStarts;
    state.start = (wsList && wsList[picked.idx])
      ? parseDate(wsList[picked.idx])
      : new Date(state.target.getTime() - (CFG.windowDays || 60) * DAY);
    state.totalMs = state.target.getTime() - state.start.getTime();

    if (el.label) el.label.textContent = CFG.targetName || '那个日子';
    if (el.date) el.date.textContent = fmtDate(state.target);
    if (el.factTarget) el.factTarget.textContent = fmtDate(state.target).replace(' · ', ' ');
    if (el.factWindow) el.factWindow.textContent = Math.round(state.totalMs / DAY) + ' 天（' + (CFG.windowLabel || '解冻窗口') + '）';
    if (el.factStart) el.factStart.textContent = state.start.getFullYear() + ' 年 ' + fmtShort(state.start);

    buildTicks();
    buildStrip();
    tick();
    setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
