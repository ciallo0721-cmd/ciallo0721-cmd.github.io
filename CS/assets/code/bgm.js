"use strict";
/* ============================================================
   bgm.js — 全局背景音乐（CS / HRAI 共用，两处文件一致）
   音乐素材：Kevin MacLeod (incompetech.com) · CC BY 4.0（可商用，需署名）
   设计：自包含，不改动游戏主逻辑。
        靠 MutationObserver 观察 #overlay / #pause / #victory 的 .hide 推游戏状态：
          开始界面 → 停   |  游戏中 → 播  |  暂停 → 停  |  结算 → 压低音量续播
   用法：页面里先定义 window.BGM_CONFIG = { src, volume, duck }，再引入本文件。
        也可直接调用 window.bgmPlay() / bgmPause() / bgmStop()。
   ============================================================ */
(function(){
  var CFG = Object.assign({ src:'assets/sound/bgm.mp3', volume:0.35, duck:0.45, label:'背景音乐' }, window.BGM_CONFIG||{});

  var LS_VOL='bgmVolume', LS_MUTE='bgmMuted';
  var vol = parseFloat(localStorage.getItem(LS_VOL));
  if(!(vol>=0 && vol<=1)) vol = CFG.volume;
  var muted = localStorage.getItem(LS_MUTE)==='1';

  /* ---------- 音频对象（相对页面路径，子目录页直接用 assets/...） ---------- */
  var audio = null, broken=false;
  try{
    audio = new Audio(CFG.src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = vol;
    audio.addEventListener('error', function(){ broken=true; });
  }catch(e){ broken=true; }

  var unlocked=false, state='idle', fadeTimer=null, stopTimer=null;

  /* ---------- 小工具 ---------- */
  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function isShown(id){ var e=document.getElementById(id); return !!e && !e.classList.contains('hide'); }
  function applyVol(v){ if(audio){ try{ audio.volume = clamp(v,0,1); }catch(e){} } }

  // 平滑过渡到目标音量；ms<=0 直接跳到
  function fadeTo(target, ms){
    if(!audio) return;
    target = clamp(target,0,1);
    if(fadeTimer){ clearInterval(fadeTimer); fadeTimer=null; }
    var from = audio.volume;
    if(ms<=0 || Math.abs(target-from)<0.003){ applyVol(target); return; }
    var t0 = performance.now();
    fadeTimer = setInterval(function(){
      var k = Math.min(1,(performance.now()-t0)/ms);
      applyVol(from + (target-from)*k);
      if(k>=1){ clearInterval(fadeTimer); fadeTimer=null; }
    }, 30);
  }

  function safePlay(){
    if(!audio || broken) return;
    try{
      if(audio.paused){ var p=audio.play(); if(p && p.catch) p.catch(function(){}); }
    }catch(e){}
  }
  function cancelStop(){ if(stopTimer){ clearTimeout(stopTimer); stopTimer=null; } }

  /* ---------- 对外动作 ---------- */
  function play(){
    cancelStop();
    state='playing';
    if(!audio || broken || muted || !unlocked) return;
    safePlay();
    fadeTo(vol, 1200);
  }
  function pause(){
    cancelStop();
    state='paused';
    if(!audio || broken) return;
    fadeTo(0, 260);
    stopTimer = setTimeout(function(){
      if(state==='paused'){ try{ audio.pause(); }catch(e){} }
    }, 300);
  }
  function stop(){
    cancelStop();
    state='idle';
    if(!audio || broken) return;
    fadeTo(0, 600);
    stopTimer = setTimeout(function(){
      if(state!=='idle') return;
      try{ audio.pause(); audio.currentTime = 0; }catch(e){}
    }, 640);
  }
  function duck(){
    cancelStop();
    state='duck';
    if(!audio || broken || muted || !unlocked) return;
    safePlay();
    fadeTo(vol*CFG.duck, 500);
  }

  function setVolume(v, silent){
    vol = clamp(parseFloat(v)||0, 0, 1);
    try{ localStorage.setItem(LS_VOL, vol); }catch(e){}
    if(muted && !silent){ muted=false; try{ localStorage.setItem(LS_MUTE,'0'); }catch(e){} updateBtn(); }
    sync(true);
  }
  function toggleMute(){
    muted = !muted;
    try{ localStorage.setItem(LS_MUTE, muted?'1':'0'); }catch(e){}
    updateBtn();
    if(muted){ fadeTo(0,200); }
    else { sync(true); }
    return muted;
  }

  /* ---------- 状态机：看界面显隐决定该干嘛 ---------- */
  function sync(force){
    if(!audio || broken) return;
    var next;
    if(isShown('overlay'))      next='idle';     // 开始界面
    else if(isShown('pause'))   next='paused';   // 暂停
    else if(isShown('victory')) next='duck';     // 结算：留着，压低
    else                        next='playing';  // 游戏中（含 DEBUG）
    if(!force && next===state) return;
    if(next==='idle')         stop();
    else if(next==='paused')  pause();
    else if(next==='duck')    duck();
    else                      play();
  }

  /* ---------- 首次用户手势：解锁自动播放 ---------- */
  var GESTURES=['pointerdown','touchstart','mousedown','keydown'];
  function onGesture(){
    if(unlocked) return;
    unlocked = true;
    for(var i=0;i<GESTURES.length;i++) document.removeEventListener(GESTURES[i], onGesture, true);
    if(!audio || broken){ sync(true); return; }
    // 借这次手势把该 audio 元素"解锁"，之后随时可播
    try{
      var keep = audio.muted;
      audio.muted = true;
      var p = audio.play();
      var done = function(){
        try{ audio.pause(); audio.currentTime = 0; }catch(e){}
        audio.muted = keep; applyVol(vol); sync(true);
      };
      if(p && p.then) p.then(done, function(){ audio.muted=keep; applyVol(vol); sync(true); });
      else done();
    }catch(e){ sync(true); }
  }
  for(var i=0;i<GESTURES.length;i++) document.addEventListener(GESTURES[i], onGesture, true);

  /* ---------- UI：HUD 快捷按钮 + 暂停面板音量行 ---------- */
  function updateBtn(){
    var b = document.getElementById('bgmBtn');
    if(b){ b.textContent = muted ? '🔇' : '🎵'; b.title = CFG.label + (muted?'（已关）':'（已开）'); }
    var r = document.getElementById('bgmVol');
    if(r) r.value = Math.round(vol*100);
    var vv = document.getElementById('bgmVolVal');
    if(vv) vv.textContent = muted ? '关' : Math.round(vol*100)+'%';
  }

  function injectStyle(){
    if(document.getElementById('bgmStyle')) return;
    var s = document.createElement('style');
    s.id = 'bgmStyle';
    s.textContent = '#bgmCredit{opacity:.5;font-size:11px;margin-left:6px;white-space:nowrap;}'
      + '#bgmRow input[type=range]{width:110px;vertical-align:middle;}'
      + '#bgmRow span#bgmVolVal{display:inline-block;min-width:38px;text-align:right;font-size:12px;opacity:.8;}';
    document.head.appendChild(s);
  }

  function buildUI(){
    // HUD 上的 🎵 快捷开关（塞进 #topbtns 最左边）
    var tb = document.getElementById('topbtns');
    if(tb && !document.getElementById('bgmBtn')){
      var b = document.createElement('button');
      b.id='bgmBtn'; b.type='button';
      b.addEventListener('click', function(e){ e.stopPropagation(); toggleMute(); });
      tb.insertBefore(b, tb.firstChild);
    }
    // 暂停面板里插一行：背景音乐 音量滑块
    var panel = document.getElementById('pause');
    if(panel && !document.getElementById('bgmRow')){
      var row = document.createElement('div');
      row.className='row'; row.id='bgmRow';
      row.innerHTML = CFG.label+' <input type="range" id="bgmVol" min="0" max="100" step="1" value="'
        + Math.round(vol*100) + '"><span id="bgmVolVal"></span><span id="bgmCredit">Kevin MacLeod · CC BY 4.0</span>';
      var anchor = panel.querySelector('.row');
      if(anchor && anchor.parentNode===panel) anchor.insertAdjacentElement('afterend', row);
      else panel.insertBefore(row, panel.firstChild);
      var r = row.querySelector('#bgmVol');
      r.addEventListener('input', function(){ setVolume(parseFloat(r.value)/100); updateBtn(); });
      var credit = row.querySelector('#bgmCredit');
      if(credit) credit.title = '音乐来源：incompetech.com（Kevin MacLeod）· CC BY 4.0';
    }
    updateBtn();
  }

  /* ---------- 监听界面显隐 ---------- */
  function watch(){
    var mo = new MutationObserver(function(){ sync(false); });
    ['overlay','pause','victory'].forEach(function(id){
      var e = document.getElementById(id);
      if(e) mo.observe(e, { attributes:true, attributeFilter:['class'] });
    });
  }

  /* ---------- 启动 ---------- */
  function boot(){
    injectStyle();
    buildUI();
    watch();
    sync(true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ---------- 全局导出 ---------- */
  window.BGM = {
    audio:audio,                 // 只读引用，方便调试/外部接管
    play:play, pause:pause, stop:stop, duck:duck,
    setVolume:setVolume, getVolume:function(){ return vol; },
    toggleMute:toggleMute, isMuted:function(){ return muted; },
    state:function(){ return state; }
  };
  window.bgmPlay = play;
  window.bgmPause = pause;
  window.bgmResume = play;
  window.bgmStop = stop;
})();
