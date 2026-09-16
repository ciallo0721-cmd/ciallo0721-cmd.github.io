"use strict";
/* ============================================================
   HRAI · another.js — 提示 / UI HTML 注入 / HUD（恐怖逃生版）
   （所有界面 DOM、toast 提示、HUD 刷新）
   ============================================================ */

/* ---------- 0. 注入全部 UI HTML（提示、HUD、遮罩等） ---------- */
const UI_HTML = `
<div id="grain"></div>

<div id="hud">
  <div id="topbar"><span class="k" id="keyCount">🔑 0 / 20</span><span class="sep">│</span><span id="objText">收集 20 把钥匙</span></div>
  <div id="topbtns">
    <button id="shareBtn" title="分享">🔗</button>
    <button id="pauseBtn" title="暂停(Esc)">⏸</button>
  </div>
  <div id="keyhelp">
    Power by ciallo0721-cmd<br>
    未经许可,请勿转载或用于商业用途<br>
    键盘：WASD 移动，鼠标看视角，空格 跳，C 蹲，E 收集 / 合成 / 开门，Esc/\` 暂停设置<br>
    手机：左摇杆移动，蹲/跳按钮，拖拽屏幕看视角，靠近钥匙盒自动收集
  </div>
  <div id="bottomleft">
    血量 <span id="hp">100</span>
    <div id="hpbar"><div id="hpfill"></div></div>
  </div>
  <!-- 交互进度条（收集钥匙盒 / 合成大钥匙共用） -->
  <div id="bottomcenter" class="hide">
    <div id="interTxt">正在开启钥匙盒…</div>
    <div id="interBar"><div id="interFill"></div></div>
  </div>
  <div id="bottomright">
    <div id="objState">🔑 收集钥匙 0/20</div>
    <div id="crowbarTag" class="hide">🔧 撬棍 · 开锁+20%</div>
    <div id="rushTag" class="hide">⚠️ 它加速了！！</div>
  </div>
  <div id="toast"></div>
</div>

<div id="touch">
  <div id="look"></div>
  <div id="joystick"><div id="joybase"></div><div id="stick"></div></div>
  <div id="btnUse" class="tbtn">使用</div>
  <div id="btnCrouch" class="tbtn">蹲</div>
  <div id="btnJump" class="tbtn">跳</div>
</div>

<!-- 开始界面 -->
<div id="overlay" class="overlay">
  <h1>HRAI · Horror AI 恐怖逃生</h1>
  <p>你被困在这座黑暗的冰封竞技场里，浓雾吞没了视野。<br>
     <b style="color:#ff5555">「它」</b>拿着小刀在雾中游荡——被追上就是一刀终结（伤害 200）。<br><br>
     唯一生路：收集散落在全场的 <b style="color:#ffd86a">20 把钥匙</b>（前 5 把直接收，之后等 5~30 秒，离开进度保留），<br>
     去右侧房屋的<b style="color:#7fd0ff">合成台</b>合成<b style="color:#7fd0ff">大钥匙</b>，然后穿过「它」出生区后方的大门逃出去！<br>
     ⚠️ 当只剩 3 把钥匙时，「它」会陷入狂暴加速。<br><br>
     桌面：WASD+鼠标+空格跳+C蹲，按 E 交互。手机：左摇杆移动，蹲/跳/使用按钮，靠近目标点「使用」。</p>
  <div id="modeRow">当前设备模式：<span id="modeLabel">桌面</span>
    <button id="modeBtn">切换为手机</button></div>
  <div class="start" id="startBtn">点击开始</div>
</div>

<!-- 暂停界面 -->
<div id="pause" class="overlay hide">
  <h1>暂停</h1>
  <div class="row">鼠标灵敏度
    <input type="range" id="sens" min="0.5" max="5" step="0.1" value="2.4">
    <span id="sensVal">2.4</span>
  </div>
  <div class="row">操作自定义
    <button id="keyMapBtn" class="setbtn" title="改键盘键位">⌨ 键盘键位</button>
    <button id="layoutBtn" class="setbtn" title="拖动摆放触屏按键">👆 手指键位</button>
  </div>
  <div class="start" id="resumeBtn">继续</div>
  <div class="start" id="shareBtn2" style="border-color:#5aa6ff;color:#5aa6ff;">分享链接</div>
  <div class="start hide" id="fsExitBtn" style="border-color:#8b949e;color:#8b949e;">取消全屏</div>
  <div class="start" id="quitBtn" style="border-color:#ff6a6a;color:#ff6a6a;">返回开始界面</div>
</div>

<!-- 胜负结算 -->
<div id="victory" class="overlay hide">
  <h1 id="victoryTitle">🎉 胜利！</h1>
  <p id="victorySub">你逃出去了</p>
  <div class="start" id="againBtn">再来一局</div>
</div>

<!-- 键盘键位设置面板 -->
<div id="keyPanel" class="overlay hide">
  <h1>⌨ 键盘键位</h1>
  <p class="tip">点右侧按键 → 再按下想绑定的新键（Esc 取消）<br>与已有键位冲突时会自动交换 · 保存在本机浏览器</p>
  <div id="keyList"></div>
  <div class="panelBtns">
    <button id="keyReset" class="pbtn warn">恢复默认</button>
    <button id="keyClose" class="pbtn">完成</button>
  </div>
</div>

<!-- 手指键位（触屏布局）编辑工具条 -->
<div id="layoutBar" class="hide">
  <span>👆 拖动按键到任意位置</span>
  <button id="layoutSave" class="lbtn ok">💾 保存</button>
  <button id="layoutReset" class="lbtn">↺ 恢复默认</button>
  <button id="layoutDone" class="lbtn">✔ 完成</button>
</div>

<!-- 竖屏提示：手机端未横屏时强制提示 -->
<div id="rotateHint" class="overlay hide">
  <div style="font-size:56px;line-height:1;">🔄</div>
  <h1>请横屏游玩</h1>
  <p>将手机旋转到<b style="color:#5aa6ff">横屏</b>方向，<br>获得更舒服的逃生体验喵~</p>
</div>`;
function buildUI(){ document.body.insertAdjacentHTML('beforeend', UI_HTML); }
buildUI();

/* ---------- 1. HUD / 提示 ---------- */
let toastTimer=null;
function toast(msg){ const t=el('toast'); t.textContent=msg; t.style.opacity=1; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{t.style.opacity=0;},1800); }
// 交互进度条：show=true 显示，txt 说明文字，pct 0~1
function updateInter(show, txt, pct){
  const box=el('bottomcenter'); if(!box) return;
  if(!show){ box.classList.add('hide'); return; }
  box.classList.remove('hide');
  if(txt!==undefined) el('interTxt').textContent=txt;
  el('interFill').style.width=Math.round(Math.max(0,Math.min(1,pct||0))*100)+'%';
}
function updateHUD(){
  if(!player||!sceneReady) return;
  const hp=Math.max(0,Math.min(200,player.hp));
  el('hp').textContent=Math.round(hp); el('hpfill').style.width=Math.min(100,hp)+'%';
  el('keyCount').textContent='🔑 '+keysCollected+' / '+TOTAL_KEYS;
  // 目标状态文案
  let obj='';
  if(keysCollected>=TOTAL_KEYS){
    obj = bigKey ? '🗝️ 大钥匙已合成 → 大门已解锁' : '🗝️ 钥匙集齐 → 去右侧房屋合成台合成大钥匙';
  } else if(keysCollected===0){
    obj = '收集 20 把钥匙（靠近按 E）';
  } else {
    obj = '收集钥匙 · 还剩 '+(TOTAL_KEYS-keysCollected)+' 把';
  }
  el('objText').textContent=obj;
  el('objState').textContent=obj;
  // 撬棍状态
  const ct=el('crowbarTag');
  if(ct) ct.classList.toggle('hide', !crowbar);
  // 狂暴提示
  const rt=el('rushTag');
  if(rt){ if(rush && keysCollected<TOTAL_KEYS) rt.classList.remove('hide'); else rt.classList.add('hide'); }
}
