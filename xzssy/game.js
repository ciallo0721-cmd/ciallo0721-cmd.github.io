/* ============================================================
   凶宅试睡员 · game.js
   主逻辑：状态机 / 第一人称控制 / 时间条 / 任务 / 灵异事件 / UI
   ============================================================ */
(function () {
  'use strict';

  var XZ = window.XZ, sfx = XZ.sfx;
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  /* ---------------- 常量 ---------------- */
  var CFG = {
    DAYS: 2, BARS: 3, MIN_PER_BAR: 30, SEC_PER_MIN: 3,
    WALK: 2.05, RUN: 3.45, EYE: 1.62, RADIUS: 0.32,
    FEAR_DARK: 0.30, FEAR_LIT: 0.05,
    MAXLIGHT: 4,
    START_CLOCK: 21 * 60          // 21:00 进屋
  };

  /* ---------------- 状态 ---------------- */
  var S = {
    run: false, over: false, paused: false, started: false,
    map: null, grid: null, bg: null, house: null,
    day: 1, t: 0, bonus: 0,
    fear: 0, immune: 0, safe: 0, freeze: 0, possess: 0, possessKind: '',
    torch: true, camMode: false, phoneOpen: false,
    tasks: {}, today: [], doneToday: 0, totalTasks: 0,
    shotToday: {}, photos: [], cameras: {}, cooked: false,
    power: false, tvOn: false, pcOn: false,
    toiletAcc: 0, phoneAcc: 0,
    yaw: 0, pitch: 0, pos: new THREE.Vector3(),
    keys: {}, sens: 1,
    room: null, roomTagT: 0,
    evT: 6, hauntT: 22, lastEv: '',
    ghost: null, ghostT: 0,
    nightStart: 0, deadReason: '',
    hasTV: false, hasPC: false
  };

  /* ---------------- 引擎 ---------------- */
  var renderer, scene, camera, torch, fill;
  var clock = null;
  var quality = (typeof isTouch === 'function' && isTouch()) ? 0.72 : 0.85;

  function initEngine() {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1) * (isTouch() ? 0.72 : 0.85));
    renderer.setSize(window.innerWidth, window.innerHeight);
    $('app').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03040a);
    scene.fog = new THREE.FogExp2(0x05070c, 0.055);

    camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.04, 70);

    var amb = new THREE.AmbientLight(0x3d5068, 1.0);
    scene.add(amb);

    torch = new THREE.SpotLight(0xfff0cc, 1.55, 20, Math.PI / 7.2, 0.62, 1.35);
    torch.position.set(0, 0, 0.05);
    torch.target.position.set(0, 0, -1);
    camera.add(torch);
    camera.add(torch.target);

    // 近身补光，避免手电照不到的地方纯黑
    fill = new THREE.PointLight(0x93aecd, 0.26, 5.5, 1.2);
    fill.position.set(0, -0.05, 0.1);
    camera.add(fill);

    scene.add(camera);

    window.addEventListener('resize', onResize);
    clock = { last: performance.now() };
  }

  function onResize() {
    if (!renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ---------------- 抽签 ---------------- */
  function rollRun() {
    // 支持 ?map=m3&bg=b4 固定本局（调试 / 自选），?debug=1 显示输入状态
    var q = new URLSearchParams(location.search);
    S.debug = q.has('debug');
    var wantMap = q.get('map'), wantBg = q.get('bg');
    // 先定背景，再从「这个故事允许的户型池」里抽（不同故事不共用户型）
    S.bg = XZ.BGS.filter(function (b) { return b.id === wantBg; })[0] || pick(XZ.BGS);
    var pool = XZ.MAPS.filter(function (m) {
      return !S.bg.maps || S.bg.maps.indexOf(m.id) >= 0;
    });
    if (!pool.length) pool = XZ.MAPS;
    S.map = XZ.MAPS.filter(function (m) { return m.id === wantMap; })[0] || pick(pool);
    S.grid = XZ.makeGrid(S.map);
    window.__xz = S;   // 调试用：简报页也能读到状态
    S.day = 1; S.t = 0; S.bonus = 0; S.fear = 0;
    S.totalTasks = 0; S.photos = []; S.cameras = {}; S.cooked = false;
    S.power = false; S.tvOn = false; S.pcOn = false;
    S.over = false; S.deadReason = '';
    S.policeCalled = false; S.policeAcc = 0; S.helpT = 0; S.dying = 0;
    S.encStage = 0; S.encT = 20;
    S.debugMode = false; S.fly = false;
    if (S.bg.special === 'debug') S.debugMode = true;
    rollDayTasks();
  }

  function rollDayTasks() {
    var pool = XZ.TASKS.filter(function (t) { return t.per === 'day'; }).map(function (t) { return t.id; });
    // 洗牌取 4 个
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    S.today = pool.slice(0, 4);
    S.tasks = {};
    S.shotToday = {};
    S.doneToday = 0;
    S.toiletAcc = 0; S.phoneAcc = 0;
    S.cooked = false;
  }

  /* ---------------- 简报 ---------------- */
  function renderIntro() {
    var m = S.map, bg = S.bg, g = S.grid;
    var areas = XZ.areasOf(m);

    $('caseNo').textContent = ('0000' + Math.floor(Math.random() * 9999)).slice(-4);
    $('planArea').textContent = m.w + ' × ' + m.h + ' 格 · ' + areas.length + ' 个区域';
    $('planWrap').innerHTML = XZ.planSVG(m, g, { triggers: bg.triggers });
    $('bgLevel').textContent = '难度 ' + bg.level + ' · ' + bg.levelTag;

    // 图例
    var leg = [['#5c4634', '走廊'], ['#7a5a3c', '客厅'], ['#6a4c34', '主卧'], ['#5e4430', '次卧'],
    ['#6c6c70', '厨房'], ['#767680', '厕所'], ['#4f4a44', '储物'], ['#62452e', '书房'],
    ['#4a4552', '电竞'], ['#56565c', '阳台']];
    $('planLegend').innerHTML = leg.map(function (x) {
      return '<span><i style="background:' + x[0] + '"></i>' + x[1] + '</span>';
    }).join('');

    $('houseCard').innerHTML =
      '<div class="hc-name">' + m.name + '</div>' +
      '<div class="hc-addr">' + m.addr + ' · 建成年份 ' + m.year + ' · 约 ' + m.area + ' ㎡</div>' +
      '<div class="hc-desc">' + m.desc + '</div>';

    var story = bg.story.map(function (p, i) {
      return '<p' + (i === 0 ? '' : '') + '>' + p.replace(/张冯|王艳芳|郑德尘|周家六口|周氏逢|周夏富/g,
        function (k) { return '<span class="ghost-name">' + k + '</span>'; }) + '</p>';
    }).join('');
    story += '<p class="warn">死亡时间：' + bg.died + '　死因：' + bg.cause +
      (bg.triggers.length ? '　灵异触发点：' + bg.triggers.map(function (r) {
        var rm = m.rooms.filter(function (q) { return q.id === r; })[0];
        return rm ? (XZ.ROOM[rm.type] || {}).name : r;
      }).join(' / ') : '　灵异触发点：无记录') + '</p>';
    story += '<p style="color:#d9b676">' + bg.title + '</p>';
    $('bgStory').innerHTML = story;

    $('introTasks').innerHTML = XZ.TASKS.map(function (t) {
      return '<li><b>' + t.icon + '</b><span>' + t.name + ' — <span style="color:#7d8792">' + t.desc + '</span></span></li>';
    }).join('');

    $('introItems').innerHTML = XZ.ITEMS.map(function (it) {
      return '<li><b>' + (it.key || '·') + '</b><span>' + it.name + ' — <span>' + it.desc + '</span></span></li>';
    }).join('');
  }

  /* ---------------- 开局 ---------------- */
  function startRun() {
    sfx.init();
    sfx.drone(true, 0.05);

    $('app').innerHTML = '';
    initEngine();

    var house = XZ.buildHouse(scene, S.map, S.grid, { maxLight: CFG.MAXLIGHT });
    S.house = house;

    S.hasTV = house.interact.some(function (i) { return i.kind === 'tv'; });
    S.hasPC = house.interact.some(function (i) { return i.kind === 'pc'; });

    // 限流点光源：只保留面积最大的 N 个
    limitLights(house);

    // 出生点
    var off = house.off;
    S.pos.set(S.map.spawn.x + 0.5 + off.x, CFG.EYE, S.map.spawn.y + 0.5 + off.z);
    S.yaw = 0; S.pitch = 0;                 // 朝 -Z（走廊深处）
    S.room = roomIdAt(S.pos.x, S.pos.z);

    // 厨房刀（b3 的死亡陷阱）——挂在灶台旁边
    var kit = S.map.rooms.filter(function (r) { return r.type === 'kitchen'; })[0];
    if (kit) {
      var R = kit;
      var kx = R.x + R.w * 0.5 + off.x, kz = R.y + 0.25 + off.z;
      var kmat = new THREE.MeshBasicMaterial({ color: 0x9aa0a6 });
      var knife = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.07), kmat);
      knife.position.set(kx, 0.92, kz);
      knife.rotation.y = 0.6;
      scene.add(knife);
      house.interact.push({ kind: 'knife', room: kit, pos: new THREE.Vector3(kx, 0.92, kz), mesh: knife });
    }

    $('intro').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('loading').classList.add('hidden');

    S.run = true; S.started = true; S.nightStart = performance.now();
    window.__xz = S;   // 调试用：控制台可看状态
    renderHotbar();
    renderTasks();
    updateHUD();
    bindControls();
    if (isTouch()) $('touchUI').classList.remove('hidden');

    subtitle('屋子里比外面冷。你打开手电筒，光柱里的灰尘几乎不动。', 6);
    requestLock();
    loop();
  }

  var LIGHT_PRIORITY = ['hall', 'living', 'kitchen', 'master', 'second', 'study', 'esports', 'toilet', 'storage', 'balcony'];

  function limitLights(house) {
    var list = house.lights;
    if (list.length <= CFG.MAXLIGHT) { list.forEach(function (l) { l.hasLight = true; }); return; }
    var sorted = list.slice().sort(function (a, b) {
      return LIGHT_PRIORITY.indexOf(a.room.type) - LIGHT_PRIORITY.indexOf(b.room.type);
    });
    var keep = {};
    sorted.slice(0, CFG.MAXLIGHT).forEach(function (l) { keep[l.room.id] = 1; });
    list.forEach(function (l) {
      l.hasLight = !!keep[l.room.id];
      if (!l.hasLight) scene.remove(l.light);
    });
  }

  /* ---------------- 碰撞 ---------------- */
  function cellBlocked(x, z) {
    var off = S.house.off, g = S.grid;
    var gx = Math.floor(x - off.x), gz = Math.floor(z - off.z);
    if (gx < 0 || gz < 0 || gx >= g.W || gz >= g.H) return true;
    var idx = gz * g.W + gx;
    if (!g.cells[idx]) return true;
    return !!S.house.blockers[idx];
  }
  function canStand(x, z) {
    var r = CFG.RADIUS;
    if (cellBlocked(x, z)) {
      // 已被卡住 → 允许移动脱困
      return !cellBlocked(S.pos.x, S.pos.z) ? false : true;
    }
    return !cellBlocked(x - r, z - r) && !cellBlocked(x + r, z - r) &&
      !cellBlocked(x - r, z + r) && !cellBlocked(x + r, z + r);
  }
  function roomIdAt(x, z) {
    if (!S.house) return null;
    var off = S.house.off;
    return S.grid.roomIdAt(x - off.x, z - off.z);
  }
  function roomOf(id) {
    return S.map.rooms.filter(function (r) { return r.id === id; })[0] || null;
  }
  function roomName(id) {
    var r = roomOf(id);
    if (!r) return '走廊';
    return r.name || (XZ.ROOM[r.type] || {}).name || '房间';
  }
  function roomCenter(id) {
    var r = roomOf(id); if (!r) return null;
    var off = S.house.off;
    return new THREE.Vector3(r.x + r.w / 2 + off.x, 0, r.y + r.h / 2 + off.z);
  }

  /* ---------------- 鬼影寻路：走门，不穿墙 ---------------- */
  var _bfsPrev = null;

  // 把任意坐标吸附到最近的可站立格（玩家可能站在家具里、鬼可能刷在床上）
  function snapCell(x, z, g, off) {
    var cx0 = Math.floor(x - off.x), cz0 = Math.floor(z - off.z);
    function ok(cx, cz) {
      if (cx < 0 || cz < 0 || cx >= g.W || cz >= g.H) return false;
      var i = cz * g.W + cx;
      return !!g.cells[i] && !S.house.blockers[i];
    }
    if (ok(cx0, cz0)) return { x: cx0, z: cz0 };
    for (var r = 1; r <= 3; r++) {
      for (var dz = -r; dz <= r; dz++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (ok(cx0 + dx, cz0 + dz)) return { x: cx0 + dx, z: cz0 + dz };
        }
      }
    }
    return null;
  }

  function bfsPath(fromX, fromZ, toX, toZ) {
    if (!S.grid || !S.house) return null;
    var g = S.grid, off = S.house.off, W = g.W, H = g.H, N = W * H;
    var a = snapCell(fromX, fromZ, g, off), b = snapCell(toX, toZ, g, off);
    if (!a || !b) return null;
    var sx = a.x, sz = a.z, tx = b.x, tz = b.z;
    var si = sz * W + sx, ti = tz * W + tx;
    if (si === ti) return null;
    if (!_bfsPrev || _bfsPrev.length !== N) _bfsPrev = new Int32Array(N);
    var prev = _bfsPrev;
    prev.fill(-1);
    var q = [si];
    prev[si] = si;
    for (var head = 0; head < q.length; head++) {
      var cur = q[head];
      if (cur === ti) break;
      var cxx = cur % W, czz = (cur - cxx) / W;
      for (var d = 0; d < 4; d++) {
        var nx = cxx + (d === 0 ? 1 : d === 1 ? -1 : 0);
        var nz = czz + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
        var ni = nz * W + nx;
        if (prev[ni] !== -1) continue;
        if (!g.cells[ni]) continue;                 // 实墙
        if (S.house.blockers[ni]) continue;         // 家具
        prev[ni] = cur;
        q.push(ni);
      }
    }
    if (prev[ti] === -1) return null;
    var path = [], pp = ti, guard = 0;
    while (pp !== si && guard++ < 4000) { path.push(pp); pp = prev[pp]; }
    path.reverse();
    return path;
  }

  /* ---------------- 控制 ---------------- */
  var locked = false, dragging = false, touchMode = false;

  // 只有真的收到 touchstart 才认作触屏（Windows 一体机常报 maxTouchPoints>0，但人是拿鼠标玩的）
  function isTouch() { return touchMode; }

  function requestLock(tries) {
    if (touchMode) return;                    // 触屏模式不要指针锁定
    tries = tries || 0;
    try {
      if (document.pointerLockElement === renderer.domElement) { locked = true; return; }
      var p = renderer.domElement.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(function () { });
    } catch (e) { }
    // Chrome 在 exitPointerLock 之后约 1 秒内会静默拒绝，隔一会儿补一次
    if (tries < 2) {
      setTimeout(function () {
        if (!locked && S.run && !S.paused && !S.over) requestLock(tries + 1);
      }, 520);
    }
  }

  function lockHint(show) {
    if (show && touchMode) return;            // 触屏不需要鼠标锁定提示
    var h = $('lockHint');
    if (h) h.classList.toggle('hidden', !show);
  }

  function bindControls() {
    document.addEventListener('pointerlockchange', function () {
      locked = document.pointerLockElement === renderer.domElement;
      if (locked) lockHint(false);
      else if (S.run && !S.over && !S.paused) lockHint(true);
    });
    document.addEventListener('pointerlockerror', function () {
      locked = false;
      if (S.run && !S.over && !S.paused) lockHint(true);
    });

    document.addEventListener('mousemove', function (e) {
      if (!S.run || S.over || S.paused) return;
      if (!locked && !dragging) return;
      var mx = e.movementX || 0, my = e.movementY || 0;
      // 刚锁上指针时 movement 偶尔会蹦出几百上千，直接夹住，免得视角被甩飞
      if (mx > 160) mx = 160; else if (mx < -160) mx = -160;
      if (my > 160) my = 160; else if (my < -160) my = -160;
      var k = 0.0022 * S.sens;
      S.yaw -= mx * k;
      S.pitch = clamp(S.pitch - my * k, -1.35, 1.35);
    });

    renderer.domElement.addEventListener('mousedown', function (e) {
      if (!S.run || S.over || S.paused) return;
      if (e.button === 2) { if (S.camMode) toggleCam(false); return; }
      if (e.button !== 0) return;
      dragging = true;                       // 拿不到指针锁定时，按住左键拖动照样能转视角
      if (!locked) requestLock();
      if (S.camMode) takePhoto();
    });
    document.addEventListener('mouseup', function () { dragging = false; });
    renderer.domElement.addEventListener('mouseleave', function () { dragging = false; });
    document.addEventListener('contextmenu', function (e) {
      if (S.run) e.preventDefault();
    });

    document.addEventListener('keydown', function (e) {
      if (!S.run) return;
      var k = e.key.toLowerCase();
      S.keys[k] = true;
      if (k === 'escape') {
        e.preventDefault();
        if (!$('panel').classList.contains('hidden')) { closePanel(); return; }
        if (S.over || S.nightEnding) return;
        setPause(!S.paused);
        return;
      }
      if (e.shiftKey && k === 'c') { e.preventDefault(); toggleDebug(); return; }
      if (S.over || S.paused) return;
      if (S.debugMode) {
        if (k === 'g') { e.preventDefault(); debugSummon(); return; }
        if (k === 'v') { e.preventDefault(); S.fly = !S.fly; toast(S.fly ? '飞天：开（W/S 上下，穿墙）' : '飞天：关'); return; }
        if (k === 't') {
          e.preventDefault();
          S.today.slice().forEach(function (id) { if (!S.tasks[id]) complete(id); });
          return;
        }
        if (k === 'n') { e.preventDefault(); S.bonus += 1; toast('时间条 +1'); return; }
        if (k === 'b') { e.preventDefault(); S.fear = 0; toast('恐惧清零'); return; }
        if (k === 'm') { e.preventDefault(); endNight(true); return; }
      }
      if (k === 'e') { e.preventDefault(); doInteract(); }
      else if (k === 'f') { e.preventDefault(); toggleTorch(); }
      else if (k === 'c') { e.preventDefault(); toggleCam(); }
      else if (k === 'h') { e.preventDefault(); openManual(); }
      else if (k === 'q') { e.preventDefault(); openPhone(); }
      else if (k === 'p') { e.preventDefault(); openAlbum(); }
      else if (k === '1') useAmulet();
      else if (k === '2') useSalt();
      else if (k === '3') useMedkit();
    });
    document.addEventListener('keyup', function (e) { S.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', function () { S.keys = {}; dragging = false; });

    // 摇杆监听常驻（对鼠标用户不触发），第一次真触屏只负责切模式 + 亮界面
    bindTouch();
    window.addEventListener('touchstart', function onFirstTouch() {
      window.removeEventListener('touchstart', onFirstTouch);
      touchMode = true;
      lockHint(false);
      if (document.exitPointerLock) document.exitPointerLock();
      if (S.run) {
        $('touchUI').classList.remove('hidden');
        document.body.classList.add('touchmode');
        lockHint(false);
      }
    }, { passive: true });

    // 按钮
    $('muteBtn').addEventListener('click', function () {
      var m = !sfx.isMuted(); sfx.mute(m);
      $('muteBtn').textContent = m ? '✕' : '♪';
      $('muteBtn').style.color = m ? '#5b656f' : '';
    });
    $('resumeBtn').addEventListener('click', function () { setPause(false); requestLock(); });
    $('manualBtn2').addEventListener('click', function () { setPause(false); openManual(); });
    $('quitBtn').addEventListener('click', function () { endRun('quit'); });
    $('panelClose').addEventListener('click', closePanel);
    $('againBtn').addEventListener('click', function () { location.reload(); });
    $('sleepNext').addEventListener('click', nextDay);
    $('sensRange').addEventListener('input', function (e) { S.sens = parseFloat(e.target.value) || 1; });
  }

  /* ---------------- 触控：左摇杆移动 / 右摇杆视角 ---------------- */
  function bindTouch() {
    if (S.touchBound) return;
    S.touchBound = true;

    var elL = $('stickL'), elR = $('stickR');
    var knobL = elL.querySelector('.knob'), knobR = elR.querySelector('.knob');
    var CAP = 46;                       // 摇杆最大位移（px）
    var mv = { x: 0, y: 0 };            // 左摇杆 → 移动
    var lk = { x: 0, y: 0 };            // 右摇杆 → 视角
    var idL = null, idR = null;
    var baseL = null, baseR = null;

    function center(el) {
      var r = el.getBoundingClientRect();
      if (r.width > 2) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      // 还没亮界面时 rect 全是 0：按 CSS 常量推算（底边 86 + 126 见方的圆盘）
      var w = 126, b = 86;
      return {
        x: el.id === 'stickL' ? 20 + w / 2 : window.innerWidth - 20 - w / 2,
        y: window.innerHeight - b - w / 2
      };
    }
    function setKnob(el, knob, dx, dy) {
      var d = Math.hypot(dx, dy);
      var k = d > CAP ? CAP / d : 1;
      knob.style.transform = 'translate(' + (dx * k) + 'px,' + (dy * k) + 'px)';
    }
    function norm(dx, dy) {
      var x = clamp(dx / CAP, -1, 1), y = clamp(dy / CAP, -1, 1);
      // 小死区，防手指抖动
      if (Math.hypot(x, y) < 0.16) return { x: 0, y: 0 };
      return { x: x, y: y };
    }

    function onStart(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        // 落到按钮上的触摸不归摇杆管
        if (t.target && t.target.closest && t.target.closest('#touchBtns')) continue;
        if (t.clientX < window.innerWidth * 0.5) {
          if (idL !== null) continue;
          idL = t.identifier;
          baseL = center(elL);
          elL.classList.add('active');
          var a = norm(t.clientX - baseL.x, t.clientY - baseL.y);
          mv.x = a.x; mv.y = a.y;
          setKnob(elL, knobL, t.clientX - baseL.x, t.clientY - baseL.y);
        } else {
          if (idR !== null) continue;
          idR = t.identifier;
          baseR = center(elR);
          elR.classList.add('active');
          var b = norm(t.clientX - baseR.x, t.clientY - baseR.y);
          lk.x = b.x; lk.y = b.y;
          setKnob(elR, knobR, t.clientX - baseR.x, t.clientY - baseR.y);
        }
      }
      e.preventDefault();
    }

    function onMove(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === idL && baseL) {
          var dx = t.clientX - baseL.x, dy = t.clientY - baseL.y;
          var a = norm(dx, dy);
          mv.x = a.x; mv.y = a.y;
          setKnob(elL, knobL, dx, dy);
        } else if (t.identifier === idR && baseR) {
          var dx2 = t.clientX - baseR.x, dy2 = t.clientY - baseR.y;
          var b = norm(dx2, dy2);
          lk.x = b.x; lk.y = b.y;
          setKnob(elR, knobR, dx2, dy2);
        }
      }
      e.preventDefault();
    }

    function onEnd(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === idL) {
          idL = null; mv.x = 0; mv.y = 0;
          knobL.style.transform = ''; elL.classList.remove('active');
        }
        if (t.identifier === idR) {
          idR = null; lk.x = 0; lk.y = 0;
          knobR.style.transform = ''; elR.classList.remove('active');
        }
      }
    }

    var cv = renderer.domElement;
    cv.addEventListener('touchstart', onStart, { passive: false });
    cv.addEventListener('touchmove', onMove, { passive: false });
    cv.addEventListener('touchend', onEnd);
    cv.addEventListener('touchcancel', onEnd);
    S.touchMove = mv;
    S.touchLook = lk;

    $('touchBtns').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !S.run || S.over || S.paused) return;
      var a = b.getAttribute('data-act');
      if (a === 'E') doInteract();
      else if (a === 'F') toggleTorch();
      else if (a === 'C') toggleCam();
      else if (a === 'H') openManual();
      else if (a === 'Q') openPhone();
    });
  }

  /* ---------------- 主循环 ---------------- */
  function loop() {
    if (!S.run) return;
    requestAnimationFrame(loop);
    var now = performance.now();
    var dt = Math.min(0.05, (now - clock.last) / 1000);
    clock.last = now;

    if (S.paused || S.over) { render(); return; }

    // 死亡镜头：镜头被强行转向它，抖一下，再进结算
    if (S.dying > 0) {
      S.dying -= dt;
      var gp = S.ghost && S.ghost.group.visible ? S.ghost.group.position : null;
      if (gp) {
        var want = Math.atan2(-(gp.x - S.pos.x), -(gp.z - S.pos.z));
        var d = want - S.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        S.yaw += d * Math.min(1, dt * 7);
        S.pitch += (-0.02 - S.pitch) * Math.min(1, dt * 5);
      }
      S.roll = Math.sin(performance.now() / 45) * 0.05 * Math.min(1, S.dying / 0.5);
      S.fear = Math.min(100, S.fear + dt * 70);
      render();
      if (S.dying <= 0) { S.roll = 0; endRun('dead'); }
      return;
    }

    updatePlayer(dt);
    updateTime(dt);
    updateFear(dt);
    updateEvents(dt);
    updateGhost(dt);
    updatePrompt();
    updateRoomTag(dt);
    adaptive(dt);

    render();
    S.uiT = (S.uiT || 0) + dt;
    if (S.uiT > 0.16) { S.uiT = 0; updateHUD(); }
  }

  function render() {
    if (!renderer) return;
    camera.position.copy(S.pos);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(S.yaw);
    camera.rotateX(S.pitch);
    if (S.roll) camera.rotateZ(S.roll);
    renderer.render(scene, camera);
  }

  function adaptive(dt) {
    S.fpsAcc = (S.fpsAcc || 0) + dt;
    S.fpsN = (S.fpsN || 0) + 1;
    if (S.fpsAcc > 3) {
      var fps = S.fpsN / S.fpsAcc;
      S.fpsAcc = 0; S.fpsN = 0;
      var base = Math.min(window.devicePixelRatio || 1, 1);
      S.fpsShown = fps.toFixed(0);
      if (fps < 38 && quality > 0.48) { quality = Math.max(0.48, quality - 0.14); renderer.setPixelRatio(base * quality); }
      else if (fps > 58 && quality < 1) { quality = Math.min(1, quality + 0.05); renderer.setPixelRatio(base * quality); }
    }
  }

  /* ---------------- 玩家 ---------------- */
  function updatePlayer(dt) {
    if (S.freeze > 0) { S.freeze -= dt; return; }

    var fwd = 0, side = 0;
    if (S.keys['w'] || S.keys['arrowup']) fwd += 1;
    if (S.keys['s'] || S.keys['arrowdown']) fwd -= 1;
    if (S.keys['a']) side -= 1;
    if (S.keys['d']) side += 1;

    if (S.touchMove) { fwd += -S.touchMove.y; side += S.touchMove.x; }
    // 右摇杆：偏多少转多少（rad/s），和鼠标是两套互不干扰的输入
    if (S.touchLook && (S.touchLook.x || S.touchLook.y)) {
      var lr = 2.0 * S.sens * dt;
      S.yaw -= S.touchLook.x * lr;
      S.pitch = clamp(S.pitch - S.touchLook.y * lr, -1.35, 1.35);
    }
    // 方向键兜底：鼠标彻底失灵也能转身
    if (S.keys['arrowleft']) S.yaw += 2.2 * dt;
    if (S.keys['arrowright']) S.yaw -= 2.2 * dt;

    var run = (S.keys['shift'] || S.keys['shiftleft']) ? 1 : 0;
    var sp = (run ? CFG.RUN : CFG.WALK) * dt;

    // 调试飞天：沿视线自由移动，不做碰撞
    if (S.fly) {
      var cy2 = Math.cos(S.yaw), sy2 = Math.sin(S.yaw);
      var cp2 = Math.cos(S.pitch), sp2 = Math.sin(S.pitch);
      var spd = (run ? CFG.RUN : CFG.WALK) * 2.0 * dt;
      var vy = 0;
      if (S.keys[' ']) vy += 1;              // 空格上升
      if (S.keys['control']) vy -= 1;        // Ctrl 下降
      S.pos.x += (-sy2 * cp2 * fwd + cy2 * side) * spd;
      S.pos.y += (sp2 * fwd + vy) * spd;
      S.pos.z += (-cy2 * cp2 * fwd - sy2 * side) * spd;
      S.pos.y = clamp(S.pos.y, 0.35, 9);
      return;
    }

    if (fwd || side) {
      var L = Math.hypot(fwd, side) || 1;
      fwd /= L; side /= L;
      var sinY = Math.sin(S.yaw), cosY = Math.cos(S.yaw);
      // 相机朝 -Z；yaw 顺时针为正
      var dx = (-sinY * fwd + cosY * side) * sp;
      var dz = (-cosY * fwd - sinY * side) * sp;

      var nx = S.pos.x + dx, nz = S.pos.z + dz;
      if (canStand(nx, S.pos.z)) S.pos.x = nx;
      if (canStand(S.pos.x, nz)) S.pos.z = nz;

      // 头部轻微晃动
      S.bob = (S.bob || 0) + dt * (run ? 13 : 9);
      S.pos.y = CFG.EYE + Math.sin(S.bob) * 0.022;
      if (Math.sin(S.bob) > 0.985) sfx.step();
    } else {
      S.pos.y += (CFG.EYE - S.pos.y) * Math.min(1, dt * 6);
    }
  }

  /* ---------------- 时间 ---------------- */
  function barsUsed() {
    return Math.floor(S.t / (CFG.MIN_PER_BAR * CFG.SEC_PER_MIN)) + S.bonus;
  }
  function gameMin() { return CFG.START_CLOCK + S.t / CFG.SEC_PER_MIN; }
  function clockText() {
    var m = Math.floor(gameMin()) % 1440;
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }

  function updateTime(dt) {
    S.t += dt;

    // 厕所任务计时（游戏分钟）
    var rid = roomIdAt(S.pos.x, S.pos.z);
    if (rid && roomOf(rid) && roomOf(rid).type === 'toilet' && hasTask('toilet')) {
      S.toiletAcc += dt / CFG.SEC_PER_MIN;
    }
    // 客厅玩手机
    if (S.phoneOpen && rid && roomOf(rid) && roomOf(rid).type === 'living' && hasTask('phone')) {
      S.phoneAcc += dt / CFG.SEC_PER_MIN;
    }

    specialTick(dt);
    checkTasks();

    if (barsUsed() >= CFG.BARS && !S.debugMode) endNight(false);
  }

  /* ---------------- 恐惧 ---------------- */
  function updateFear(dt) {
    if (S.immune > 0) S.immune -= dt;
    if (S.safe > 0) S.safe -= dt;

    var lit = S.power;
    var gain = lit ? CFG.FEAR_LIT : CFG.FEAR_DARK;
    if (S.torch) gain *= 0.72;
    S.fear = clamp(S.fear + gain * dt, 0, 100);

    if (S.fear >= 100 && !S.over) {
      S.fear = 45;
      S.bonus += 1;
      toast('你眼前一黑 —— 损失一个时间条', 'bad');
      sfx.thump(2);
      flashScreen(0.9);
    }

    // 心跳
    S.hb = (S.hb || 0) - dt;
    if (S.fear > 55 && S.hb <= 0) {
      sfx.heart(S.fear / 100);
      S.hb = 1.5 - S.fear / 130;
    }

    // 滤镜（按整数变化才写 DOM）
    var fi = Math.round(S.fear);
    if (fi !== S.fearDraw) {
      S.fearDraw = fi;
      var v = $('vignette');
      if (v) v.style.opacity = (0.55 + fi / 100 * 0.45).toFixed(3);
      $('fearBar').style.width = fi + '%';
      $('fearTxt').textContent = fi;
    }
  }

  /* ---------------- 附身 ---------------- */
  function possess(kind) {
    if (S.possess > 0) return;
    S.possess = 3.6;
    S.possessKind = kind;
    S.freeze = 3.6;
    S.camMode = false;
    $('viewfinder').classList.add('hidden');
    $('crosshair').classList.remove('hidden');
    sfx.sting();
    sfx.tinnitus(2.4);
    flashScreen(0.5);
    subtitle(kind === 'pc'
      ? '……你的手自己动了。屏幕上在跑跳伞动画，键盘声不是你的节奏。'
      : '刀柄上有别人的手印。你的手正握着它。', 3.4);
  }

  /* ---------------- 灵异事件 ---------------- */
  function updateEvents(dt) {
    if (S.possess > 0) {
      S.possess -= dt;
      S.roll = Math.sin(performance.now() / 50) * 0.05 * Math.min(1, S.possess / 1.2);
      if (S.possess <= 0) {
        S.roll = 0;
        S.fear = clamp(S.fear + 26, 0, 100);
        subtitle(S.possessKind === 'pc'
          ? '……你什么时候打开的这个游戏？屏幕上还剩一局没打完。'
          : '你回过神，手已经在半空了。刀不见了。', 4.5);
        flashScreen(0.5);
        S.possessKind = '';
      }
      return;
    }
    S.roll = 0;

    if (S.freeze > 0) return;

    // 环境音
    S.evT -= dt;
    if (S.evT <= 0) {
      S.evT = rnd(9, 20);
      ambientSFX();
    }

    //  haunt 事件
    S.hauntT -= dt;
    if (S.hauntT <= 0) {
      var gapR = {
        '轻': [55, 80], '轻中': [46, 66], '中': [38, 56], '中高': [34, 48],
        '高': [34, 50], '噩梦': [30, 44], '复仇': [26, 38], '特殊': [50, 74], 'DEBUG': [1e9, 1e9]
      }[S.bg.level] || [50, 70];
      S.hauntT = rnd(gapR[0], gapR[1]);
      haunt();
    }
  }

  function ambientSFX() {
    var r = Math.random();
    if (r < 0.3) sfx.creak();
    else if (r < 0.5) sfx.drip();
    else if (r < 0.7) sfx.step();
    else if (r < 0.86) sfx.thump(0.5);
    else sfx.whisper(1.4);
  }

  function haunt() {
    var bg = S.bg;
    var fams = bg.families || [];
    if (!fams.length) return;
    // 报警之后，复仇线的鬼不再追人
    var pool = fams.filter(function (f) { return !(S.policeCalled && f === 'chase'); });
    if (!pool.length) return;
    var fam = pick(pool);
    var here = roomIdAt(S.pos.x, S.pos.z);
    var inTrig = here && bg.triggers.indexOf(here) >= 0;

    if (fam === 'light') {
      if (here === bg.deathRoom) {
        sfx.creak();
        spawnSpectre(bg, { mode: 'stare', dur: 6 });
        subtitle('主卧门口站着一个人。他没有动，也没有看你。', 4.5);
        S.fear += 9;
      } else {
        sfx.thump(0.7);
        subtitle(pick([
          '收音机的旋钮自己转了半格，然后又转回去。',
          '有人在隔壁慢慢走动，脚步很轻，像怕吵醒谁。',
          '墙里传来一声很长的叹息。',
          '走廊尽头有个影子——你把手电转过去，那儿只有一块掉下来的墙皮。',
          '有人在你身后清了清嗓子。你回头，没有人。'
        ]), 4);
        S.fear += 5;
      }
      return;
    }

    if (fam === 'mid') {
      var roll = Math.random();
      if (!S.safe && roll < 0.28) {
        sfx.thump(1.6); flashScreen(0.28);
        subtitle('有什么东西从床底下抓住了你的脚踝。冰的。', 4);
        S.fear += 17;
      } else if (roll < 0.5 && S.power) {
        setPower(false); sfx.breaker();
        toast('配电箱跳闸了', 'bad');
        subtitle('屋子一下子黑了。跳闸的声音是从你身后传来的。', 4);
        S.fear += 11;
      } else if (roll < 0.7 && S.hasTV) {
        setTV(true, true);
        subtitle('电视自己亮了。画面上是那首歌的 MV，音量开到了最大。', 5);
        S.fear += 13;
      } else {
        spawnSpectre(bg, { mode: 'walk', dur: 7 });
        subtitle('浅睡一样的感觉压下来。有个人形从走廊这头走到那头。', 4.5);
        S.fear += 10;
      }
      return;
    }

    if (fam === 'high') {
      if (inTrig && here === 'kitchen') {
        sfx.thump(1.2);
        subtitle('刀架上的刀自己动了一下，刀尖朝着你。', 4);
        S.fear += 12;
      } else if (inTrig && here === 'esports') {
        if (!S.immune) possess('pc');
        subtitle('电脑屏幕自己亮起来，登录界面在等你。', 4);
        S.fear += 9;
      } else {
        spawnSpectre(bg, { mode: 'walk', dur: 6 });
        sfx.creak();
        S.fear += 8;
      }
      return;
    }

    // chase：噩梦 / 复仇
    // 从「离玩家最近的触发房间」里挑（不在玩家所在房间刷），够压迫又不至于半路就超时
    var cand = bg.triggers.filter(function (r) { return r !== here; })
      .map(function (r) {
        var c = roomCenter(r);
        return { id: r, d: c ? Math.hypot(c.x - S.pos.x, c.z - S.pos.z) : 999 };
      })
      .sort(function (a, b) { return a.d - b.d; });
    var room = cand.length ? cand[Math.random() < 0.6 ? 0 : Math.min(1, cand.length - 1)].id : bg.triggers[0];
    spawnSpectre(bg, { mode: 'chase', dur: bg.special === 'revenge' ? 15 : 13, room: room });
    sfx.sting();
    subtitle(bg.special === 'revenge'
      ? '有人在走廊尽头站着。他没有脸，但你能确定他在看你。'
      : '走廊里有六个影子。它们同时转过头来。', 4.5);
    S.fear += bg.special === 'revenge' ? 11 : 9;
  }

  /* ---------------- 鬼影 ---------------- */
  function spawnSpectre(bg, opt) {
    if (!S.ghost) {
      var g = new THREE.Group();
      var body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.36, 1.42, 9),
        new THREE.MeshBasicMaterial({ color: 0x04050a })
      );
      body.position.y = 0.72;
      g.add(body);
      var head = new THREE.Mesh(
        new THREE.SphereGeometry(0.165, 9, 7),
        new THREE.MeshBasicMaterial({ color: 0x04050a })
      );
      head.position.y = 1.58;
      g.add(head);
      var eyeMat = new THREE.MeshBasicMaterial({ color: bg.color });
      [-0.062, 0.062].forEach(function (x) {
        var e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), eyeMat);
        e.position.set(x, 1.60, -0.145);
        g.add(e);
      });
      g.visible = false;
      scene.add(g);
      S.ghost = { group: g, body: body, head: head, eyeMat: eyeMat, t: 0, mode: '', speed: 0 };
    }

    var G = S.ghost;
    var target = null;
    if (opt.room) target = roomCenter(opt.room);
    if (!target) {
      var c = roomCenter(bg.deathRoom) || roomCenter(S.map.rooms[0].id);
      target = c;
    }
    // 站位稍微偏一点
    G.group.position.set(target.x + rnd(-0.9, 0.9), 0, target.z + rnd(-0.9, 0.9));
    G.mode = opt.mode || 'stare';
    G.t = opt.dur || 6;
    G.speed = G.mode === 'chase' ? (bg.ghostSpeed || 1.6) : (G.mode === 'friend' ? 1.1 : 0.9);
    G.tell = G.mode === 'chase' ? 1.2 : 0;   // 出场僵直：先亮个相，别贴脸秒杀
    G.path = null;
    G.repath = 0;
    G.eyeMat.color.setHex(bg.color);
    G.group.visible = true;
    G.group.rotation.y = Math.atan2(S.pos.x - G.group.position.x, S.pos.z - G.group.position.z);
  }

  function updateGhost(dt) {
    var G = S.ghost;
    if (!G || !G.group.visible) return;
    G.t -= dt;
    // 先判「它该走了」：到期这一帧直接退场，不再判伤
    // （以前判伤在到期之前，导致它在消失的瞬间顺手把你带走）
    if (G.t <= 0 && G.mode === 'chase') {
      G.group.visible = false;
      toast('它退回了黑暗里');
      S.fear = Math.min(100, S.fear + 2);
      return;
    }
    G.group.position.y = Math.sin(performance.now() / 520) * 0.045;

    var dx = S.pos.x - G.group.position.x, dz = S.pos.z - G.group.position.z;
    var dist = Math.hypot(dx, dz);

    if (G.mode === 'chase') {
      if (G.tell > 0) G.tell -= dt;
      G.repath -= dt;
      if (G.repath <= 0 || !G.path) {
        G.path = bfsPath(G.group.position.x, G.group.position.z, S.pos.x, S.pos.z);
        G.repath = 0.32;
      }

      var mvx, mvz;
      if (G.path && G.path.length) {
        var gW = S.grid.W, gOff = S.house.off;
        var cell = G.path[0];
        var wxp = (cell % gW) + 0.5 + gOff.x;
        var wzp = Math.floor(cell / gW) + 0.5 + gOff.z;
        var vx = wxp - G.group.position.x, vz = wzp - G.group.position.z;
        var vd = Math.hypot(vx, vz) || 1;
        mvx = vx / vd; mvz = vz / vd;
        if (vd < 0.3) G.path.shift();
      } else {
        // 走不通（被家具堵住之类）才退回直线，正常情况不会穿墙
        mvx = dx / (dist || 1);
        mvz = dz / (dist || 1);
      }

      if (!S.safe && G.tell <= 0) {
        var sp = G.speed * dt;
        G.group.position.x += mvx * sp;
        G.group.position.z += mvz * sp;
      }
      G.group.rotation.y = Math.atan2(dx, dz);
      if (dist < 1.05 && !S.safe && !S.immune && !S.over && !(S.dying > 0)) {
        S.deadReason = 'chase';
        S.dying = 1.25;              // 死亡镜头：镜头被拽向它，然后才结算
        S.paused = false;
        sfx.sting();
        sfx.heart(1);
        return;
      }
      if (dist < 3 && !S.safe) S.fear += dt * 4;
    } else if (G.mode === 'friend') {
      // 温和状态：飘在玩家身边 1.6m 处，不掉恐惧不杀人
      var ax = S.pos.x - dx / (dist || 1) * 1.6;
      var az = S.pos.z - dz / (dist || 1) * 1.6;
      G.group.position.x += (ax - G.group.position.x) * Math.min(1, dt * 0.9);
      G.group.position.z += (az - G.group.position.z) * Math.min(1, dt * 0.9);
      G.group.rotation.y = Math.atan2(dx, dz);
      if (G.t < 3) G.t = 3;           // friend 不自己消失
    } else if (G.mode === 'walk') {
      G.group.position.x += Math.sin(G.t * 1.4) * 0.18 * dt * 6;
      G.group.position.z += G.speed * dt * 0.55;
    } else {
      // stare：慢慢转向玩家
      G.group.rotation.y += (Math.atan2(dx, dz) - G.group.rotation.y) * Math.min(1, dt * 0.9);
      if (dist < 4) S.fear += dt * 2.4;
    }

    if (G.t <= 0 && G.mode !== 'friend') {
      G.group.visible = false;
    }
  }

  /* ---------------- 电力 / 设备 ---------------- */
  function setPower(on) {
    S.power = on;
    S.house.lights.forEach(function (L) {
      L.on = on;
      if (L.hasLight) {
        L.light.visible = on;
        L.light.intensity = on ? 0.85 : 0;
        L.bulb.material.color.setHex(on ? 0xffe0ac : 0x22201c);
      }
    });
    sfx.buzz(0.4);
    if (!on) {
      setTV(false);
      setPC(false);
    }
  }
  function setTV(on, ghost) {
    if (!S.hasTV) return;
    S.tvOn = !!on;
    S.house.dyn.forEach(function (it) {
      if (it.kind === 'tv') it.mat.color.setHex(on ? (ghost ? 0x4a6fa8 : 0x3a4c66) : 0x0a0a0c);
    });
    if (on) sfx.tvStatic(1.2, 0.05);
  }
  function setPC(on) {
    if (!S.hasPC) return;
    S.pcOn = !!on;
    S.house.dyn.forEach(function (it) {
      if (it.kind === 'pc') it.mat.color.setHex(on ? 0x2f5f8f : 0x0a0a0c);
    });
    if (on) sfx.buzz(0.2);
  }

  /* ---------------- 交互 ---------------- */
  var _dir = new THREE.Vector3();
  function nearInteract() {
    var best = null, bestD = 2.3;
    var dir = _dir.set(-Math.sin(S.yaw), 0, -Math.cos(S.yaw));
    S.house.interact.forEach(function (it) {
      var dx = it.pos.x - S.pos.x, dz = it.pos.z - S.pos.z;
      var d = Math.hypot(dx, dz);
      if (d > bestD) return;
      // 视线夹角
      var dot = (dx / (d || 1)) * dir.x + (dz / (d || 1)) * dir.z;
      if (dot < 0.35) return;
      bestD = d; best = it;
    });
    return best;
  }

  var INTERACT_NAME = {
    bed: '躺下 · 睡一晚', stove: '开火做饭', tv: '打开电视', pc: '打开电脑',
    breaker: '合上配电箱电闸', mirror: '照镜子', knife: '拿起菜刀'
  };

  function updatePrompt() {
    if (S.over || S.paused) { $('prompt').classList.add('hidden'); return; }
    var it = nearInteract();
    var p = $('prompt');
    if (it) {
      p.classList.remove('hidden');
      p.querySelector('span').textContent = INTERACT_NAME[it.kind] || '查看';
    } else if (hasTask('cameras') && cameraRoomFree()) {
      p.classList.remove('hidden');
      p.querySelector('span').textContent = '在此处架设记录相机';
    } else {
      p.classList.add('hidden');
    }
  }

  function cameraRoomFree() {
    var rid = roomIdAt(S.pos.x, S.pos.z);
    if (!rid || rid === 'door') return false;
    var r = roomOf(rid);
    if (!r || r.type === 'hall') return false;
    return !S.cameras[rid];
  }

  function doInteract() {
    if (S.over || S.paused || S.freeze > 0 || S.possess > 0) return;
    var it = nearInteract();
    if (!it) {
      // 无目标：架设相机
      if (hasTask('cameras') && cameraRoomFree()) {
        var rid = roomIdAt(S.pos.x, S.pos.z);
        S.cameras[rid] = 1;
        placeCameraMesh(S.pos, S.yaw);
        sfx.shutter();
        toast('记录相机已架设 · ' + roomName(rid) + '（' + Object.keys(S.cameras).length + '/3）', 'good');
        checkTasks();
      }
      return;
    }

    switch (it.kind) {
      case 'bed': {
        var r = roomOf(it.room.id);
        S.sleepRoom = it.room.id;
        if (S.bg.deathRoom === it.room.id) S.sleepOnDeathBed = true;
        endNight(true);
        break;
      }
      case 'stove':
        if (!S.power) { toast('灶是电磁炉，没电'); sfx.buzz(0.2); return; }
        S.cooked = true;
        sfx.buzz(0.6);
        toast('饭做好了（虽然只有一包泡面）', 'good');
        subtitle('热气腾起来的时候，你听见客厅有人在挪椅子。', 3.5);
        checkTasks();
        break;
      case 'tv':
        if (!S.power) { toast('没电。先去合电闸'); return; }
        setTV(!S.tvOn);
        break;
      case 'pc':
        if (!S.power) { toast('没电。先去合电闸'); return; }
        if (S.bg.id === 'b3' && it.room.type === 'esports' && !S.immune) {
          setPC(true);
          possess('pc');
          break;
        }
        setPC(!S.pcOn);
        break;
      case 'breaker':
        setPower(!S.power);
        toast(S.power ? '全屋通电' : '你拉下了电闸', S.power ? 'good' : '');
        checkTasks();
        break;
      case 'mirror':
        sfx.whisper(1.6);
        S.fear += 6;
        subtitle(pick([
          '镜子里的人比你慢了半拍才抬头。',
          '你在镜子里数了一遍房间的灯，数出来六盏。这里只有五盏。',
          '镜子很干净。干净得不像有人住过。'
        ]), 4);
        break;
      case 'knife':
        if (S.bg.id === 'b3') {
          S.deadReason = 'knife';
          subtitle('手不是你的了。', 2);
          setTimeout(function () { endRun('dead'); }, 1200);
        } else {
          toast('你拿起刀看了看，又放回去了。');
        }
        break;
    }
  }

  function placeCameraMesh(pos, yaw) {
    var m = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.14, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x1a1d22 })
    );
    m.position.set(pos.x, 1.0, pos.z);
    m.rotation.y = yaw;
    scene.add(m);
    var led = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    led.position.set(pos.x - Math.sin(yaw) * 0.12, 1.0, pos.z - Math.cos(yaw) * 0.12);
    scene.add(led);
  }

  /* ---------------- 物品 ---------------- */
  var used = {};
  function useAmulet() {
    if (used.amulet) { toast('护身符已经烧完了'); return; }
    used.amulet = true;
    S.immune = 30;
    S.fear = clamp(S.fear - 30, 0, 100);
    flashScreen(0.35);
    toast('护身符捏碎了 · 30 秒内它碰不到你', 'good');
    renderHotbar();
  }
  function useSalt() {
    if (used.salt) { toast('盐已经撒完了'); return; }
    used.salt = true;
    S.safe = 60;
    S.fear = clamp(S.fear - 20, 0, 100);
    sfx.salt();
    toast('你在脚边撒了一道盐 · 60 秒安全', 'good');
    renderHotbar();
  }
  function useMedkit() {
    if (used.med) { toast('药盒空了'); return; }
    used.med = true;
    S.fear = clamp(S.fear - 15, 0, 100);
    sfx.heart(0.4);
    toast('吞了一片止痛药，心跳慢下来一点', 'good');
    renderHotbar();
  }

  function toggleTorch() {
    S.torch = !S.torch;
    torch.intensity = S.torch ? 1.55 : 0;
    fill.intensity = S.torch ? 0.26 : 0.14;
    sfx.buzz(0.08);
    renderHotbar();
  }

  function toggleCam(force) {
    var on = (force === undefined) ? !S.camMode : force;
    S.camMode = on;
    $('viewfinder').classList.toggle('hidden', !on);
    $('crosshair').classList.toggle('hidden', on);
    if (on) sfx.flashCharge();
    renderHotbar();
  }

  /* ---------------- 拍照 ---------------- */
  function takePhoto() {
    var rid = roomIdAt(S.pos.x, S.pos.z);
    render();
    var c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    var g2 = c.getContext('2d');
    try { g2.drawImage(renderer.domElement, 0, 0, 320, 180); } catch (e) { }
    var url = '';
    try { url = c.toDataURL('image/jpeg', 0.6); } catch (e) { }

    flashScreen(0.85);
    sfx.shutter();

    var name = (rid && rid !== 'door') ? roomName(rid) : '走廊';
    S.photos.push({ room: rid, name: name, url: url, day: S.day, clock: clockText() });
    if (S.photos.length > 40) S.photos.shift();

    if (rid && rid !== 'door') {
      var r = roomOf(rid);
      if (r && r.type !== 'hall') S.shotToday[rid] = 1;
    }
    toast('已拍摄：' + name + '（第 ' + S.day + ' 天 ' + clockText() + '）');
    checkTasks();
  }

  /* ---------------- 专属机制：复仇 / 相遇 / 调试 ---------------- */
  function specialTick(dt) {
    var sp = S.bg.special;

    // 复仇线：掏出手机按住 2 秒 = 报警
    if (sp === 'revenge' && !S.policeCalled) {
      if (S.phoneOpen) {
        S.policeAcc += dt;
        if (S.policeAcc >= 2) callPolice();
      } else if (S.policeAcc > 0) {
        S.policeAcc = Math.max(0, S.policeAcc - dt * 1.4);
      }
    }
    // 报警后：它会隔一会儿替你做掉一件活
    if (S.policeCalled) {
      S.helpT -= dt;
      if (S.helpT <= 0) { S.helpT = 9; autoHelp(); }
    }
    // 相遇线：两个 NPC 先后登场
    if (sp === 'encounter' && S.encStage < 2) {
      S.encT -= dt;
      if (S.encT <= 0) {
        S.encT = 1e9;
        S.encStage++;
        if (S.encStage === 1) {
          spawnSpectre(S.bg, { mode: 'friend', dur: 1e9 });
          subtitle('客厅沙发上坐着一个背双肩包的人。他先开口："你也是来看房的？"\n他说他叫阿哲，大四，上个月刚签的合同，中介一个字没提过这里死过人。', 9);
          toast('阿哲（大学生）加入了这栋房子', 'good');
        } else {
          spawnSpectre(S.bg, { mode: 'friend', dur: 1e9 });
          subtitle('走廊里多了一个人。提着公文包，胸牌上写着和你一样的公司名。\n"……第七天早上我锁门走了。你也是来交报告的？"', 9);
          toast('上一任试睡员找到了（他还不知道自己死了）', 'good');
        }
      }
    }
  }

  function callPolice() {
    S.policeCalled = true;
    S.fear = Math.max(0, S.fear - 40);
    S.safe = 0; S.immune = 0;
    S.hauntT = 1e9;
    S.helpT = 5;
    if (S.ghost) S.ghost.group.visible = false;
    sfx.ring();
    flashScreen(0.3);
    toast('电话接通了。你说：人还在里面', 'good');
    subtitle('电话那头安静了两秒，然后说：我们二十分钟到。\n走廊尽头那个影子停住了，慢慢转过来，第一次像是在看一个人，而不是在看猎物。', 7);
    if (typeof gtag === 'function') gtag('event', 'xzssy_police', { bg: S.bg.id });
  }

  function autoHelp() {
    var pend = S.today.filter(function (id) { return !S.tasks[id]; });
    if (!pend.length || S.over) return;
    var id = pick(pend);
    var t = XZ.TASKS.filter(function (q) { return q.id === id; })[0];
    complete(id);
    subtitle('有什么东西替你动了手 —— ' + (t ? t.name : id) + '，做完了。', 4);
  }

  /* ---------------- 调试模式 ---------------- */
  function toggleDebug(force) {
    var on = (force === undefined) ? !S.debugMode : force;
    S.debugMode = on;
    S.fly = false;
    if (on) {
      S.hauntT = 1e9;
      if (S.ghost) S.ghost.group.visible = false;
      toast('DEBUG 开：G 鬼 · V 飞天(空格升/Ctrl 降) · T 任务 · N 时间条 · B 恐惧 · M 下一夜', 'good');
      subtitle('调试模式。这里的规则由你说了算。', 4);
    } else {
      S.hauntT = 25;
      toast('DEBUG 关');
    }
  }

  function debugSummon() {
    var dir = new THREE.Vector3(-Math.sin(S.yaw), 0, -Math.cos(S.yaw));
    var room = roomIdAt(S.pos.x + dir.x * 3, S.pos.z + dir.z * 3) || S.room || S.map.rooms[0].id;
    spawnSpectre(S.bg, { mode: 'chase', dur: 25, room: room });
    toast('召唤了一个（3 秒后开始追）');
  }

  /* ---------------- 任务 ---------------- */
  function hasTask(id) { return S.today.indexOf(id) >= 0 && !S.tasks[id]; }

  function checkTasks() {
    if (!S.run || S.over) return;

    var areas = XZ.areasOf(S.map);
    var shotN = areas.filter(function (r) { return S.shotToday[r.id]; }).length;

    if (hasTask('shoot') && shotN >= areas.length) complete('shoot');
    if (hasTask('toilet') && S.toiletAcc >= 5) complete('toilet');
    if (hasTask('cook') && S.cooked && shotN && S.shotToday[kitchenId()]) complete('cook');
    if (hasTask('cameras') && Object.keys(S.cameras).length >= 3) complete('cameras');
    if (hasTask('allOn') && S.power && (!S.hasTV || S.tvOn) && (!S.hasPC || S.pcOn)) complete('allOn');
    if (hasTask('phone') && S.phoneAcc >= CFG.MIN_PER_BAR) complete('phone');
  }

  function kitchenId() {
    var k = S.map.rooms.filter(function (r) { return r.type === 'kitchen'; })[0];
    return k ? k.id : '';
  }

  function complete(id) {
    if (S.tasks[id]) return;
    S.tasks[id] = 1;
    S.doneToday++;
    S.totalTasks++;
    var t = XZ.TASKS.filter(function (q) { return q.id === id; })[0];
    sfx.breaker();
    toast('任务完成：' + (t ? t.name : id), 'good');
    renderTasks();

    if (S.doneToday % 2 === 0 && !S.over) {
      S.bonus += 1;
      toast('两个任务交差 —— 时间条推进 1 格', 'good');
      sfx.thump(0.8);
      if (barsUsed() >= CFG.BARS) setTimeout(function () { endNight(false); }, 900);
    }
  }

  /* ---------------- 一天结束 ---------------- */
  function endNight(voluntary) {
    if (S.over || S.nightEnding) return;
    S.nightEnding = true;
    S.paused = true;
    document.exitPointerLock && document.exitPointerLock();

    var onDeathBed = S.sleepRoom && S.sleepRoom === S.bg.deathRoom;
    if (onDeathBed && !S.sleptDeathBed) {
      S.sleptDeathBed = true; S.totalTasks++;
      toast('任务完成：睡出事那间', 'good');
    }

    fadeTo(1);
    sfx.drone(true, 0.02);
    setTimeout(function () {
      var txt = dreamText(onDeathBed);
      $('sleep').classList.remove('hidden');
      $('sleepTitle').textContent = onDeathBed ? '第 ' + S.day + ' 夜 · 出事的房间' : '第 ' + S.day + ' 夜 · 就地昏睡';
      $('sleepText').textContent = txt;
      $('sleepNext').classList.remove('hidden');
      $('hud').classList.add('hidden');
    }, 950);
  }

  function dreamText(onDeathBed) {
    var b = S.bg.id;
    if (b === 'b1') {
      return '你睡着了。\n\n房间里很静，收音机还在响，戏曲台，一段很老的调子。\n' +
        '你睁开眼，看见一个人站在床尾。七十多岁，背有点驼，手垂在身体两侧。\n' +
        '你想动。动不了。\n\n他没有靠近，也没有说话。他只是站在那里，好像在等你说点什么。\n' +
        '你什么也说不出来。\n\n再睁眼，天亮了。床头柜上的灯亮着——睡觉前你明明关了。';
    }
    if (b === 'b2') {
      return '你睡着了。\n\n不知道过了多久，有什么东西抓住了你的小腿。\n' +
        '不是压住，是抓住。五根手指，从脚踝往上，一节一节收紧。\n\n' +
        '你猛地坐起来，房间空的。\n\n电视自己亮了一秒就灭了。那首歌只放了半句，卡在副歌前面。\n' +
        '你突然很想跟谁说一句对不起，虽然你不知道该跟谁说。';
    }
    if (b === 'b3') {
      return '你睡着了。\n\n梦里有人在打游戏，键盘声很响。屏幕的光照着一张很年轻的脸。\n' +
        '他回头看你，说了一句："别睡我的床。"\n\n' +
        '你问他为什么。\n\n他说："上次有人睡在这儿，醒来就不是他自己了。"\n\n' +
        '你醒来的时候，手放在床沿外面，像是刚才想抓住什么。';
    }
    if (b === 'b4') {
      return '你睡着了。\n\n六个影子围在床边。大的、小的、老的、年轻的。\n' +
        '他们不看你，只看房间里的门。像在等谁推门进来。\n\n' +
        '有一个很小很小的影子伸手碰了碰你的头发，然后被旁边的影子拉回去了。\n\n' +
        '你听见有人说："不是他。"\n\n你醒过来，天没亮。屋子里安静得像什么都没发生过。';
    }
    if (b === 'b6') {
      return '你睡着了。\n\n梦里是厨房的灯，很黄。有个人背对着你在倒猫粮，倒完把碗往地上推了推。\n' +
        '她没回头，只是说了一句：\n"馒头吃完了你帮我添一下，就在下面柜子里。"\n\n' +
        '你醒来的时候，客厅有猫叫声。屋子里没有猫。';
    }
    if (b === 'b7') {
      return '你睡着了。\n\n满耳朵都是键盘声，很急，很密。有人在打最后一局。\n' +
        '"你帮我打完这把，"他说，"打完我就不欠了。"\n\n' +
        '你在梦里坐下来，手放在键盘上。屏幕上是你根本没玩过的游戏。\n' +
        '醒来的时候，你的手指还在动。';
    }
    if (b === 'b8') {
      return '你睡着了。\n\n他站在床边，没有走近。你第一次看清他的脸 —— 三十岁上下，左边眉骨有道疤。\n' +
        '"我不需要你陪我，"他说，"我只需要你打个电话。"\n\n' +
        '他抬起手，比了一个数字，两根手指。\n\n' +
        '醒来时手机在你手里，屏幕亮着，拨号界面已经打开了。';
    }
    if (b === 'b9') {
      return '你睡着了。\n\n梦里客厅坐着两个人。一个背着双肩包，一个提着公文包。\n' +
        '他们没在说话，只是都看着门口 —— 好像门外还有人没进来。\n\n' +
        '你想问他们是谁，一张嘴，发现自己也坐在那儿了。\n\n' +
        '醒来时天已经亮了，客厅的灯是开着的。';
    }
    if (b === 'b10') {
      return '你睡着了。\n\n这是个空梦。没有人，没有声音，没有画面。\n' +
        '只有一行字浮在黑里，像是有人用浏览器控制台打出来的：\n\n' +
        '> 这栋房子是模板生成的。\n> 你现在想干什么都行。\n\n' +
        '醒来时你发现自己一点都不困。';
    }
    return '你睡着了。\n\n没有梦。\n\n你也说不清自己到底睡没睡着。\n' +
      '只是醒来的时候，发现自己面朝着房门的方向躺着，被子被掀开了一半。\n' +
      '门是关着的。你不记得自己关过。';
  }

  function nextDay() {
    $('sleep').classList.add('hidden');
    fadeTo(0);

    if (S.day >= CFG.DAYS) { endRun('clear'); return; }

    S.day++;
    S.t = 0; S.bonus = 0;
    S.fear = clamp(S.fear - 16, 0, 100);
    S.nightEnding = false;
    S.paused = false;
    S.immune = 0; S.safe = 0;
    S.phoneOpen = false;
    $('phone').classList.add('hidden');
    if (S.camMode) toggleCam(false);
    S.power = false; S.tvOn = false; S.pcOn = false;
    S.house.lights.forEach(function (L) {
      L.on = false;
      if (L.hasLight) { L.light.visible = false; L.light.intensity = 0; L.bulb.material.color.setHex(0x141414); }
    });
    S.house.dyn.forEach(function (it) {
      if (it.kind === 'tv' || it.kind === 'pc') it.mat.color.setHex(0x0a0a0c);
    });
    if (S.ghost) S.ghost.group.visible = false;
    S.sleepRoom = null;

    if (S.bg.special === 'encounter' && S.encStage < 2) S.encT = 12;
    rollDayTasks();
    S.shotToday = {};
    S.cameras = {};
    S.hauntT = rnd(25, 40);
    S.evT = rnd(6, 12);

    $('hud').classList.remove('hidden');
    renderTasks();
    updateHUD();
    subtitle('第 ' + S.day + ' 天。你又站在了门口，钥匙还在兜里。', 5);
    requestLock();
    clock.last = performance.now();
  }

  /* ---------------- 结算 ---------------- */
  function endRun(kind) {
    if (S.over) return;
    S.over = true; S.run = false;
    if (document.exitPointerLock) document.exitPointerLock();
    fadeTo(1);
    sfx.drone(true, 0.0);
    sfx.mute(true);

    var e = XZ.ENDINGS[kind] || XZ.ENDINGS.clear;
    if (kind === 'clear') {
      var all = S.sleptDeathBed && S.totalTasks >= 5;
      if (S.bg.special === 'revenge' && S.policeCalled) e = XZ.ENDINGS.revenge;
      else if (S.bg.special === 'encounter') e = XZ.ENDINGS.encounter;
      else if (!all) e = XZ.ENDINGS.timeout;
    }
    if (kind === 'dead') {
      if (S.deadReason === 'knife') {
        e = {
          title: '委托终止 · 现场',
          text: '警方在厨房找到你。\n刀柄上是你的指纹，刀口朝着你自己。\n\n' +
            '卷宗上写着"自杀"。\n只有一件事没人解释得清：\n' +
            '你右手是左撇子，但刀是从右侧切进去的。'
        };
      }
    }

    setTimeout(function () {
      $('hud').classList.add('hidden');
      $('sleep').classList.add('hidden');
      $('pause').classList.add('hidden');
      $('ending').classList.remove('hidden');
      $('endKicker').textContent = kind === 'dead' ? '委托终止 · 第 ' + S.day + ' 天' : '委托结束';
      $('endTitle').textContent = e.title;
      $('endText').textContent = e.text;
      var areas = XZ.areasOf(S.map);
      $('endStats').innerHTML =
        '<span>宅子：<b>' + S.map.name + '</b></span>' +
        '<span>背景：<b>' + S.bg.ghost + ' · ' + S.bg.level + '</b></span>' +
        '<span>在宅天数：<b>' + S.day + ' / ' + CFG.DAYS + '</b></span>' +
        '<span>完成任务：<b>' + S.totalTasks + '</b></span>' +
        '<span>照片：<b>' + S.photos.length + '</b></span>';
      if (typeof gtag === 'function') {
        gtag('event', 'xzssy_end', { kind: kind, map: S.map.id, bg: S.bg.id, day: S.day });
      }
    }, 900);
  }

  /* ---------------- UI ---------------- */
  function updateHUD() {
    if (!S.map) return;
    $('dayLabel').textContent = S.debugMode ? ('DEBUG · 第 ' + S.day + ' 天') : ('第 ' + S.day + ' / ' + CFG.DAYS + ' 天');
    $('clockLabel').textContent = clockText();
    var used = Math.min(CFG.BARS, barsUsed());
    var bars = document.querySelectorAll('#barsBox .tbar');
    for (var i = 0; i < bars.length; i++) {
      bars[i].classList.toggle('full', i < used);
    }
    var tc = $('taskCount');
    if (tc) {
      var total = S.today.length;
      var done = S.today.filter(function (id) { return S.tasks[id]; }).length;
      tc.textContent = done + '/' + total;
    }
    // 输入诊断（?debug=1）
    if (S.debug) {
      var d = $('dbg');
      if (d) {
        d.classList.remove('hidden');
        d.textContent = [
          'lock ' + (locked ? 'Y' : 'N') + '   drag ' + (dragging ? 'Y' : 'N') +
          '   paused ' + (S.paused ? 'Y' : 'N') + '   touch ' + (touchMode ? 'Y' : 'N'),
          'yaw ' + S.yaw.toFixed(2) + '   pitch ' + S.pitch.toFixed(2) + '   fps ' + (S.fpsShown || '?'),
          'room ' + (S.room || '-')
        ].join('  |  ');
      }
    }

    // 手机小窗时间
    if (S.phoneOpen) {
      var ph = $('phTime');
      if (ph) ph.textContent = clockText();
    }

    // 任务进度文案（约每 0.5 秒比对一次，文字变了才动 DOM）
    S.tkN = (S.tkN || 0) + 1;
    if (S.tkN % 3 === 0) {
      var sig = S.today.map(function (id) {
        var t = XZ.TASKS.filter(function (q) { return q.id === id; })[0];
        return id + (S.tasks[id] ? '1' : '0') + (t ? taskSub(id, t) : '');
      }).join('|');
      if (sig !== S.taskSig) { S.taskSig = sig; renderTasks(); }
    }
  }

  function renderTasks() {
    var ul = $('taskList');
    if (!ul) return;
    ul.innerHTML = S.today.map(function (id) {
      var t = XZ.TASKS.filter(function (q) { return q.id === id; })[0];
      if (!t) return '';
      var sub = taskSub(id, t);
      return '<li class="' + (S.tasks[id] ? 'done' : '') + '">' +
        '<span class="tk">' + (S.tasks[id] ? '✓' : '□') + '</span>' +
        '<span>' + t.name + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</span></li>';
    }).join('');
  }

  function taskSub(id, t) {
    var areas = XZ.areasOf(S.map);
    if (id === 'shoot') {
      var n = areas.filter(function (r) { return S.shotToday[r.id]; }).length;
      return '照片 ' + n + ' / ' + areas.length;
    }
    if (id === 'toilet') return '停留 ' + Math.min(5, S.toiletAcc).toFixed(1) + ' / 5 分钟';
    if (id === 'cook') return (S.cooked ? '已做好，去拍一张' : '还没开火');
    if (id === 'cameras') return '已架设 ' + Object.keys(S.cameras).length + ' / 3';
    if (id === 'allOn') {
      var need = ['电闸'].concat(S.hasTV ? ['电视'] : []).concat(S.hasPC ? ['电脑'] : []);
      var ok = [S.power ? '电闸' : ''].concat(S.hasTV && S.tvOn ? ['电视'] : []).concat(S.hasPC && S.pcOn ? ['电脑'] : []);
      return '已通电 ' + ok.filter(Boolean).length + ' / ' + need.length;
    }
    if (id === 'phone') return Math.min(30, S.phoneAcc).toFixed(0) + ' / 30 分钟';
    return '';
  }

  function renderHotbar() {
    var hb = $('hotbar');
    if (!hb) return;
    var map = [
      { em: '🔦', kb: 'F', name: '手电', act: S.torch ? 'on' : '', used: false },
      { em: '📷', kb: 'C', name: '相机', act: S.camMode ? 'on' : '', used: false },
      { em: '📱', kb: 'Q', name: '手机', act: '', used: false },
      { em: '📕', kb: 'H', name: '手册', act: '', used: false },
      { em: '🧿', kb: '1', name: '护符', act: '', used: !!used.amulet },
      { em: '🧂', kb: '2', name: '盐', act: '', used: !!used.salt },
      { em: '💊', kb: '3', name: '药', act: '', used: !!used.med },
      { em: '💰', kb: '', name: '现金', act: '', used: false }
    ];
    hb.innerHTML = map.map(function (s) {
      return '<div class="slot ' + (s.used ? 'used' : '') + ' ' + (s.act ? 'act' : '') + '">' +
        (s.kb ? '<span class="kb">' + s.kb + '</span>' : '') +
        '<span class="em">' + s.em + '</span><span>' + s.name + '</span></div>';
    }).join('');
  }

  function toast(txt, kind) {
    var t = $('toast');
    t.textContent = txt;
    t.className = 'show ' + (kind || '');
    clearTimeout(S.toastT);
    S.toastT = setTimeout(function () { t.className = ''; }, 2600);
  }

  function subtitle(txt, dur) {
    var s = $('subtitle');
    s.textContent = txt;
    s.classList.add('show');
    clearTimeout(S.subT);
    S.subT = setTimeout(function () { s.classList.remove('show'); }, (dur || 4) * 1000);
  }

  function flashScreen(a) {
    var f = $('flash');
    f.style.opacity = a;
    setTimeout(function () { f.style.opacity = 0; }, 90);
  }

  function fadeTo(a) {
    var f = $('fade');
    f.style.opacity = a;
  }

  function updateRoomTag(dt) {
    var rid = roomIdAt(S.pos.x, S.pos.z);
    if (rid && rid !== S.room) {
      S.room = rid;
      S.roomTagT = 2.0;
      var tag = $('roomTag');
      tag.textContent = roomName(rid);
      tag.classList.add('show');
    }
    if (S.roomTagT > 0) {
      S.roomTagT -= dt;
      if (S.roomTagT <= 0) $('roomTag').classList.remove('show');
    }
  }

  /* ---------------- 面板 ---------------- */
  function openPanel(title, html) {
    S.phoneOpen = false;
    $('panelTitle').textContent = title;
    $('panelBody').innerHTML = html;
    $('panel').classList.remove('hidden');
    S.paused = true;
    document.exitPointerLock && document.exitPointerLock();
  }
  function closePanel() {
    $('panel').classList.add('hidden');
    S.paused = false;
    S.phoneOpen = false;
    $('hud').classList.remove('hidden');
    clock.last = performance.now();
    requestLock();
  }

  function openManual() {
    var html = XZ.MANUAL.map(function (sec) {
      return '<h3>' + sec[0] + '</h3>' + sec[1].map(function (p) { return '<p>' + p + '</p>'; }).join('');
    }).join('');
    openPanel('培训手册 · 凶宅试睡操作规范', html);
  }

  function openPhone() {
    togglePhone();
  }

  function togglePhone() {
    S.phoneOpen = !S.phoneOpen;
    $('phone').classList.toggle('hidden', !S.phoneOpen);
    if (S.phoneOpen) {
      sfx.buzz(0.1);
      $('phTime').textContent = clockText();
      $('phSub').textContent = '第 ' + S.day + ' 天 · 无服务 · 电量 ' + Math.max(6, 100 - S.day * 9) + '%';
      if (S.room && roomOf(S.room) && roomOf(S.room).type !== 'living' && hasTask('phone')) {
        toast('在客厅刷手机才算数');
      }
    }
  }

  function openAlbum() {
    var html;
    if (!S.photos.length) {
      html = '<div class="photo-grid"><div class="empty">还没有照片。举起相机（C），左键快门。</div></div>';
    } else {
      html = '<div class="photo-grid">' + S.photos.slice().reverse().map(function (p) {
        return '<figure>' +
          (p.url ? '<img src="' + p.url + '" alt="' + p.name + '">' : '<div style="height:90px;display:flex;align-items:center;justify-content:center;color:#5b656f;font-size:10px">无法读取画面</div>') +
          '<figcaption><span>' + p.name + '</span><span>D' + p.day + ' ' + p.clock + '</span></figcaption></figure>';
      }).join('') + '</div>';
    }
    openPanel('取证相册 · ' + S.photos.length + ' 张', html);
  }

  function setPause(on) {
    S.paused = on;
    $('pause').classList.toggle('hidden', !on);
    if (!on) { clock.last = performance.now(); requestLock(); }
    else document.exitPointerLock && document.exitPointerLock();
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    $('loading').classList.add('hidden');
    // three.js 必须已加载
    if (typeof THREE === 'undefined') {
      $('loading').classList.remove('hidden');
      $('loading').textContent = 'three.js 加载失败，刷新试试';
      return;
    }
    rollRun();
    renderIntro();
    $('startBtn').addEventListener('click', function () {
      if (S.started) return;
      startRun();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
