/*!
 * halloween-desktop.js — 10·31 万圣节彩蛋桌面逻辑
 * ------------------------------------------------------------
 * 由 js/js/halloween-1031.js 在 10 月 31 日的首页挂载（halloween-desktop.html）
 * 桌面外壳沿用 10·24 那套 Win98 电脑风格，但：
 *   - 壁纸 / 任务栏换成万圣节皮肤
 *   - Internet Explorer 窗口里打开的是【当前正常站点】（iframe 直载 index.html）
 *   - CMD 命令表换成万圣节版：Halloween 触发蓝屏并恢复正常
 *   - 1024 / 0721 / 67 这些 10·24 专属口令一律失效
 *
 * 惊吓彩蛋（都可忍，不弹窗、不劫持）：
 *   1. CMD 输入 Halloween → 黑屏 → 蓝屏 → 自动恢复正常
 *   2. 随机白脸闪现（~110ms）+ 合成音效
 *   3. 桌面暗处随机浮出两点红眼
 *   4. CMD 空闲时自己敲出一行字再消失
 *   5. 时钟偶尔跳到 03:33 变红
 *   6. 桌面图标偶尔自己挪一下再挪回去
 */
(function () {
  'use strict';

  /* ============================================================
     0. 通用工具
     ============================================================ */
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  var S = {
    wins: {},          // name -> { open, min, max, z }
    zTop: 100,
    active: null,
    bsod: false,
    bgmLoaded: false,
    bgmOn: false,
    ieLoaded: false,
    termHist: [],
    histIdx: -1,
    lastInput: Date.now(),
    scareCount: 0,
    secretUnlocked: false,
    started: false
  };

  /* ============================================================
     1. 音效（WebAudio 合成，零外部文件）
     ============================================================ */
  var AC = null;

  function ac() {
    if (!AC) {
      try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
    return AC;
  }

  function tone(freq, dur, vol, type, freqEnd) {
    var c = ac(); if (!c) return;
    var t = c.currentTime;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noiseBurst(dur, vol, freq, q) {
    var c = ac(); if (!c) return;
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    }
    var src = c.createBufferSource();
    src.buffer = buf;
    var f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq || 1400;
    f.Q.value = q || 0.8;
    var g = c.createGain();
    g.gain.value = vol || 0.18;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start();
  }

  function sfxScream() {
    noiseBurst(0.3, 0.36, 2400, 0.7);
    tone(210, 0.34, 0.1, 'sawtooth', 70);
  }
  function sfxPowerDown() {
    tone(760, 0.34, 0.09, 'sine', 40);
    noiseBurst(0.14, 0.12, 900, 1.2);
  }
  function sfxPowerUp() {
    tone(60, 0.22, 0.1, 'sine', 300);
    noiseBurst(0.2, 0.1, 1800, 0.9);
  }
  function sfxBlip() { tone(880, 0.05, 0.045, 'square'); }
  function sfxClick() { tone(620, 0.04, 0.035, 'square'); }

  /* ============================================================
     2. 窗口管理
     ============================================================ */
  var WIN_TITLES = { browser: '🌐 Internet Explorer', terminal: '🖥️ CMD', readme: '📄 readme.txt' };

  function getWin(name) { return $('win-' + name); }

  function focusWin(name) {
    var el = getWin(name);
    if (!el || !S.wins[name] || !S.wins[name].open) return;
    S.zTop += 1;
    el.style.zIndex = String(S.zTop);
    Object.keys(S.wins).forEach(function (k) {
      var w = getWin(k);
      if (w) w.classList.toggle('active', k === name);
    });
    S.active = name;
    updateTaskbar();
    if (name === 'terminal') setTimeout(function () { $('term-input').focus(); }, 0);
  }

  function openWindow(name) {
    var el = getWin(name);
    if (!el) return;

    if (!S.wins[name]) {
      S.wins[name] = { open: false, min: false, max: false, z: ++S.zTop };
    }
    var st = S.wins[name];

    if (st.open && st.min) {
      st.min = false;
      el.classList.remove('minimized');
      el.style.display = 'flex';
    } else if (!st.open) {
      st.open = true;
      el.style.display = 'flex';
      // 只开一个同名窗口，也不叠在已有窗口正上方
      if (!st.max) {
        var offset = 0;
        Object.keys(S.wins).forEach(function (k) {
          if (k !== name && S.wins[k].open) offset += 26;
        });
        if (offset) {
          var baseLeft = parseInt(el.style.left, 10) || 60;
          var baseTop = parseInt(el.style.top, 10) || 40;
          el.style.left = Math.min(baseLeft + offset, Math.max(20, window.innerWidth - 360)) + 'px';
          el.style.top = Math.min(baseTop + offset, Math.max(20, window.innerHeight - 240)) + 'px';
        }
      }
    }

    if (name === 'browser') loadIE();
    focusWin(name);
    sfxClick();
  }

  function closeWindow(name) {
    var el = getWin(name);
    var st = S.wins[name];
    if (!el || !st) return;
    st.open = false;
    st.min = false;
    st.max = false;
    el.style.display = 'none';
    el.classList.remove('minimized');
    if (S.active === name) S.active = null;
    updateTaskbar();
    sfxClick();
  }

  function minWindow(name) {
    var el = getWin(name);
    var st = S.wins[name];
    if (!el || !st) return;
    st.min = true;
    el.classList.add('minimized');
    el.style.display = 'none';
    if (S.active === name) S.active = null;
    updateTaskbar();
  }

  function maxWindow(name) {
    var el = getWin(name);
    var st = S.wins[name];
    if (!el || !st) return;
    st.max = !st.max;
    if (st.max) {
      st._rect = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.width = window.innerWidth + 'px';
      el.style.height = (document.getElementById('desktop').offsetHeight) + 'px';
    } else if (st._rect) {
      el.style.left = st._rect.left;
      el.style.top = st._rect.top;
      el.style.width = st._rect.width;
      el.style.height = st._rect.height;
    }
    focusWin(name);
  }

  function updateTaskbar() {
    var box = $('task-items');
    box.innerHTML = '';
    Object.keys(S.wins).forEach(function (name) {
      var st = S.wins[name];
      if (!st.open) return;
      var d = document.createElement('div');
      d.className = 'task-item' + (S.active === name ? ' active' : '');
      d.textContent = WIN_TITLES[name] || name;
      d.addEventListener('click', function () {
        if (S.active === name && !st.min) { minWindow(name); return; }
        if (st.min) { st.min = false; var el = getWin(name); if (el) { el.classList.remove('minimized'); el.style.display = 'flex'; } }
        focusWin(name);
      });
      box.appendChild(d);
    });
  }

  /* ---------- 拖拽 ---------- */
  var drag = null;

  document.addEventListener('mousedown', function (e) {
    var t = e.target.closest ? e.target.closest('[data-drag]') : null;
    if (!t) return;
    var name = t.getAttribute('data-drag');
    var el = getWin(name);
    if (!el) return;
    var r = el.getBoundingClientRect();
    drag = { el: el, x: e.clientX - r.left, y: e.clientY - r.top };
    focusWin(name);
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!drag) return;
    var x = e.clientX - drag.x;
    var y = e.clientY - drag.y;
    x = Math.max(-160, Math.min(x, window.innerWidth - 120));
    y = Math.max(0, Math.min(y, document.getElementById('desktop').offsetHeight - 30));
    drag.el.style.left = x + 'px';
    drag.el.style.top = y + 'px';
  });

  document.addEventListener('mouseup', function () { drag = null; });

  /* ---------- 点击窗口任意处提层 ---------- */
  document.addEventListener('mousedown', function (e) {
    var w = e.target.closest ? e.target.closest('.window') : null;
    if (!w) return;
    var name = w.id.replace(/^win-/, '');
    if (S.active !== name) focusWin(name);
  }, true);

  /* ---------- 窗口按钮委托 ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    if (b.hasAttribute('data-close')) closeWindow(b.getAttribute('data-close'));
    else if (b.hasAttribute('data-min')) minWindow(b.getAttribute('data-min'));
    else if (b.hasAttribute('data-max')) maxWindow(b.getAttribute('data-max'));
    else if (b.hasAttribute('data-ie-home')) loadIE(true);
    else if (b.hasAttribute('data-ie-go')) loadIE(true);
  });

  /* ============================================================
     3. 桌面图标 / 开始菜单
     ============================================================ */
  document.querySelectorAll('.desk-icon').forEach(function (icon) {
    icon.addEventListener('dblclick', function () {
      var kind = icon.getAttribute('data-icon');
      if (kind === 'bgm') { toggleBGM(true); return; }
      openWindow(kind);
    });
  });

  $('start-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    $('start-menu').classList.toggle('show');
  });

  document.addEventListener('click', function () {
    $('start-menu').classList.remove('show');
  });

  $('start-menu').addEventListener('click', function (e) {
    var it = e.target.closest ? e.target.closest('.sm-item') : null;
    if (!it) return;
    if (it.hasAttribute('data-open')) openWindow(it.getAttribute('data-open'));
    else if (it.hasAttribute('data-bgm')) toggleBGM(true);
    else if (it.hasAttribute('data-restart')) location.reload();
  });

  /* ============================================================
     4. Internet Explorer（内嵌当前正常站点）
     ============================================================ */
  function loadIE(reset) {
    var frame = $('ie-frame');
    var loading = $('ie-loading');
    if (!frame) return;
    if (!S.ieLoaded || reset) {
      if (S.ieLoaded && reset) {
        loading.style.display = 'flex';
        setTimeout(function () { loading.style.display = 'none'; }, 420);
      }
      if (!S.ieLoaded) {
        frame.addEventListener('load', function () { loading.style.display = 'none'; });
        // 桌面页本身就在站点根目录，./index.html 就是当前首页。
        // hw_ie=1 告诉彩蛋脚本「这是万圣节桌面里的 IE 窗口，保持站点现状」：
        //   入口脚本 → iframe 内直接 return（不套娃）
        //   retro-1024.js → 不套 2000 年外壳（否则界面就不是现在这样了）
        frame.src = './index.html?hw_ie=1';
        S.ieLoaded = true;
        setTimeout(function () { loading.style.display = 'none'; }, 4000);
      }
    }
    $('ie-url').value = 'http://ciallo0721-cmd.top/';
    $('browser-title').textContent = 'Internet Explorer';
  }

  /* ============================================================
     5. readme.txt
     ============================================================ */
  function renderReadme() {
    $('readme-body').innerHTML =
      '<b>readme.txt</b>\n\n' +
      '    欢迎来到这台机器。它是这台屋子里唯一还亮着的东西。\n\n' +
      '    桌面上有四个能用的东西：\n' +
      '      1. Internet Explorer —— 打开就是你熟悉的那个网站，那边一切正常。\n' +
      '      2. 命令提示符 —— 随便折腾，但它记仇。\n' +
      '      3. readme.txt —— 就是你正在看的这个。\n' +
      '      4. 今晚的歌 —— 音量别开太大，会听见别的声音。\n\n' +
      '    只有一件事要提醒你：\n\n' +
      '      CMD 里不要输入 <b>Halloween</b>。\n\n' +
      '    上一个不听劝的人，现在还坐在这把椅子上。\n' +
      '    他不是不想走，是走不了。\n\n' +
      '                                    —— 屋主\n' +
      '<span class="np-dim">                                    （10 月 31 日 23:59 留言）</span>';
  }

  /* ============================================================
     6. 命令行
     ============================================================ */
  var termOut, termInput, termBody;

  function scrollTerm() {
    if (termBody) termBody.scrollTop = termBody.scrollHeight;
  }

  function termLine(html, cls) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = html;
    termOut.appendChild(d);
    scrollTerm();
    return d;
  }

  function termEcho(cmd) {
    termLine('<span style="color:#57ff8a">C:\\&gt;</span> <span class="t-cmd">' + esc(cmd) + '</span>');
  }

  function termClear() { termOut.innerHTML = ''; }

  var DIR_TEXT =
    ' 驱动器 C 中的卷是 SYSTEM\n' +
    ' 卷的序列号是 1F4A-0B31\n' +
    '\n' +
    ' C:\\ 的目录\n' +
    '\n' +
    '2026-10-31  23:59    &lt;DIR&gt;          .\n' +
    '2026-10-31  23:59    &lt;DIR&gt;          ..\n' +
    '2025-10-31  03:33    &lt;DIR&gt;          WINDOWS\n' +
    '2025-10-31  03:33                 0 dont_look.txt\n' +
    '2026-10-18  21:11             1,024 autoexec.bat\n' +
    '2026-10-18  21:11               721 config.sys\n' +
    '2026-10-31  00:00    &lt;DIR&gt;          ????\n' +
    '               3 个文件          1,745 字节\n' +
    '               3 个目录  1,048,576 字节可用';

  var GHOST_LINES = [
    '有人吗',
    '刚刚是谁在打字',
    '这台电脑不是你的',
    '你数过房间里现在有几个人吗',
    '关灯之后屏幕会更亮',
    '别用鼠标了，直接用念的试试',
    '它说它也想过节'
  ];

  function pushGhost(text, ms) {
    if (!termOut) return null;
    if (termOut.querySelector('.t-ghost')) return null; // 同一时刻只留一行，别叠字
    var d = termLine(esc(text), 't-ghost');
    setTimeout(function () { if (d.parentNode) d.remove(); }, ms || 3000);
    return d;
  }

  function ghostIntoTerm() {
    if (!S.wins.terminal || !S.wins.terminal.open) return;
    if (S.bsod) return;
    pushGhost(pick(GHOST_LINES), 2800);
  }

  function maybeGhost() {
    if (Math.random() < 0.16) {
      setTimeout(function () { pushGhost(pick(GHOST_LINES), 3200); }, 700);
    }
  }

  function runCommand(raw) {
    var cmd = String(raw || '').trim();
    if (!cmd) return;
    termEcho(cmd);

    var lower = cmd.toLowerCase();
    var parts = lower.split(/\s+/);
    var key = parts[0];
    var rest = cmd.slice(key.length).trim();

    switch (key) {
      case 'help':
        termLine(
          '可用命令:\n' +
          '  HELP      显示此列表\n' +
          '  DIR       列出目录内容\n' +
          '  CLS       清屏\n' +
          '  VER       显示系统版本\n' +
          '  DATE      显示当前日期\n' +
          '  TIME      显示当前时间\n' +
          '  ECHO      回显文本\n' +
          '  WHOAMI    显示当前用户\n' +
          '  MUSIC     播放今晚的歌\n' +
          '  EXIT      关闭命令提示符\n' +
          '\n' +
          '（有些命令今晚不可用。）', 't-out');
        break;

      case 'dir':
        termLine(DIR_TEXT, 't-out');
        break;

      case 'cls':
        termClear();
        break;

      case 'ver':
        termLine('Windows 98 [Version 4.10.2222]\n<span style="color:#6b4b8a">（主板上的时钟不是这么写的。）</span>', 't-out');
        break;

      case 'date': {
        var d = new Date();
        termLine('当前日期: ' + d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0'), 't-out');
        break;
      }

      case 'time': {
        var t = new Date();
        termLine('当前时间: ' + String(t.getHours()).padStart(2, '0') + ':' +
          String(t.getMinutes()).padStart(2, '0') + ':' +
          String(t.getSeconds()).padStart(2, '0'), 't-out');
        break;
      }

      case 'echo':
        termLine(esc(rest), 't-out');
        break;

      case 'whoami':
        termLine('desktop-0d00072\\visitor\n\n（但屏幕上有两个人影。你只有一个。）', 't-out');
        break;

      case 'music':
        toggleBGM(true);
        termLine('正在播放「今晚的歌」……\n<span style="color:#6b4b8a">（如果没声音，点一下右下角的小喇叭。）</span>', 't-out');
        break;

      case 'exit':
        closeWindow('terminal');
        break;

      case 'halloween':
        triggerBSOD();
        break;

      /* ---------- 10·24 专属口令：今晚全部失效 ---------- */
      case '1024':
      case '0721':
      case '67':
        termLine("'" + esc(cmd) + "' 不是内部或外部命令，也不是可运行的程序\n或批处理文件。\n\n" +
          '（那是 10 月 24 日的口令。今晚不通。）', 't-err');
        setTimeout(function () { pushGhost('今晚的暗号不叫这个。', 3200); }, 800);
        break;

      default: {
        var errNode = termLine("'" + esc(cmd) + "' 不是内部或外部命令，也不是可运行的程序\n或批处理文件。", 't-err');
        maybeGhost(errNode);
      }
    }
    scrollTerm();
  }

  function initTerminal() {
    termBody = $('term-body');
    termOut = $('term-out');
    termInput = $('term-input');
    if (!termInput) return;

    termInput.addEventListener('keydown', function (e) {
      S.lastInput = Date.now();
      if (e.key === 'Enter') {
        var v = termInput.value;
        termInput.value = '';
        if (v.trim()) {
          S.termHist.push(v);
          S.histIdx = S.termHist.length;
        }
        runCommand(v);
      } else if (e.key === 'ArrowUp') {
        if (!S.termHist.length) return;
        S.histIdx = Math.max(0, S.histIdx - 1);
        termInput.value = S.termHist[S.histIdx] || '';
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (!S.termHist.length) return;
        S.histIdx = Math.min(S.termHist.length, S.histIdx + 1);
        termInput.value = S.termHist[S.histIdx] || '';
        e.preventDefault();
      }
    });

    termBody.addEventListener('click', function (e) {
      if (e.target === termBody || e.target.closest('.t-input-line')) {
        termInput.focus();
      }
    });
  }

  /* ============================================================
     7. 蓝屏彩蛋（Halloween）
     ============================================================ */
  var bsodEl, blackoutEl;

  function triggerBSOD() {
    if (S.bsod) return;
    S.bsod = true;

    termLine('正在执行……', 't-out');

    // 1) 断电黑屏
    blackoutEl.classList.add('show');
    sfxPowerDown();

    // 2) 蓝屏
    setTimeout(function () {
      blackoutEl.classList.remove('show');
      bsodEl.classList.add('show');
      sfxPowerUp();
      noiseBurst(0.35, 0.1, 5200, 2.4);
    }, 280);

    // 3) 恢复正常
    setTimeout(recoverFromBSOD, 3100);
  }

  function recoverFromBSOD() {
    bsodEl.classList.remove('show');
    blackoutEl.classList.add('show');

    setTimeout(function () {
      blackoutEl.classList.remove('show');
      S.bsod = false;
      joltWindows();
      creepClock();
      sfxCrtBack();
      if (S.wins.terminal && S.wins.terminal.open) {
        termLine('系统已从 0x0000BEEF 中恢复。', 't-sys');
        pushGhost('它还在。', 3600);
        termLine(' ', 't-out');
      }
      unlockSecretIcon();
    }, 260);
  }

  function sfxCrtBack() {
    tone(120, 0.16, 0.06, 'sine', 900);
    noiseBurst(0.12, 0.07, 3200, 2);
  }

  function joltWindows() {
    Object.keys(S.wins).forEach(function (k) {
      var el = getWin(k);
      if (!el || !S.wins[k].open) return;
      var l = parseInt(el.style.left, 10) || 0;
      var t = parseInt(el.style.top, 10) || 0;
      el.style.transition = 'left 0.12s ease, top 0.12s ease';
      el.style.left = Math.max(0, l + rand(-26, 26)) + 'px';
      el.style.top = Math.max(0, t + rand(-18, 18)) + 'px';
      setTimeout(function () { el.style.transition = ''; }, 400);
    });
  }

  /* 蓝屏后解锁的隐藏图标 */
  function unlockSecretIcon() {
    if (S.secretUnlocked) return;
    S.secretUnlocked = true;

    var desk = $('desktop');
    var icon = document.createElement('div');
    icon.className = 'desk-icon';
    icon.style.cssText = 'left:26px;top:150px;opacity:0;transition:opacity .8s ease;';
    icon.innerHTML = '<div class="ico">📁</div><div class="lbl">dont_look</div>';
    desk.appendChild(icon);

    requestAnimationFrame(function () { icon.style.opacity = '1'; });

    icon.addEventListener('dblclick', function () {
      flashFace();
      icon.remove();
      S.secretUnlocked = false;
    });
  }

  /* ============================================================
     8. 惊吓彩蛋探测器
     ============================================================ */
  var faceEl, eyesEl;

  function flashFace() {
    if (S.bsod || document.hidden) return;
    faceEl.classList.add('show');
    sfxScream();
    S.scareCount += 1;
    setTimeout(function () { faceEl.classList.remove('show'); }, 110);
  }

  function showEyes() {
    if (S.bsod || document.hidden) return;
    var w = window.innerWidth, h = document.getElementById('desktop').offsetHeight;
    eyesEl.style.left = Math.round(rand(60, Math.max(80, w - 120))) + 'px';
    eyesEl.style.top = Math.round(rand(60, Math.max(80, h - 120))) + 'px';
    eyesEl.classList.remove('show');
    void eyesEl.offsetWidth;
    eyesEl.classList.add('show');
    setTimeout(function () { eyesEl.classList.remove('show'); }, 1600);
  }

  function creepClock() {
    var clock = $('clock');
    clock.classList.add('creepy');
    clock.textContent = '03:33';
    setTimeout(function () {
      clock.classList.remove('creepy');
      updateClock();
    }, 3200);
  }

  function joltIcon() {
    var icons = document.querySelectorAll('.desk-icon');
    if (!icons.length) return;
    var el = icons[(Math.random() * icons.length) | 0];
    var l = parseInt(el.style.left, 10) || 0;
    var t = parseInt(el.style.top, 10) || 0;
    el.style.transform = 'translate(' + rand(-22, 22) + 'px,' + rand(-16, 16) + 'px)';
    setTimeout(function () { el.style.transform = ''; }, 2400);
  }

  function loopScares() {
    // 白脸闪现：第一次在 45~80 秒后，之后 60~150 秒一次
    setTimeout(function tickFace() {
      if (!S.bsod && !document.hidden && S.started) flashFace();
      setTimeout(tickFace, rand(60000, 150000));
    }, rand(45000, 80000));

    // 红眼
    setTimeout(function tickEyes() {
      if (!S.bsod && !document.hidden) showEyes();
      setTimeout(tickEyes, rand(38000, 95000));
    }, rand(20000, 50000));

    // 时钟
    setTimeout(function tickClock() {
      if (!S.bsod) creepClock();
      setTimeout(tickClock, rand(40000, 100000));
    }, rand(30000, 70000));

    // 图标漂移
    setTimeout(function tickIcon() {
      if (!S.bsod) joltIcon();
      setTimeout(tickIcon, rand(50000, 120000));
    }, rand(35000, 80000));

    // 终端幽灵打字
    setTimeout(function tickGhost() {
      var st = S.wins.terminal;
      if (st && st.open && !S.bsod && Date.now() - S.lastInput > 30000 && Math.random() < 0.5) {
        ghostIntoTerm();
      }
      setTimeout(tickGhost, 24000);
    }, 30000);
  }

  /* ============================================================
     9. 时钟
     ============================================================ */
  function updateClock() {
    var clock = $('clock');
    if (!clock || clock.classList.contains('creepy')) return;
    var d = new Date();
    clock.textContent = String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0');
  }

  /* ============================================================
     10. BGM（网易云外链，用户指定曲目）
     ============================================================ */
  var BGM_SRC = '//music.163.com/outchain/player?type=2&id=1335681507&auto=1&height=66';

  function ensureBGM(force) {
    var holder = $('bgm-holder');
    if (!holder) return;
    if (S.bgmLoaded && !force) return;
    if (S.bgmLoaded && force) {
      // 重新加载以借助用户手势把 auto=1 真正跑起来
      var old = holder.querySelector('iframe');
      if (old) old.parentNode.removeChild(old);
    }
    var f = document.createElement('iframe');
    f.setAttribute('frameborder', 'no');
    f.setAttribute('border', '0');
    f.setAttribute('marginwidth', '0');
    f.setAttribute('marginheight', '0');
    f.setAttribute('allow', 'autoplay; encrypted-media');
    f.setAttribute('width', '330');
    f.setAttribute('height', '86');
    f.setAttribute('title', '今晚的歌');
    f.src = BGM_SRC;
    holder.appendChild(f);
    S.bgmLoaded = true;
  }

  /* 用户第一次操作时重新点一次歌（浏览器要求手势才允许自动播放） */
  var bgmKicked = false;
  function kickBGM() {
    if (bgmKicked) return;
    bgmKicked = true;
    if (S.bgmLoaded) ensureBGM(true); else ensureBGM();
    if (!S.bgmOn) toggleBGM(true);
  }

  function toggleBGM(forceOn) {
    if (!S.bgmLoaded) ensureBGM();
    var box = $('bgm-box');
    var tray = $('tray-bgm');
    var on = forceOn === true ? true : !S.bgmOn;
    box.classList.toggle('show', on);
    S.bgmOn = on;
    if (tray) tray.textContent = on ? '🔊' : '🔇';
    sfxClick();
  }

  $('tray-bgm').addEventListener('click', function (e) {
    e.stopPropagation();
    toggleBGM();
  });

  $('bgm-close').addEventListener('click', function (e) {
    e.stopPropagation();
    S.bgmOn = true;
    toggleBGM();
  });

  /* 蜡烛图标：偷偷告诉你通关方式 */
  $('tray-secret').addEventListener('click', function (e) {
    e.stopPropagation();
    openWindow('terminal');
    setTimeout(function () {
      termLine('提示：readme.txt 里写了一句话。它写了什么，你就输入什么。', 't-hint');
    }, 120);
  });

  /* ============================================================
     11. 开机自检
     ============================================================ */
  var BIOS_LINES = [
    ['HALLOWEEN BIOS v1.03  ', 'bios-hl'],
    ['(C) 1998 Phantom Systems, Inc.  All Rights Reversed.', 'bios-dim'],
    ['', ''],
    ['Main Processor     : Intel Pentium(R) 133MHz', ''],
    ['Memory Test        : 65536K OK', ''],
    ['Cache Memory       : 512K Pipeline Burst', ''],
    ['', ''],
    ['Detecting IDE Primary Master   ... NEC CD-ROM DRIVE:28', ''],
    ['Detecting IDE Primary Slave    ... None', ''],
    ['Detecting IDE Secondary Master ... WDC AC21600H', ''],
    ['Detecting IDE Secondary Slave  ... UNKNOWN DEVICE', ''],
    ['', ''],
    ['WARNING: 检测到 1 个未登记的设备。', 'bios-warn'],
    ['         它不在主板上，也不在机箱里。', 'bios-warn'],
    ['', ''],
    ['Press DEL to enter SETUP , ESC to skip memory test', 'bios-dim']
  ];

  var biosTimer = null;
  var biosDone = false;

  function endBIOS() {
    if (biosDone) return;
    biosDone = true;
    if (biosTimer) clearTimeout(biosTimer);
    $('bios-screen').classList.remove('show');
    S.started = true;
    // 用户手势之后创建 AudioContext + 尝试放歌
    ac();
    setTimeout(function () {
      ensureBGM();
      toggleBGM(true);
    }, 500);
    updateClock();
    setInterval(updateClock, 15000);
    loopScares();
    console.log('%c🎃 10·31 万圣节彩蛋已激活 %c试试在 CMD 里输入 help，readme.txt 里也有一句话。',
      'background:#2a0d33;color:#ff7a18;font-family:monospace;font-size:13px;padding:2px 6px;',
      'color:#7b2cbf;font-family:monospace;');
  }

  function runBIOS() {
    var screen = $('bios-screen');
    var text = $('bios-text');
    screen.classList.add('show');
    text.textContent = '';
    var i = 0;

    function step() {
      if (biosDone) return;
      if (i >= BIOS_LINES.length) {
        biosTimer = setTimeout(endBIOS, 900);
        return;
      }
      var line = BIOS_LINES[i++];
      var span = document.createElement('span');
      span.className = line[1] || '';
      span.textContent = line[0] + '\n';
      text.appendChild(span);
      biosTimer = setTimeout(step, line[0] ? (90 + Math.random() * 70) : 40);
    }
    step();

    $('bios-skip').addEventListener('click', function (e) {
      e.stopPropagation();
      endBIOS();
    });
    document.addEventListener('keydown', function (e) {
      if (!biosDone) { e.preventDefault(); endBIOS(); }
    }, true);
    screen.addEventListener('click', function (e) {
      if (e.target.id !== 'bios-skip') endBIOS();
    });
  }

  /* ============================================================
     12. 启动
     ============================================================ */
  function boot() {
    bsodEl = $('bsod');
    blackoutEl = $('blackout');
    faceEl = $('scare-face');
    eyesEl = $('scare-eyes');

    renderReadme();
    initTerminal();
    updateClock();

    // 预览模式（?hw=1）给一个退出按钮
    try {
      if (new URLSearchParams(location.search).get('hw') === '1') {
        var btn = $('hw-exit');
        btn.style.display = 'block';
        btn.addEventListener('click', function () {
          try { sessionStorage.setItem('hw1031', '0'); } catch (e) {}
          // 桌面本身在 iframe 里，必须让顶层窗口跳转
          try { window.top.location.href = './index.html?hw=0'; }
          catch (e2) { location.href = './index.html?hw=0'; }
        });
      }
    } catch (e) {}

    // 蓝屏期间按任意键 / 点击可提前恢复
    bsodEl.addEventListener('click', function () {
      if (S.bsod) recoverFromBSOD();
    });
    document.addEventListener('keydown', function (e) {
      if (S.bsod) { e.preventDefault(); recoverFromBSOD(); }
    }, true);

    // 首次手势 → 把背景音乐真正放起来
    document.addEventListener('pointerdown', kickBGM, true);
    document.addEventListener('keydown', kickBGM, true);

    runBIOS();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
