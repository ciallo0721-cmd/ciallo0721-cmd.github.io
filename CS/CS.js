"use strict";
/* ============================================================
   CS · CS.js — 游戏主逻辑（场景 / 角色 / 控制 / 主循环 / 彩蛋）
   资源与模块：
     assets/screen/*.svg     方块纹理（着色器渲染）
     assets/sound/*.wav      音效
     assets/Shader/Shader.js 着色器材质
     assets/code/*.js        各功能模块
   ============================================================ */

/* ---------- 0. 全局配置 & 秘籍参数 ---------- */
// 中型战场地图：600m × 600m，12 队 × 5 人 = 60 人混战
const MAP = 600, HALF = MAP/2;
let RES_SCALE = 0.5;
const BASE_SCALE = RES_SCALE;   // 自适应分辨率的上限（只降不升破基线）
const EYE = 1.6;
const JUMP_V = 7, GRAVITY = 22;   // 跳跃初速 / 重力加速度（蹲跳系统）

const params = new URLSearchParams(location.search);
// —— 下包系统：?bomb=1 开启（12队模式默认关闭）——
const BOMB_ENABLED = params.get('bomb') === '1';

/* —— 12 支队伍（红橙黄绿青蓝紫 + 5 个补充色），每队 5 人，玩家是蓝队队长 —— */
const TEAMS = [
  {id:'blue',  name:'蓝',  hex:0x3a7bd5},
  {id:'red',   name:'红',  hex:0xd53a3a},
  {id:'orange',name:'橙',  hex:0xf09030},
  {id:'yellow',name:'黄',  hex:0xe8d030},
  {id:'green', name:'绿',  hex:0x3aad5a},
  {id:'cyan',  name:'青',  hex:0x30b8c8},
  {id:'purple',name:'紫',  hex:0x9a50d0},
  {id:'pink',  name:'粉',  hex:0xe87ab0},
  {id:'brown', name:'棕',  hex:0x9a6a40},
  {id:'gray',  name:'灰',  hex:0x888898},
  {id:'gold',  name:'金',  hex:0xd8b028},
  {id:'lime',  name:'青柠',hex:0xa8d030}
];
const TEAM_IDX = {}; TEAMS.forEach((t,i)=>TEAM_IDX[t.id]=i);
function teamName(id){ return (TEAMS[TEAM_IDX[id]]||TEAMS[0]).name; }
function teamCSS(id){ return '#'+((TEAMS[TEAM_IDX[id]]||TEAMS[0]).hex+0x1000000).toString(16).slice(1); }
let teamScores = {};   // 每队积分
function addScore(team,n){ teamScores[team]=(teamScores[team]||0)+n; }
// —— 秘籍 ——
let imagod        = params.get('imagod') === '1';          // 外挂全开：无敌+无限子弹+飞天
let fireinthehole = params.get('fireinthehole') === '1';   // 无限子弹
let chinesecanfly = params.get('chinesecanfly') === '1';   // 飞天
const pvp           = params.get('pvp') === '1';             // 1v5（无队友）
const tryMode       = params.get('try') === '1';             // 5v1（敌仅1）
let gztfxxm       = params.get('gztfxxm') === '1';          // 核弹（按 0），慎用
const hospitalParam = params.get('hospital');
let sorry         = params.get('sorry') === '1';           // 可误伤友军（打队友）
const spy           = params.get('spy') === '1';             // 玩家变红方（间谍）
let hospitalVal   = (hospitalParam!==null && !isNaN(Number(hospitalParam))) ? Number(hospitalParam) : 0; // 无敌血量

// 渲染分辨率缩放：核显/弱机优先流畅。默认 0.5；?high=1 回 0.75；?low=1 极限 0.45；自动检测 2 核/<=2G 也降
{ const _lp=params.get('low'), _hp=params.get('high');
  if(_hp==='1') RES_SCALE=0.75; else if(_lp==='1') RES_SCALE=0.45;
  else if((navigator.hardwareConcurrency||4)<=2 || (navigator.deviceMemory||8)<=2) RES_SCALE=0.5; }

let infiniteAmmo = fireinthehole || imagod;
let flyEnabled   = chinesecanfly || imagod;

// DEBUG 沙盒模式：点开始界面「.」10 下进入；空地图、可手动召唤/击倒单位、触发胜负
let debugMode = false;
let debugGodOn = false;

// 全局游戏状态
let running = false;        // 游戏进行中
let revivingNow = false;    // 玩家正在救人（此时不能开枪）
let sceneReady = false;     // 场景资源（SVG 纹理）加载完成
let matchOver=false;
const keys = {};

// 公共 DOM 简写（供所有模块使用）
function el(id){ return document.getElementById(id); }

/* ---------- 1. 场景 / 相机 / 渲染器 ---------- */
const container = document.getElementById('game');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb8d8);
scene.fog = new THREE.Fog(0x9fb8d8, 100, 700);   // 600m 地图：雾随地图收窄，远处融入天色
const camera = new THREE.PerspectiveCamera(78, window.innerWidth/window.innerHeight, 0.1, 1600);
camera.rotation.order = 'YXZ';

/* —— 渲染后端检测（暂停菜单可切换）——
   webgl  = WebGL（= Web 上的 OpenGL，基于 OpenGL ES）→ 自定义 GLSL 着色器
   three  = three.js 标准材质管线（MeshStandardMaterial PBR）
   webgpu = WebGPU（= Web 上的 Vulkan，基于 Vulkan/Metal/D3D12 模型）
            注意：本地引擎文件是 three r128，未内置 WebGPURenderer；
            检测不到时自动回退 webgl 并提示——以后换成 r167+ 引擎文件即可直接生效。
            WebGPU 不跑 GLSL ShaderMaterial（用 WGSL），因此该后端统一用标准材质。 */
function detectBackend(){
  const saved = localStorage.getItem('csRenderBackend') || 'auto';
  const webgpuOK = !!(navigator.gpu && typeof THREE.WebGPURenderer === 'function');
  if(saved === 'auto') return webgpuOK ? 'webgpu' : 'webgl';
  if(saved === 'webgpu' && !webgpuOK){
    setTimeout(()=>toast && toast('本机或引擎(r128)不支持 WebGPU(Vulkan系)，已回退 WebGL(OpenGL系)'), 2500);
    return 'webgl';
  }
  return saved;
}
const RENDER_BACKEND = detectBackend();
// 画面风格（仅 webgl 系后端生效）：mosaic 程序化马赛克 / toon 卡通 / crt 扫描线
const SHADER_STYLE = ['mosaic','toon','crt'].indexOf(localStorage.getItem('csShaderStyle'))>=0
  ? localStorage.getItem('csShaderStyle') : 'mosaic';
// 兼容旧 csShaderMode 存档：three → 渲染后端 three
if(localStorage.getItem('csShaderMode')==='three' && localStorage.getItem('csRenderBackend')===null){
  localStorage.setItem('csRenderBackend','three');
}

let renderer = null;
if(RENDER_BACKEND === 'webgpu'){
  try{
    renderer = new THREE.WebGPURenderer({antialias:false});
    if(renderer.init) renderer.init().catch(()=>{});   // WebGPU 异步初始化
  }catch(e){ /* 回退在下方 */ }
}
if(!renderer) renderer = new THREE.WebGLRenderer({antialias:false});
renderer.setClearColor(0x9ec8e8); // 天空蓝背景（避免围墙背面剔除后露出纯黑）
renderer.setClearColor(0x9fc5e8, 1.0);  // 天空浅蓝（围墙背面被剔除时背景不会黑）
renderer.setPixelRatio(1);
renderer.setSize(Math.floor(window.innerWidth*RES_SCALE), Math.floor(window.innerHeight*RES_SCALE), false);
container.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6); dirLight.position.set(20,40,10); scene.add(dirLight);
const cv = renderer.domElement;
function applyResSize(){
  camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(Math.floor(window.innerWidth*RES_SCALE), Math.floor(window.innerHeight*RES_SCALE), false);
  if(typeof syncShaderRes === 'function') syncShaderRes(renderer.domElement.width, renderer.domElement.height);
}

/* ---------- 2. 方块纹理（加载 assets/screen 下的 SVG，着色器渲染） ---------- */
function makeSVGTexture(t){
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter;
  t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
function loadTex(url){ return new Promise((res,rej)=>{
  // 手动加载纹理：绕开 TextureLoader 的 CORS 请求 + 服务器非法 MIME(image/svg)问题
  // 本地 python http.server 在 Windows 下把 .svg 返回为 image/svg，Chrome 拒绝解码 → 纹理全挂
  const build = img => {
    const tex = new THREE.Texture(img);
    tex.needsUpdate = true;
    res(makeSVGTexture(tex));
  };
  // 方案1：fetch → 重制 Blob(type=image/svg+xml) → objectURL（http/https 通用，无视服务器 MIME）
  fetch(url).then(r=>r.text()).then(txt=>{
    const obj = URL.createObjectURL(new Blob([txt],{type:'image/svg+xml'}));
    const img = new Image();
    img.onload  = ()=>{ URL.revokeObjectURL(obj); build(img); };
    img.onerror = ()=>{ URL.revokeObjectURL(obj); rej(new Error('decode fail: '+url)); };
    img.src = obj;
  }).catch(()=>{
    // 方案2（file:// 等无 fetch 环境）：原生 img 直载（Chrome 按扩展名识别 svg）
    const img = new Image();
    img.onload  = ()=>build(img);
    img.onerror = ()=>rej(new Error('img fail: '+url));
    img.src = url;
  });
}); }

/* ---------- 3. 角色系统（共享材质 & 网格构造） ---------- */
// 12 队各一份共享材质（避免每角色独立材质，减少 GPU 状态切换）
const TEAM_MATS = {};
for(const t of TEAMS) TEAM_MATS[t.id] = new THREE.MeshLambertMaterial({color:t.hex});
const MAT = {
  head:   new THREE.MeshLambertMaterial({color:0xf0d8b0}),
  gun:    new THREE.MeshLambertMaterial({color:0x23232f}),
  medBox: new THREE.MeshLambertMaterial({color:0xd8e8ff}),
  cross:  new THREE.MeshLambertMaterial({color:0x39d06a}),
  bullet: new THREE.MeshLambertMaterial({color:0xff8a3a}),
  loot:   new THREE.MeshLambertMaterial({color:0xd8a838}),
};
const characters=[], hitMeshes=[], grenades=[], medkits=[];
const MEDKIT_HEAL = 60, MEDKIT_RADIUS = 1.6, MEDKIT_CD = 12;
const REVIVE_TIME = 3.2, REVIVE_RANGE = 3.2;

function makeReviveSprite(){
  const c=document.createElement('canvas'); c.width=64; c.height=10;
  const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(10,20,15,0.75)'; ctx.fillRect(0,0,64,10);
  ctx.fillStyle='#7dff9b'; ctx.fillRect(2,2,60,6);
  const tex=new THREE.CanvasTexture(c);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
  sp.scale.set(1.6,0.25,1); sp.visible=false; return sp;
}
function makeCharMesh(team){
  const g=new THREE.Group();
  const tm=TEAM_MATS[team]||TEAM_MATS.blue;
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.8,1.0,0.5), tm); body.position.y=1.0;
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),MAT.head); head.position.y=1.8;
  const tag=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.16,0.7), tm); tag.position.y=2.2;
  // 枪：身前横杆，代表枪口朝向（分辨谁在打你）
  const gun=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.12,0.14),MAT.gun);
  gun.position.set(0,1.05,0.75); gun.userData.isGun=true;
  g.add(body,head,tag,gun); return {group:g,body,head,gun};
}
function makeMarkSprite(){
  const c=document.createElement('canvas'); c.width=64; c.height=20;
  const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(255,40,40,0.9)'; ctx.beginPath(); ctx.moveTo(32,2); ctx.lineTo(58,18); ctx.lineTo(6,18); ctx.closePath(); ctx.fill();
  const tex=new THREE.CanvasTexture(c);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
  sp.scale.set(1.4,0.45,1); sp.visible=false; return sp;
}
/* ---------- 2b. 名字 / 计分（排行榜用） ---------- */
const AI_NAMES = ['雪绪','小菲','菲球','小皮','二狗','铁蛋','大锤','翠花','狗剩','阿强','阿伟','大熊','静香','胖虎','小夫','皮皮','蛋蛋','毛毛','球球','豆豆','米米','花花','果果','多多','东东','西西','南南','北北','老六','刚枪王','伏地魔','蹲坑怪','快递员','外卖员','医疗兵','狙击手','冲锋哥','苟分王','舔包怪','雷神','枪王','白给侠','送人头','战神','萌新','大佬','学妹','学长','班长','体育生','老王','大聪明','小机灵','憨憨','机灵鬼','夜猫子','早八人','摸鱼精','干饭人','小学生'];
const usedNames = new Set();
function pickAIName(){
  const free = AI_NAMES.filter(n=>!usedNames.has(n));
  const pool = free.length ? free : AI_NAMES;
  const n = pool[Math.floor(Math.random()*pool.length)];
  usedNames.add(n); return n;
}
function freeName(n){ if(n) usedNames.delete(n); }
function makeNameSprite(text, team){
  const c=document.createElement('canvas'); c.width=256; c.height=64;
  const ctx=c.getContext('2d');
  ctx.font='bold 34px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.lineWidth=5; ctx.strokeStyle='rgba(0,0,0,0.85)'; ctx.strokeText(text,128,34);
  ctx.fillStyle = teamCSS(team);
  ctx.fillText(text,128,34);
  const tex=new THREE.CanvasTexture(c);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
  sp.scale.set(2.6,0.65,1); sp.visible=true; return sp;
}
function setCharName(ch, name){
  if(!ch || !name) return;
  freeName(ch.name);
  ch.name = name; usedNames.add(name);
  if(ch.nameTag) scene.remove(ch.nameTag);
  ch.nameTag = makeNameSprite(name, ch.team); scene.add(ch.nameTag);
}
function spawnCharacter(team,isPlayer){
  const m=makeCharMesh(team); scene.add(m.group);
  const ch={team,isPlayer,alive:true,hp:100,respawn:0,group:m.group,meshes:[m.body,m.head],
    yaw:0,pitch:0,recoil:0,flyY:0,weapon:isPlayer?'ak':pickBotWeapon(),gun:m.gun,
    ammo:{}, elev:0,          // elev：当前支撑高度（大楼分层用）
    superAI:false,            // 超级AI（Q-learning 推理端）
    lovesTower:Math.random()<0.5,   // 50% 的 AI 爱往中央大楼跑
    reloading:false,reloadT:0,lastFire:0,aiState:'patrol',aiTarget:null,aiTimer:0,moveTarget:null,role:null,
    downed:false,downedT:0,reviveProg:0,reviveT:0,jumpQueued:false,vy:0,jumpY:0,grounded:true,
    slowT:0,markT:0,
    name: isPlayer?'你':pickAIName(), kills:0, deaths:0, score:0};   // 名字/击杀/死亡/得分（排行榜用）
  initAmmo(ch);
  ch.reviveBar=makeReviveSprite(); scene.add(ch.reviveBar);
  ch.mark=makeMarkSprite(); scene.add(ch.mark);
  ch.nameTag=makeNameSprite(ch.name, team); scene.add(ch.nameTag);
  m.body.userData.char=ch; m.head.userData.char=ch;
  characters.push(ch); hitMeshes.push(m.body,m.head); return ch;
}
// 弹药模型：每把枪 {m:弹匣内, r:备用弹}；手雷单独计数
function initAmmo(ch){
  // 按 assets/Guns/all.json 里实际列出来的枪逐把初始化，增删枪不用改代码
  ch.ammo = {};
  for(const w in WEAPONS){
    if(w==='grenade'){ ch.ammo.grenade = WEAPONS.grenade.mag; continue; }  // 手雷按个数计
    if(WEAPONS[w].melee) ch.ammo[w] = { m:1, r:0 };   // 近战武器（如刀）不耗弹，占位避免 HUD 出错
    else ch.ammo[w] = { m: WEAPONS[w].mag, r: WEAPONS[w].reserve };
  }
}
// bot 随机分配武器（按 all.json 里实际存在的枪来，ak/pistol 多，霰弹/RPG 少）
function pickBotWeapon(){
  const pool = ALL_WEAPONS.filter(k=>k!=='grenade' && WEAPONS[k]);
  if(!pool.length) return 'ak';
  const has = k=>pool.indexOf(k)>=0;
  const r=Math.random();
  if(has('ak')      && r<0.5)  return 'ak';
  if(has('pistol')  && r<0.72) return 'pistol';
  // 狙击枪默认 hidden：把它在 all.json 里的 "hidden" 删掉就会自动进入随机池
  if(has('shotgun') && r<0.92) return 'shotgun';
  if(has('rpg'))               return 'rpg';
  return pool[pool.length-1];
}
function placeAtSpawn(ch){
  // 12 队环形出生：每队占一个扇区，半径按地图比例（0.45×MAP），出生区互不相邻
  const ti=TEAM_IDX[ch.team]||0;
  const a=(ti/TEAMS.length)*Math.PI*2 + 0.26;
  const R=HALF*0.9;
  ch.group.position.set(Math.cos(a)*R+(Math.random()-0.5)*35, 0, Math.sin(a)*R+(Math.random()-0.5)*35);
  ch.group.rotation.y=ch.yaw; ch.group.rotation.x=0;
  ch.elev=0; ch.group.position.y=0;
}

/* ---------- 3b. 医疗箱 ---------- */
function makeMedkit(x,z){
  const g=new THREE.Group();
  const box=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.9,0.9),MAT.medBox);
  box.position.y=0.8;
  const cr1=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.26,0.26),MAT.cross); cr1.position.y=0.8;
  const cr2=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.9,0.26),MAT.cross); cr2.position.y=0.8;
  g.add(box,cr1,cr2); g.position.set(x,0,z); scene.add(g);
  medkits.push({group:g,pos:new THREE.Vector3(x,0,z),active:true,cd:0});
}

/* ---------- 4. 伤害 / 击倒 / 救援 / 胜负 ---------- */
function damage(ch,amt,attacker){
  if(!ch.alive||ch.downed) return;
  if(imagod && ch.isPlayer){ ch.hp=Math.min(200,ch.hp+amt); if(ch.isPlayer)updateHUD(); return; }
  ch.hp-=amt;
  if(ch.hp<=0){ downChar(ch,attacker); }
  else if(ch.isPlayer) updateHUD();
}
// 击倒（倒地）：可以爬行、可以被队友救，全队倒地则淘汰
function downChar(ch,attacker,boom){
  ch.alive=false; ch.downed=true; ch.downedT=0; ch.reviveProg=0;
  ch.group.rotation.x=Math.PI/2.1; ch.group.position.y=(ch.elev||0)+0.35;
  if(ch.gun) ch.gun.visible=false;
  if(ch.reviveBar){ ch.reviveBar.visible=false; }
  if(attacker&&attacker.team!==ch.team){ addScore(attacker.team,1);
    attacker.kills=(attacker.kills||0)+1; attacker.score=(attacker.score||0)+100; }
  ch.deaths=(ch.deaths||0)+1;
  if(ch.isPlayer) toast(boom?'你被炸倒了！爬向队友或等队友救援':'你被击倒了！爬向队友或等队友救援（被救前无法战斗）');
  else if(attacker&&attacker.isPlayer) toast('击倒 '+teamName(ch.team)+'队 · '+((ch.team!==attacker.team)?'敌方':'友军')+' +1');
  // —— 淘汰播报（屏幕中下方）——
  if(attacker && attacker!==ch) addKillFeed(kfName(attacker)+' <span style="color:#ff8a8a">☠</span> '+kfName(ch));
  else addKillFeed('<span style="color:#ffd86a">💥</span> '+kfName(ch));
  if(!characters.some(c=>c.team===ch.team && c.alive)) addKillFeed('🏅 <b style="color:#ffd86a">'+teamName(ch.team)+'队 全军覆没</b>');
  updateHUD(); renderScoreboard();
  checkWin();
}
// 救援
function tickRevive(dc,dt,reviver){
  if(!dc.downed) return;
  dc.reviveProg = Math.min(1, dc.reviveProg + dt/REVIVE_TIME);
  if(dc.reviveBar){
    dc.reviveBar.visible=true;
    dc.reviveBar.position.set(dc.group.position.x, 2.1, dc.group.position.z);
    dc.reviveBar.scale.x = Math.max(0.06, 1.6*dc.reviveProg);
  }
  if(dc.reviveProg>=1) reviveChar(dc,reviver);
}
function reviveChar(ch,reviver){
  ch.alive=true; ch.downed=false; ch.reviveProg=0; ch.downedT=0;
  ch.hp = (ch.isPlayer && hospitalVal>0)?hospitalVal:50;
  ch.group.rotation.x=0; ch.group.position.y=ch.elev||0;
  if(ch.gun) ch.gun.visible=true;
  if(ch.reviveBar) ch.reviveBar.visible=false;
  if(ch.isPlayer) toast('你被救起来了！血量 '+Math.round(ch.hp));
  else if(reviver&&reviver.isPlayer) toast('已救起 '+((ch.team===reviver.team)?'队友':teamName(ch.team)+'队')+' 血量 '+Math.round(ch.hp));
  updateHUD();
}
function respawnChar(ch){
  ch.alive=true; ch.downed=false; ch.reviveProg=0; ch.reviveT=0; ch.downedT=0;
  ch.hp = (ch.isPlayer && hospitalVal>0)?hospitalVal:100; ch.group.visible=!ch.isPlayer;
  initAmmo(ch);
  ch.orderGoal=null;   // 重生清空「前往标记点」指令
  ch.reloading=false; ch.reloadT=0; ch.flyY=0;
  ch.group.rotation.x=0;
  if(ch.gun) ch.gun.visible=true;
  if(ch.reviveBar) ch.reviveBar.visible=false;
  placeAtSpawn(ch); if(ch.isPlayer)updateHUD();
}
// 淘汰判定：12 队混战，只剩 ≤1 支队存活时分胜负
function teamAlive(t){ return characters.some(c=>c.team===t && c.alive); }
function checkWin(){
  if(matchOver||debugMode) return;   // DEBUG 沙盒下不自动判胜负（空场/手动单位）
  const aliveTeams=TEAMS.map(t=>t.id).filter(teamAlive);
  if(aliveTeams.length<=1){
    matchOver=true; running=false;
    const w=aliveTeams[0]||null;
    const playerWin=(w===playerTeam);
    el('victoryTitle').textContent = playerWin?'🎉 胜利！':(w?('💀 失败… '+teamName(w)+'队获胜'):'💀 全灭…');
    el('victorySub').textContent = w?(teamName(w)+'队存活到最后 · '+teamName(playerTeam)+'队已淘汰'):'场上无人生还';
    el('victory').classList.remove('hide');
    if(document.pointerLockElement===cv) document.exitPointerLock();
  }
}
function resetMatch(){
  if(debugMode){ enterDebug(); return; }   // DEBUG 下「再来一局」= 清空重开沙盒
  roundNum = roundNum + 1;
  teamScores={}; matchOver=false;
  bomb.planted=false; bomb.pos=null; bomb.timer=0; bomb.plantT=0; bomb.defuseT=0; bomb.site=null;
  worldMark=null; if(markBeacon) markBeacon.visible=false;   // 新一局清空标点
  for(const c of characters) respawnChar(c);
  el('victory').classList.add('hide');
  running=true; updateHUD();
  if(!isPhone) cv.requestPointerLock();
  toast('第 '+roundNum+' 局 · 12队混战'+(BOMB_ENABLED?' · C4已启用':' · ?bomb=1 开启C4'));
}
function resolveCollision(pos){
  pos.x=Math.max(-HALF+1.5,Math.min(HALF-1.5,pos.x));
  pos.z=Math.max(-HALF+1.5,Math.min(HALF-1.5,pos.z));
  for(const p of pillars){const dx=pos.x-p.x,dz=pos.z-p.z,d=Math.hypot(dx,dz);
    if(d<p.r&&d>0.0001){const push=p.r-d; pos.x+=dx/d*push; pos.z+=dz/d*push;}}
  // 房屋墙体（矩形障碍）推出
  for(const r of walls){
    const minx=r.x-r.w/2, maxx=r.x+r.w/2, minz=r.z-r.d/2, maxz=r.z+r.d/2;
    if(pos.x>minx&&pos.x<maxx&&pos.z>minz&&pos.z<maxz){
      const dl=pos.x-minx, dr=maxx-pos.x, dt=pos.z-minz, db=maxz-pos.z;
      const m=Math.min(dl,dr,dt,db);
      if(m===dl) pos.x=minx; else if(m===dr) pos.x=maxx; else if(m===dt) pos.z=minz; else pos.z=maxz;
    }
  }
}

/* ---------- 4b. 下包系统 + 无人机技能 ---------- */
const BOMB_TIME=40, PLANT_TIME=3, DEFUSE_TIME=5, BOMB_PLANT_R=3.5, BOMB_DEFUSE_R=3.5, ROUND_MAX=5;
let roundNum=1;
const bomb = { planted:false, pos:null, byTeam:null, timer:0, plantT:0, defuseT:0, site:null };
const SITES = [ {name:'A', pos:new THREE.Vector3(0,0,0)}, {name:'B', pos:new THREE.Vector3(125,0,0)} ]; // B 在右侧 125m 处房屋内
// 下包角色：?bomb=1 才启用；12 队模式简化为「未下包=全员T，下包后=全员CT」
function bombRoleOf(team){ if(!BOMB_ENABLED) return null; return bomb.planted?'CT':'T'; }
function nearestSite(p){ let s=null,bd=1e9; for(const st of SITES){ const d=p.distanceTo(st.pos); if(d<bd){bd=d;s=st;} } return s?{site:s,d:bd}:null; }
function plantBomb(site, team){ bomb.planted=true; bomb.pos=site.pos.clone(); bomb.byTeam=team; bomb.timer=BOMB_TIME; bomb.plantT=0; bomb.site=site.name; toast('💣 C4 已安装于站点 '+site.name+'！'+BOMB_TIME+'s 后爆炸'); updateHUD(); }
function defuseBomb(team){ bomb.planted=false; bomb.defuseT=0; bomb.site=null; toast('✅ C4 已拆除，防守方获胜！'); bombRoundWin(team, false); }
function bombExplode(){ const t=bomb.byTeam; bomb.planted=false; bomb.site=null; toast('💥 C4 爆炸！进攻方获胜！'); bombRoundWin(t, true); }
function bombRoundWin(winTeam, exploded){
  if(matchOver) return;
  matchOver=true; running=false;
  const playerWin = (winTeam===playerTeam);
  el('victoryTitle').textContent = playerWin?'🎉 胜利！':'💀 失败…';
  el('victorySub').textContent = teamName(winTeam)+'队获胜（C4 '+(exploded?'爆炸':'拆除')+'）';
  el('victory').classList.remove('hide');
  if(document.pointerLockElement===cv) document.exitPointerLock();
}
// —— 侦查无人机 ——
let reconActive=false, reconT=0, reconCd=0;
const RECON_TIME=30, RECON_CD=45;
let reconMesh=null;
function useRecon(){
  if(!player||!player.alive||player.downed) return;
  if(reconCd>0){ toast('侦查无人机冷却中 '+Math.ceil(reconCd)+'s'); return; }
  reconActive=true; reconT=RECON_TIME; reconCd=RECON_CD+RECON_TIME;
  if(!reconMesh){ reconMesh=new THREE.Mesh(new THREE.SphereGeometry(0.4,10,10), new THREE.MeshBasicMaterial({color:0x66ddff})); scene.add(reconMesh); }
  reconMesh.visible=true;
  toast('🛰 侦查无人机升空（'+RECON_TIME+'s 透视敌方）'); updateHUD();
}
function updateRecon(dt){
  if(reconCd>0) reconCd-=dt;
  if(!reconActive){ if(reconMesh) reconMesh.visible=false; return; }
  reconT-=dt;
  if(reconMesh){ const p=player.group.position; reconMesh.position.set(p.x, 8+Math.sin(performance.now()/300)*0.5, p.z); }
  if(reconT<=0){ reconActive=false; if(reconMesh) reconMesh.visible=false; }
}
// —— 自爆无人机 ——
let kamikazeCd=0; const KAMI_CD=40; const kamiDrones=[];
function useKamikaze(){
  if(!player||!player.alive||player.downed) return;
  if(kamikazeCd>0){ toast('自爆无人机冷却中 '+Math.ceil(kamikazeCd)+'s'); return; }
  let cx=0,cz=0,n=0; for(const c of characters){ if(c.alive&&!c.downed&&c.team!==player.team){ cx+=c.group.position.x; cz+=c.group.position.z; n++; } }
  if(n===0){ toast('附近没有敌人'); return; }
  cx/=n; cz/=n; kamikazeCd=KAMI_CD;
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(0.35,10,10), new THREE.MeshBasicMaterial({color:0xff3344}));
  mesh.position.copy(player.group.position).setY(2); scene.add(mesh);
  kamiDrones.push({mesh, pos:player.group.position.clone().setY(2), target:new THREE.Vector3(cx,1.5,cz), t:0});
  toast('🚀 自爆无人机出击！'); updateHUD();
}
function updateKami(dt){
  if(kamikazeCd>0) kamikazeCd-=dt;
  for(let i=kamiDrones.length-1;i>=0;i--){
    const k=kamiDrones[i];
    const dir=k.target.clone().sub(k.pos); const d=dir.length(); dir.normalize();
    const sp=14; k.pos.addScaledVector(dir, Math.min(sp*dt, d));
    k.mesh.position.copy(k.pos); k.t+=dt;
    if(d<1.2 || k.t>6){ explode(k.pos, player, 7, 90); scene.remove(k.mesh); kamiDrones.splice(i,1); }
  }
}
function updateDrones(dt){ updateRecon(dt); updateKami(dt); }

/* ---------- 5. 玩家控制（含飞天 / 倒地爬行 / 救人） ---------- */
const joy={active:false,id:null,baseX:0,baseY:0,x:0,y:0};
function updatePlayer(dt){
  // —— 倒地状态：只能缓慢爬行，等队友来救 ——
  if(player.downed){
    player.downedT+=dt;
    let fx=0,fz=0;
    if(!isPhone){ fx=(kdown('forward')?1:0)-(kdown('back')?1:0); fz=(kdown('right')?1:0)-(kdown('left')?1:0); }
    else { fx=-joy.y; fz=joy.x; }
    const sin=Math.sin(player.yaw),cos=Math.cos(player.yaw);
    const fwdX=-sin,fwdZ=-cos, rgtX=cos,rgtZ=-sin;
    let vx=fwdX*fx+rgtX*fz, vz=fwdZ*fx+rgtZ*fz; const len=Math.hypot(vx,vz); if(len>0){vx/=len;vz/=len;}
    const sp=2.2; player.group.position.x+=vx*sp*dt; player.group.position.z+=vz*sp*dt;
    resolveCollision(player.group.position);
    player.group.position.y=(player.elev||0)+0.35;
    camera.position.set(player.group.position.x, 0.5+(player.elev||0), player.group.position.z);
    camera.rotation.y=player.yaw; camera.rotation.x=player.pitch;
    // 附近的 AI 队友会自动来救你
    for(const c of characters){ if(c.team===player.team&&!c.isPlayer&&c.alive&&!c.downed){
      if(c.group.position.distanceTo(player.group.position)<REVIVE_RANGE) tickRevive(player,dt,c); } }
    return;
  }
  if(!player.alive) return;
  if(player.reloading){ player.reloadT-=dt; if(player.reloadT<=0)finishReload(player); }
  // 救人：按住 E（手机靠近自动）救最近的倒地队友；救人时不能开枪
  revivingNow=false;
  let revTarget=null, rd=1e9;
  for(const c of characters){ if(c.team===player.team&&c.downed){ const d=c.group.position.distanceTo(player.group.position); if(d<rd){rd=d;revTarget=c;} } }
  const nearRev = revTarget && rd<=REVIVE_RANGE;
  const wantRev = isPhone ? nearRev : (kdown('use') && nearRev);
  if(wantRev){
    revivingNow=true;
    if(revTarget.reviveProg<=0.001) toast(isPhone?'正在救援…':'正在救援…保持按住 E');
    tickRevive(revTarget,dt,player);
  }
  // 下包 / 拆包（万能 E；手机靠近自动，与救人互斥：优先救人）
  const role = player.alive ? bombRoleOf(player.team) : null;
  let nearSite=null, siteD=1e9;
  if(role==='T' && !bomb.planted){ const st=nearestSite(player.group.position); if(st){ nearSite=st.site; siteD=st.d; } }
  const nearBomb = role==='CT' && bomb.planted && bomb.pos && player.group.position.distanceTo(bomb.pos) < BOMB_DEFUSE_R;
  const wantPlant = nearSite && siteD <= BOMB_PLANT_R;
  const wantBomb = isPhone ? (wantPlant || nearBomb) : (kdown('use') && (wantPlant || nearBomb));
  if(wantBomb && !nearRev){
    if(role==='T'){ bomb.plantT += dt; if(bomb.plantT>=PLANT_TIME) plantBomb(nearSite, player.team); }
    else { bomb.defuseT += dt; if(bomb.defuseT>=DEFUSE_TIME) defuseBomb(player.team); }
  } else if(!nearRev){ bomb.plantT=0; bomb.defuseT=0; }
  // 蹲跳系统：跳跃物理 + 蹲下
  if(player.jumpQueued && player.grounded){ player.vy=JUMP_V; player.grounded=false; }
  player.jumpQueued=false;
  if(!player.grounded){ player.jumpY+=player.vy*dt; player.vy-=GRAVITY*dt; if(player.jumpY<=0){ player.jumpY=0; player.vy=0; player.grounded=true; } }
  const crouching = (!isPhone && kdown('crouch')) || (isPhone && touchCrouch);
  // 飞天
  if(flyEnabled){ if(kdown('flyup')||flyUp)player.flyY+=7*dt; if(kdown('flydown')||flyDown)player.flyY-=7*dt; player.flyY=Math.max(-1,Math.min(45,player.flyY)); }
  // 狙击枪瞄准镜：装备狙击时拉近 FOV + 显示圆形准星遮罩
  const sc=el('scope');
  if(curWeapon==='sniper'){ if(camera.fov!==32){camera.fov=32;camera.updateProjectionMatrix();} if(sc)sc.style.display='block'; }
  else { if(camera.fov!==78){camera.fov=78;camera.updateProjectionMatrix();} if(sc)sc.style.display='none'; }
  let fx=0,fz=0;
  if(!isPhone){ fx=(kdown('forward')?1:0)-(kdown('back')?1:0); fz=(kdown('right')?1:0)-(kdown('left')?1:0); }
  else { fx=-joy.y; fz=joy.x; }
  const sin=Math.sin(player.yaw),cos=Math.cos(player.yaw);
  const fwdX=-sin,fwdZ=-cos, rgtX=cos,rgtZ=-sin;
  let vx=fwdX*fx+rgtX*fz, vz=fwdZ*fx+rgtZ*fz; const len=Math.hypot(vx,vz); if(len>0){vx/=len;vz/=len;}
  // Shift 跑步加速（蹲下时不算；手机端暂无跑步键）
  const sprinting = !crouching && !isPhone && kdown('sprint');
  const sp=(crouching?4.5:(sprinting?13.5:9))*slowMul(player); player.group.position.x+=vx*sp*dt; player.group.position.z+=vz*sp*dt;
  resolveCollision(player.group.position);
  // 分层支撑：中央大楼楼板/坡道（走进大楼自动上楼板，走下边缘逐层掉落）
  player.elev = groundHeightAt(player.group.position.x, player.group.position.z, player.elev+0.01);
  player.group.position.y=player.elev+player.flyY;
  camera.position.set(player.group.position.x, EYE+player.elev+player.flyY+player.jumpY-(crouching?0.7:0), player.group.position.z);
  player.recoil*=0.85; camera.rotation.y=player.yaw; camera.rotation.x=player.pitch+player.recoil;
  // 全枪种统一开火（不再只限 ak）；半自动在 playerFire 内自行停火
  if(firing && curWeapon!=='grenade' && !revivingNow && !player.downed) playerFire();
}

/* ---------- 6. 场景构建（纹理加载完成后执行，着色器材质渲染地图） ---------- */
let player=null, playerTeam='blue';
const pillars=[], walls=[], buildings=[];

function initScene(texMid, texAlly, texEnemy, texWall, texPIce, texPStone, texPRed){
  // 材质选择（按渲染后端 + 画面风格）：
  //   three / webgpu 后端 → three.js 标准材质（WebGPU 不跑 GLSL，统一走标准管线）
  //   webgl 系后端 → 自定义 GLSL：mosaic 马赛克 / toon 卡通 / crt 扫描线
  function csMat(tex, tint, cells){
    if(RENDER_BACKEND==='three' || RENDER_BACKEND==='webgpu'){
      return new THREE.MeshStandardMaterial({ map:tex, color:0xffffff, roughness:0.9, metalness:0.0, side:THREE.DoubleSide });
    }
    if(SHADER_STYLE==='toon') return makeToonMaterial(tex,tint);
    if(SHADER_STYLE==='crt')  return makeScanMaterial(tex,tint);
    return (typeof cells==='number') ? makeMosaicMaterial(tex,tint,cells) : makeSmoothMaterial(tex,tint);
  }
  // 地图（地面用马赛克着色器，墙/柱用平滑材质保留贴图细节）
  // 600m 地面：三块 200m 深的分区（敌方/中场/我方）
  function addGround(z,len,tex,tint){ tex.repeat.set(36,12);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(MAP,len), csMat(tex,tint,8));
    m.rotation.x=-Math.PI/2; m.position.set(0,0,z); scene.add(m);
  }
  addGround(-200,200,texEnemy,0xd8c0c0); addGround(0,200,texMid,0xffffff); addGround(200,200,texAlly,0xc0d0ff);
  const wallMat=csMat(texWall,0xcfe0f5);
  function addWall(x,z,w,d){const m=new THREE.Mesh(new THREE.BoxGeometry(w,3,d),wallMat);m.position.set(x,1.5,z);scene.add(m);m.updateMatrix();m.matrixAutoUpdate=false;}
  addWall(0,-HALF,MAP,1);addWall(0,HALF,MAP,1);addWall(-HALF,0,1,MAP);addWall(HALF,0,1,MAP);

  // 静态优化：墙体/柱子/建筑构建时统一 updateMatrix + matrixAutoUpdate=false（省 CPU）

  // 柱子掩体：固定种子伪随机散布 34 根（600m 地图上均匀铺开，避开中心站点与出生区）
  const pillarPos=[];
  { let seed=42; const rnd=()=>{ seed=(seed*1103515245+12345)%2147483648; return seed/2147483648; };
    let guard=0;
    while(pillarPos.length<34 && guard++<500){
      const x=Math.round((rnd()-0.5)*540), z=Math.round((rnd()-0.5)*540);
      if(Math.hypot(x,z)<45) continue;           // 中心 A 站点留空
      if(Math.abs(z)>HALF-40) continue;          // 出生区留空
      if(pillarPos.some(p=>Math.hypot(p[0]-x,p[1]-z)<30)) continue;  // 间距 ≥30m
      pillarPos.push([x,z]);
    } }
  const pillarMats=[
    csMat(texPIce,0xd8ecff),
    csMat(texPStone,0xb8cfe0),
    csMat(texPRed,0xd07070)
  ];
  for(const [i,[x,z]] of pillarPos.entries()){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,6,12),pillarMats[i%3]);
    m.position.set(x,3,z);scene.add(m);
    m.updateMatrix(); m.matrixAutoUpdate=false;   // 静态物体关掉矩阵自动更新
    pillars.push({x,z,r:2.1});
  }

  // 房屋：四面墙 + 南侧门洞，墙体加入碰撞与导航阻挡；室内可进入
  // openHall=钢枪楼：南北对门 + 室内双柱，无窗（大开间贴脸对枪）
  // height=自定义墙高（狙击楼 7m，配高位窗带）
  function addBuilding(bx,bz,w,d,withWindow,openHall,h){
    h=h||3.4;
    const t=1, hw=w/2, hd=d/2, door=3, halfDoor=door/2;
    const seg=(x,z,sw,sd)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(sw,h,sd),wallMat); m.position.set(x,h/2,z); scene.add(m);
      m.updateMatrix(); m.matrixAutoUpdate=false;
      walls.push({x,z,w:sw,d:sd});
    };
    if(openHall){
      // 南北各一个 5m 大门（墙分两段），东西实心
      const bigDoor=5, hd2=bigDoor/2;
      seg(bx-(hw+hd2)/2, bz-hd, (hw-hd2), t); seg(bx+(hw+hd2)/2, bz-hd, (hw-hd2), t);
      seg(bx-(hw+hd2)/2, bz+hd, (hw-hd2), t); seg(bx+(hw+hd2)/2, bz+hd, (hw-hd2), t);
      seg(bx-hw, bz, t, d); seg(bx+hw, bz, t, d);
      // 室内两根钢枪柱
      const pm=new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.8,h,10),wallMat);
      pm.position.set(bx-3,h/2,bz); scene.add(pm); pm.updateMatrix(); pm.matrixAutoUpdate=false;
      const pm2=pm.clone(); pm2.position.set(bx+3,h/2,bz); scene.add(pm2);
      pillars.push({x:bx-3,z:bz,r:1.2},{x:bx+3,z:bz,r:1.2});
    } else {
      seg(bx, bz+hd, w, t);                 // 北墙（实心）
      seg(bx+hw, bz, t, d);                 // 东墙
      seg(bx-hw, bz, t, d);                // 西墙
      const sideW = hw - halfDoor;         // 南墙分两段，中间留门
      seg(bx-(hw+halfDoor)/2, bz-hd, sideW, t);
      seg(bx+(hw+halfDoor)/2, bz-hd, sideW, t);
    }
    buildings.push({x:bx,z:bz,w,d});
    // 窗户：北墙中央加窗框 + 半透明玻璃（视觉，墙体仍实心不可穿）
    if(withWindow){
      const wz=bz+hd, fMat=new THREE.MeshLambertMaterial({color:0x222a33});
      const gMat=new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:0.35,side:THREE.DoubleSide});
      const fT=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.25,0.2),fMat); fT.position.set(bx,2.7,wz);
      const fB=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.25,0.2),fMat); fB.position.set(bx,1.3,wz);
      const fL=new THREE.Mesh(new THREE.BoxGeometry(0.25,1.4,0.2),fMat); fL.position.set(bx-1.2,2.0,wz);
      const fR=new THREE.Mesh(new THREE.BoxGeometry(0.25,1.4,0.2),fMat); fR.position.set(bx+1.2,2.0,wz);
      const glass=new THREE.Mesh(new THREE.PlaneGeometry(2.1,1.3),gMat); glass.position.set(bx,2.0,wz); glass.rotation.y=Math.PI/2;
      scene.add(fT,fB,fL,fR,glass);
    } else if(h>5){
      // 狙击楼高位窗带：四面 5m 高处的深色窗框条（视觉标识：这楼能架狙）
      const fMat=new THREE.MeshLambertMaterial({color:0x1a222c});
      [[0,bz+hd,w,0.25,0.2],[0,bz-hd,w,0.25,0.2],[bx-hw,0,0.25,0.2,d],[bx+hw,0,0.25,0.2,d]].forEach(([wx,wz,sw,sh,sd])=>{
        const m=new THREE.Mesh(new THREE.BoxGeometry(sw===0.25?0.3:Math.min(4,sw*0.4), 0.6, sd===0.25?0.3:Math.min(4,sd*0.4)),fMat);
        m.position.set(wx,h-1.5,wz); scene.add(m); m.updateMatrix(); m.matrixAutoUpdate=false;
      });
    }
  }
  // 30 栋功能楼铺开全图：3 类循环（钢枪=开阔大厅 / 苟分=封闭小屋 / 狙击=高楼窗台），站点 B 在 (125,0) 楼内
  { let seed=777; const rnd=()=>{ seed=(seed*1103515245+12345)%2147483648; return seed/2147483648; };
    let placed=0, guard=0;
    const spots=[];
    while(placed<30 && guard++<800){
      const x=Math.round((rnd()-0.5)*540), z=Math.round((rnd()-0.5)*540);
      if(Math.hypot(x,z)<75) continue;                   // 中央大楼 100×100 周边留空
      if(spots.some(s=>Math.hypot(s[0]-x,s[1]-z)<35)) continue;   // 楼间距 ≥35m
      if(Math.hypot(x-125,z)<25) continue;               // 给 B 点建筑留位
      spots.push([x,z]); placed++;
      const type=placed%3;   // 0=钢枪 1=苟分 2=狙击
      if(type===0){        // 钢枪楼：18×18 开阔大厅，两侧对门，中间两根柱，适合贴脸对枪
        addBuilding(x,z,18,18,false,true);
      } else if(type===1){ // 苟分楼：12×12 封闭小屋带窗，蹲里面苟
        addBuilding(x,z,12,12,true);
      } else {             // 狙击楼：10×10 加高（墙 7m）+ 高位窗带，架狙看外面
        addBuilding(x,z,10,10,false,false,7);
      }
    }
    addBuilding(125,0,14,14,true);   // B 站点建筑（带窗户）
  }
  // 中央大楼：100×100×25m，3 层楼板 + 顶层，四角坡道上楼，楼内补给箱
  buildTower(wallMat);
  // A/B 下包点浮标（?bomb=1 时才用；A 就在大楼一层，B 在东侧 250m 楼内）
  if(BOMB_ENABLED){
    function makeSiteLabel(txt,pos){
      const c=document.createElement('canvas'); c.width=64; c.height=64; const x=c.getContext('2d');
      x.fillStyle='rgba(255,200,0,0.92)'; x.beginPath(); x.arc(32,32,28,0,7); x.fill();
      x.fillStyle='#000'; x.font='bold 38px sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(txt,32,34);
      const tex=new THREE.CanvasTexture(c); const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
      sp.scale.set(12,12,1); sp.position.set(pos.x,8,pos.z); scene.add(sp);
    }
    SITES.forEach(s=>makeSiteLabel(s.name, s.pos));
  }

  // 角色：12 队 × 5 人（玩家占蓝队 1 席），pvp/try 模式保留特殊化
  playerTeam = spy ? 'red' : 'blue';
  player = spawnCharacter(playerTeam,true);
  for(const t of TEAMS){
    let n=5;
    if(t.id===playerTeam) n = pvp?0:4;           // 玩家队：4 AI 队友
    else if(tryMode && t.id==='red') n=1;        // 5v1 模式红队仅1
    for(let i=0;i<n;i++) spawnCharacter(t.id,false);
  }
  characters.forEach(placeAtSpawn);

  // 超级AI分配：每队随机 1~5 个（Q-learning 推理端，Q表 assets/Q/qlearning.json）
  for(const t of TEAMS){
    const members=characters.filter(c=>c.team===t.id && !c.isPlayer);
    const n=Math.min(members.length, 1+Math.floor(Math.random()*5));
    for(let i=members.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const tmp=members[i];members[i]=members[j];members[j]=tmp; }
    for(let i=0;i<n;i++) members[i].superAI=true;
  }

  // 医疗箱（按区域分散铺 17 个）
  [[-125,-125],[125,-125],[-125,125],[125,125],[0,0],
   [125,0],[-125,0],[0,-125],[0,125],
   [-250,-250],[250,-250],[-250,250],[250,250],
   [0,-250],[0,250],[-275,0],[275,0]].forEach(p=>makeMedkit(p[0],p[1]));
  for(const mk of medkits){ mk.group.traverse(o=>{ if(o.isMesh){ o.updateMatrix(); o.matrixAutoUpdate=false; } }); }

  // 玩家：隐身（只剩摄像机在打）+ 应用 hospital 血量
  player.group.visible=false;
  if(hospitalVal>0) player.hp=hospitalVal;

  // 相机初始位置 + 标记就绪
  camera.position.set(player.group.position.x, EYE, player.group.position.z);
  sceneReady = true;
  updateHUD();
}

/* ---------- 6b. 中央大楼：100×100×25m，3 层 + 顶层，四角坡道，楼内补给箱 ---------- */
const loots=[];   // 补给箱
const LOOT_CD = 30;
const TOWER_FLOORS = [6.25, 12.5, 18.75, 25];
const TOWER_RAMPS = [   // 四角坡道：a=低边坐标，沿 axis 升 6.25m/20m
  {x1:  30,x2:  50,z1: -50,z2: -30, y0:    0,  axis:'z', a: -30},   // R1: z=-30(0m)→z=-50(6.25m)
  {x1:  30,x2:  50,z1:  30,z2:  50, y0:6.25,  axis:'z', a:  30},   // R2: z=30(6.25m)→z=50(12.5m)
  {x1: -50,x2: -30,z1:  30,z2:  50, y0:12.5,  axis:'x', a: -30},   // R3: x=-30(12.5m)→x=-50(18.75m)
  {x1: -50,x2: -30,z1: -50,z2: -30, y0:18.75, axis:'z', a: -30},   // R4: z=-30(18.75m)→z=-50(25m)
];
// 分层地面高度：取「≤ 当前脚高+1.3m」的最高支撑（楼板/坡道/地面）→ 走下楼板边缘会逐层掉落
function groundHeightAt(x,z,curY){
  if(Math.abs(x)>50 || Math.abs(z)>50) return 0;   // 大楼外都是平地
  const lim = curY + 1.3;
  let g = 0;
  for(const r of TOWER_RAMPS){
    if(x>=r.x1 && x<=r.x2 && z>=r.z1 && z<=r.z2){
      const t = Math.max(0, Math.min(1, (r.axis==='z') ? (r.a - z)/20 : (r.a - x)/20));
      const y = r.y0 + t*6.25;
      if(y<=lim && y>g) g=y;
    }
  }
  for(const fy of TOWER_FLOORS){ if(fy<=lim && fy>g) g=fy; }
  return g;
}
function buildTower(wallMat){
  const H=25, half=50;
  // 外墙：每侧中央 12m 门洞 → 两段；墙高 25m
  const door=12, seg=(x,z,w,d)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,H,d),wallMat); m.position.set(x,H/2,z); scene.add(m);
    m.updateMatrix(); m.matrixAutoUpdate=false; walls.push({x,z,w,d});
  };
  const sideLen=(half*2-door)/2, off=door/2+sideLen/2;
  seg(-off,-half, sideLen, 2); seg(off,-half, sideLen, 2);      // 北墙(z=-50)
  seg(-off, half, sideLen, 2); seg(off, half, sideLen, 2);      // 南墙
  seg(-half,-off, 2, sideLen); seg(-half, off, 2, sideLen);     // 西墙
  seg( half,-off, 2, sideLen); seg( half, off, 2, sideLen);     // 东墙
  // 4 层楼板（96×96 留墙厚）
  const slabMat=new THREE.MeshLambertMaterial({color:0x9aa8b8});
  for(const fy of TOWER_FLOORS){
    const m=new THREE.Mesh(new THREE.BoxGeometry(96,0.6,96),slabMat);
    m.position.set(0,fy-0.3,0); scene.add(m); m.updateMatrix(); m.matrixAutoUpdate=false;
  }
  // 4 条坡道（视觉斜板；实际高度由 groundHeightAt 计算）
  const rampLen=Math.sqrt(20*20+6.25*6.25);
  for(const r of TOWER_RAMPS){
    const m=new THREE.Mesh(new THREE.BoxGeometry(20,0.6,rampLen),slabMat);
    const t0=(r.axis==='z') ? (r.a-r.z1)/20 : (r.a-r.x1)/20;    // 起端高度
    const yA=r.y0+Math.max(0,Math.min(1,t0))*6.25;
    const t1=(r.axis==='z') ? (r.a-r.z2)/20 : (r.a-r.x2)/20;
    const yB=r.y0+Math.max(0,Math.min(1,t1))*6.25;
    m.position.set((r.x1+r.x2)/2,(yA+yB)/2-0.3,(r.z1+r.z2)/2);
    // 旋转方向：让网格低端贴地、高端贴楼板（原符号反了 → 坡道一头戳穿楼板、一头贴地，看着像上不去）
    m.rotation.x = (r.axis==='z') ? -Math.atan2(yB-yA, r.z2-r.z1) : 0;
    m.rotation.z = (r.axis==='x') ?  Math.atan2(yB-yA, r.x2-r.x1) : 0;
    scene.add(m); m.updateMatrix(); m.matrixAutoUpdate=false;
  }
  // 内部承重柱 ×4（高层 25m）
  const colMat=new THREE.MeshLambertMaterial({color:0x6a7684});
  [[-20,-20],[20,-20],[-20,20],[20,20]].forEach(([x,z])=>{
    const m=new THREE.Mesh(new THREE.CylinderGeometry(2,2,H,10),colMat);
    m.position.set(x,H/2,z); scene.add(m); m.updateMatrix(); m.matrixAutoUpdate=false;
    walls.push({x,z,w:4,d:4});
  });
  // 补给箱：每层 4 个（+备用弹 +回血），黄金小箱
  let seed=555; const rnd=()=>{ seed=(seed*1103515245+12345)%2147483648; return seed/2147483648; };
  for(const fy of [0].concat(TOWER_FLOORS)){
    for(let i=0;i<4;i++){
      const x=Math.round((rnd()-0.5)*70), z=Math.round((rnd()-0.5)*70);
      const g=new THREE.Group();
      const box=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.5,1.5),MAT.loot); box.position.y=fy+0.75;
      const band=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.3,1.6),MAT.head); band.position.y=fy+0.75;
      g.add(box,band); g.position.set(x,0,z); scene.add(g);
      g.traverse(o=>{ if(o.isMesh){ o.updateMatrix(); o.matrixAutoUpdate=false; } });
      loots.push({group:g,pos:new THREE.Vector3(x,fy,z),active:true,cd:0});
    }
  }
}
// 补给箱拾取（主循环调用）：碰到 +90 备用弹(当前枪) +25 血
function tickLoots(dt){
  for(const lt of loots){
    if(lt.cd>0){ lt.cd-=dt||1/60; if(lt.cd<=0){ lt.active=true; lt.group.visible=true; } continue; }
    for(const c of characters){
      if(!c.alive||c.downed) continue;
      const p=c.group.position;
      if(Math.abs(p.x-lt.pos.x)<2.2 && Math.abs(p.z-lt.pos.z)<2.2 && Math.abs((c.elev||0)-lt.pos.y)<3){
        const wn=c.isPlayer?curWeapon:c.weapon;
        const a=c.ammo[wn]; if(a) a.r+=90;
        c.hp=Math.min(200,c.hp+25);
        lt.active=false; lt.group.visible=false; lt.cd=LOOT_CD;
        if(c.isPlayer){ toast('📦 补给箱：备用弹+90 血量+25'); updateHUD(); }
        break;
      }
    }
  }
}

// 渲染模式：js = Canvas 实时纹理(清晰)，svg = SVG 贴图(轻量)。暂停界面可切换，存 localStorage
const TEX_MODE = localStorage.getItem('csTexMode') === 'svg' ? 'svg' : 'js';
// 渲染后端 / 画面风格 已在文件头部检测（RENDER_BACKEND / SHADER_STYLE）

// svg 模式：异步加载 7 张 SVG 纹理 → 构建场景
function loadSVGTextures(){
  return Promise.all([
    loadTex('assets/screen/mid.svg'),
    loadTex('assets/screen/ally.svg'),
    loadTex('assets/screen/enemy.svg'),
    loadTex('assets/screen/wall_ice.svg'),
    loadTex('assets/screen/pillar_ice.svg'),
    loadTex('assets/screen/pillar_stone.svg'),
    loadTex('assets/screen/pillar_red.svg')
  ]);
}

function bootScene(){
  if(TEX_MODE === 'js' && typeof CSGenTex === 'function'){
    // js 实时渲染：Canvas 同步生成，立即就绪
    try{
      initScene.apply(null, CSGenTex());
      return;
    }catch(e){ console.error('[CS] Canvas 纹理生成失败，回退 svg', e); }
  }
  loadSVGTextures().then(([tm,ta,te,tw,tpi,tps,tpr])=>{
    initScene(tm,ta,te,tw,tpi,tps,tpr);
  }).catch(()=>{
  console.error('[CS] SVG 纹理加载失败');
  if(el('toast')){ el('toast').textContent='纹理加载失败，请刷新重试'; el('toast').style.opacity=1; }
});
}
// 先等枪械 JSON（all.json）读完再建场景，保证 initAmmo 用的是 JSON 里的弹量；3s 超时则自动用内置兜底表
whenGunsReady(bootScene);

/* ---------- 7. 修改器菜单（点击「5v5」5 下开启） ---------- */
window.__csGetState = function(){
  return { imagod, fireinthehole, chinesecanfly, sorry, gztfxxm, spy, pvp, tryMode, hospital:hospitalVal };
};
window.__csApplyLive = function(s){
  if(typeof s.imagod==='boolean')        imagod        = s.imagod;
  if(typeof s.fireinthehole==='boolean') fireinthehole = s.fireinthehole;
  if(typeof s.chinesecanfly==='boolean') chinesecanfly = s.chinesecanfly;
  if(typeof s.sorry==='boolean')         sorry         = s.sorry;
  if(typeof s.gztfxxm==='boolean')       gztfxxm       = s.gztfxxm;
  if(typeof s.hospital==='number'){ hospitalVal = s.hospital; if(player&&player.alive) player.hp = hospitalVal; }
  infiniteAmmo = fireinthehole || imagod;
  flyEnabled   = chinesecanfly || imagod;
  if(flyEnabled && isPhone) document.body.classList.add('flyon'); else document.body.classList.remove('flyon');
  updateHUD();
  if(imagod) toast('外挂已实时开启 ⚡');
};

const TRAINER_HTML = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<title>修改器 / Trainer</title>
<style>
  *{box-sizing:border-box;font-family:"Courier New",monospace;}
  body{margin:0;background:#0a1020;color:#cfe3ff;padding:16px;}
  h1{font-size:20px;color:#9fe0ff;letter-spacing:1px;margin:0 0 4px;}
  .sub{font-size:12px;color:#7fa8d8;margin-bottom:14px;line-height:1.6;}
  .row{display:flex;align-items:center;justify-content:space-between;background:rgba(20,40,70,.5);
    border:1px solid #2a4a7a;border-radius:6px;padding:10px 12px;margin:8px 0;}
  .lab{font-size:14px;} .tag{font-size:11px;color:#ffd86a;margin-left:6px;}
  .row input[type=checkbox]{width:22px;height:22px;accent-color:#5aa6ff;}
  .row input[type=number]{width:90px;background:#0a1430;color:#cfe3ff;border:1px solid #3a5a8a;border-radius:4px;padding:4px;font-size:14px;}
  .btns{display:flex;gap:8px;margin-top:16px;}
  button{flex:1;font-family:inherit;font-size:14px;padding:12px;border-radius:8px;cursor:pointer;border:1px solid #5aa6ff;background:rgba(20,40,70,.7);color:#cfe3ff;}
  #apply{background:#1d5fb0;border-color:#9fe0ff;color:#fff;font-weight:bold;}
  #status{margin-top:12px;font-size:13px;color:#9be86a;min-height:18px;text-align:center;}
</style></head>
<body>
<h1>🛠 修改器 Trainer</h1>
<div class="sub">勾选秘籍 → 实时应用（无敌 / 无限弹 / 飞天 / 误伤 / 核弹 即时生效）<br>间谍 · 1v5 · 5v1 需点「应用并重开」</div>
<div id="list"></div>
<div class="btns">
  <button id="apply">实时应用</button>
  <button id="restart">应用并重开</button>
  <button id="close">关闭</button>
</div>
<div id="status"></div>
<script>
  var ITEMS=[
    {k:'imagod',t:'无敌 + 无限弹 + 飞天'},
    {k:'fireinthehole',t:'无限子弹'},
    {k:'chinesecanfly',t:'飞天 (=升 / -降)'},
    {k:'sorry',t:'误伤友军（打队友）'},
    {k:'gztfxxm',t:'核弹（游戏内按 0）'},
    {k:'spy',t:'间谍 / 变红方',need:true},
    {k:'pvp',t:'1v5（无队友）',need:true},
    {k:'tryMode',t:'5v1（敌仅1）',need:true}
  ];
  var st = (opener && opener.__csGetState) ? opener.__csGetState() : {};
  var list=document.getElementById('list');
  ITEMS.forEach(function(it){
    var row=document.createElement('div'); row.className='row';
    var left=document.createElement('div');
    left.innerHTML='<span class="lab">'+it.t+'</span>'+(it.need?'<span class="tag">需重开</span>':'');
    var cb=document.createElement('input'); cb.type='checkbox'; cb.dataset.k=it.k; cb.checked=!!st[it.k];
    row.appendChild(left); row.appendChild(cb); list.appendChild(row);
  });
  var hrow=document.createElement('div'); hrow.className='row';
  hrow.innerHTML='<span class="lab">无敌血量 hospital</span>';
  var num=document.createElement('input'); num.type='number'; num.min='0'; num.value=st.hospital||0; num.id='hosp';
  hrow.appendChild(num); list.appendChild(hrow);
  function readUI(){
    var s={imagod:false,fireinthehole:false,chinesecanfly:false,sorry:false,gztfxxm:false,spy:false,pvp:false,tryMode:false,hospital:0};
    ITEMS.forEach(function(it){ var cb=list.querySelector('input[data-k="'+it.k+'"]'); s[it.k]=cb.checked; });
    s.hospital=parseInt(document.getElementById('hosp').value,10)||0;
    return s;
  }
  function setStatus(m){ document.getElementById('status').textContent=m; }
  function reloadWith(s){
    var base=opener.location.href.split('?')[0].split('#')[0];
    var p=new URLSearchParams();
    if(s.imagod)p.set('imagod','1');
    if(s.fireinthehole)p.set('fireinthehole','1');
    if(s.chinesecanfly)p.set('chinesecanfly','1');
    if(s.sorry)p.set('sorry','1');
    if(s.gztfxxm)p.set('gztfxxm','1');
    if(s.spy)p.set('spy','1');
    if(s.pvp)p.set('pvp','1');
    if(s.tryMode)p.set('try','1');
    if(s.hospital>0)p.set('hospital',String(s.hospital));
    opener.location.href=base+(p.toString()?('?'+p.toString()):'');
    window.close();
  }
  document.getElementById('apply').onclick=function(){
    var s=readUI();
    if(opener&&opener.__csApplyLive) opener.__csApplyLive(s);
    if(s.spy||s.pvp||s.tryMode){ setStatus('间谍/1v5/5v1 需重开游戏…'); setTimeout(function(){reloadWith(s);},400); }
    else setStatus('已实时应用 ✔ 回游戏看效果');
  };
  document.getElementById('restart').onclick=function(){ reloadWith(readUI()); };
  document.getElementById('close').onclick=function(){ window.close(); };
</script>
</body></html>`;

function openTrainer(){
  const w = window.open('', 'cs_trainer', 'width=440,height=700');
  if(!w){ toast('弹窗被拦截，请允许本页弹出窗口'); return; }
  w.document.write(TRAINER_HTML);
  w.document.close();
  toast('修改器已打开 🛠');
}

// 「5v5」彩蛋：连点 5 下开修改器
let _eggClicks = 0;
const _eggEl = el('egg5v5');
if(_eggEl){
  _eggEl.addEventListener('click', e=>{
    e.stopPropagation();           // 别误触「点击开始」
    _eggClicks++;
    if(_eggClicks >= 5){ _eggClicks = 0; openTrainer(); }
    else toast('修改器解锁进度 '+_eggClicks+'/5 ✦');
  });
}

/* ---------- 8. DEBUG 沙盒（空地图 + 手动单位 + 触发胜负） ---------- */
// 「.」彩蛋：连点 10 下进入 DEBUG 沙盒（空地图）
let _dotClicks = 0;
const _dotEl = el('eggDot');
if(_dotEl){
  _dotEl.addEventListener('click', e=>{
    e.stopPropagation();
    _dotClicks++;
    if(_dotClicks >= 10){ _dotClicks = 0; enterDebug(); }
    else toast('DEBUG 解锁进度 '+_dotClicks+'/10 ✦');
  });
}

function enterDebug(){
  // 清掉所有非玩家角色（mesh / 进度条 / hitMeshes）
  for(const c of characters.slice()){
    if(c.isPlayer) continue;
    freeName(c.name); scene.remove(c.nameTag);
    scene.remove(c.group); scene.remove(c.reviveBar);
    const i0=hitMeshes.indexOf(c.meshes[0]); if(i0>=0) hitMeshes.splice(i0,2);
    const ci=characters.indexOf(c); if(ci>=0) characters.splice(ci,1);
  }
  debugMode=true; debugGodOn=false; teamScores={}; matchOver=false;
  // 复位玩家
  player.alive=true; player.downed=false; player.hp=100; player.flyY=0;
  player.group.rotation.x=0; player.group.position.y=0; player.group.visible=false;
  if(player.reviveBar) player.reviveBar.visible=false;
  el('victory').classList.add('hide');
  el('dbgHud').classList.remove('hide');
  el('overlay').classList.add('hide'); running=true; updateHUD();
  if(!isPhone) cv.requestPointerLock(); else toast('🐞 DEBUG：用左下/右侧按钮操作');
  toast('🐞 DEBUG 沙盒已开启：空地图，按键或按钮召唤单位');
}
function debugSpawn(team){
  if(team==='blue' && playerTeam!=='blue'){ /* 仍按字面召唤蓝队 */ }
  const ch=spawnCharacter(team,false); placeAtSpawn(ch);
  toast(team==='red'?'召唤红方（敌）':'召唤队友（蓝）');
}
function debugDown(team){
  if(team==='red'){
    let t=null,nd=1e9;
    for(const c of characters){ if(c.team==='red'&&c.alive&&!c.downed){ const d=c.group.position.distanceTo(player.group.position); if(d<nd){nd=d;t=c;} } }
    if(t){ downChar(t,null); toast('红方击倒'); } else toast('场上没有红方可击倒');
  } else {
    // 优先击倒蓝队 AI 队友；没有则击倒自己（测试队友救援）
    let t=null,nd=1e9;
    for(const c of characters){ if(c.team==='blue'&&!c.isPlayer&&c.alive&&!c.downed){ const d=c.group.position.distanceTo(player.group.position); if(d<nd){nd=d;t=c;} } }
    if(t){ downChar(t,null); toast('队友击倒（测试救援）'); }
    else if(player.alive&&!player.downed){ downChar(player,null); toast('我倒下了！等待队友救援'); }
    else toast('没有可击倒的队友/自己');
  }
}
function debugGod(){
  debugGodOn=!debugGodOn;
  if(debugGodOn){
    flyEnabled=true; infiniteAmmo=true; player.alive=true; player.downed=false;
    player.hp=100; player.group.rotation.x=0; player.group.position.y=0; updateHUD();
    toast('DEBUG 飞天+无限弹+100血 已开');
  } else { flyEnabled=false; infiniteAmmo=false; toast('DEBUG 外挂已关'); }
}
function debugMedkitFront(){
  const sin=Math.sin(player.yaw), cos=Math.cos(player.yaw);
  const fx=-sin, fz=-cos;   // 玩家正前方
  const x=player.group.position.x+fx*3, z=player.group.position.z+fz*3;
  makeMedkit(x,z); toast('已在面前生成医疗箱');
}
function debugWin(){
  el('victoryTitle').textContent='🐞 DEBUG 直接胜利';
  el('victorySub').textContent='（调试）已触发胜利界面';
  el('victory').classList.remove('hide'); running=false; matchOver=true;
  if(document.pointerLockElement===cv) document.exitPointerLock();
  toast('DEBUG：直接胜利');
}
function debugLose(){
  el('victoryTitle').textContent='🐞 DEBUG 直接失败';
  el('victorySub').textContent='（调试）已触发失败界面';
  el('victory').classList.remove('hide'); running=false; matchOver=true;
  if(document.pointerLockElement===cv) document.exitPointerLock();
  toast('DEBUG：直接失败');
}
function debugExit(){ location.reload(); }

/* ---------- 8b. 小地图 / 淘汰播报 / 队伍聊天 / 标点指挥 ---------- */
// —— 标点系统：Q 标记当前位置（小地图黄点 + 3D 信标），直到下一次标点 ——
let worldMark=null, markBeacon=null;
function ensureMarkBeacon(){
  if(markBeacon) return;
  const c=document.createElement('canvas'); c.width=64; c.height=64; const x=c.getContext('2d');
  x.fillStyle='rgba(255,216,58,0.95)'; x.beginPath(); x.moveTo(32,4); x.lineTo(58,60); x.lineTo(6,60); x.closePath(); x.fill();
  x.fillStyle='#000'; x.font='bold 40px sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('!',32,44);
  const tex=new THREE.CanvasTexture(c);
  markBeacon=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
  markBeacon.scale.set(4,4,1); markBeacon.visible=false; scene.add(markBeacon);
}
function placeMark(){
  if(!player||!player.alive||player.downed) return;
  worldMark=player.group.position.clone(); worldMark.y=0;
  ensureMarkBeacon(); markBeacon.visible=true; markBeacon.position.set(worldMark.x,5,worldMark.z);
  toast('📍 已标记位置（小地图黄点 · 聊天 @队友名 可派TA前来）');
}
// —— 淘汰播报：屏幕中下方，最多同时 4 条，3.8s 后淡出 ——
function kfName(c){ return '<span style="color:'+teamCSS(c.team)+';font-weight:bold">'+escapeHtml(c.name)+'</span>'; }
function addKillFeed(html){
  const kf=el('killfeed'); if(!kf) return;
  const d=document.createElement('div'); d.className='kfLine'; d.innerHTML=html;
  kf.appendChild(d);
  while(kf.children.length>4) kf.removeChild(kf.firstChild);
  setTimeout(()=>{ d.style.opacity=0; setTimeout(()=>d.remove(),450); },3800);
}
// —— 队伍聊天：AI 不定时发固定消息（100 条池），玩家可按 T 打字 ——
const CHAT_POOL=[
  '冲了冲了！','稳住别送','我在楼里蹲着呢','有人摸过来了！','队友牛逼！','这波不亏','医疗箱在哪儿','中心大楼有人架狙','绕后偷一个','我卡他们后面了',
  '别站在楼顶装逼','老六实锤了','前面有柱子掩体','补个弹先','谁把我打倒的？！','救我！快救我！','我看见红色那边了','东边有枪声','西边好像没人','撤撤撤打不过',
  '换弹中别指望我','手雷给我留一个','楼下有人守门','我上去狙他们','苟住就是胜利','隔壁队打起来了','捡了个补给箱','血量健康放心冲','有人抢我人头？','蹲坑使我快乐',
  '别吵，我在听脚步','他们要冲脸了？','我们稳如老狗','这地图我熟','跟着我冲A点','B点空了','又白给一个','别扔雷！会误伤','我枪法一般，别指望我','塔不灭！',
  '关注永雏塔菲喵','Ciallo～(∠・ω< )⌒★','谁抢我医疗箱谁是狗','楼上有人！走楼梯','我从坡道绕上去了','狙楼那位别睡了','全都窝在大楼里？','外面安全，快跑','不好意思走错了','刚才那波是我操作的',
  '别拍我，我在装死','这把我稳了','完了我弹药没了','有RPG的那位悠着点','给我一把喷子谢谢','移动靶打不中的，站着别动（指我）','对面有个挂哥吧','别骂了别骂了','这波配合给我打满分','下次我一定救你（下次一定）',
  '萌新瑟瑟发抖','谁也别抢我的人头','侦察无人机好了，要照吗','自爆无人机蓄力中','友军！自己人！别开枪！','蹲草丛里的小可爱是我','楼里在开派对，全是人','三缺一，来打牌吗','前面打完了，过去舔包','别舔了快撤，有人来了',
  '我这把稳如泰山','敌人的敌人就是朋友','报告位置：北边柱子','南边出生点方向有人','中心大楼四层风景不错','我在顶楼看戏','卧倒！有狙击','这狙也太准了','收枪收枪，打不过','虚晃一枪，溜了',
  '包抄成功！他们屁股对我了','别开枪是我！','友军伤害警告','今晚吃鸡…啊不对这是CS','波波波，收到请回答','谁有多的弹药分我点','我数到三一起冲','一…二…你们怎么不等我','赢了一起去吃火锅','输了就当练枪',
  '这准星是不是歪的','键盘侠上线','把中心大楼围起来！','他们五个人蹲一间房？','笑死，对面全在乱跑','下一个淘汰的就是我（不是）','稳住，我们能赢','别管我了，你们冲','摸鱼摸鱼，苟到前五','收到收到'
];
let aiChatT=9;
// —— 0.1B 对话模型（真AI回复）：Worker 懒加载，点了开始就开始后台加载 ——
let aiWorker=null, aiReady=false, aiBusy=false, aiReplyWait=null;
function initChatAI(){
  if(aiWorker) return;
  window.__aiLog=window.__aiLog||[];
  try{
    aiWorker=new Worker('assets/code/chatai-worker.js',{type:'module'});
    aiWorker.onmessage=e=>{
      const d=e.data||{};
      window.__aiLog.push(d.type);
      if(d.type==='ready'){ aiReady=true; toast('🤖 AI队友已上线（'+(d.ms/1000|0)+'s 加载完成）'); }
      else if(d.type==='reply'){ aiBusy=false; if(aiReplyWait){ const f=aiReplyWait; aiReplyWait=null; f(d.reply); } }
      else if(d.type==='error'){ aiBusy=false; console.error('[chatai] worker error:', d.msg||d.err); }
    };
    aiWorker.onerror=ev=>{ aiWorker=null; aiReady=false; aiBusy=false; console.error('[chatai] worker onerror:', ev.message||ev.filename+':'+ev.lineno); };
  }catch(e){ aiWorker=null; console.error('[chatai] init failed:', e); }
}
// 玩家说话后队友的回复池（1~2 个队友会接话）
const REPLY_POOL=[
  '收到！','收到收到','6','哈哈哈哈','说得好','中！','听你的','冲！','好耶','懂了懂了',
  '这就来','等我一秒','别催了别催了','嗯嗯','你说了算','行行行','没问题','稳','跟着大哥混','塔不灭！',
  '你在哪儿我去找你','注意隐蔽','先苟一波','同意','反对！我没说完呢','啊对对对','OK的','包在我身上','又画大饼','你先撤我掩护'
];
function aiReply(text){
  // 0.1B 模型就绪且空闲 → 真·AI 生成回复（Worker 线程）；否则/超时 → 固定回复池
  const pool=characters.filter(c=>c.team===playerTeam&&!c.isPlayer&&c.alive&&!c.downed);
  if(!pool.length) return;
  if(aiWorker && aiReady && !aiBusy){
    const c=pool[(Math.random()*pool.length)|0];
    aiBusy=true;
    const fallback=setTimeout(()=>{ if(aiReplyWait){ const f=aiReplyWait; aiReplyWait=null; f(null); } }, 8000);
    aiReplyWait=reply=>{
      clearTimeout(fallback);
      addChatLine(c.name, c.team, reply || REPLY_POOL[(Math.random()*REPLY_POOL.length)|0]);
    };
    aiWorker.postMessage({type:'gen', text});
  } else {
    const n=1+(Math.random()<0.35?1:0);
    for(let i=0;i<n;i++){
      const c2=pool[(Math.random()*pool.length)|0];
      const msg=REPLY_POOL[(Math.random()*REPLY_POOL.length)|0];
      setTimeout(()=>addChatLine(c2.name, c2.team, msg), 600+Math.random()*1800);
    }
  }
}
function addChatLine(name, team, msg, isMe){
  const box=el('chatbox'); if(!box) return;
  const d=document.createElement('div'); d.className='chatLine'+(isMe?' chatMe':'');
  d.innerHTML='<span style="color:'+teamCSS(team)+';font-weight:bold">'+escapeHtml(name)+'：</span>'+escapeHtml(msg);
  box.appendChild(d);
  while(box.children.length>6) box.removeChild(box.firstChild);
  setTimeout(()=>{ d.style.opacity=0; setTimeout(()=>d.remove(),500); },7000);
}
function updateAIChat(dt){
  if(!running||paused) return;
  aiChatT-=dt;
  if(aiChatT>0) return;
  aiChatT=7+Math.random()*13;
  const pool=characters.filter(c=>!c.isPlayer&&c.alive&&!c.downed);
  if(!pool.length) return;
  const mine=pool.filter(c=>c.team===playerTeam);
  const c=(mine.length&&Math.random()<0.75)?mine[(Math.random()*mine.length)|0]:pool[(Math.random()*pool.length)|0];
  addChatLine(c.name, c.team, CHAT_POOL[(Math.random()*CHAT_POOL.length)|0]);
}
// —— 聊天输入（T 唤起）：@队友名 + 已有标点 → 派 TA 前往标记点（超级AI同样听令）——
let chatOpen=false;
function openChatInput(){
  if(!running||paused||matchOver) return;
  chatOpen=true;
  const bar=el('chatInputBar'); const inp=el('chatInput');
  if(bar) bar.classList.remove('hide');
  if(inp){ inp.value=''; setTimeout(()=>inp.focus(),0); }
  if(!isPhone && document.pointerLockElement===cv) document.exitPointerLock();
}
function closeChatInput(back){
  chatOpen=false;
  const bar=el('chatInputBar'), inp=el('chatInput');
  if(bar) bar.classList.add('hide');
  if(inp) inp.blur();
  if(back && !isPhone && running && !paused){ try{ cv.requestPointerLock(); }catch(e){} }
}
function sendChat(){
  const inp=el('chatInput'); if(!inp) return;
  const text=(inp.value||'').trim();
  if(text){
    addChatLine('你', playerTeam, text, true);
    aiReply(text);   // 队友会接话（0.1B模型生成，超时回退固定池）
    if(text.indexOf('@')>=0){
      if(!worldMark){ toast('先按 Q 标记地点，再 @队友 派TA过去'); }
      else{
        const mts=text.match(/@([^\s@，。！？!?,.]+)/g)||[];
        let hit=false;
        for(const raw of mts){
          const nm=raw.slice(1);
          const t=characters.find(c=>c.team===playerTeam&&!c.isPlayer&&c.alive&&(c.name===nm||c.name.indexOf(nm)>=0||nm.indexOf(c.name)>=0));
          if(t){ t.orderGoal=worldMark.clone(); hit=true;
            addKillFeed('📢 <span style="color:#ffd86a">指挥</span> '+kfName(t)+' 前往标记点！'); }
        }
        if(!hit) toast('没找到这个队友名（看看头顶名牌/小地图）');
        else toast('📢 已下令！队友正在赶往标记点');
      }
    }
  }
  closeChatInput(true);
}
// 聊天输入框事件（输入框内 stopPropagation，键盘不会漏进游戏逻辑）
(function(){
  const inp=el('chatInput'); if(!inp) return;
  inp.addEventListener('keydown', e=>{
    e.stopPropagation();
    if(e.key==='Enter'){ e.preventDefault(); sendChat(); }
    else if(e.key==='Escape'){ e.preventDefault(); closeChatInput(true); }
  });
  const send=el('chatSend'); if(send) send.addEventListener('click', e=>{ e.preventDefault(); sendChat(); });
})();
// —— 小地图：左下角（手机端右上），画队友/玩家朝向/标点/侦查透视敌人 ——
const MM_SIZE=156;
function updateMinimap(){
  const mc=el('minimap'); if(!mc||!player) return;
  const ctx=mc.getContext('2d');
  const S=MM_SIZE, sc=S/(MAP+40);
  const w2m=v=>(v+HALF)*sc;
  ctx.clearRect(0,0,S,S);
  // 中央大楼 + 各栋房屋
  ctx.fillStyle='rgba(120,160,220,.30)';
  ctx.fillRect(S/2-50*sc, S/2-50*sc, 100*sc, 100*sc);
  ctx.fillStyle='rgba(150,180,230,.22)';
  for(const b of buildings) ctx.fillRect(w2m(b.x-b.w/2), w2m(b.z-b.d/2), b.w*sc, b.d*sc);
  // 标点（黄菱形）
  if(worldMark){
    const mx=w2m(worldMark.x), my=w2m(worldMark.z);
    ctx.fillStyle='#ffd83a';
    ctx.beginPath(); ctx.moveTo(mx,my-5); ctx.lineTo(mx+5,my); ctx.lineTo(mx,my+5); ctx.lineTo(mx-5,my); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,216,58,.5)'; ctx.beginPath(); ctx.arc(mx,my,8,0,7); ctx.stroke();
  }
  // 侦查无人机透视：敌人红点
  if(reconActive){
    ctx.fillStyle='rgba(255,80,80,.9)';
    for(const c of characters){
      if(c.team===player.team||!c.alive) continue;
      ctx.fillRect(w2m(c.group.position.x)-2, w2m(c.group.position.z)-2, 4, 4);
    }
  }
  // 队友（倒地半透明）
  for(const c of characters){
    if(c.isPlayer||c.team!==player.team) continue;
    ctx.globalAlpha=c.downed?0.45:1;
    ctx.fillStyle=teamCSS(c.team);
    ctx.beginPath(); ctx.arc(w2m(c.group.position.x), w2m(c.group.position.z), 3, 0, 7); ctx.fill();
    ctx.globalAlpha=1;
  }
  // 玩家箭头（白，朝向实际视角）
  const px=w2m(player.group.position.x), py=w2m(player.group.position.z);
  const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw);
  const ang=Math.atan2(fz,fx);
  ctx.save(); ctx.translate(px,py); ctx.rotate(ang);
  ctx.fillStyle='#ffffff';
  ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-4,4); ctx.lineTo(-4,-4); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ---------- 9. 桌面输入（键盘 / 鼠标） ---------- */
document.addEventListener('keydown', e=>{
  if(chatOpen) return;   // 聊天输入中：按键全归输入框（输入框自身已 stopPropagation，这里是保险）
  if(typeof remapAction!=='undefined' && remapAction){ e.preventDefault(); applyRemap(e); return; }   // 键位绑定捕获（keymap.js）优先级最高
  if(e.key==='/'){ e.preventDefault(); toggleScoreboard(); return; }   // 「/」唤醒 / 收起排行榜
  const k=e.key.toLowerCase(); keys[k]=true;
  if(k==='escape'){ togglePause(); return; }
  if(k==='`'){ togglePause(); return; }   // 与 Esc 同：对局中按一次进设置(解鼠标)，再按返回对局
  if(k===keymap.jump || (keymap.jump===' '&&e.code==='Space')){ e.preventDefault(); if(player&&player.grounded&&running&&!paused) player.jumpQueued=true; return; }
  if(debugMode){   // DEBUG 沙盒：专属键拦截 return，其余键（换枪 F / 换弹 R / 移动）放行到下方主逻辑
    if(e.repeat) return;   // 防键盘重复：避免按住 - 反复开关外挂 / 连续刷单位
    if(k===';'){ debugSpawn('red'); return; }
    if(k==="'"){ debugSpawn('blue'); return; }
    if(k==='.'){ debugDown('red'); return; }
    if(k===','){ debugDown('blue'); return; }
    if(k==='-'){ debugGod(); return; }
    if(k==='y'){ debugWin(); return; }
    if(k==='n'){ debugLose(); return; }
    if(k==='h'){ debugMedkitFront(); return; }
    // 其余键（换枪/换弹等）放行，走到下方主逻辑
  }
  if(player&&player.downed) return;          // 倒地时禁用换弹/换枪/核弹
  if(k===keymap.mark){ placeMark(); return; }
  if(k===keymap.chat){ openChatInput(); return; }
  if(k===keymap.reload) startReload(player);
  else if(k===keymap.switchw) switchWeapon();
  else if(k===keymap.recon) useRecon();
  else if(k===keymap.kami) useKamikaze();
  else if(k===keymap.nuke) callNuke();
});
document.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });
// 「/」唤醒的排行榜开关：对局中随时按 / 打开，再按收起
function toggleScoreboard(){
  const sb=el('scoreboard'); if(!sb) return;
  const show=sb.classList.contains('hide');
  sb.classList.toggle('hide', !show);
  if(show) renderScoreboard();
}
cv.addEventListener('mousedown', e=>{
  if(!running||!player.alive||revivingNow) return;
  if(e.button===0){ if(curWeapon==='grenade')throwGrenade(player); else firing=true; }
});
window.addEventListener('mouseup', e=>{ if(e.button===0)firing=false; });
cv.addEventListener('contextmenu', e=>e.preventDefault());
document.addEventListener('contextmenu', e=>e.preventDefault());
document.addEventListener('mousemove', e=>{
  if(!running||document.pointerLockElement!==cv) return;
  player.yaw-=e.movementX*sensitivity; player.pitch-=e.movementY*sensitivity;
  player.pitch=Math.max(-1.45,Math.min(1.45,player.pitch));
});
document.addEventListener('pointerlockchange', ()=>{
  if(layoutEditing) return;   // 手指键位编辑态（需释放鼠标拖拽）不弹暂停
  // 指针锁丢失（主动 Esc/` 或意外切窗）：若在对局中，自动进暂停设置菜单，绝不弹回开始界面
  // 聊天输入时主动解锁属正常操作，不触发暂停
  if(document.pointerLockElement!==cv && running && !paused && !chatOpen){
    paused=true; el('pause').classList.remove('hide');
  }
});

// 间谍模式：替换开始界面文案（another.js 已注入 UI）
if(spy){ const _p=document.querySelector('#overlay p'); if(_p){ _p.innerHTML=_p.innerHTML
  .replace('蓝队</b>（我方）','红队</b>（我方·间谍）')
  .replace('红队</b> AI','蓝队</b> AI'); } }

/* ---------- 10. 开始 / 主循环 ---------- */
function startGame(){
  if(typeof THREE==='undefined'){ toast('引擎未加载，请检查网络后刷新'); return; }
  if(!sceneReady){ toast('资源加载中…'); return; }
  initAudio();    // 用户手势：预加载 assets/sound 音效
  initChatAI();   // [已上线] 0.1B 对话模型 int4 量化版已部署（git-lfs 托管 model.onnx，ORT CPU wasm + transformers.min.js 同域加载）
  if(isPhone && typeof requestLandscape==='function') requestLandscape();  // 尝试锁横屏
  el('overlay').classList.add('hide'); running=true;
  if(!isPhone) cv.requestPointerLock(); else toast('左摇杆移动 · 右侧开枪/换弹/换枪');
  if(imagod) toast('外挂全开：无敌+无限子弹+飞天');
  updateHUD();
  toast('第 '+roundNum+' 把 · 红方='+bombRoleOf('red')+' 蓝方='+bombRoleOf('blue'));
}
el('overlay').addEventListener('click', startGame);

window.addEventListener('resize', applyResSize);

const clock=new THREE.Clock();

/* —— 渲染性能系统（大地图 + 60~120 人不卡的核心）—— */
// 1) 角色 LOD：按距离分级显示部件，砍掉远处的 draw call
//    近(<70m) 全部件+头顶名 | 中(70~180m) 身体+头+枪 | 远(>180m) 只留身体
//    每 0.25s 才更新一轮，别每帧全图扫
function updateLOD(){
  const pp=player.group.position, mine=player.team;
  for(const c of characters){
    const d=c.group.position.distanceTo(pp);
    const body=c.meshes[0], head=c.meshes[1];
    if(d>180){
      if(body)body.visible=true; if(head)head.visible=false; if(c.gun)c.gun.visible=false;   // 远处：只留身体一个 draw call
      if(c.nameTag)c.nameTag.visible=false;
      c._lod=2;
    } else {
      if(body)body.visible=true; if(head)head.visible=true;
      if(c.gun)c.gun.visible=c.alive&&!c.downed;
      // 头顶名只给存活队友；>70m 也不显示（看不清还费 draw call）
      if(c.nameTag)c.nameTag.visible=c.alive&&c.team===mine&&d<=70;
      c._lod=1;
    }
  }
}
// 2) 自适应分辨率：FPS<42 自动降渲染比例（最低 0.33），FPS>57 缓慢回升
let _fpsAcc=0,_fpsN=0,_adaptT=0;
function adaptResolution(dt){
  _adaptT+=dt; _fpsAcc+=dt; _fpsN++;
  if(_adaptT<2) return;
  const fps=_fpsN/Math.max(_fpsAcc,0.001);
  _adaptT=0;_fpsAcc=0;_fpsN=0;
  if(fps<42 && RES_SCALE>0.33){ RES_SCALE=Math.max(0.33,RES_SCALE-0.08); applyResSize(); }
  else if(fps>57 && RES_SCALE<BASE_SCALE){ RES_SCALE=Math.min(BASE_SCALE,RES_SCALE+0.05); applyResSize(); }
}
// 3) HUD DOM 刷新节流（每帧改 DOM 在低配机上是隐形杀手）
let _hudT=0;
let _hudDomT=0;    // updateHUD 降到 ~8Hz（开枪/受伤等事件仍会即时调用 updateHUD）
let _mmT=0;        // 小地图 Canvas 重绘降到 10Hz
let _pickupT=0;    // 医疗箱/补给箱拾取扫描降到 ~6.7Hz（冷却倒计时仍每帧走）

function animate(){
  requestAnimationFrame(animate);
  let dt=clock.getDelta(); if(dt>0.05)dt=0.05;
  if(sceneReady && running && !paused){
    updatePlayer(dt);
    for(const c of characters) if(!c.isPlayer) updateBot(c,dt);
    for(let i=grenades.length-1;i>=0;i--){ const g=grenades[i]; g.vel.y-=14*dt; g.pos.addScaledVector(g.vel,dt);
      if(g.pos.y<0.3){ g.pos.y=0.3; g.vel.y*=-0.42; g.vel.x*=0.6; g.vel.z*=0.6; if(Math.abs(g.vel.y)<1)g.vel.y=0; }
      g.mesh.position.copy(g.pos); g.fuse-=dt;
      if(g.fuse<=0){ explode(g.pos,g.owner); scene.remove(g.mesh); grenades.splice(i,1); } }
    // 医疗箱拾取与刷新（扫描降频：冷却倒计时每帧，角色距离扫描 0.15s 一轮）
    _pickupT+=dt; const _scanNow = _pickupT>=0.15; if(_scanNow) _pickupT=0;
    for(const mk of medkits){
      if(mk.cd>0){ mk.cd-=dt; if(mk.cd<=0){ mk.active=true; mk.group.visible=true; } continue; }
      if(!_scanNow) continue;
      for(const c of characters){ if(!c.alive||c.downed)continue;
        if(c.group.position.distanceTo(mk.pos)<MEDKIT_RADIUS){
          const heal=Math.min(MEDKIT_HEAL,100-c.hp);
          if(heal>0){ c.hp+=heal; mk.active=false; mk.group.visible=false; mk.cd=MEDKIT_CD;
            if(c.isPlayer){ toast('拾取医疗箱 +'+Math.round(heal)+' 血'); updateHUD(); } }
          break; } }
    }
    updateRockets(dt); updateDrones(dt); tickGunSpecial(dt);
    if(_scanNow) tickLoots();
    updateAIChat(dt);
    _mmT+=dt; if(_mmT>=0.1){ _mmT=0; updateMinimap(); }
    if(bomb.planted){ bomb.timer-=dt; if(bomb.timer<=0) bombExplode(); }
    // 透视：侦查无人机(reconActive) 或 被带 perspective 的枪打中(markT) 都显示穿墙标记
    for(const c of characters){ if(c.mark){ if((reconActive||c.markT>0) && c.alive && !c.downed && c.team!==player.team){ c.mark.visible=true; c.mark.position.set(c.group.position.x,2.7,c.group.position.z); } else c.mark.visible=false; } }
    // 名字牌位置每帧跟随（只改 3 个浮点，开销可忽略；可见性交给 LOD 节流管）
    for(const c of characters){ if(c.nameTag && c.nameTag.visible) c.nameTag.position.set(c.group.position.x, 2.4, c.group.position.z); }
    // 头顶名字/LOD 节流刷新（原来每帧全图扫 sprites，现在 0.25s 一轮）
    _hudT+=dt;
    if(_hudT>0.25){ _hudT=0; updateLOD(); }
    _hudDomT+=dt; if(_hudDomT>=0.12){ _hudDomT=0; updateHUD(); }
    adaptResolution(dt);
  }
  try{ renderer.render(scene,camera); }catch(e){ /* WebGPU 初始化中的首帧等瞬态错误直接吞掉 */ }
}
animate();

// DEBUG 沙盒按钮（手机端用按钮代替键盘；桌面也可点）
[['dbgSpawnRed',()=>debugSpawn('red')],['dbgSpawnBlue',()=>debugSpawn('blue')],
 ['dbgDownRed',()=>debugDown('red')],['dbgDownBlue',()=>debugDown('blue')],
 ['dbgGod',debugGod],['dbgMed',debugMedkitFront],['dbgWin',debugWin],['dbgLose',debugLose],
 ['dbgExit',debugExit],['dbgSwitch',()=>{ switchWeapon(); const b=el('dbgSwitch'); if(b) b.textContent='换枪（'+WEAPONS[curWeapon].name+'）'; }]].forEach(([id,fn])=>{ const b=el(id); if(b) b.addEventListener('click', e=>{ e.preventDefault(); if(!debugMode) return; fn(); }); });
