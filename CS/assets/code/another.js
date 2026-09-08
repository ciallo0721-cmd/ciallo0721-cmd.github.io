"use strict";
/* ============================================================
   CS · another.js — 提示 / UI HTML 注入 / HUD
   （所有界面 DOM、toast 提示、HUD 刷新）
   ============================================================ */

/* ---------- 0. 注入全部 UI HTML（提示、HUD、遮罩等） ---------- */
const UI_HTML = `
<div id="grain"></div>
<div id="scope"></div>   <!-- 狙击枪瞄准镜遮罩（仅装备狙击时显示） -->

<div id="hud">
  <div id="crosshair"></div>
  <div id="topbar"><span class="b" id="blueScore">蓝 0</span> &nbsp;:&nbsp; <span class="r" id="redScore">红 0</span></div>
  <div id="cheats"></div>
  <div id="god">★ 无敌模式 ★</div>
  <div id="topbtns">
    <button id="shareBtn" title="分享">🔗</button>
    <button id="pauseBtn" title="暂停(Esc)">⏸</button>
  </div>
  <div id="keyhelp">
    Power by ciallo0721-cmd<br>
    未经许可,请勿转载或用于商业用途<br>
    键盘：WASD 移动，Shift 跑步，鼠标看视角，空格 跳，C 蹲，左键开枪，R 换弹，F 换枪，E 救队友/下包/拆包，Q 标点，T 聊天（@队友名 派TA去标记点），1 侦查 2 自爆，/ 排行榜，Esc/\` 暂停设置<br>
    手机：左摇杆移动，右侧三键操作，拖拽屏幕看视角，下方有侦查/自爆按钮
  </div>
  <div id="bottomleft">
    血量 <span id="hp">100</span>
    <div id="hpbar"><div id="hpfill"></div></div>
  </div>
  <div id="bottomright">
    <div id="weapon">AK47</div>
    <div id="ammo">30 / 30</div>
    <div id="nade">雷 x2</div>
    <div id="bombInfo" class="inf">—</div>
    <div id="skillInfo" class="inf">侦察1 自爆2</div>
  </div>
  <div id="toast"></div>
  <!-- DEBUG 沙盒控制面板（默认隐藏，进 DEBUG 后显示；手机/桌面均可点） -->
  <div id="dbgHud" class="hide">
    <h3>🐞 DEBUG 沙盒</h3>
    <div class="hint">键：;红方 '队友 .红倒 ,蓝倒 -外挂 Y胜 N败 H急救包<br>按钮同功能，手机端可用</div>
    <button id="dbgSpawnRed">召唤红方（敌）</button>
    <button id="dbgSpawnBlue">召唤队友（蓝）</button>
    <button id="dbgDownRed">红方击倒</button>
    <button id="dbgDownBlue">队友/我击倒</button>
    <button id="dbgGod">飞天+无限弹+100血</button>
    <button id="dbgSwitch">换枪（AK47）</button>
    <button id="dbgMed">面前生成急救包</button>
    <button id="dbgWin">直接胜利</button>
    <button id="dbgLose">直接失败</button>
    <button id="dbgExit" class="exit">退出 DEBUG</button>
  </div>
  <div id="viewgun">
    <svg viewBox="0 0 140 70" width="170" height="85">
      <g stroke="#14141f" stroke-width="1.5">
        <rect x="30" y="34" width="100" height="13" rx="3" fill="#41415a"/>
        <rect x="22" y="24" width="26" height="13" rx="2" fill="#4d4d66"/>
        <rect x="8" y="30" width="18" height="19" rx="2" fill="#2b2b3d"/>
        <rect x="52" y="47" width="36" height="15" rx="2" fill="#3a3a52"/>
        <rect x="96" y="27" width="13" height="7" rx="2" fill="#6a6a88"/>
        <rect x="118" y="30" width="8" height="20" rx="2" fill="#33334a"/>
      </g>
    </svg>
    <div id="viewgunName">AK47</div>
  </div>
  <div id="scoreboard" class="hide"></div>
  <canvas id="minimap" width="156" height="156"></canvas>
  <div id="chatbox"></div>
  <div id="killfeed"></div>
</div>

<div id="touch">
  <div id="look"></div>
  <div id="joystick"><div id="joybase"></div><div id="stick"></div></div>
  <div id="btnFire" class="tbtn">开枪</div>
  <div id="btnReload" class="tbtn">换弹</div>
  <div id="btnSwitch" class="tbtn">换枪</div>
  <div id="btnUp" class="tbtn flybtn">飞↑</div>
  <div id="btnDown" class="tbtn flybtn">飞↓</div>
  <div id="btnCrouch" class="tbtn">蹲</div>
  <div id="btnJump" class="tbtn">跳</div>
  <div id="btnRecon" class="tbtn">侦察</div>
  <div id="btnKami" class="tbtn">自爆</div>
  <div id="btnMark" class="tbtn">标点</div>
  <div id="btnChat" class="tbtn">聊天</div>
  <div id="btnBoard" class="tbtn">排行</div>
</div>

<!-- 聊天输入条（T 唤起 / 手机「聊天」按钮） -->
<div id="chatInputBar" class="hide">
  <span>聊天</span>
  <input id="chatInput" type="text" maxlength="40" placeholder="说话…或 @队友名 派TA去标记点">
  <button id="chatSend">发送</button>
</div>

<!-- 开始界面 -->
<div id="overlay" class="overlay">
  <h1>12队大乱斗 fyGrid</h1>
  <p>你属于<b style="color:#5aa6ff">蓝队</b>，场上共 <b>12 队 × 5 人 = 60 人</b>混战（红橙黄绿青蓝紫…）。
     600m × 600m 大战场，中央有 100m 三层大楼（坡道上楼、箱子补给），全图 30+ 栋功能楼。<br>
      每队有 1~5 名<b style="color:#ffd86a">超级AI</b>（Q-learning 驱动）；50% 的 AI 爱往中央大楼跑。?bomb=1 开启下包系统。<br>
      桌面：WASD+鼠标+空格跳+C蹲，点击锁定指针。手机：左摇杆移动，右侧三键操作。<br>
      击倒≠死亡：倒地可爬行等队友救（按住 E 救队友，救人时不能开枪），一方全员倒地即分胜负；场地有医疗箱可回血。<br>
      <b style="color:#ffd86a">Shift 跑步</b> · 左下角<b style="color:#ffd86a">小地图</b>看队友位置 · <b style="color:#ffd86a">Q 标点</b>后在聊天里 @队友名 可指挥TA前往标记点（超级AI也听令）· AI 会不定时在左上发聊天。</p>
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
  <div class="row">渲染后端
    <button id="renderBackendBtn" style="background:none;border:1px solid #5aa6ff;color:#5aa6ff;border-radius:6px;padding:2px 10px;cursor:pointer;"></button>
    <span style="opacity:.65;font-size:12px;margin-left:6px;">OpenGL系=WebGL · Vulkan系=WebGPU · 不支持自动回退</span>
  </div>
  <div class="row">画面风格
    <button id="shaderStyleBtn" style="background:none;border:1px solid #5aa6ff;color:#5aa6ff;border-radius:6px;padding:2px 10px;cursor:pointer;"></button>
    <span style="opacity:.65;font-size:12px;margin-left:6px;">仅 OpenGL系(WebGL) 下生效（GLSL 着色器）</span>
  </div>
  <div class="row">纹理来源
    <button id="texModeBtn" style="background:none;border:1px solid #5aa6ff;color:#5aa6ff;border-radius:6px;padding:2px 10px;cursor:pointer;"></button>
    <span style="opacity:.65;font-size:12px;margin-left:6px;">切换后自动重开</span>
  </div>
  <div class="row">操作自定义
    <button id="keyMapBtn" class="setbtn" title="改键盘键位">⌨ 键盘键位</button>
    <button id="layoutBtn" class="setbtn" title="拖动摆放触屏按键">👆 手指键位</button>
  </div>
  <div class="row">瞄准格式
    <button id="crossTen"   class="setbtn crossbtn">十</button>
    <button id="crossX"     class="setbtn crossbtn">Ⅹ</button>
    <button id="crossAngle" class="setbtn crossbtn">&gt;&lt;</button>
    <button id="crossBox"   class="setbtn crossbtn">[]</button>
    <button id="crossDot"   class="setbtn crossbtn">·</button>
  </div>
  <div class="cheats" id="cheatsPause"></div>
  <div class="start" id="resumeBtn">继续</div>
  <div class="start" id="shareBtn2" style="border-color:#5aa6ff;color:#5aa6ff;">分享链接</div>
  <div class="start" id="quitBtn" style="border-color:#ff6a6a;color:#ff6a6a;">返回开始界面</div>
</div>

<!-- 胜负结算 -->
<div id="victory" class="overlay hide">
  <h1 id="victoryTitle">🎉 胜利！</h1>
  <p id="victorySub">红方获胜 · 对方全员倒地</p>
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

<!-- 竖屏提示：手机端未横屏时强制提示（点击无操作，需物理旋转） -->
<div id="rotateHint" class="overlay hide">
  <div style="font-size:56px;line-height:1;">🔄</div>
  <h1>请横屏游玩</h1>
  <p>将手机旋转到<b style="color:#5aa6ff">横屏</b>方向，<br>获得更舒服的 FPS 操作体验喵~</p>
</div>`;
function buildUI(){ document.body.insertAdjacentHTML('beforeend', UI_HTML); }
buildUI();

/* ---------- 1. HUD / 提示 ---------- */
let toastTimer=null;
function toast(msg){ const t=el('toast'); t.textContent=msg; t.style.opacity=1; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{t.style.opacity=0;},1400); }
function updateHUD(){
  if(!player||!sceneReady) return;
  const hp=Math.max(0,Math.min(200,player.hp));
  el('hp').textContent=Math.round(hp); el('hpfill').style.width=Math.min(100,hp)+'%';
  const w=WEAPONS[curWeapon];
  if(!w || !player.ammo[curWeapon]) return;   // 武器表被热替换时弹药可能对不上，别把 HUD 搞崩
  el('weapon').textContent=w.name;
  const ds=el('dbgSwitch'); if(ds) ds.textContent='换枪（'+w.name+'）';
  if(curWeapon==='grenade') el('ammo').textContent = infiniteAmmo?'∞':('x'+player.ammo.grenade);
  else if(w.melee) el('ammo').textContent = '近战';
  else el('ammo').textContent = infiniteAmmo?'∞':(player.ammo[curWeapon].m+'/'+player.ammo[curWeapon].r);
  el('nade').textContent = '雷 '+(infiniteAmmo?'∞':('x'+player.ammo.grenade));
  const role = bombRoleOf(player.team);
  if(!BOMB_ENABLED){
    el('bombInfo').textContent='下包系统关闭（?bomb=1 开启）';
  } else if(bomb.planted){
    const left=Math.max(0,Math.ceil(bomb.timer));
    el('bombInfo').textContent='💣 C4['+bomb.site+'] '+left+'s'+(bomb.defuseT>0?(' 拆'+Math.floor(bomb.defuseT/DEFUSE_TIME*100)+'%'):'');
  } else if(role==='T'){
    el('bombInfo').textContent='第'+roundNum+'把 · 携带C4 → 走到 A/B 点按 E 下包';
  } else {
    el('bombInfo').textContent='第'+roundNum+'把 · 靠近 C4 按 E 拆包';
  }
  el('skillInfo').textContent='侦察1['+(reconCd>0?Math.ceil(reconCd)+'s':'就绪')+'] 自爆2['+(kamikazeCd>0?Math.ceil(kamikazeCd)+'s':'就绪')+']';
  // 12队积分：显示我方排名 + 榜首
  if(typeof TEAMS!=='undefined' && playerTeam){
    const rank=TEAMS.map(t=>({id:t.id,s:teamScores[t.id]||0})).sort((a,b)=>b.s-a.s);
    const myRank=rank.findIndex(r=>r.id===playerTeam)+1;
    el('blueScore').textContent='我方'+teamName(playerTeam)+'队 '+myRank+'/12';
    el('redScore').textContent='榜首 '+teamName(rank[0].id)+' '+rank[0].s+'分';
  }
  const vg=el('viewgun'); if(vg){ vg.style.opacity=(player.downed||!player.alive)?0:1; const vn=el('viewgunName'); if(vn)vn.textContent=w.name; }
  // 秘籍状态条已隐藏（仅 README 记录，不在游戏内透露）
}
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
// 对局内排行榜：按 score 降序，显示名次 / 英文名 / 击杀-死亡 / 得分；头部带「第 X 把」（roundNum 持续累加）
function renderScoreboard(){
  const sb=el('scoreboard'); if(!sb) return;
  if(sb.classList.contains('hide')) return;   // 排行榜没收起就不重建（60人时每次击杀重建 innerHTML 很贵）
  const rows=characters.slice().sort((a,b)=>(b.score||0)-(a.score||0));
  if(!rows.length){ sb.innerHTML='<div class="sbHead">🏆 排行榜</div><div class="sbEmpty">暂无数据</div>'; return; }
  let h='<div class="sbHead">🏆 排行榜 · 第 '+roundNum+' 把 <span class="sbHint">按 / 关闭</span></div>';
  rows.forEach((c,i)=>{
    const me=c.isPlayer?' sbMe':'';
    h+='<div class="sbRow'+me+'">'
      +'<span class="sbRank">'+(i+1)+'</span>'
      +'<span class="sbName" style="color:'+teamCSS(c.team)+'">'+teamName(c.team)+'·'+escapeHtml(c.name)+'</span>'
      +'<span class="sbKD">'+(c.kills||0)+' / '+(c.deaths||0)+'</span>'
      +'<span class="sbScore">'+(c.score||0)+'</span></div>';
  });
  sb.innerHTML=h;
}
