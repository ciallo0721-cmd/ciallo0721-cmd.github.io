/*!
 * halloween-1031.js — 每年 10 月 31 日限定：万圣节彩蛋
 * ------------------------------------------------------------
 * 触发规则（按优先级）：
 *   1. URL 带 ?hw=1  → 强制开启（预览用，写入 sessionStorage；?hw=0 关闭并清除）
 *   2. sessionStorage 有 hw1031=1 → 本次会话继续生效
 *   3. 当天是 10 月 31 日 → 自动开启（彩蛋本体）
 *   4. 其余 364 天 → 直接 return，对站点零影响
 *
 * 激活后在【首页】整页挂载 halloween-desktop.html：
 *   - 电脑（Win98 外壳）风格，壁纸 / 任务栏换成万圣节皮肤
 *   - 桌面里的 Internet Explorer 打开的是【当前正常站点】的 iframe，
 *     也就是"浏览器里面的界面和现在的一样"
 *   - CMD 输入 Halloween → 蓝屏 → 自动恢复正常
 *   - 1024 / 0721 / 67 这些 10·24 专属口令在万圣节版里全部失效
 *
 * 内页（blog / app / 各类说明页）一律不动 —— 保持现状。
 * iframe 内也一律不动（IE 窗口里加载的就是正常首页，防递归）。
 */
(function () {
  'use strict';

  /* ---------- 0. 防御重复注入 ---------- */
  if (window.__hw1031Mounted) return;
  window.__hw1031Mounted = true;

  /* ---------- 0.5 iframe 内：什么都不做（否则 IE 窗口会套娃） ---------- */
  if (window.top !== window.self) return;

  /* ---------- 0.6 只在首页生效，内页保持现状 ---------- */
  var path = location.pathname;
  var isHome = /^\/(index\.html)?$/i.test(path);
  if (!isHome) return;

  /* ---------- 1. 判定今天是否过节 ---------- */
  var now = new Date();
  var isHalloween = now.getMonth() === 9 && now.getDate() === 31; // 10 月 31 日

  var force = null;
  try { force = new URLSearchParams(location.search).get('hw'); } catch (e) {}

  var override = null;
  try {
    if (force === '1' || force === '0') {
      sessionStorage.setItem('hw1031', force);
      override = force;
    } else {
      override = sessionStorage.getItem('hw1031');
    }
  } catch (e) {}

  if (override === '0') return;                              // 明确要求关闭
  if (override !== '1' && !isHalloween) return;              // 平时安静躺好

  /* ---------- 2. 反推站点根目录 ---------- */
  function getRoot() {
    var src = (document.currentScript && document.currentScript.src) || '';
    var m = src.match(/^(.*?)\/js\/js\/halloween-1031\.js/);
    if (m && m[1]) return m[1];
    var any = document.querySelector('script[src*="/js/js/halloween-1031.js"]');
    if (any) {
      m = any.src.match(/^(.*?)\/js\/js\//);
      if (m && m[1]) return m[1];
    }
    return '.';
  }

  /* ---------- 3. 挂载 ---------- */
  try {
    var root = getRoot();
    var preview = override === '1';

    var wrap = document.createElement('div');
    wrap.id = 'hw-desktop-mount';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#000;';

    var frame = document.createElement('iframe');
    frame.src = root + '/halloween-desktop.html' + (preview ? '?hw=1' : '');
    frame.title = '10 月 31 日';
    frame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
    frame.setAttribute('allow', 'autoplay; encrypted-media');

    wrap.appendChild(frame);
    document.body.appendChild(wrap);

    // 隐藏原首页内容（不删，去掉彩蛋后刷新即恢复）
    document.body.style.overflow = 'hidden';
    Array.prototype.slice.call(document.body.children).forEach(function (el) {
      if (el !== wrap) el.style.visibility = 'hidden';
    });

    document.documentElement.classList.add('hw1031');
    document.title = '🎃 ' + document.title;

    console.log('%c🎃 10 月 31 日 · 万圣节彩蛋已激活 %c桌面里的 IE 打开的是本站正常界面；CMD 输入 help 看看。',
      'background:#2a0d33;color:#ff7a18;font-family:monospace;font-size:13px;padding:2px 6px;',
      'color:#7b2cbf;font-family:monospace;');
  } catch (err) {
    console.warn('[halloween-1031] 挂载失败，不影响本站正常使用：', err);
  }
})();
