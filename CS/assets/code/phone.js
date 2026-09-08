"use strict";
/* ============================================================
   CS · phone.js — 手机端逻辑 / 触控
   （模式检测、摇杆、按钮、拖拽视角）
   ============================================================ */

/* ---------- 0. 手机模式检测 & 模式切换 ---------- */
let isPhone;
if (params.get('isphone') === 'T') isPhone = true;
else if (params.get('isphone') === 'F') isPhone = false;
else isPhone = /Mobi|Android|iPhone|iPad|iPod|touch/i.test(navigator.userAgent)
              || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
function applyMode(){
  if (isPhone) document.body.classList.add('phone'); else document.body.classList.remove('phone');
  const lbl=document.getElementById('modeLabel'), btn=document.getElementById('modeBtn');
  if(lbl) lbl.textContent = isPhone?'手机':'桌面';
  if(btn) btn.textContent = isPhone?'切换为桌面':'切换为手机';
  if(flyEnabled && isPhone) document.body.classList.add('flyon'); else document.body.classList.remove('flyon');
}
applyMode();
document.getElementById('modeBtn').addEventListener('click', e=>{ e.stopPropagation(); isPhone=!isPhone; applyMode(); });

/* ---------- 1. 左摇杆移动 ---------- */
const joyEl=el('joystick'), stickEl=el('stick'), JMAX=42;
function stickMove(t){ let dx=t.clientX-joy.baseX, dy=t.clientY-joy.baseY; const d=Math.hypot(dx,dy);
  if(d>JMAX){dx=dx/d*JMAX;dy=dy/d*JMAX;} stickEl.style.transform=`translate(${dx}px,${dy}px)`; joy.x=dx/JMAX; joy.y=dy/JMAX; }
joyEl.addEventListener('touchstart', e=>{ e.preventDefault(); if(layoutEditing) return; const t=e.changedTouches[0]; joy.id=t.identifier; joy.active=true;
  const r=joyEl.getBoundingClientRect(); joy.baseX=r.left+r.width/2; joy.baseY=r.top+r.height/2; stickMove(t); },{passive:false});
joyEl.addEventListener('touchmove', e=>{ e.preventDefault(); for(const t of e.changedTouches) if(t.identifier===joy.id)stickMove(t); },{passive:false});
function joyEnd(e){ for(const t of e.changedTouches) if(t.identifier===joy.id){ joy.active=false;joy.id=null;joy.x=0;joy.y=0;stickEl.style.transform='translate(0,0)'; } }
joyEl.addEventListener('touchend', e=>{e.preventDefault();joyEnd(e);},{passive:false});
joyEl.addEventListener('touchcancel', e=>{e.preventDefault();joyEnd(e);},{passive:false});

/* ---------- 2. 右侧操作按钮 ---------- */
// 编辑手指键位时（layoutEditing）只处理拖拽，不触发游戏动作
function bindBtn(id,onDown,onUp){ const b=el(id); b.addEventListener('touchstart',e=>{e.preventDefault();if(!running||layoutEditing)return;onDown();},{passive:false});
  if(onUp)b.addEventListener('touchend',e=>{e.preventDefault();onUp();},{passive:false}); }
bindBtn('btnFire', ()=>{ if(curWeapon==='grenade')throwGrenade(player); else if(curWeapon==='pistol')playerFire(); else {firing=true;playerFire();} }, ()=>{firing=false;});
bindBtn('btnReload', ()=>startReload(player));
bindBtn('btnSwitch', ()=>switchWeapon());

/* ---------- 3. 手机飞天（仅秘籍开启时显示） ---------- */
let flyUp=false, flyDown=false;
bindBtn('btnUp', ()=>{flyUp=true;}, ()=>{flyUp=false;});
bindBtn('btnDown', ()=>{flyDown=true;}, ()=>{flyDown=false;});
let touchCrouch=false;
bindBtn('btnCrouch', ()=>{touchCrouch=true;}, ()=>{touchCrouch=false;});
bindBtn('btnJump', ()=>{ if(player&&player.grounded&&running&&!paused) player.jumpQueued=true; });
bindBtn('btnRecon', ()=>{ useRecon(); });
bindBtn('btnKami', ()=>{ useKamikaze(); });
bindBtn('btnMark', ()=>{ placeMark(); });
bindBtn('btnChat', ()=>{ openChatInput(); });
bindBtn('btnBoard', ()=>{ toggleScoreboard(); });   // 手机端排行榜（桌面用「/」键）

/* ---------- 4. 手机视角（#look 层拖拽；摇杆与按钮在其上层，互不干扰） ---------- */
const lookEl=el('look'), look={id:null,lx:0,ly:0};
lookEl.addEventListener('touchstart', e=>{ if(!running||paused||layoutEditing)return; e.preventDefault(); const t=e.changedTouches[0]; look.id=t.identifier; look.lx=t.clientX; look.ly=t.clientY; }, {passive:false});
lookEl.addEventListener('touchmove', e=>{ if(look.id===null)return; e.preventDefault();
  for(const t of e.changedTouches){ if(t.identifier===look.id){
    const dx=t.clientX-look.lx, dy=t.clientY-look.ly; look.lx=t.clientX; look.ly=t.clientY;
    player.yaw-=dx*sensitivity*2; player.pitch-=dy*sensitivity*2; player.pitch=Math.max(-1.45,Math.min(1.45,player.pitch)); } }
}, {passive:false});
function lookEnd(e){ for(const t of e.changedTouches) if(t.identifier===look.id) look.id=null; }
lookEl.addEventListener('touchend', lookEnd, {passive:false});
lookEl.addEventListener('touchcancel', lookEnd, {passive:false});

/* ---------- 5. 手机端强制横屏 ---------- */
function isPortrait(){ return window.innerHeight > window.innerWidth; }
function updateOrientation(){
  const hint = el('rotateHint');
  if(!hint) return;
  if(isPhone && isPortrait()) hint.classList.remove('hide');
  else hint.classList.add('hide');
}
window.addEventListener('resize', updateOrientation);
window.addEventListener('orientationchange', updateOrientation);
updateOrientation();
// 进入游戏时尝试锁定横屏（Android Chrome 真锁；iOS 无此能力，靠上面的提示遮罩）
function requestLandscape(){
  try{
    const doc = document.documentElement;
    const lock = ()=>{ try{ if(screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(()=>{}); }catch(e){} };
    if(doc.requestFullscreen){ doc.requestFullscreen().then(lock).catch(()=>{ lock(); }); }
    else lock();
  }catch(e){}
}
