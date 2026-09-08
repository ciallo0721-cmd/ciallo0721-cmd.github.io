"use strict";
/* ============================================================
   CS · keymap.js — 键位自定义
     A. 键盘键位：动作 → 按键，存 localStorage['csKeymap']
     B. 手指键位：触屏按钮位置，存 localStorage['csTouchLayout']
        （在 DEBUG 沙盒地图中进入编辑态，拖动按键后保存）
   依赖：el() / keys / toast() / enterDebug() / isPhone / cv / running
   注意：本文件必须在 phone.js 之后加载（index.html 末位）
   ============================================================ */

/* ================= A. 键盘键位 ================= */
const KEYMAP_DEFAULT = {
  forward:'w', back:'s', left:'a', right:'d',
  jump:' ',   crouch:'c',
  reload:'r', switchw:'f', use:'e',
  flyup:'=',  flydown:'-',
  recon:'1',  kami:'2',    nuke:'0',
  sprint:'shift', mark:'q', chat:'t'
};
const KEYMAP_LABEL = {
  forward:'前进', back:'后退', left:'左移', right:'右移',
  jump:'跳跃', crouch:'蹲下',
  reload:'换弹', switchw:'换枪', use:'救援 / 下包 / 拆包',
  flyup:'飞↑（升高）', flydown:'飞↓（下降）',
  recon:'侦查无人机', kami:'自爆无人机', nuke:'核弹',
  sprint:'跑步（Shift）', mark:'标点（指挥用）', chat:'聊天'
};
const KEYMAP_ORDER = ['forward','back','left','right','jump','crouch',
  'reload','switchw','use','flyup','flydown','recon','kami','nuke','sprint','mark','chat'];
const LS_KEYMAP = 'csKeymap';

let keymap = (function(){
  const m = Object.assign({}, KEYMAP_DEFAULT);
  try{
    const s = localStorage.getItem(LS_KEYMAP);
    if(s){ const o = JSON.parse(s);
      if(o) for(const k of KEYMAP_ORDER){ if(typeof o[k]==='string' && o[k].length) m[k]=o[k]; } }
  }catch(e){}
  return m;
})();
function saveKeymap(){ try{ localStorage.setItem(LS_KEYMAP, JSON.stringify(keymap)); }catch(e){} }

// 动作是否处于按下状态（供 CS.js 替代硬编码 keys['w'] 等）
function kdown(action){ const k = keymap[action]; return (k && keys[k]) ? true : false; }

function keyName(k){
  if(k===' ') return 'Space';
  if(k==='arrowup')   return '↑';
  if(k==='arrowdown') return '↓';
  if(k==='arrowleft') return '←';
  if(k==='arrowright')return '→';
  if(k==='escape')    return 'Esc';
  if(k==='control')   return 'Ctrl';
  if(k.length===1)    return k.toUpperCase();
  return k;
}

/* ---------- A2. 绑定捕获 ---------- */
var remapAction = null;   // 非 null = 正在等待按键（CS.js 的 keydown 会优先交给 applyRemap）；用 var 挂到 window，确保跨脚本可见

function beginRemap(action){
  remapAction = action;
  renderKeyList();
  toast('按下新按键以绑定「'+KEYMAP_LABEL[action]+'」（Esc 取消）');
}
function applyRemap(e){
  const k = e.key.toLowerCase();
  if(k==='escape'){ remapAction=null; renderKeyList(); toast('已取消绑定'); return; }
  remapKey(remapAction, k);
  remapAction = null;
  renderKeyList();
}
function remapKey(action, k){
  const old = keymap[action];
  // 与其他动作冲突 → 两者交换，避免出现两个动作抢一个键
  for(const b of KEYMAP_ORDER){
    if(b!==action && keymap[b]===k){ keymap[b]=old; toast('与「'+KEYMAP_LABEL[b]+'」已自动交换'); }
  }
  keymap[action] = k;
  keys[old] = false;      // 清掉旧键残留，防止卡住持续移动
  saveKeymap();
  toast('「'+KEYMAP_LABEL[action]+'」→ '+keyName(k)+' 已保存');
}
function resetKeymap(){
  keymap = Object.assign({}, KEYMAP_DEFAULT);
  try{ localStorage.removeItem(LS_KEYMAP); }catch(e){}
  renderKeyList();
  toast('键盘键位已恢复默认');
}

/* ---------- A3. 键位面板 ---------- */
function renderKeyList(){
  const box = el('keyList'); if(!box) return;
  box.innerHTML = '';
  for(const a of KEYMAP_ORDER){
    const row = document.createElement('div'); row.className='krow'; row.dataset.a=a;
    const nm  = document.createElement('span'); nm.className='kname'; nm.textContent=KEYMAP_LABEL[a];
    const btn = document.createElement('button'); btn.className='kkey';
    btn.textContent = (remapAction===a) ? '按下按键…' : keyName(keymap[a]);
    if(remapAction===a) btn.classList.add('wait');
    btn.addEventListener('click', ev=>{ ev.stopPropagation(); beginRemap(a); });
    row.appendChild(nm); row.appendChild(btn); box.appendChild(row);
  }
}
function openKeyPanel(){ remapAction=null; renderKeyList(); el('keyPanel').classList.remove('hide'); }
function closeKeyPanel(){ remapAction=null; el('keyPanel').classList.add('hide'); }

/* ================= B. 手指键位（触屏布局） ================= */
const TOUCH_IDS = ['joystick','btnFire','btnReload','btnSwitch','btnUp','btnDown',
  'btnCrouch','btnJump','btnRecon','btnKami','btnMark','btnChat','btnBoard'];
const LS_LAYOUT = 'csTouchLayout';
var layoutEditing = false;      // var：phone.js 先加载，事件回调里访问更安全
let layoutDirty = false;
let touchLayout = null;         // { id: {l:0~1, t:0~1} } 相对视口比例
try{ const s=localStorage.getItem(LS_LAYOUT); if(s) touchLayout=JSON.parse(s); }catch(e){ touchLayout=null; }

// 测量当前所有触屏元素位置（默认布局来自 CSS，需临时强制可见）
function measureLayout(){
  const b=document.body, hadPhone=b.classList.contains('phone'), hadEdit=b.classList.contains('layoutedit');
  b.classList.add('phone','layoutedit');
  const W=innerWidth||1, H=innerHeight||1, o={};
  for(const id of TOUCH_IDS){
    const e2=el(id); if(!e2) continue;
    const r=e2.getBoundingClientRect();
    o[id]={ l:r.left/W, t:r.top/H };
  }
  if(!hadPhone) b.classList.remove('phone');
  if(!hadEdit)  b.classList.remove('layoutedit');
  return o;
}
function applyTouchLayout(){
  if(!touchLayout) return;
  const W=innerWidth, H=innerHeight;
  for(const id of TOUCH_IDS){
    const p=touchLayout[id], e2=el(id); if(!p||!e2) continue;
    e2.style.right='auto'; e2.style.bottom='auto';
    e2.style.left = Math.round(p.l*W)+'px';
    e2.style.top  = Math.round(p.t*H)+'px';
  }
}
function saveTouchLayout(){
  touchLayout = measureLayout();
  try{ localStorage.setItem(LS_LAYOUT, JSON.stringify(touchLayout)); }catch(e){}
  layoutDirty = false;
  toast('👆 手指键位已保存（本机浏览器）');
}
function resetTouchLayout(){
  try{ localStorage.removeItem(LS_LAYOUT); }catch(e){}
  touchLayout = null; layoutDirty = false;
  for(const id of TOUCH_IDS){
    const e2=el(id); if(!e2) continue;
    e2.style.left=''; e2.style.top=''; e2.style.right=''; e2.style.bottom='';
  }
  toast('手指键位已恢复默认');
}

/* ---------- B2. 拖拽（Pointer Events，鼠标 / 触屏通用） ---------- */
function bindLayoutDrag(){
  for(const id of TOUCH_IDS){
    const e2 = el(id); if(!e2) continue;
    e2.addEventListener('pointerdown', ev=>{
      if(!layoutEditing) return;
      ev.preventDefault(); ev.stopPropagation();
      const r0 = e2.getBoundingClientRect();
      const ox = ev.clientX-r0.left, oy = ev.clientY-r0.top;
      const w  = r0.width||1,        h  = r0.height||1;
      e2.classList.add('dragging');
      try{ e2.setPointerCapture(ev.pointerId); }catch(_){}
      const onMove = mv=>{
        let nx = mv.clientX-ox, ny = mv.clientY-oy;
        nx = Math.max(0, Math.min(innerWidth -w, nx));
        ny = Math.max(0, Math.min(innerHeight-h, ny));
        e2.style.left=nx+'px'; e2.style.top=ny+'px';
        e2.style.right='auto'; e2.style.bottom='auto';
        layoutDirty = true;
      };
      const onUp = ()=>{
        e2.classList.remove('dragging');
        try{ e2.releasePointerCapture(ev.pointerId); }catch(_){}
        e2.removeEventListener('pointermove', onMove);
        e2.removeEventListener('pointerup', onUp);
        e2.removeEventListener('pointercancel', onUp);
      };
      e2.addEventListener('pointermove', onMove);
      e2.addEventListener('pointerup', onUp);
      e2.addEventListener('pointercancel', onUp);
    });
  }
}

/* ---------- B3. 编辑态开关（在 DEBUG 沙盒地图里改） ---------- */
function startLayoutEdit(){
  if(typeof sceneReady!=='undefined' && !sceneReady){ toast('资源加载中…'); return; }
  const panel = el('pause'); if(panel) panel.classList.add('hide');
  if(typeof paused!=='undefined') paused = false;
  layoutEditing = true; layoutDirty = false;
  document.body.classList.add('layoutedit');
  if(typeof debugMode!=='undefined' && !debugMode) enterDebug();   // 空地图编辑，不会被打
  el('layoutBar').classList.remove('hide');
  if(document.pointerLockElement) document.exitPointerLock();      // 桌面端拖按钮需先释放鼠标
  applyTouchLayout();
  toast('👆 编辑手指键位：拖动按键 → 点「保存」');
}
function stopLayoutEdit(){
  if(layoutDirty) saveTouchLayout();
  layoutEditing = false;
  document.body.classList.remove('layoutedit');
  el('layoutBar').classList.add('hide');
  if(!isPhone){ try{ cv.requestPointerLock(); }catch(e){} }
}

/* ---------- B4. 初始化 ---------- */
applyTouchLayout();
bindLayoutDrag();
window.addEventListener('resize', applyTouchLayout);

/* ================= C. 瞄准格式（准星样式） ================= */
const CROSS_OPTS = [ ['ten','十'],['x','Ⅹ'],['angle','><'],['box','[]'],['dot','·'] ];
const LS_CROSS = 'csCross';
function crossBtnId(v){ return 'cross' + v.charAt(0).toUpperCase() + v.slice(1); }   // ten→crossTen …
function applyCross(){
  const ch = el('crosshair'); if(!ch) return;
  let v = CROSS_OPTS[0][0];
  try{ const s = localStorage.getItem(LS_CROSS); if(s) v = s; }catch(e){}
  ch.dataset.cross = v; renderCrossSel();
}
function setCross(v){
  const ch = el('crosshair'); if(!ch) return;
  ch.dataset.cross = v;
  try{ localStorage.setItem(LS_CROSS, v); }catch(e){}
  renderCrossSel();
  toast('瞄准格式 → '+v);
}
function renderCrossSel(){
  let cur = CROSS_OPTS[0][0];
  const ch = el('crosshair'); if(ch && ch.dataset.cross) cur = ch.dataset.cross;
  for(const [v] of CROSS_OPTS){ const b = el(crossBtnId(v)); if(b) b.classList.toggle('sel', v===cur); }
}
applyCross();

// 暂停界面入口
(function(){
  const kb = el('keyMapBtn'); if(kb) kb.addEventListener('click', e=>{ e.stopPropagation(); openKeyPanel(); });
  const lb = el('layoutBtn'); if(lb) lb.addEventListener('click', e=>{ e.stopPropagation(); startLayoutEdit(); });
  const kc = el('keyClose');  if(kc) kc.addEventListener('click', e=>{ e.stopPropagation(); closeKeyPanel(); });
  const kr = el('keyReset');  if(kr) kr.addEventListener('click', e=>{ e.stopPropagation(); resetKeymap(); });
  const ls = el('layoutSave');  if(ls) ls.addEventListener('click', e=>{ e.stopPropagation(); saveTouchLayout(); });
  const lr = el('layoutReset'); if(lr) lr.addEventListener('click', e=>{ e.stopPropagation(); resetTouchLayout(); });
  const ld = el('layoutDone');  if(ld) ld.addEventListener('click', e=>{ e.stopPropagation(); stopLayoutEdit(); });
  for(const [v] of CROSS_OPTS){
    const cb = el(crossBtnId(v));
    if(cb) cb.addEventListener('click', e=>{ e.stopPropagation(); setCross(v); });
  }
  // 键位面板：点空白处关闭
  const kp = el('keyPanel');
  if(kp) kp.addEventListener('click', e=>{ if(e.target===kp) closeKeyPanel(); });
})();
