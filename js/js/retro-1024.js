/*!
 * retro-1024.js — 每年 10 月 24 日限定：全站穿越回 2000 年初风格
 * ------------------------------------------------------------
 * 触发规则（按优先级）：
 *   1. URL 带 ?retro=1  → 强制开启（预览用，并写入 sessionStorage，
 *                        本次会话内翻页也保持穿越；?retro=0 关闭并清除）
 *   2. sessionStorage 有 retro2k=1 → 本次会话继续穿越
 *   3. 当天是 10 月 24 日 → 自动穿越（彩蛋本体）
 *   4. 其余 364 天 → 直接 return，对站点零影响
 *
 * 激活后做四件事：
 *   - <html> 加 class="retro2k"，挂载 css/css/retro-2000.css
 *   - body 顶部插入 sticky 千禧年 chrome（跑马灯 / NEW!横幅 / 施工条 / 访客计数器）
 *   - 挂 Webring 页脚 + 星标光标拖尾 + 标题/图标千禧年化
 *   - 预览模式追加「关闭穿越」按钮
 *
 * 路径自适应：根目录页 / 子目录页 / blog/X/N/ 三层文章页通用
 * （从自身 script src 反推站点根，不写死相对深度）
 */
(function () {
  'use strict';

  /* ---------- 0. 已激活过就别重复（防御双注入） ---------- */
  if (document.documentElement.classList.contains('retro2k')) return;

  /* ---------- 0.5 iframe 内（桌面 IE 窗口）：只挂第一版 chrome，不升级桌面 ---------- */
  if (window.top !== window.self) {
    try { activate(false, false, true); } catch (err) {
      console.warn('[retro-1024] iframe 内穿越失败：', err);
    }
    return;
  }

  /* ---------- 1. 判定今天是否穿越 ---------- */
  var now = new Date();
  var isAnniversary = now.getMonth() === 9 && now.getDate() === 24; // 10 月 24 日
  var force = null;
  try { force = new URLSearchParams(location.search).get('retro'); } catch (e) {}

  // override：'1' 强制开 / '0' 强制关（覆盖日期），URL 参数优先并写入 sessionStorage
  var override = null;
  try {
    if (force === '1' || force === '0') {
      sessionStorage.setItem('retro2k', force);
      override = force;
    } else {
      override = sessionStorage.getItem('retro2k');
    }
  } catch (e) {}

  if (override === '0') return; // 明确要求关闭
  if (override !== '1' && !isAnniversary) return; // 平时安静躺好

  try { activate(isAnniversary, override === '1'); } catch (err) {
    console.warn('[retro-1024] 穿越失败，不影响本站正常使用：', err);
  }

  /* ================= 以下是激活逻辑 ================= */
  function activate(byDate, previewMode, inFrame) {
    /* ---------- 1.5 首页特殊：整个首页变成 Win98 桌面（arg 的拷贝，arg 本体不动） ---------- */
    if (!inFrame && /^\/(index\.html)?([?#]|$)/.test(location.pathname)) {
      mountDesktop(previewMode);
      return;
    }

    /* ---------- 2. 反推站点根目录 ---------- */
    var src = (document.currentScript && document.currentScript.src) || '';
    var m = src.match(/^(.*?)\/js\/js\/retro-1024\.js/);
    var root = m ? m[1] : '';
    if (!root) { // currentScript 拿不到时的兜底：找任意 /js/js/ 脚本
      var any = document.querySelector('script[src*="/js/js/"]');
      if (any) { m = any.src.match(/^(.*?)\/js\/js\//); if (m) root = m[1]; }
    }

    /* ---------- 3. 挂样式 + 打标记 ---------- */
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = root + '/css/css/retro-2000.css';
    document.head.appendChild(link);
    document.documentElement.classList.add('retro2k');

    /* ---------- 4. 标题与图标千禧年化 ---------- */
    document.title = '☆ ' + document.title + ' ☆';
    var icon = document.createElement('link');
    icon.rel = 'icon';
    icon.href = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
      '<text y="13" font-size="13">⭐</text></svg>'
    );
    document.head.appendChild(icon);

    /* ---------- 5. 拼装 chrome ---------- */
    var chrome = document.createElement('div');
    chrome.className = 'r2k-chrome';

    // 5.1 跑马灯（2000 年代每站的标配）
    var marquee = document.createElement('div');
    marquee.className = 'r2k-marquee';
    marquee.innerHTML = '<span>★ 欢迎来到 ciallo0721-cmd 的小站 ★ 本站时光机已抵达 2000 年 ★ ' +
      '今天是 10 月 24 日限定活动 ★ 塔菲检测到杂鱼访客一名 ★ 关注永雏塔菲谢谢喵 ★ ' +
      '本站最佳浏览效果 800×600 ★</span>';

    // 5.2 主横幅：闪烁 NEW! + 88×31 小按钮
    var banner = document.createElement('div');
    banner.className = 'r2k-banner';
    banner.innerHTML =
      '<div class="r2k-banner-inner">' +
        '<span class="r2k-blink">NEW!</span><span class="r2k-blink">NEW!</span><span class="r2k-blink">NEW!</span>' +
        '<span class="r2k-banner-title">✿ ❀ 时光机抵达：2000 年 ❀ ✿</span>' +
        '<span class="r2k-banner-sub">每年 10 月 24 日，本站自动穿越回千禧年初风格 · 手动预览可加 ?retro=1</span>' +
        '<span class="r2k-btn88">800×600</span>' +
        '<span class="r2k-btn88">IE 5.0+</span>' +
        '<span class="r2k-btn88">NOT Y2K BUG</span>' +
        '<span class="r2k-btn88">HTML 4.01</span>' +
      '</div>';

    // 5.3 施工条（UNDER CONSTRUCTION 是时代之魂）
    var cstr = document.createElement('div');
    cstr.className = 'r2k-construction';
    cstr.innerHTML = '<span>🚧 UNDER CONSTRUCTION · 本站永远处于施工中 · 施工中 🚧</span>';

    // 5.4 访客计数器（localStorage 驱动，不是真统计，纯氛围）
    var n = 0;
    try {
      n = (parseInt(localStorage.getItem('retro2k_visits') || '0', 10) || 0) + 1;
      localStorage.setItem('retro2k_visits', String(n));
    } catch (e) { n = 1; }
    var digits = ('000000' + n).slice(-6).split('').map(function (d) {
      return '<span class="r2k-digit">' + d + '</span>';
    }).join('');
    var counter = document.createElement('div');
    counter.className = 'r2k-counter';
    counter.innerHTML = '<span class="r2k-counter-label">您是第</span>' + digits +
      '<span class="r2k-counter-label">位访客 · 计数器自 2000 年服役至今</span>';

    chrome.appendChild(marquee);
    chrome.appendChild(banner);
    chrome.appendChild(cstr);
    chrome.appendChild(counter);

    // 5.5 预览模式才给「关闭穿越」按钮
    if (previewMode) {
      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'r2k-close';
      close.textContent = '✕ 关闭穿越';
      close.addEventListener('click', function () {
        try { sessionStorage.removeItem('retro2k'); } catch (e) {}
        var u = new URL(location.href);
        u.searchParams.delete('retro');
        location.href = u.pathname + u.search + u.hash;
      });
      banner.querySelector('.r2k-banner-inner').appendChild(close);
    }

    /* ---------- 6. 插到 body 最顶部（sticky 由 CSS 负责） ---------- */
    document.body.insertBefore(chrome, document.body.firstChild);

    /* ---------- 7. Webring 页脚 ---------- */
    var foot = document.createElement('div');
    foot.className = 'r2k-footer';
    foot.innerHTML =
      '<span class="r2k-webring">← 上一站 | <b>千禧 Webring</b> | 下一站 →</span>' +
      '<span class="r2k-sep">|</span>' +
      '<a href="' + root + '/friends.html">留言板</a><span class="r2k-sep">|</span>' +
      '<a href="' + root + '/aboutme.html">关于站长</a><span class="r2k-sep">|</span>' +
      '<a href="mailto:ciallo0721cmd@gmail.com">联系站长</a><span class="r2k-sep">|</span>' +
      '<span>按 Ctrl+D 收藏本站</span>' +
      '<div class="r2k-copy">© 2000-' + now.getFullYear() +
      ' ciallo0721-cmd 的小站 · 本页面由记事本手工编写 HTML · 推荐 Netscape 4.0 / IE 5.0 浏览</div>';
    document.body.appendChild(foot);

    /* ---------- 8. 星标光标拖尾（经典中的经典） ---------- */
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var colors = ['#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff', '#f80', '#8f0', '#fff'];
      var lastSpark = 0;
      document.addEventListener('mousemove', function (ev) {
        var t = Date.now();
        if (t - lastSpark < 50) return; // 节流，别把 CPU 点着了
        lastSpark = t;
        var s = document.createElement('span');
        s.className = 'r2k-spark';
        s.style.left = (ev.clientX - 4) + 'px';
        s.style.top = (ev.clientY - 4) + 'px';
        s.style.background = colors[(Math.random() * colors.length) | 0];
        document.body.appendChild(s);
        setTimeout(function () { s.remove(); }, 900);
      }, { passive: true });
    }

    /* ---------- 9. CTRL+S：蓝屏「不可控元素」→ 恢复正常 ---------- */
    function bsodExit() {
      if (document.getElementById('r2k-bsod')) return;
      var bsod = document.createElement('div');
      bsod.id = 'r2k-bsod';
      bsod.style.cssText = 'position:fixed;inset:0;background:#0000aa;color:#fff;z-index:2147483647;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'font-family:"Courier New",monospace;text-align:center;cursor:pointer;padding:20px;box-sizing:border-box;';
      bsod.innerHTML =
        '<div style="background:#c0c0c0;color:#0000aa;font-size:34px;font-weight:bold;padding:2px 26px;margin-bottom:36px;letter-spacing:2px;">Windows</div>' +
        '<div style="font-size:17px;line-height:2.3;max-width:660px;">' +
        '系统遇到<b>不可控元素</b>，已停止响应。<br>' +
        '<span style="color:#ffff00;">CTRL_SAVE_IN_TIME_PARADOX (0x00000067)</span><br>' +
        '当前进程 ciallo0721-cmd.top 已从时光机中断开连接。<br><br>' +
        '正在从 2000 年恢复至正常时间线……<br>' +
        '<span style="color:#ffff00;">按任意键立即恢复</span></div>';
      document.body.appendChild(bsod);
      var done = false;
      var go = function () {
        if (done) return;
        done = true;
        try { sessionStorage.removeItem('retro2k'); } catch (e) {}
        var u = new URL(location.href);
        u.searchParams.set('retro', '0');
        location.href = u.toString();
      };
      document.addEventListener('keydown', function onKey(ev) {
        ev.preventDefault();
        document.removeEventListener('keydown', onKey, true);
        go();
      }, true);
      bsod.addEventListener('click', go);
      setTimeout(go, 3200);
    }
    document.addEventListener('keydown', function (ev) {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      if ((ev.key || '').toLowerCase() !== 's') return;
      ev.preventDefault();
      bsodExit();
    });

    /* ---------- 10. 控制台彩蛋提示 ---------- */
    console.log('%c☆ 时光机彩蛋触发（10/24 限定）☆ %c' +
      (byDate ? '今天是 10 月 24 日，自动穿越回 2000 年。' : '预览模式：地址栏加 ?retro=1 可随时穿越。'),
      'background:#000080;color:#ff0;font-family:monospace;font-size:13px;',
      'color:#060;');
  }

  /* ================= 首页专属：整页替换为 Win98 桌面 ================= */
  function mountDesktop(previewMode) {
    document.documentElement.classList.add('retro2k');
    var mount = document.createElement('div');
    mount.id = 'r2k-desktop-mount';
    mount.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#000;';
    var frame = document.createElement('iframe');
    frame.src = './_retro-desktop.html';
    frame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
    frame.title = 'Windows 98';
    mount.appendChild(frame);
    document.body.appendChild(mount);
    document.body.style.overflow = 'hidden';
    // 隐藏原首页内容（不删，关闭穿越后刷新即恢复）
    Array.prototype.slice.call(document.body.children).forEach(function (el) {
      if (el !== mount) el.style.visibility = 'hidden';
    });
    if (previewMode) {
      var btn = document.createElement('button');
      btn.textContent = '✕ 关闭穿越';
      btn.style.cssText = 'position:fixed;top:10px;right:14px;z-index:2147483001;padding:4px 12px;background:#c0c0c0;border:2px outset #fff;font-family:SimSun,sans-serif;font-size:12px;cursor:pointer;';
      btn.onclick = function () {
        try { sessionStorage.setItem('retro2k', '0'); } catch (e) {}
        location.reload();
      };
      document.body.appendChild(btn);
    }
    console.log('%c☆ 首页已整站替换为 Win98 桌面（10/24 限定）☆ %c试试：右键桌面 · CTRL+SHIFT · CTRL+ALT · CMD 里输入 1024 / 0721 / 67',
      'background:#000080;color:#ff0;font-family:monospace;font-size:13px;',
      'color:#060;');
  }
})();
