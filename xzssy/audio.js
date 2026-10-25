/* ============================================================
   凶宅试睡员 · audio.js
   全程序化音效（WebAudio 合成，零音频文件）
   ============================================================ */
window.XZ = window.XZ || {};
(function (XZ) {
  'use strict';

  var ctx = null, master = null, noiseBuf = null, droneNodes = null, muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ctx.destination);

    // 2 秒白噪声缓存
    var len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function now() { return ctx.currentTime; }

  function noise(dur, gain, type, freq, q) {
    if (!ensure()) return;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = freq || 900;
    f.Q.value = q || 1;
    var g = ctx.createGain();
    var t = now();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.06, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
    return { g: g, f: f, src: src };
  }

  function tone(freq, dur, gain, type, slideTo) {
    if (!ensure()) return;
    var o = ctx.createOscillator();
    o.type = type || 'sine';
    var g = ctx.createGain();
    var t = now();
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  var API = {
    init: ensure,

    mute: function (m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.85;
      if (droneNodes) droneNodes.gain.gain.value = m ? 0 : 0.05;
    },
    isMuted: function () { return muted; },

    /* 环境低频嗡鸣（持续） */
    drone: function (on, level) {
      if (!ensure()) return;
      if (on) {
        if (droneNodes) { droneNodes.gain.gain.value = level === undefined ? 0.05 : level; return; }
        var g = ctx.createGain(); g.gain.value = level === undefined ? 0.05 : level;
        var o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 46;
        var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 58.5;
        var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
        o1.start(); o2.start();
        droneNodes = { gain: g, o1: o1, o2: o2 };
      } else if (droneNodes) {
        droneNodes.gain.gain.value = 0;
      }
    },

    /* 木质吱呀 */
    creak: function () {
      if (!ensure()) return;
      var t = now();
      var o = ctx.createOscillator(); o.type = 'sawtooth';
      var f0 = 80 + Math.random() * 120;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.linearRampToValueAtTime(f0 * (1.4 + Math.random() * 0.8), t + 0.55);
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700 + Math.random() * 900; f.Q.value = 7;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.8);
    },

    /* 闷响 */
    thump: function (k) {
      if (!ensure()) return;
      tone(64, 0.34, 0.5 * (k || 1), 'sine', 34);
      noise(0.16, 0.06 * (k || 1), 'lowpass', 300, 0.7);
    },

    /* 脚步 */
    step: function () { noise(0.09, 0.035, 'lowpass', 420 + Math.random() * 200, 0.8); },

    /* 低语（多层带通噪声） */
    whisper: function (dur) {
      dur = dur || 1.6;
      if (!ensure()) return;
      var n = noise(dur, 0.055, 'bandpass', 1100 + Math.random() * 600, 5);
      if (!n) return;
      var t = now();
      var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 4.5 + Math.random() * 3;
      var lg = ctx.createGain(); lg.gain.value = 0.03;
      lfo.connect(lg); lg.connect(n.g.gain);
      lfo.start(t); lfo.stop(t + dur);
    },

    /* 电视雪花 */
    tvStatic: function (dur, gain) {
      noise(dur || 2.2, gain || 0.05, 'highpass', 2200, 0.6);
    },

    /* 快门 */
    shutter: function () {
      if (!ensure()) return;
      noise(0.05, 0.16, 'highpass', 2600, 0.7);
      setTimeout(function () { noise(0.06, 0.12, 'highpass', 1800, 0.7); }, 70);
    },

    /* 闪光灯蓄能 */
    flashCharge: function () { tone(1200, 0.18, 0.05, 'square', 2600); },

    /* 电闸 */
    breaker: function () {
      if (!ensure()) return;
      tone(70, 0.09, 0.35, 'square', 40);
      noise(0.12, 0.12, 'highpass', 1500, 0.6);
    },

    /* 心跳，strength 0..1 */
    heart: function (strength) {
      if (!ensure()) return;
      var s = Math.max(0.15, Math.min(1, strength || 0.5));
      tone(58, 0.14, 0.28 * s, 'sine', 40);
      setTimeout(function () { tone(52, 0.18, 0.2 * s, 'sine', 36); }, 165);
    },

    /* 惊吓刺响 */
    sting: function () {
      if (!ensure()) return;
      var t = now();
      var o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(1500, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.7);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.85);
      noise(0.5, 0.12, 'highpass', 1400, 0.5);
    },

    /* 门闩 */
    doorSlam: function () {
      if (!ensure()) return;
      tone(90, 0.2, 0.4, 'square', 45);
      noise(0.35, 0.1, 'lowpass', 700, 0.9);
    },

    /* 电流 / 灯丝 */
    buzz: function (dur) {
      if (!ensure()) return;
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100;
      var g = ctx.createGain();
      var t = now();
      g.gain.setValueAtTime(0.03, t);
      g.gain.linearRampToValueAtTime(0, t + (dur || 0.3));
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + (dur || 0.3) + 0.02);
    },

    /* 水滴 */
    drip: function () {
      if (!ensure()) return;
      tone(700 + Math.random() * 500, 0.12, 0.05, 'sine', 260);
    },

    /* 撒盐 / 沙沙 */
    salt: function () { noise(0.5, 0.07, 'highpass', 4200, 0.5); },

    /* 铃声（手机） */
    ring: function () {
      if (!ensure()) return;
      var t0 = now();
      for (var i = 0; i < 3; i++) {
        (function (i) {
          setTimeout(function () { tone(880, 0.1, 0.06, 'sine'); }, i * 220);
          setTimeout(function () { tone(1180, 0.1, 0.05, 'sine'); }, i * 220 + 110);
        })(i);
      }
    },

    /* 附身后的耳鸣 */
    tinnitus: function (dur) { tone(3400, dur || 2.0, 0.035, 'sine'); }
  };

  XZ.sfx = API;
})(window.XZ);
