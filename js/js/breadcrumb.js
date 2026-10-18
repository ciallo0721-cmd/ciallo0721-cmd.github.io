/* ==========================================================================
   全站面包屑导航 / Site Breadcrumb（自动渲染）
   --------------------------------------------------------------------------
   用法：页面 <head> 内引入
       <link rel="stylesheet" href="<相对路径>/css/css/breadcrumb.css">
       <script defer src="<相对路径>/js/js/breadcrumb.js"></script>
   需要跳过的页面（全屏游戏 / 跳转页 / 测试页）：
       在 <html> 或 <body> 上加 data-no-breadcrumb 属性

   特性：
   - 路径与标题全部自动推导，无需逐页配置
   - 自动挂载到 nav 之后 / main 之首 / .container 首 / body 首
   - 同步输出 schema.org BreadcrumbList 结构化数据
   ========================================================================== */

(function () {
  'use strict';

  if (window.__siteBreadcrumbReady) return;
  window.__siteBreadcrumbReady = true;

  var docEl = document.documentElement;

  /* ---------- 目录名 → 中文名 ---------- */
  var DIR_LABELS = {
    'blog': '博客',
    'app': '应用',
    'tools': '在线工具',
    'pages': '页面',
    'doc': '文档',
    'oops': '异常页面',
    'work': '作品',
    'wiki': '百科',
    'arg': 'ARG',
    'baicai': '真白花音纪念站',
    'taffy': '塔菲档案',
    'verity': 'Verity 模组',
    'mathtovideo': '塔珀动画',
    'WeiShan': '伪善Club',
    'istaffylive': 'IStaffyLive 歌回',
    'iswarmaupdate': 'ISWarma 更新',
    'ispopcornradioupdate': '爆米花电台更新',
    'moeface': 'MoeFace',
    'wenzhangyong': '章节',
    'muban': '模板',
    'web': '网页版',
    'weekly': '周报',
    'friends': '友情链接',
    'aboutme': '关于我',
    'status': '网站状态',
    'help': '帮助中心',
    'mathtovideo': '塔珀动画'
  };

  /* ---------- 工具函数 ---------- */
  function clean(str) {
    return String(str == null ? '' : str).replace(/[\s\u3000]+/g, ' ').trim();
  }

  function isFileSeg(seg) {
    return /\.[a-z0-9]+$/i.test(seg);
  }

  /* 去掉标题首尾的 emoji / 图标字符（h1 里常混着 📄 🧠 之类） */
  var stripEmoji = (function () {
    try {
      var re = new RegExp(
        '^[\\p{Extended_Pictographic}\\uFE0F\\u200D\\s]+|[\\p{Extended_Pictographic}\\uFE0F\\u200D\\s]+$',
        'gu'
      );
      return function (s) {
        return String(s || '').replace(re, '');
      };
    } catch (e) {
      return function (s) {
        return String(s || '');
      };
    }
  })();

  /* 当前页面在站点中的目录深度 → 相对前缀（'' 或 '../' 若干层） */
  function rootPrefix() {
    var segs = location.pathname
      .split('/')
      .filter(Boolean)
      .filter(function (s) {
        return !/^[A-Za-z]:$/.test(s);
      });
    if (segs.length && isFileSeg(segs[segs.length - 1])) segs.pop();
    var out = '';
    for (var i = 0; i < segs.length; i++) out += '../';
    return out;
  }

  /* 页面显示名：h1 首行 > <title> 首段 */
  function pageLabel() {
    var label = '';

    var h1 = document.querySelector('h1');
    if (h1 && !h1.classList.contains('sr-only') && !h1.hasAttribute('hidden')) {
      var raw = h1.innerText || h1.textContent || '';
      label = clean(raw.split('\n')[0]);
      if (label.indexOf('\uFFFD') !== -1 || label.length < 2) label = '';
    }

    if (!label) {
      var t = clean(document.title || '');
      t = t.split(/\s*[|｜]\s*/)[0];
      t = t.split(/\s+[-–—·]\s+/)[0];
      label = clean(t);
    }

    label = clean(stripEmoji(label));

    if (label.length > 42) label = label.slice(0, 41) + '…';
    return label || '当前页面';
  }

  /* 路径段解码（中文目录名不能以 %E5%... 形式外露） */
  function decodeSeg(seg) {
    try {
      return decodeURIComponent(seg);
    } catch (e) {
      return seg;
    }
  }

  /* 解析路径 → 面包屑节点数组 */
  function buildCrumbs() {
    var segs = location.pathname
      .split('/')
      .filter(Boolean)
      .filter(function (s) {
        return !/^[A-Za-z]:$/.test(s); /* file:// 打开时剔除盘符 */
      })
      .map(decodeSeg);
    if (segs.length && isFileSeg(segs[segs.length - 1])) {
      var file = segs.pop().replace(/\.html?$/i, '');
      if (file && file !== 'index') segs.push(file);
    }

    /* 首页不渲染 */
    if (!segs.length) return null;

    var label = pageLabel();
    var crumbs = [{ label: '首页', href: rootPrefix() || './', isHome: true }];
    var hrefAcc = rootPrefix();
    var hasCurrent = false;

    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      var isLast = i === segs.length - 1;
      hrefAcc += encodeURIComponent(seg) + '/';

      if (/^\d+$/.test(seg)) {
        /* 文章 / 项目数字 id：末位用页面标题，非末位（章节页）跳过避免冗余 */
        if (isLast) {
          crumbs.push({ label: label, current: true });
          hasCurrent = true;
        }
        continue;
      }

      if (isLast) {
        var mapped = DIR_LABELS[seg];
        if (mapped) {
          crumbs.push({ label: mapped, current: true });
        } else if (seg.indexOf('-') !== -1 || /^[a-z0-9_]+$/i.test(seg)) {
          /* 英文/含连字符的目录名不好看 → 用页面标题 */
          crumbs.push({ label: label, current: true });
        } else {
          crumbs.push({ label: seg, current: true });
        }
        hasCurrent = true;
        continue;
      }

      crumbs.push({
        label: DIR_LABELS[seg] || seg,
        href: hrefAcc
      });
    }

    if (!hasCurrent) crumbs.push({ label: label, current: true });
    if (crumbs.length < 2) return null;
    return crumbs;
  }

  /* ---------- 渲染 ---------- */
  var CHEVRON =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';

  var HOME_ICON =
    '<svg class="site-crumb__home-icon" width="13" height="13" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 10.5L12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/></svg>';

  function render(crumbs) {
    var nav = document.createElement('nav');
    nav.className = 'site-crumb';
    nav.setAttribute('aria-label', '面包屑导航');

    var inner = document.createElement('ol');
    inner.className = 'site-crumb__inner';

    crumbs.forEach(function (c, idx) {
      if (idx > 0) {
        var sep = document.createElement('li');
        sep.className = 'site-crumb__sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.innerHTML = CHEVRON;
        inner.appendChild(sep);
      }

      var li = document.createElement('li');
      li.className = 'site-crumb__item';

      if (c.current) {
        var span = document.createElement('span');
        span.className = 'site-crumb__current';
        span.setAttribute('aria-current', 'page');
        span.textContent = c.label;
        span.title = c.label;
        li.appendChild(span);
      } else {
        var a = document.createElement('a');
        a.className = 'site-crumb__link';
        a.href = c.href;
        a.title = c.label;
        if (c.isHome) {
          a.innerHTML = HOME_ICON + '<span>' + escapeHtml(c.label) + '</span>';
        } else {
          a.textContent = c.label;
        }
        li.appendChild(a);
      }

      inner.appendChild(li);
    });

    nav.appendChild(inner);
    return nav;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- 深色页面探测（黑底文章需要换配色） ---------- */
  function isDarkPage() {
    var nodes = [document.body, document.documentElement];
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i]) continue;
      var m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(
        window.getComputedStyle(nodes[i]).backgroundColor || ''
      );
      if (!m) continue;
      var alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (alpha < 0.5) continue;
      var lum = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
      return lum < 140;
    }
    return false;
  }

  /* ---------- 挂载点选择 ---------- */
  function pickAnchor() {
    var navs = document.querySelectorAll('nav');
    for (var i = 0; i < navs.length; i++) {
      var n = navs[i];
      if (n.classList.contains('site-crumb')) continue;
      if (n.closest('[aria-hidden="true"]')) continue;
      var rect = n.getBoundingClientRect();
      if (rect.width < 40) continue;
      var pos = window.getComputedStyle(n).position;
      if (pos === 'fixed' || pos === 'absolute') continue;
      /* nav 若处在 flex/grid 行内，插到它后面会变成同行项目 → 跳过，改用 main/container */
      if (n.parentElement) {
        var pDisp = window.getComputedStyle(n.parentElement).display;
        if (pDisp.indexOf('flex') !== -1 || pDisp.indexOf('grid') !== -1) continue;
      }
      return { node: n, mode: 'after' };
    }

    var main = document.querySelector('main');
    if (main) return { node: main, mode: 'prepend' };

    var container = document.querySelector('.container');
    if (container) return { node: container, mode: 'prepend' };

    return { node: document.body, mode: 'prepend' };
  }

  /* ---------- 结构化数据 ---------- */
  function injectJsonLd(crumbs) {
    if (location.protocol === 'file:') return;
    try {
      var list = crumbs.map(function (c, i) {
        var item = {
          '@type': 'ListItem',
          'position': i + 1,
          'name': c.label
        };
        var url = c.current
          ? location.origin + location.pathname
          : new URL(c.href, location.href).href;
        item.item = url;
        return item;
      });

      var s = document.createElement('script');
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': list
      });
      document.head.appendChild(s);
    } catch (e) {
      /* 静默失败，不影响页面 */
    }
  }

  /* ---------- 启动 ---------- */
  function init() {
    if (docEl.hasAttribute('data-no-breadcrumb')) return;
    if (document.body && document.body.hasAttribute('data-no-breadcrumb')) return;

    var crumbs;
    try {
      crumbs = buildCrumbs();
    } catch (e) {
      return;
    }
    if (!crumbs) return;

    var el = render(crumbs);
    if (isDarkPage()) el.setAttribute('data-adaptive', 'dark');
    var anchor = pickAnchor();

    try {
      if (anchor.mode === 'after') {
        anchor.node.insertAdjacentElement('afterend', el);
      } else {
        anchor.node.insertBefore(el, anchor.node.firstChild);
      }
    } catch (e) {
      document.body.insertBefore(el, document.body.firstChild);
    }

    injectJsonLd(crumbs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
