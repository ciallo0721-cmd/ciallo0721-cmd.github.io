/**
 * 全站搜索（首页）
 * 数据源：window.articlesData（文章，articles-data.js）+ 内置站点页面清单
 * 交互：导航栏按钮 / Ctrl+K 呼出 · ↑↓ 选择 · Enter 打开 · Esc 关闭
 */
(function () {
  'use strict';

  /* ---------- 站点页面清单 ---------- */
  var PAGES = [
    { t: '首页', d: '站点首页 · 每日一句 · 项目与工具总览', u: './index.html', k: 'home 主页 首页' },
    { t: '文章站', d: '全部原创文章的集中入口，支持标签筛选与站内搜索', u: './blog/', k: 'blog 文章 博客 归档 列表 全部' },
    { t: '关于我', d: 'ciallo0721-cmd 的个人简介与技能栈', u: './aboutme.html', k: 'about 关于 简介 作者 自我介绍' },
    { t: '友情链接', d: '友链交换与小伙伴们的站点', u: './friends.html', k: 'friends 友链 链接 朋友' },
    { t: '联系方式', d: 'QQ / 邮箱 / GitHub / B站 / Discord 等全部联系方式', u: './adss.html', k: 'contact 联系 邮箱 qq 合作' },
    { t: '实用工具集', d: 'VTuber 名字生成器、Ren\'Py 模板生成器等全部工具', u: './tools/', k: 'tools 工具 合集 小工具' },
    { t: 'VTuber 名字生成器', d: '随机生成 VTuber 风格的名字，支持多种风格', u: './tools/vtuber-name-generator/', k: '名字 生成器 vtuber 起名' },
    { t: 'Ren\'Py 模板生成器', d: '一键生成 script.rpy + options.rpy 完整项目文件', u: './tools/renpy-template-generator/', k: 'renpy 模板 生成 视觉小说' },
    { t: 'VTuber 人格测试', d: '测测你适合什么样的 VTuber 人设', u: './tools/vtuber-personality-test/', k: '人格 测试 人设 性格' },
    { t: '二次元色彩分析器', d: '上传图片分析配色方案，生成调色板', u: './tools/anime-color-analyzer/', k: '色彩 配色 调色板 图片 分析' },
    { t: '新番数据库', d: '实时查询当季新番动画信息，追番必备', u: 'https://ciallo0721-cmd.top/scraper', k: '新番 动画 追番 番剧 数据库' },
    { t: '人脸识别 MoeFace', d: '上传图片识别动漫角色，纯浏览器端 AI 处理', u: 'https://ciallo0721-cmd.top/moeface', k: '人脸 识别 moeface 角色 动漫' },
    { t: '打工模拟器', d: 'C 语言编译的 WebAssembly 文字经营模拟游戏', u: './work/', k: '游戏 wasm 打工 模拟器 经营' },
    { t: '镜中人', d: 'Win98 复古美学 ARG 解谜游戏，四种结局', u: './arg/', k: '游戏 arg 解谜 镜中人 论坛' },
    { t: '12队大乱斗 fyGrid', d: 'CSGO fy_iceworld 风格的 5v5 团队死斗第一人称射击', u: './CS/', k: '游戏 cs 射击 fps 对战 团队 大乱斗' },
    { t: 'HRAI 恐怖逃生', d: '黑暗冰封竞技场里的单人恐怖追逐逃脱', u: './HRAI/', k: '游戏 恐怖 逃生 追逐 惊吓' },
    { t: '塔珀动画', d: '数学公式转动画的小工具', u: './mathtovideo/', k: 'mathtovideo 数学 动画 塔珀' },
    { t: '更新记录', d: '站点全部更新历史与变更时间线', u: './timeline.html', k: 'timeline 更新 记录 日志 时间线' },
    { t: '网站状态', d: '各页面与服务运行状态监控', u: 'https://status.ciallo0721-cmd.top', k: 'status 状态 监控 运行 故障' },
    { t: '留言板', d: '在首页留言板留下你的想法和足迹', u: '#comments', k: 'comment 留言 评论 giscus' },
    { t: '隐私政策', d: '站点隐私政策与数据处理说明', u: './doc/privacy.html', k: 'privacy 隐私 政策 cookie' },
    { t: '用户协议与隐私政策', d: '全部法律文档索引', u: './doc/all.html', k: 'doc 协议 条款 法律 文档' }
  ];

  var MAX = 24;
  var overlay = null, input = null, resultsEl = null, btn = null;
  var cursor = -1;

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function norm(s) { return String(s == null ? '' : s).toLowerCase(); }

  function mark(text, q) {
    var safe = esc(text);
    var needle = esc(q).toLowerCase();
    if (!needle) return safe;
    var idx = safe.toLowerCase().indexOf(needle);
    if (idx < 0) return safe;
    return safe.slice(0, idx) +
      '<span class="ss-mark">' + safe.slice(idx, idx + needle.length) + '</span>' +
      safe.slice(idx + needle.length);
  }

  /* ---------- 文章数据（首页需补 /blog/ 前缀） ---------- */
  function getArticles() {
    var out = [];
    try {
      if (window.articlesData && typeof window.articlesData.getSortedArticles === 'function') {
        window.articlesData.getSortedArticles().forEach(function (a) {
          var file = String(a.fileName || '').replace(/\.html$/, '');
          var url = /^(https?:|\/|\.)/.test(file) ? file : './blog/' + file;
          out.push({
            t: a.title || '',
            d: a.excerpt || '',
            u: url,
            path: 'blog/' + file,
            k: (a.tags || []).join(' ') + ' ' + (a.category || ''),
            date: a.date || ''
          });
        });
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  /* ---------- 检索 ---------- */
  function search(q) {
    q = q.trim();
    if (!q) return [];
    var key = norm(q);
    var hits = [];

    getArticles().forEach(function (a) {
      if (norm(a.t + ' ' + a.d + ' ' + a.k).indexOf(key) === -1) return;
      hits.push({ item: a, group: '文章', score: norm(a.t).indexOf(key) !== -1 ? -100 : 0 });
    });
    PAGES.forEach(function (p) {
      if (norm(p.t + ' ' + p.d + ' ' + p.k).indexOf(key) === -1) return;
      hits.push({ item: p, group: '页面', score: norm(p.t).indexOf(key) !== -1 ? -120 : -10 });
    });

    hits.sort(function (a, b) { return a.score - b.score; });
    return hits.slice(0, MAX);
  }

  /* ---------- 渲染 ---------- */
  function render(list, q) {
    cursor = -1;
    if (!q.trim()) {
      resultsEl.innerHTML = '<div class="ss-empty"><i class="fas fa-compass"></i>输入关键词，检索全站文章与页面</div>';
      return;
    }
    if (!list.length) {
      resultsEl.innerHTML = '<div class="ss-empty"><i class="fas fa-search"></i>没有找到和「' + esc(q) + '」相关的内容</div>';
      return;
    }
    var html = '', lastGroup = '';
    list.forEach(function (row, i) {
      if (row.group !== lastGroup) {
        html += '<div class="ss-group">' + row.group + '</div>';
        lastGroup = row.group;
      }
      var it = row.item;
      var external = /^https?:/.test(it.u);
      html +=
        '<a class="ss-item" data-i="' + i + '" href="' + esc(it.u) + '"' +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' +
          '<div class="ss-title">' + mark(it.t, q) + '</div>' +
          '<div class="ss-desc">' + mark(it.d, q) + '</div>' +
          '<div class="ss-path">' + esc(it.path || it.u) + '</div>' +
        '</a>';
    });
    html += '<div class="ss-count">共 ' + list.length + ' 条结果</div>';
    resultsEl.innerHTML = html;
  }

  function moveCursor(delta) {
    var nodes = resultsEl.querySelectorAll('.ss-item');
    if (!nodes.length) return;
    cursor += delta;
    if (cursor < 0) cursor = nodes.length - 1;
    if (cursor >= nodes.length) cursor = 0;
    Array.prototype.forEach.call(nodes, function (n, i) {
      n.classList.toggle('current', i === cursor);
    });
    nodes[cursor].scrollIntoView({ block: 'nearest' });
  }

  function openPanel() {
    if (!overlay) return;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { if (input) input.focus(); }, 30);
  }
  function closePanel() {
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* ---------- 初始化 ---------- */
  function init() {
    overlay = document.getElementById('siteSearch');
    input = document.getElementById('siteSearchInput');
    resultsEl = document.getElementById('siteSearchResults');
    btn = document.getElementById('siteSearchBtn');
    if (!overlay || !input || !resultsEl) return;

    render([], '');

    if (btn) btn.addEventListener('click', openPanel);

    var closeBtn = document.getElementById('siteSearchClose');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePanel();
    });

    var timer = null;
    input.addEventListener('input', function () {
      if (timer) clearTimeout(timer);
      var v = input.value;
      timer = setTimeout(function () { render(search(v), v); }, 110);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var nodes = resultsEl.querySelectorAll('.ss-item');
        if (cursor >= 0 && nodes[cursor]) nodes[cursor].click();
        else if (nodes.length === 1) nodes[0].click();
      }
    });

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && norm(e.key) === 'k') {
        e.preventDefault();
        if (overlay.classList.contains('active')) closePanel(); else openPanel();
        return;
      }
      if (e.key === 'Escape' && overlay.classList.contains('active')) closePanel();
    });

    // 同页锚点：先滚动再关闭，避免被浮层挡住
    resultsEl.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('.ss-item') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.charAt(0) === '#' || href.indexOf('./index.html#') === 0) {
        e.preventDefault();
        closePanel();
        var id = href.split('#')[1];
        var target = id ? document.getElementById(id) : null;
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        closePanel();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
