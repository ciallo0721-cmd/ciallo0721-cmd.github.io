/**
 * ==========================================
 *  ciallo0721-cmd 动态广告系统 v1.2
 *  数据与逻辑分离 + 点击/展现/转化统计
 * ==========================================
 *
 * 算法逻辑：
 *   1. 每种广告标签有初始权重 100
 *   2. 用户点击进入广告 → 该标签权重 +10（喜欢）
 *   3. 用户点"不感兴趣" → 该标签权重 -40（降权）
 *   4. 加载时使用加权随机选择广告
 *   5. 同一页面不会展示重复广告
 *   6. 权重范围: 10 ~ 500
 *
 * 统计功能（v1.2）：
 *   1. 展现次数（impressions）：每次广告被渲染到页面 +1
 *   2. 点击次数（clicks）：用户点击广告 +1
 *   3. 转化率（CTR）：点击 / 展现 * 100%
 *   4. 数据存储于 localStorage('ciallo_ad_stats')
 *   5. 支持按广告/按标签汇总统计
 */

;(function () {
  'use strict';

  // ============ 从 ad-data.js 构建注册表 ============
  var DATA_SRC = window.AD_DATA || [];

  var STYLE_MAP = {
    '游戏':   { icon: '🎮', c1: '#FF4757', c2: '#FF6B81' },
    '工具':   { icon: '🛠️', c1: '#FF6B35', c2: '#FF9F6E' },
    '教育':   { icon: '📚', c1: '#FFD93D', c2: '#FFE97A' },
    '设计':   { icon: '🎨', c1: '#2ED573', c2: '#7BED9F' },
    '音乐':   { icon: '🎵', c1: '#1E90FF', c2: '#63B3FF' },
    '编程':   { icon: '💻', c1: '#3366FF', c2: '#7094FF' },
    'AI智能': { icon: '🤖', c1: '#7C3AED', c2: '#A78BFA' },
    '应用':   { icon: '📱', c1: '#E040FB', c2: '#F48FB1' },
    '影视':   { icon: '🎬', c1: '#FF4081', c2: '#FF80AB' },
    '阅读':   { icon: '📖', c1: '#8D6E63', c2: '#BCAAA4' },
    '购物':   { icon: '🛒', c1: '#FF6D00', c2: '#FFAB40' },
    '健康':   { icon: '🏃', c1: '#76FF03', c2: '#B2FF59' },
    '效率':   { icon: '🎯', c1: '#00BCD4', c2: '#4DD0E1' },
    '社交':   { icon: '🌍', c1: '#FF6E6E', c2: '#FF9E9E' },
    '娱乐':   { icon: '🎲', c1: '#FF408C', c2: '#FF79B0' },
    '域名':   { icon: '🌐', c1: '#6C5CE7', c2: '#A29BFE' }
  };

  /** 将 AD_DATA + STYLE_MAP 合并为内部注册表 */
  var AD_REGISTRY = [];
  function buildRegistry() {
    AD_REGISTRY = [];
    for (var i = 0; i < DATA_SRC.length; i++) {
      var entry = DATA_SRC[i];
      if (!entry || entry.length < 3) continue;
      var tag   = entry[0];
      var img   = entry[1];
      var link  = entry[2];
      var style = STYLE_MAP[tag] || {};
      AD_REGISTRY.push({
        id:   'ad-' + i,
        tag:  tag,
        icon: style.icon || '📌',
        svg:  img,
        link: link,
        c1:   style.c1 || '#3366FF',
        c2:   style.c2 || '#7094FF'
      });
    }
  }
  buildRegistry();

  // ============ 偏好引擎 ============
  var STORAGE_KEY  = 'ciallo_ad_prefs';
  var STATS_KEY    = 'ciallo_ad_stats';
  var BASE_WEIGHT  = 100;
  var LIKE_BONUS   = 10;
  var DISLIKE_PENALTY = 40;
  var MIN_WEIGHT   = 10;
  var MAX_WEIGHT   = 500;

  // ============ Cookie 读写 ============
  // 2026-09-12 起：ciallo_ad_prefs / ciallo_ad_disabled 由 localStorage 改存 Cookie。
  // 单个 Cookie 上限约 4KB，故写入时把 history 截到 20 条（原为 50）。
  // ciallo_ad_stats 仍留在 localStorage —— 它只是本地统计，不回传、也不随请求发送。
  var CK_PREF_DAYS = 365;
  var CK_HISTORY_MAX = 20;

  function ckGet(name) {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function ckSet(name, value, days) {
    var exp = days > 0 ? new Date(Date.now() + days * 86400000).toUTCString() : 'Fri, 31 Dec 9999 23:59:59 GMT';
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; Path=/; Expires=' + exp + '; SameSite=Lax' + secure;
  }

  function ckDel(name) {
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = name + '=; Path=/; Max-Age=0; SameSite=Lax' + secure;
  }

  // ============ Adkey 自验证签名 ============
  // 内置盐值（有默认值，站长无需修改）。
  // adkey.htm 生成带签名的 adkey → 直接发给访客 → 访客在调试面板输入 → 自动验证。
  // 站长不需要改任何代码，不需要重新部署。
  var ADKEY_SALT = 'ciallo-adkey-v1';  // 站长想换可以改，不改也行
  var ADKEY_STORAGE_KEY = 'ciallo_ad_disabled';

  /** 用盐值对明文签名 */
  function adkeySign(plain, salt) {
    var h = 0;
    for (var i = 0; i < plain.length; i++) {
      h = ((h << 5) - h) + plain.charCodeAt(i);
      h |= 0;
    }
    for (var i = 0; i < salt.length; i++) {
      h = ((h << 5) - h) + salt.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  /** 验证 adkey 签名（adkey 格式：明文-签名） */
  function validateAdkey(key) {
    if (!key) return false;
    key = key.trim();
    var lastDash = key.lastIndexOf('-');
    if (lastDash < 1) return false;
    var plain = key.slice(0, lastDash);
    var sig = key.slice(lastDash + 1);
    if (!plain || !sig) return false;
    return adkeySign(plain, ADKEY_SALT) === sig;
  }

  /** 验证并通过 adkey 后永久关闭广告 */
  function applyAdkey(key) {
    if (validateAdkey(key)) {
      try { ckSet(ADKEY_STORAGE_KEY, 'true', 3650); } catch(e) {}
      return true;
    }
    return false;
  }

  /** 恢复广告显示 */
  function removeAdkey() {
    try { ckDel(ADKEY_STORAGE_KEY); } catch(e) {}
  }

  /** 检查广告是否已被禁用 */
  function isAdDisabled() {
    try { return ckGet(ADKEY_STORAGE_KEY) === 'true'; } catch(e) {}
    return false;
  }

  function loadPrefs() {
    try {
      var raw = ckGet(STORAGE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p.blocked && p.blocked.length > 0) {
          console.log('[AdSystem] 迁移：清除旧的屏蔽列表 ' + JSON.stringify(p.blocked));
          delete p.blocked;
        }
        return p;
      }
    } catch (e) { /* ignore */ }
    return { weights: {}, history: [] };
  }

  function savePrefs(prefs) {
    try {
      if (prefs.history && prefs.history.length > CK_HISTORY_MAX) {
        prefs.history = prefs.history.slice(-CK_HISTORY_MAX);
      }
      ckSet(STORAGE_KEY, JSON.stringify(prefs), CK_PREF_DAYS);
    } catch (e) { /* ignore */ }
  }

  function getTagWeight(prefs, tag) {
    return prefs.weights[tag] || BASE_WEIGHT;
  }

  function weightedRandomSelect(prefs, candidates) {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    var total = 0;
    var weighted = candidates.map(function (ad) {
      var w = getTagWeight(prefs, ad.tag);
      total += w;
      return { ad: ad, w: w };
    });

    if (total === 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    var rand = Math.random() * total;
    var cum = 0;
    for (var i = 0; i < weighted.length; i++) {
      cum += weighted[i].w;
      if (rand <= cum) return weighted[i].ad;
    }
    return weighted[weighted.length - 1].ad;
  }

  function getAvailable(prefs) {
    return AD_REGISTRY.slice();
  }

  function resetPrefs() {
    ckDel(STORAGE_KEY);
    console.log('[AdSystem] 偏好已重置');
  }

  // ============ 交互处理 ============

  function onAdEnter(adId) {
    var ad = AD_REGISTRY.find(function (a) { return a.id === adId; });
    if (!ad) return;

    // 偏好更新
    var p = loadPrefs();
    var oldW = getTagWeight(p, ad.tag);
    p.weights[ad.tag] = Math.min(MAX_WEIGHT, oldW + LIKE_BONUS);
    p.history = p.history || [];
    p.history.push({ action: 'enter', adId: adId, tag: ad.tag, time: Date.now() });
    savePrefs(p);

    // 统计：点击 +1
    trackClick(adId);

    console.log('[AdSystem] 喜欢「' + ad.tag + '」权重: ' + oldW + ' → ' + p.weights[ad.tag]);
  }

  function onAdDislike(adId) {
    var ad = AD_REGISTRY.find(function (a) { return a.id === adId; });
    if (!ad) return;

    var p = loadPrefs();
    var oldW = getTagWeight(p, ad.tag);
    p.weights[ad.tag] = Math.max(MIN_WEIGHT, oldW - DISLIKE_PENALTY);
    p.history = p.history || [];
    p.history.push({ action: 'dislike', adId: adId, tag: ad.tag, time: Date.now() });
    savePrefs(p);

    console.log('[AdSystem] 不感兴趣「' + ad.tag + '」权重: ' + oldW + ' → ' + p.weights[ad.tag] + ' (不屏蔽)');
  }

  // ============ 统计系统 v1.2 ============

  /** 加载统计数据 */
  function loadStats() {
    try {
      var raw = localStorage.getItem(STATS_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        // 确保每个 ad 都有 stats 条目
        if (!s.ads) s.ads = {};
        return s;
      }
    } catch (e) { /* ignore */ }
    return { ads: {}, totalImpressions: 0, totalClicks: 0, lastUpdated: null };
  }

  /** 保存统计数据 */
  function saveStats(stats) {
    try {
      stats.lastUpdated = Date.now();
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) { /* ignore */ }
  }

  /** 记录一次展现 */
  function trackImpression(adId) {
    var ad = AD_REGISTRY.find(function (a) { return a.id === adId; });
    if (!ad) return;
    var stats = loadStats();
    if (!stats.ads[adId]) {
      stats.ads[adId] = { tag: ad.tag, impressions: 0, clicks: 0 };
    }
    stats.ads[adId].impressions = (stats.ads[adId].impressions || 0) + 1;
    stats.totalImpressions = (stats.totalImpressions || 0) + 1;
    saveStats(stats);
  }

  /** 记录一次点击 */
  function trackClick(adId) {
    var ad = AD_REGISTRY.find(function (a) { return a.id === adId; });
    if (!ad) return;
    var stats = loadStats();
    if (!stats.ads[adId]) {
      stats.ads[adId] = { tag: ad.tag, impressions: 0, clicks: 0 };
    }
    stats.ads[adId].clicks = (stats.ads[adId].clicks || 0) + 1;
    stats.totalClicks = (stats.totalClicks || 0) + 1;
    saveStats(stats);
  }

  /** 获取统计报表 */
  function getStatsReport() {
    var stats = loadStats();
    var report = {
      totalImpressions: stats.totalImpressions || 0,
      totalClicks: stats.totalClicks || 0,
      overallCTR: 0,
      ads: [],
      lastUpdated: stats.lastUpdated
    };

    if (report.totalImpressions > 0) {
      report.overallCTR = ((report.totalClicks / report.totalImpressions) * 100).toFixed(2) + '%';
    } else {
      report.overallCTR = '0.00%';
    }

    // 按注册表顺序输出每个广告的统计
    for (var i = 0; i < AD_REGISTRY.length; i++) {
      var ad = AD_REGISTRY[i];
      var adStats = stats.ads[ad.id] || { impressions: 0, clicks: 0 };
      var imp  = adStats.impressions || 0;
      var clk  = adStats.clicks || 0;
      var ctr  = imp > 0 ? ((clk / imp) * 100).toFixed(2) + '%' : '0.00%';
      report.ads.push({
        id: ad.id,
        tag: ad.tag,
        icon: ad.icon,
        impressions: imp,
        clicks: clk,
        ctr: ctr
      });
    }

    return report;
  }

  /** 重置统计数据 */
  function resetStats() {
    localStorage.removeItem(STATS_KEY);
    console.log('[AdSystem] 统计已重置');
  }

  /** 重置所有数据（偏好 + 统计） */
  function resetAll() {
    resetPrefs();
    resetStats();
    console.log('[AdSystem] 所有数据已重置');
  }

  // ============ 渲染 ============

  function createAdSlot(adId) {
    var p = loadPrefs();

    var ad;
    if (adId) {
      ad = AD_REGISTRY.find(function (a) { return a.id === adId; });
    } else {
      var available = getAvailable(p);
      if (available.length === 0) return null;
      ad = weightedRandomSelect(p, available);
    }

    if (!ad) return null;

    return buildAdDOM(ad);
  }

  function buildAdDOM(ad) {
    // 记录展现
    trackImpression(ad.id);

    var wrapper = document.createElement('div');
    wrapper.className = 'ad-card-wrapper';
    wrapper.setAttribute('data-ad-id', ad.id);
    wrapper.setAttribute('data-ad-tag', ad.tag);
    wrapper.setAttribute('data-ad-icon', ad.icon);

    wrapper.innerHTML =
      '<div class="ad-card">' +
        '<a href="' + ad.link + '" class="ad-card-link" target="_blank" rel="noopener" title="查看「' + ad.tag + '」广告详情">' +
          '<img src="' + ad.svg + '" alt="' + ad.tag + ' · 广告" class="ad-card-img" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';" />' +
          '<div class="ad-card-fallback" style="display:none;width:100%;aspect-ratio:728/90;align-items:center;justify-content:center;background:linear-gradient(135deg,' + ad.c1 + ',' + ad.c2 + ');border-radius:12px;color:white;font-size:18px;font-weight:700;font-family:\'PingFang SC\',\'Microsoft YaHei\',sans-serif;">' + ad.icon + ' ' + ad.tag + '</div>' +
        '</a>' +
        '<button class="ad-card-dislike" title="不感兴趣，减少此类推荐" aria-label="不感兴趣">' +
          '<svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M8 1a7 7 0 100 14A7 7 0 008 1zm2.35 9.35a.5.5 0 01-.7.7L8 8.71l-1.65 1.64a.5.5 0 01-.7-.7L7.29 8 5.65 6.35a.5.5 0 01.7-.7L8 7.29l1.65-1.64a.5.5 0 01.7.7L8.71 8l1.64 1.65z"/></svg>' +
        '</button>' +
        '<span class="ad-card-tag" title="广告分类：' + ad.tag + '">' + ad.icon + ' ' + ad.tag + '</span>' +
      '</div>';

    var link = wrapper.querySelector('.ad-card-link');
    link.addEventListener('click', function () {
      onAdEnter(ad.id);
    });

    var dislikeBtn = wrapper.querySelector('.ad-card-dislike');
    dislikeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      onAdDislike(ad.id);

      wrapper.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      wrapper.style.opacity = '0';
      wrapper.style.transform = 'scale(0.9)';
      setTimeout(function () {
        if (wrapper.parentNode) {
          wrapper.parentNode.removeChild(wrapper);
        }
      }, 300);
    });

    return wrapper;
  }

  function initAdSlots() {
    // 如果 adkey 已生效，不在任何页面渲染广告
    if (isAdDisabled()) {
      console.log('[AdSystem] 广告已被用户关闭（adkey 验证通过），跳过渲染');
      return;
    }

    var slots = document.querySelectorAll('[data-ad-slot]');
    
    var debugMarker = document.createElement('div');
    debugMarker.style.cssText = 'text-align:center;padding:8px;margin:0 auto;max-width:728px;font-size:11px;color:#aaa;font-family:"PingFang SC","Microsoft YaHei",sans-serif;';
    debugMarker.textContent = '[AdSystem v1.2] 统计已开启 | 展现: ' + (loadStats().totalImpressions || 0) + ' | 点击: ' + (loadStats().totalClicks || 0);
    if (slots.length > 0) {
      var lastSlot = slots[slots.length - 1];
      lastSlot.parentNode.insertBefore(debugMarker, lastSlot.nextSibling);
    }
    
    if (slots.length === 0) {
      console.log('[AdSystem] 未检测到广告位容器 (data-ad-slot)');
      return;
    }

    console.log('[AdSystem] 检测到 ' + slots.length + ' 个广告位，开始智能投放...');

    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (slot.children.length > 0) continue;
      var specifiedId = slot.getAttribute('data-ad-id') || null;
      var adEl = createAdSlot(specifiedId);
      if (adEl) {
        slot.appendChild(adEl);
      } else {
        slot.innerHTML = '<div class="ad-empty">暂无广告喵～</div>';
      }
    }

    var p = loadPrefs();
    console.log('[AdSystem] 当前偏好: ' + JSON.stringify(p.weights));
  }

  // ============ 导出 API ============
  window.AdSystem = {
    init: initAdSlots,
    reset: resetPrefs,
    resetStats: resetStats,
    resetAll: resetAll,
    getPrefs: loadPrefs,
    getAd: createAdSlot,
    getStats: getStatsReport,
    registry: AD_REGISTRY,
    // adkey 相关
    adkeySign: adkeySign,
    validateAdkey: validateAdkey,
    applyAdkey: applyAdkey,
    removeAdkey: removeAdkey,
    isAdDisabled: isAdDisabled
  };

  // ============ 注入样式 ============
  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '[data-ad-slot] { width: 100%; }' +
      '.ad-card-wrapper { position: relative; width: 100%; max-width: 728px; margin: 0 auto; }' +
      '.ad-card { position: relative; width: 100%; line-height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,0.08); transition: all 0.35s cubic-bezier(0.4,0,0.2,1); border: 1px solid rgba(51,102,255,0.12); }' +
      '.ad-card:hover { box-shadow: 0 6px 28px rgba(51,102,255,0.22); transform: translateY(-2px); border-color: rgba(51,102,255,0.3); }' +
      '.ad-card-img { width: 100%; height: auto; display: block; border-radius: 12px; }' +
      '.ad-card-link { display: block; width: 100%; line-height: 0; text-decoration: none; }' +
      '.ad-card-dislike { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; padding: 0; border: none; border-radius: 50%; background: rgba(0,0,0,0.35); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s ease, background 0.2s ease; z-index: 10; }' +
      '.ad-card:hover .ad-card-dislike { opacity: 1; }' +
      '.ad-card-dislike:hover { background: rgba(255,71,87,0.85); }' +
      '.ad-card-tag { position: absolute; bottom: 8px; left: 8px; padding: 3px 10px; background: rgba(0,0,0,0.45); color: #fff; font-size: 11px; border-radius: 10px; font-family: "PingFang SC","Microsoft YaHei",sans-serif; white-space: nowrap; pointer-events: none; }' +
      '.ad-empty { text-align: center; color: #999; padding: 20px; font-size: 13px; font-family: "PingFang SC","Microsoft YaHei",sans-serif; }' +
      '@media (max-width: 768px) { .ad-card-dislike { opacity: 1; width: 22px; height: 22px; top: 4px; right: 4px; } .ad-card-tag { font-size: 10px; padding: 2px 8px; bottom: 4px; left: 4px; } }';

    document.head.appendChild(style);
  }

  // ============ 自动启动 ============
  injectStyles();

  if (document.readyState !== 'loading') {
    initAdSlots();
  }
  document.addEventListener('DOMContentLoaded', initAdSlots);
  setTimeout(initAdSlots, 1000);
})();
