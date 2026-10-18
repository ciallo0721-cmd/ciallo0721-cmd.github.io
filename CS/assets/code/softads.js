/* ==========================================================
 *  softads.js —— 战场墙面软性广告（软植入模块 v1）
 * ----------------------------------------------------------
 * 思路：不打横幅、不弹窗、不遮挡画面。广告以「墙上海报」的形式
 *       存在于地图里 —— 你路过才看得见，跟场景融为一体。
 *
 * 特性
 *   · 自包含：不改动 CS.js / ai.js 等任何游戏逻辑
 *   · Canvas 实时生成贴图，不依赖任何图片文件
 *   · 自动挑选较长的墙面，贴在地图外侧那一面（朝向战场中央）
 *   · ?noads=1 一键关闭全部海报
 *
 * 想换内容 / 加一条：改下面 POSTERS 数组即可（改完刷新就生效）。
 * ========================================================== */
(function () {
  'use strict';

  // ---------- 海报内容（软植入位） ----------
  var POSTERS = [
    { brand: 'DOVE',      name: '德芙巧克力', sub: '纵享丝滑 · 回能 +20%',   bg: '#4a2a1a', fg: '#f3e2c0', accent: '#d9b26a' },
    { brand: 'SPAM',      name: 'SPAM 罐头',  sub: '经典午餐肉 · 回血 +30%', bg: '#1c3f8f', fg: '#ffe066', accent: '#ff6b6b' },
    { brand: 'OREO',      name: '奥利奥',     sub: '扭一扭 · 舔一舔 · 泡一泡', bg: '#1b1b1f', fg: '#ffffff', accent: '#7fc4ff' },
    { brand: 'TNAME',     name: '域名注册',   sub: '.top 一年不到 30 块',    bg: '#2b2352', fg: '#e6e0ff', accent: '#a99bfa' },
    { brand: 'CIALLO',    name: 'ciallo0721-cmd', sub: '主站 · 更多小游戏与文章', bg: '#0c4a6e', fg: '#e0f2fe', accent: '#0ea5e9' },
    { brand: 'WORK',      name: '打工模拟器',  sub: '本站还有别的游戏',      bg: '#3a2a12', fg: '#ffe9c2', accent: '#f0a500' }
  ];

  var MAX_POSTERS = 14;     // 全图最多贴几张
  var MIN_WALL_SPAN = 6;    // 太短的墙不贴（避免挡住门洞）

  if (/[?&]noads=1/.test(location.search)) return;

  function makeTexture(p) {
    var W = 320, H = 200;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d');

    // 底色
    x.fillStyle = p.bg;
    x.fillRect(0, 0, W, H);

    // 做旧：随机噪点，跟地图的像素做旧风格统一
    x.globalAlpha = 0.07;
    x.fillStyle = '#ffffff';
    for (var i = 0; i < 260; i++) {
      x.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    x.globalAlpha = 1;

    // 边框
    x.strokeStyle = p.accent;
    x.lineWidth = 6;
    x.strokeRect(8, 8, W - 16, H - 16);

    // 品牌大字
    x.fillStyle = p.fg;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = 'bold 46px "Microsoft YaHei","PingFang SC",sans-serif';
    x.fillText(p.brand, W / 2, 62);

    // 中文名
    x.font = 'bold 26px "Microsoft YaHei","PingFang SC",sans-serif';
    x.fillText(p.name, W / 2, 112);

    // 副标题
    x.fillStyle = p.accent;
    x.font = '20px "Microsoft YaHei","PingFang SC",sans-serif';
    x.fillText(p.sub, W / 2, 152);

    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  // ---------- 放置逻辑 ----------
  var placed = false;

  function placePosters() {
    if (placed) return true;
    if (typeof walls === 'undefined' || !walls.length) return false;
    if (typeof scene === 'undefined') return false;
    if (scene.getObjectByName('softAdGroup')) { placed = true; return true; }

    var group = new THREE.Group();
    group.name = 'softAdGroup';

    // 只挑够长的墙；长边决定海报贴哪一面
    var cands = [];
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var span = Math.max(w.w, w.d);
      if (span >= MIN_WALL_SPAN) cands.push(w);
    }
    if (!cands.length) return false;

    var step = Math.max(1, Math.floor(cands.length / MAX_POSTERS));
    var n = 0;
    for (var k = 0; k < cands.length && n < MAX_POSTERS; k += step, n++) {
      var wall = cands[k];
      var p = POSTERS[n % POSTERS.length];

      var mat = new THREE.MeshLambertMaterial({ map: makeTexture(p), side: THREE.FrontSide });
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.63), mat);
      mesh.position.y = 1.7;

      if (wall.w >= wall.d) {
        // 长面朝向 ±Z：选朝战场中央（原点）的那一面
        var signZ = wall.z > 0 ? -1 : 1;
        mesh.position.set(wall.x, 1.7, wall.z + signZ * (wall.d / 2 + 0.06));
        mesh.rotation.y = signZ < 0 ? Math.PI : 0;
      } else {
        var signX = wall.x > 0 ? -1 : 1;
        mesh.position.set(wall.x + signX * (wall.w / 2 + 0.06), 1.7, wall.z);
        mesh.rotation.y = signX > 0 ? Math.PI / 2 : -Math.PI / 2;
      }

      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }

    if (!group.children.length) return false;

    scene.add(group);
    placed = true;
    console.log('[SoftAds] 已贴出 ' + group.children.length + ' 张墙上海报（?noads=1 可关闭）');
    return true;
  }

  // 地图是异步搭起来的（要等 SVG 纹理加载），轮询等它就位
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (placePosters() || tries > 80) clearInterval(timer);
  }, 500);
})();
