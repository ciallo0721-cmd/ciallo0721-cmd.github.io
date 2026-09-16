"use strict";
/* ============================================================
   CS · stop.js — 暂停 / 灵敏度 / 分享
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
  teamScores={};
  el('overlay').classList.remove('hide');
  el('startBtn').textContent='点击开始';
  updateHUD();
}
function shareGame(){
  const url=location.href;
  const intro='【12队大乱斗 fyGrid】600m×600m 大战场：12队×5人混战,中央100m三层大楼+全图30栋功能楼,每队1~5名Q-learning超级AI。倒地可爬可救、医疗箱回血。点开即玩,无需下载:\n'+url;
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

// 渲染模式切换（js 实时纹理 / svg 贴图）
const texModeBtn=el('texModeBtn');
function applyTexModeLabel(){
  const isSvg = localStorage.getItem('csTexMode')==='svg';
  texModeBtn.textContent = isSvg ? 'svg贴图渲染(轻量)' : 'js实时渲染(清晰)';
}
texModeBtn.addEventListener('click', ()=>{
  const next = localStorage.getItem('csTexMode')==='svg' ? 'js' : 'svg';
  localStorage.setItem('csTexMode', next);
  location.reload();
});
applyTexModeLabel();

// 渲染后端选择：auto / OpenGL系(WebGL) / three.js / Vulkan系(WebGPU)
// 调研结论：WebGL 基于 OpenGL ES（Web 上的 OpenGL）；WebGPU 基于 Vulkan/Metal/D3D12 模型（Web 上的 Vulkan），
// 2026 年 Chrome/Firefox/Safari 26 全线支持。WebGPU 不跑 GLSL（用 WGSL），因此该后端下场景用 three.js 标准材质渲染。
const BACKENDS = [
  { k:'auto',   label:'自动检测' },
  { k:'webgl',  label:'OpenGL系 (WebGL)' },
  { k:'three',  label:'three.js 标准材质' },
  { k:'webgpu', label:'Vulkan系 (WebGPU)' },
];
const renderBackendBtn=el('renderBackendBtn');
function applyBackendLabel(){
  const saved = localStorage.getItem('csRenderBackend') || 'auto';
  const it = BACKENDS.find(b=>b.k===saved) || BACKENDS[0];
  const webgpuOK = !!(navigator.gpu && typeof THREE.WebGPURenderer==='function');
  let suffix = '';
  if(it.k==='auto')   suffix = webgpuOK ? '→WebGPU' : '→WebGL';
  if(it.k==='webgpu') suffix = webgpuOK ? '' : '→回退WebGL';
  renderBackendBtn.textContent = it.label + suffix;
}
renderBackendBtn.addEventListener('click', ()=>{
  const saved = localStorage.getItem('csRenderBackend') || 'auto';
  const next = BACKENDS[(BACKENDS.findIndex(b=>b.k===saved)+1) % BACKENDS.length];
  localStorage.setItem('csRenderBackend', next.k);
  location.reload();
});
applyBackendLabel();

// 画面风格（自定义 GLSL 着色器循环）：马赛克程序化 / 卡通 / CRT 扫描线（仅 webgl 系后端生效）
const STYLES = [
  { k:'mosaic', label:'程序化马赛克' },
  { k:'toon',   label:'卡通着色 GLSL' },
  { k:'crt',    label:'扫描线 CRT GLSL' },
];
const shaderStyleBtn=el('shaderStyleBtn');
function applyStyleLabel(){
  const cur = localStorage.getItem('csShaderStyle') || 'mosaic';
  const it = STYLES.find(s=>s.k===cur) || STYLES[0];
  shaderStyleBtn.textContent = it.label;
}
shaderStyleBtn.addEventListener('click', ()=>{
  const cur = localStorage.getItem('csShaderStyle') || 'mosaic';
  const next = STYLES[(STYLES.findIndex(s=>s.k===cur)+1) % STYLES.length];
  localStorage.setItem('csShaderStyle', next.k);
  location.reload();
});
applyStyleLabel();
