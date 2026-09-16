"use strict";
/* ============================================================
   HRAI · stop.js — 暂停 / 灵敏度 / 分享（恐怖逃生精简版）
   ============================================================ */
let sensitivity = 0.0024;   // 由暂停菜单滑块调节
let paused = false;

function togglePause(){
  if(matchOver||!running) return;   // 结算/开始界面不响应 Esc、`、暂停按钮
  if(layoutEditing) return;         // 手指键位编辑态：保持界面干净，Esc 不弹设置
  const _kp=el('keyPanel'); if(_kp && !_kp.classList.contains('hide')) return;  // 键位面板开着时 Esc 只关面板
  paused=!paused;
  if(paused){ el('pause').classList.remove('hide');
    if(document.pointerLockElement===cv) document.exitPointerLock(); }
  else { el('pause').classList.add('hide'); if(!isPhone) cv.requestPointerLock(); }
}
// 从暂停设置返回开始界面（清空残局）
function quitToMenu(){
  if(layoutEditing) return;   // 编辑手指键位时不允许退回开始界面（会盖住触控层）
  if(document.pointerLockElement===cv) document.exitPointerLock();
  paused=false; running=false; matchOver=false;
  el('pause').classList.add('hide');
  el('victory').classList.add('hide');
  for(const c of characters) respawnChar(c);
  resetRunState();            // 重置钥匙/合成/大门等进度
  el('overlay').classList.remove('hide');
  el('startBtn').textContent='点击开始';
  updateHUD();
}
function shareGame(){
  const url=location.href;
  const intro='【HRAI · Horror AI 恐怖逃生】黑暗竞技场里，「它」拿着小刀在雾中游荡。收集 20 把钥匙、合成大钥匙、穿过敌区后方的大门逃出去——别被一刀终结。点开即玩:\n'+url;
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(intro).then(()=>toast('已复制分享文案+链接'),()=>toast('复制失败')); }
  else toast(intro);
}
el('pauseBtn').addEventListener('click', togglePause);
el('shareBtn').addEventListener('click', shareGame);
el('resumeBtn').addEventListener('click', togglePause);
el('shareBtn2').addEventListener('click', shareGame);
el('againBtn').addEventListener('click', resetMatch);
el('quitBtn').addEventListener('click', quitToMenu);

// 取消全屏：手机端 requestLandscape 进了全屏后，提供游戏内退出入口（仅在全屏时显示）
function exitFullscreen(){
  if(document.exitFullscreen) document.exitFullscreen();
  else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
  else if(document.msExitFullscreen) document.msExitFullscreen();
}
function syncFsBtn(){
  const b=el('fsExitBtn'); if(!b) return;
  const fs=!!(document.fullscreenElement||document.webkitFullscreenElement||document.msFullscreenElement);
  b.classList.toggle('hide', !fs);
}
document.addEventListener('fullscreenchange', syncFsBtn);
document.addEventListener('webkitfullscreenchange', syncFsBtn);
syncFsBtn();
el('fsExitBtn').addEventListener('click', ()=>{ exitFullscreen(); toast('已退出全屏'); });

// 灵敏度旋钮
const sensInput=el('sens'), sensVal=el('sensVal');
function applySens(){ const mul=parseFloat(sensInput.value); sensitivity=0.001*mul; sensVal.textContent=mul.toFixed(1); }
sensInput.addEventListener('input', applySens); applySens();
