/* blog-share.js — 通用文章分享功能 v1.0 */
/* 自动创建浮动分享按钮，动态获取当前 URL */
(function() {
  'use strict';

  /* ─── 配置 ─── */
  var SITE_NAME = 'ciallo0721-cmd 的博客';

  /* ─── 获取页面信息 ─── */
  var pageUrl = window.location.href;
  var pageTitle = document.title || SITE_NAME;
  var shareMsg = '快来看看这篇文章《' + pageTitle + '》: ' + pageUrl;

  /* ─── 创建分享按钮 ─── */
  var fab = document.createElement('button');
  fab.className = 'wb-share-fab';
  fab.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>';
  fab.setAttribute('title', '分享这篇文章');
  fab.setAttribute('aria-label', '分享这篇文章');
  document.body.appendChild(fab);

  /* ─── 创建弹窗遮罩 ─── */
  var overlay = document.createElement('div');
  overlay.className = 'wb-share-overlay';
  overlay.id = 'wbShareOverlay';
  overlay.innerHTML =
    '<div class="wb-share-modal">' +
      '<div class="wb-share-header">' +
        '<h3 class="wb-share-title"><svg viewBox="0 0 24 24" width="18" height="18" fill="#3366ff" style="vertical-align:-3px;margin-right:6px;"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg> 分享这篇文章</h3>' +
        '<button class="wb-share-close" id="wbShareClose">&times;</button>' +
      '</div>' +
      '<div class="wb-share-text" id="wbShareText">' + shareMsg + '</div>' +
      '<div class="wb-share-grid">' +
        '<button class="wb-share-btn wb-share-full" id="wbCopyBtn"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> 复制分享链接</button>' +
        '<a class="wb-share-btn wb-share-qq" id="wbShareQQ" href="#" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M21.5 13.5c.3-1.5-.3-3-.5-3.5.5-1 .5-3.5-.5-5-1-1.5-3-2.5-5-2.5s-5 .8-6.5 2c-1.5 1.2-2.5 3-2.5 5 0 2 .5 4 1.5 5.5.2.5-.8 3-3 5.5 2 0 4-1 5-2 .5.2 1 .3 1.5.3s1-.1 1.5-.3c1 1 3 2 5 2-2-2-3.2-5-3-5.5 1-1.5 1.5-3.5 1.5-5.5 0-2-1-3.8-2.5-5-1-1-2.5-1.5-4-2-1.5.5-3 1-4 2-1.5 1.2-2.5 3-2.5 5 0 2 .5 4 1.5 5.5-.2.5-1 2.5-2.5 4 1 0 2-.5 3-1 .5.2 1 .3 1.5.3s1-.1 1.5-.3c1 1 2.5 1.5 4 1.5s3-.5 4-1.5c.5.2 1 .3 1.5.3s1-.1 1.5-.3c1 .5 2 1 3 1-1-1.5-2.3-3.5-2.5-4z"/></svg> QQ</a>' +
        '<a class="wb-share-btn wb-share-twitter" id="wbShareTwitter" href="#" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> X（Twitter）</a>' +
        '<button class="wb-share-btn" id="wbShareNative"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg> 更多分享</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  /* ─── DOM 引用 ─── */
  var closeBtn = document.getElementById('wbShareClose');
  var copyBtn = document.getElementById('wbCopyBtn');
  var qqLink = document.getElementById('wbShareQQ');
  var twitterLink = document.getElementById('wbShareTwitter');
  var nativeBtn = document.getElementById('wbShareNative');
  var shareText = document.getElementById('wbShareText');

  /* ─── 打开/关闭 ─── */
  function openShare() { overlay.classList.add('active'); }
  function closeShare() {
    overlay.classList.remove('active');
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> 复制分享链接';
    copyBtn.className = 'wb-share-btn wb-share-full';
  }

  fab.addEventListener('click', openShare);
  closeBtn.addEventListener('click', closeShare);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeShare();
  });

  /* ─── 复制链接 ─── */
  copyBtn.addEventListener('click', function() {
    var text = shareText.textContent || shareMsg;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> 已复制到剪贴板';
        copyBtn.className = 'wb-share-btn wb-share-full copied';
        setTimeout(function() {
          copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> 复制分享链接';
          copyBtn.className = 'wb-share-btn wb-share-full';
        }, 2500);
      }).catch(function() { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  });

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy');
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> 已复制';
      setTimeout(function() {
        copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> 复制分享链接';
      }, 2000);
    } catch(e) { alert('复制失败，请手动复制链接'); }
    document.body.removeChild(ta);
  }

  /* ─── QQ 分享 ─── */
  qqLink.addEventListener('click', function(e) {
    e.preventDefault();
    var qqUrl = 'https://connect.qq.com/widget/shareqq/index.html?url=' + encodeURIComponent(pageUrl) + '&title=' + encodeURIComponent(pageTitle) + '&summary=' + encodeURIComponent('来自 ' + SITE_NAME);
    window.open(qqUrl, '_blank', 'width=700,height=550');
  });

  /* ─── Twitter/X 分享 ─── */
  twitterLink.addEventListener('click', function(e) {
    e.preventDefault();
    var twUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(pageTitle + ' - ' + pageUrl + ' 来自 ' + SITE_NAME);
    window.open(twUrl, '_blank', 'width=600,height=450');
  });

  /* ─── 原生分享（移动端） ─── */
  nativeBtn.addEventListener('click', function() {
    if (navigator.share) {
      navigator.share({
        title: pageTitle,
        text: '发现了一篇好文章！',
        url: pageUrl
      }).catch(function() {});
    } else {
      copyBtn.click();
    }
  });
})();

/* ─────────────────────────────────────────────
   外链安全提醒：点外链先过 /oops/link/ 中转页
   （信任域名存 localStorage.oops_trusted_domains，由中转页维护）
   ───────────────────────────────────────────── */
(function() {
  var TRUSTED_KEY = 'oops_trusted_domains';
  function isTrusted(host) {
    try {
      var list = JSON.parse(localStorage.getItem(TRUSTED_KEY) || '[]');
      return list.indexOf(host) !== -1;
    } catch (e) { return false; }
  }
  document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || e.defaultPrevented) return;
    var href = a.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return;
    var dest;
    try { dest = new URL(href); } catch (err) { return; }
    if (dest.hostname === location.hostname) return;
    if (isTrusted(dest.hostname)) return;
    e.preventDefault();
    location.href = '/oops/link/index.html?url=' + encodeURIComponent(href);
  }, true);
})();
