"use strict";
/* ============================================================
   CS · ai.js — 敌人 AI 状态机 + 战术系统
   ------------------------------------------------------------
   本文件实现了比「直球冲锋」聪明得多的敌方 AI，包含：

     [0] AI 总配置 AI_CFG        —— 所有手感参数集中可调
     [1] 导航网格 + A* 寻路       —— 自动绕开柱子/围墙，不再卡死
     [2] 感知系统                 —— FOV 视野 + 视线(LOS) + 反应时间 + 警觉度
     [3] 掩体 / 包抄 / 侧移几何    —— 会找掩体、绕侧翼、走位不站桩
     [4] 小队分工                 —— 突击 / 包抄 / 支援 三种角色
     [5] 主状态机 updateBot        —— revive/chase/flank/fight/cover/retreat/search/patrol
     [6] 卡死自救 + 调试可视化      —— 长时间不动就强制重新规划

   对外依赖（由 CS.js / gun.js 提供，勿在此修改）：
     MAP, HALF, pillars, characters, medkits, REVIVE_RANGE,
     THREE, resolveCollision, tickRevive, startReload,
     finishReload, botFire, throwGrenade, lineClear(自带)
   被 CS.js 主循环调用的入口： updateBot(b, dt)
   ============================================================ */

// 帮个忙agent 让投雷概率小点 —— 已完成：掷雷改为「无视线才扔 + 12~20s 冷却」(2026-09-07)

/* ============================================================
   [0] AI 总配置 —— 想调手感只改这里
   ============================================================ */
const AI_CFG = {
  /* —— 寻路 —— */
  NAV_CELL:        6,        // 导航网格单元格边长(米)。1.2km 图下 6m/格 = 200×200=4万格，A* 才跑得动
  NAV_MARGIN:      1.8,      // 柱子阻挡外扩裕量（柱半径2.1 + 机体半径）
  REPATH_CHASE:    0.6,      // 追击时重新算路的间隔(秒)（大地图路径长，算一次管更久）
  REPATH_OTHER:    1.5,      // 其它状态重算间隔(秒)
  REPATH_MOVE:     8.0,      // 目标移动超过该距离立即重算(米)
  WP_REACH:        2.2,      // 到达航点的判定半径(米)（格子大了判定跟着放大）

  /* —— 感知 —— */
  FOV_COS:         0.15,     // 视野半角余弦（越小视野越广，0.15≈159°）
  SENSE_CLOSE:     13,       // 13 米内靠听觉必察觉（无视视野/视线）
  REACT_TIME:      0.28,     // 刚发现敌人时的愣神(反应)时间(秒)
  ALERT_DECAY:     0.25,     // 丢失目标后警觉度每秒衰减
  SEARCH_TIME:     3.5,      // 丢失目标后前往最后已知位置的搜索时长(秒)

  /* —— 战斗 —— */
  ENGAGE_MIN:      90,        // 进入交火的最小距离(米)（1.2km 大地图交火距离同步拉远）
  CHASE_MAX:       60,       // 超过该距离不再追击（放弃）
  FIRE_RANGE_AK:   34,       // 超出此距离命中率显著下降
  HIT_NEAR:        0.92,     // 近距离命中率上限
  HIT_FAR:         0.42,     // 远距离命中率下限
  FLANK_DIST:      16,       // 包抄点的侧向偏移距离(米)
  STRAFE_SPEED:    4.6,      // 交火时横向走位速度
  STRAFE_SWITCH:   0.85,     // 切换左右横移的间隔(秒)
  NADE_CHANCE:     0.002,    // 掷雷判定概率（每帧；仅在目标躲掩体后且冷却完毕时才会真扔）
  NADE_CD:         12,       // 每 bot 掷雷冷却基准(秒)，实际 +0~8s 随机——防止人多时全场雷海

  /* —— 生存 —— */
  RETREAT_HP:      35,       // 血量低于此值转入撤退/找掩体
  COVER_HP:        55,       // 血量低于此值优先躲掩体而非硬刚
  REVIVE_RANGE:    80,       // 倒地队友在此范围内才去救（大地图放大）
  REVIVE_SAFE:     16,       // 敌人比这近时先不救（保命）
  THINK_MIN:       0.16,     // AI 思考节流：感知+决策最快 0.16s 一次（移动/开火每帧照常）
  THINK_VAR:       0.08,     // 思考间隔随机抖动，避免 60+ bot 同帧齐思考造成卡顿尖峰

  /* —— 防卡死 —— */
  STUCK_WINDOW:    0.6,      // 卡死检测窗口(秒)
  STUCK_DIST:      0.45,     // 窗口内移动不足此值算卡住
  STUCK_LIMIT:     1.2,      // 连续卡住超过此时长强制重规划+随机抖
};

/* 小队角色参数：突击往前压、包抄走侧翼、支援保人扔雷 */
const AI_ROLES = {
  assault: { fightRange: 11, push: 1.25, nadeBias: 1.0, preferRevive: false },
  flanker: { fightRange: 14, push: 1.0,  nadeBias: 1.1, preferRevive: false },
  support: { fightRange: 18, push: 0.8,  nadeBias: 1.6, preferRevive: true  },
};

/* ============================================================
   [1] 导航网格 + A* 寻路
   ============================================================ */
const NAV_CELL = AI_CFG.NAV_CELL;   // 由 CS.js 按地图尺寸设置（1.2km 图 → 6m/格，200×200）
const NAV_HALF = MAP / 2;
const NAV_N    = Math.round(MAP / NAV_CELL);
let navGrid  = null;     // Uint8Array: 1 = 阻挡
let navBuilt = false;

const _navI  = x => Math.floor((x + NAV_HALF) / NAV_CELL);
const _navJ  = z => Math.floor((z + NAV_HALF) / NAV_CELL);
const _navWX = i => -NAV_HALF + (i + 0.5) * NAV_CELL;
const _navWZ = j => -NAV_HALF + (j + 0.5) * NAV_CELL;

function navBlocked(i, j){
  if(i < 0 || j < 0 || i >= NAV_N || j >= NAV_N) return true;
  return navGrid[j * NAV_N + i] === 1;
}

/* 构建静态网格：柱子(圆) + 房屋墙(矩形) + 四周边界标记为阻挡
   注意：墙体导航裕量(wallMargin)必须明显小于门洞宽度的一半，
   否则 3m 门洞被两边各外扩 1.4m 堵成 0.2m 缝 → A* 进不去房屋，
   导致站点是「房屋内 C4」(站点B)时 bot 永远下不了/拆不了包。 */
const WALL_NAV_MARGIN = 0.6;
function buildNav(){
  navGrid = new Uint8Array(NAV_N * NAV_N);
  const m = AI_CFG.NAV_MARGIN;          // 柱子阻挡裕量（机体半径+柱半径）
  for(let j = 0; j < NAV_N; j++) for(let i = 0; i < NAV_N; i++){
    const wx = _navWX(i), wz = _navWZ(j);
    let blk = false;
    for(const p of pillars){ if(Math.hypot(wx - p.x, wz - p.z) < p.r + m){ blk = true; break; } }
    if(!blk){ for(const r of walls){ if(wx > r.x-r.w/2-WALL_NAV_MARGIN && wx < r.x+r.w/2+WALL_NAV_MARGIN && wz > r.z-r.d/2-WALL_NAV_MARGIN && wz < r.z+r.d/2+WALL_NAV_MARGIN){ blk = true; break; } } }
    if(blk) navGrid[j * NAV_N + i] = 1;
  }
  for(let i = 0; i < NAV_N; i++){
    navGrid[0 * NAV_N + i] = 1;
    navGrid[(NAV_N - 1) * NAV_N + i] = 1;
    navGrid[i * NAV_N + 0] = 1;
    navGrid[i * NAV_N + (NAV_N - 1)] = 1;
  }
}
function ensureNav(){ if(!navBuilt){ if(!pillars.length) return; buildNav(); navBuilt = true; } }

/* 任意世界坐标 → 最近的「可行走格」中心坐标 */
function navSnap(x, z){
  let i = _navI(x), j = _navJ(z);
  if(!navBlocked(i, j)) return { i, j };
  for(let r = 1; r < NAV_N; r++){
    for(let dj = -r; dj <= r; dj++) for(let di = -r; di <= r; di++){
      if(Math.abs(di) !== r && Math.abs(dj) !== r) continue;
      const ni = i + di, nj = j + dj;
      if(!navBlocked(ni, nj)) return { i: ni, j: nj };
    }
  }
  return { i, j };
}

/* 视线检测：a→b 之间是否被柱子挡住（直视 = 无遮挡） */
function lineClear(a, b){
  const steps = Math.ceil(a.distanceTo(b) / 1.0);
  for(let s = 1; s < steps; s++){
    const t = s / steps, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    for(const p of pillars){ if(Math.hypot(x - p.x, z - p.z) < p.r + 0.6) return false; }
  }
  return true;
}
const hasLOS = lineClear;   // 别名，语义更清楚

/* 贪心视线平滑：去掉中间能被直线连接的冗余航点，路径更自然 */
function smoothPath(path, gx, gz){
  if(path.length <= 2){ path[path.length - 1] = new THREE.Vector3(gx, 0, gz); return path; }
  const out = [path[0]];
  let anchor = 0;
  for(let i = 2; i < path.length; i++){
    if(!lineClear(path[anchor], path[i])){ out.push(path[i - 1]); anchor = i - 1; }
  }
  out.push(path[path.length - 1]);
  out[out.length - 1] = new THREE.Vector3(gx, 0, gz);
  return out;
}

/* A*（八方向，对角防穿角）返回世界坐标航点数组
   性能版（1.2km 图 200×200 格 + 60 bot 高频寻路）：
   - 二叉堆 open set（旧版线性扫 Set，最坏 O(n²) 直接把帧打穿）
   - gScore/came/stamp/closed 缓冲全局复用，不再每次寻路 new 三个大数组喂 GC
   - stamp 代数标记代替 fill(Infinity) 全量重置
   - closed 集防重展开：大地图 f 值超平坦，无 closed 会出现
     「改进→重展开→再改进」的雪球（实测 845 格被 push 18 万次）；
     octile 启发式在均匀网格上是一致的，首次弹出即最优，closed 检查安全 */
const _asBuf = { cap: 0, gScore: null, fScore: null, came: null, stamp: null, closed: null, gen: 0 };
function findPath(sx, sz, gx, gz){
  ensureNav();
  if(!navGrid) return null;
  const N = NAV_N * NAV_N;
  if(_asBuf.cap !== N){
    _asBuf.gScore = new Float32Array(N); _asBuf.fScore = new Float32Array(N);
    _asBuf.came = new Int32Array(N);     _asBuf.stamp = new Uint32Array(N);
    _asBuf.closed = new Uint32Array(N);
    _asBuf.cap = N; _asBuf.gen = 0;
  }
  const { gScore, fScore, came, stamp, closed } = _asBuf;
  const gen = ++_asBuf.gen;
  const s = navSnap(sx, sz), g = navSnap(gx, gz);
  const startIdx = s.j * NAV_N + s.i, goalIdx = g.j * NAV_N + g.i;
  if(startIdx === goalIdx) return [new THREE.Vector3(gx, 0, gz)];
  const h = (i, j) => { const dx = Math.abs(i - g.i), dz = Math.abs(j - g.j); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
  gScore[startIdx] = 0; fScore[startIdx] = h(s.i, s.j);
  came[startIdx] = -1; stamp[startIdx] = gen; closed[startIdx] = gen - 1;   // gen-1 ≠ gen，即未关闭
  const heap = [];
  const heapPush = (idx) => {
    heap.push(idx);
    let i = heap.length - 1;
    while(i > 0){
      const p = (i - 1) >> 1;
      if(fScore[heap[p]] <= fScore[heap[i]]) break;
      const t = heap[p]; heap[p] = heap[i]; heap[i] = t;
      i = p;
    }
  };
  const heapPop = () => {
    const top = heap[0], last = heap.pop(), n = heap.length;
    if(n > 0){
      heap[0] = last;
      let i = 0;
      for(;;){
        const l = i * 2 + 1, r = l + 1; let m = i;
        if(l < n && fScore[heap[l]] < fScore[heap[m]]) m = l;
        if(r < n && fScore[heap[r]] < fScore[heap[m]]) m = r;
        if(m === i) break;
        const t = heap[m]; heap[m] = heap[i]; heap[i] = t;
        i = m;
      }
    }
    return top;
  };
  heapPush(startIdx);
  const DIRS = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
  let guard = 0;
  while(heap.length && guard++ < 46000){
    const cur = heapPop();
    if(cur === goalIdx){
      const path = []; let c = cur;
      while(c !== -1){ const ci = c % NAV_N, cj = (c - c % NAV_N) / NAV_N; path.push(new THREE.Vector3(_navWX(ci), 0, _navWZ(cj))); c = came[c]; }
      path.reverse();
      return smoothPath(path, gx, gz);
    }
    if(closed[cur] === gen) continue;   // 已展开过（陈旧堆条目）：跳过
    closed[cur] = gen;
    const ci = cur % NAV_N, cj = (cur - cur % NAV_N) / NAV_N;
    for(const [di, dj, cost] of DIRS){
      const ni = ci + di, nj = cj + dj;
      if(navBlocked(ni, nj)) continue;
      if(di !== 0 && dj !== 0 && (navBlocked(ci + di, cj) || navBlocked(ci, cj + dj))) continue;
      const ni2 = nj * NAV_N + ni;
      if(closed[ni2] === gen) continue; // 已最优，不再 Relax
      const tg = gScore[cur] + cost;
      if(stamp[ni2] !== gen || tg < gScore[ni2]){
        stamp[ni2] = gen; came[ni2] = cur; gScore[ni2] = tg;
        fScore[ni2] = tg + h(ni, nj);
        heapPush(ni2);
      }
    }
  }
  return null;
}

/* 给某个 bot 规划到 (tx,tz) 的路径，写回 b.path 等字段
   快路径：起点→终点直线无遮挡时直接冲（1.2km 图只有 34 柱+10 房，
   大部分寻路命中此分支，A* 只在真正需要绕障时才跑） */
function planTo(b, tx, tz, state){
  const from = b.group.position;
  const dist = Math.hypot(tx - from.x, tz - from.z);
  if(dist > 0.5 && lineClear(from, new THREE.Vector3(tx, 0, tz))){
    b.path = [new THREE.Vector3(tx, 0, tz)];
    b.pathIdx = 0;
    b.pathGoal  = new THREE.Vector3(tx, 0, tz);
    b.pathState = state;
    return;
  }
  const np = findPath(b.group.position.x, b.group.position.z, tx, tz);
  if(np && np.length){
    b.path = np;
    b.pathIdx = np.length > 1 ? 1 : 0;   // 跳过起点格（就在脚下）
  } else {
    // 不可达：直奔目标（resolveCollision 兜底，不会冻结卡死）
    b.path = [new THREE.Vector3(tx, 0, tz)];
    b.pathIdx = 0;
  }
  b.pathGoal  = new THREE.Vector3(tx, 0, tz);
  b.pathState = state;
}

/* 沿当前路径前进，返回「是否已抵达终点」 */
function followPath(b, dt, speed){
  if(!b.path || b.pathIdx >= b.path.length) return true;
  const wp = b.path[b.pathIdx];
  const dx = wp.x - b.group.position.x, dz = wp.z - b.group.position.z;
  const d = Math.hypot(dx, dz);
  if(d < AI_CFG.WP_REACH) b.pathIdx++;
  let vx = 0, vz = 0;
  if(d > 0.001){ vx = dx / d; vz = dz / d; }
  const sp = speed * slowMul(b);   // 被 cold 凝固命中 → 移速减半
  b.group.position.x += vx * sp * dt;
  b.group.position.z += vz * sp * dt;
  return b.pathIdx >= b.path.length;
}

/* ============================================================
   [2] 感知系统
   ============================================================ */
/* 敌人在不在视野内（FOV 锥形，背后也能被察觉靠 SENSE_CLOSE） */
function inFOV(b, t){
  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
  const dx = t.group.position.x - b.group.position.x, dz = t.group.position.z - b.group.position.z;
  const d = Math.hypot(dx, dz) || 1;
  const dot = (fx * dx + fz * dz) / d;
  return dot >= AI_CFG.FOV_COS;
}

/* 返回当前「可见」的敌人（最近 + 有视线 + 在视野/近距），否则 null */
function perceive(b, dt){
  let enemy = null, ed = 1e9;
  for(const c of characters){
    if(c === b || !c.alive || c.downed || c.team === b.team) continue;
    const d = b.group.position.distanceTo(c.group.position);
    if(d < ed){ ed = d; enemy = c; }
  }
  if(!enemy){ b._perceiveDist = 1e9; return null; }
  b._perceiveDist = ed;

  const aware = (ed < AI_CFG.SENSE_CLOSE) || (inFOV(b, enemy) && hasLOS(b.group.position, enemy.group.position));
  if(aware){
    if(b.target !== enemy){ b.reactT = AI_CFG.REACT_TIME; }   // 刚发现 → 愣一下
    b.target    = enemy;
    b.lastSeen  = enemy.group.position.clone();
    b.alert     = 1;
    b._lostT    = 0;
  } else {
    // 看不到：警觉度衰减，超时清除目标转入搜索
    b.alert = Math.max(0, (b.alert || 0) - AI_CFG.ALERT_DECAY * dt);
    if(b.alert <= 0){ b.target = null; }
  }
  return b.target;
}

/* 最近的倒地队友（去救） */
function nearestDownedTeammate(b){
  let t = null, td = 1e9;
  for(const c of characters){
    if(c.team !== b.team || !c.downed) continue;
    const d = b.group.position.distanceTo(c.group.position);
    if(d < td){ td = d; t = c; }
  }
  return t ? { ch: t, d: td } : null;
}

/* ============================================================
   [3] 掩体 / 包抄 / 侧移 几何
   ============================================================ */
/* 找离敌人最安全的掩体点：选某根柱子「背向敌人」的那一侧 */
function bestCover(b, enemyPos){
  let best = null, bestScore = -1e9;
  for(const p of pillars){
    const dx = p.x - enemyPos.x, dz = p.z - enemyPos.z;
    const d = Math.hypot(dx, dz) || 1;
    const cx = p.x + dx / d * (p.r + 1.9);   // 柱子背敌侧
    const cz = p.z + dz / d * (p.r + 1.9);
    if(Math.abs(cx) > NAV_HALF - 3 || Math.abs(cz) > NAV_HALF - 3) continue;
    const distToMe = Math.hypot(cx - b.group.position.x, cz - b.group.position.z);
    const distToEnemy = Math.hypot(cx - enemyPos.x, cz - enemyPos.z);
    if(distToEnemy < 5) continue;            // 离敌人太近的掩体没用
    // 评分：离敌人适中(利于偷瞄) + 离自己近(快到) + 从掩体能看见敌人
    let score = -Math.abs(distToEnemy - 12) - distToMe * 0.3;
    if(hasLOS(new THREE.Vector3(cx, 0, cz), enemyPos)) score += 6;
    if(score > bestScore){ bestScore = score; best = new THREE.Vector3(cx, 0, cz); }
  }
  return best;
}

/* 包抄点：在敌人侧翼偏移 FLANK_DIST，挑能看见敌人的那一侧 */
function flankPoint(b, enemyPos){
  const dx = enemyPos.x - b.group.position.x, dz = enemyPos.z - b.group.position.z;
  const d = Math.hypot(dx, dz) || 1;
  const px = -dz / d, pz = dx / d;           // 垂直方向
  const off = AI_CFG.FLANK_DIST;
  const cand = [
    new THREE.Vector3(enemyPos.x + px * off, 0, enemyPos.z + pz * off),
    new THREE.Vector3(enemyPos.x - px * off, 0, enemyPos.z - pz * off),
  ];
  let pick = cand[0];
  if(!hasLOS(pick, enemyPos) && hasLOS(cand[1], enemyPos)) pick = cand[1];
  // 夹在地图内
  pick.x = Math.max(-NAV_HALF + 3, Math.min(NAV_HALF - 3, pick.x));
  pick.z = Math.max(-NAV_HALF + 3, Math.min(NAV_HALF - 3, pick.z));
  return pick;
}

/* 与队友保持间距，避免五个人叠成一个点 */
function separation(b){
  let sx = 0, sz = 0;
  for(const c of characters){
    if(c === b || c.team !== b.team || !c.alive || c.downed) continue;
    const dx = b.group.position.x - c.group.position.x, dz = b.group.position.z - c.group.position.z;
    const d = Math.hypot(dx, dz);
    if(d < 2.2 && d > 0.001){ sx += dx / d * (2.2 - d); sz += dz / d * (2.2 - d); }
  }
  return { x: sx, z: sz };
}

/* 友军是否挡在「我→目标」连线上（避免误伤队友） */
function teammateInLine(b, target){
  const a = b.group.position, c = target.group.position;
  for(const m of characters){
    if(m === b || m === target || m.team !== b.team || !m.alive || m.downed) continue;
    const mx = m.group.position.x, mz = m.group.position.z;
    const t = ((mx - a.x) * (c.x - a.x) + (mz - a.z) * (c.z - a.z)) /
              ((c.x - a.x) ** 2 + (c.z - a.z) ** 2 || 1);
    if(t < 0.05 || t > 0.95) continue;
    const px = a.x + (c.x - a.x) * t, pz = a.z + (c.z - a.z) * t;
    if(Math.hypot(mx - px, mz - pz) < 0.9) return true;
  }
  return false;
}

/* ============================================================
   [4] 小队分工（首次出现时按出生顺序分配角色）
   ============================================================ */
const _roleOrder = ['assault', 'flanker', 'support', 'assault', 'flanker'];
let _roleAssigned = 0;
function assignRole(b){
  if(b.aiRole) return;
  b.aiRole = _roleOrder[_roleAssigned % _roleOrder.length];
  _roleAssigned++;
  const r = AI_ROLES[b.aiRole];
  b.fightRange = r.fightRange;
  b.pushMul    = r.push;
  b.nadeBias   = r.nadeBias;
  b.preferRev  = r.preferRevive;
}

/* ============================================================
   [5] 主状态机
   ============================================================ */
function patrolPoint(){
  return new THREE.Vector3((Math.random() - 0.5) * (MAP - 60), 0, (Math.random() - 0.5) * (MAP - 60));
}
/* 中央大楼巡逻点（50% 的 AI 爱扎堆这里：狙击/苟分/钢枪一体） */
function towerPoint(){
  return new THREE.Vector3((Math.random() - 0.5) * 90, 0, (Math.random() - 0.5) * 90);
}

/* 开火决策：反应时间 + 装弹 + 视线(缓存) + 命中率 + 防误伤 + 掷雷(带冷却)
   性能要点：视线检测 hasLOS 每步遍历 40+ 柱子，原来每帧每 bot 都算
   （60 bot × 60fps ≈ 每帧数万次运算）——现在降到思考周期(0.16~0.24s)算一次，
   结果缓存在 b._losOK / b._tmLine，开火只读缓存。 */
function botTryFire(b, target, nd, dt){
  if(b.reloading) return;
  if(b.reactT > 0){ b.reactT -= dt; return; }     // 刚发现，愣神中
  if(b.ammo[b.weapon].m <= 0){ startReload(b); return; }   // 弹匣空 → 换弹
  /* —— 掷雷决策（先于开火判定：目标躲掩体后=无视线才是扔雷的正确时机）—— */
  if((b._nadeCd || 0) > 0){
    b._nadeCd -= dt;
  } else if(nd < 14 && b.ammo.grenade > 0 && b._losOK === false
            && Math.random() < AI_CFG.NADE_CHANCE * (b.nadeBias || 1)){
    b._nadeCd = AI_CFG.NADE_CD + Math.random() * 8;   // 冷却 12~20s，人多也不至于雷海
    throwGrenade(b);
  }
  if(b._losOK === false) return;                  // 视线被挡（思考周期缓存）→ 不开枪
  if(b._tmLine === true) return;                  // 队友挡枪线（缓存）→ 别崩队友
  if(nd > AI_CFG.ENGAGE_MIN){
    const far = Math.max(0, nd - AI_CFG.ENGAGE_MIN);
    const chance = Math.max(AI_CFG.HIT_FAR, AI_CFG.HIT_NEAR - far * 0.016);
    if(Math.random() > chance) return;                          // 远距离更容易脱靶
  }
  b.aiTimer -= dt;
  if(b.aiTimer <= 0){
    b.aiTimer = (b.weapon === 'ak') ? 0.2 : 0.5;
    botFire(b, target);
  }
}

/* 状态决策：返回状态名 + 相关目标 */
function decideState(b, enemy, dtm, nd){
  assignRole(b);
  // 1) 优先救队友（支援角色更积极；附近有敌人贴脸则先保命）
  if(dtm && dtm.d < AI_CFG.REVIVE_RANGE && (b.preferRev || !enemy || nd > AI_CFG.REVIVE_SAFE)){
    return 'revive';
  }
  // 1.5) 超级AI：Q-learning 决策覆盖（Q表 assets/Q/qlearning.json，由 train.py 训练生成）
  if(b.superAI && typeof qPick==='function'){
    const a=qPick(b);
    if(a) return a;
  }
  if(enemy && nd < AI_CFG.CHASE_MAX){
    // 2) 低血：撤到医疗箱或找掩体
    if(b.hp < AI_CFG.RETREAT_HP && !(dtm && dtm.d < AI_CFG.REVIVE_RANGE && b.preferRev)){
      return 'retreat';
    }
    if(b.hp < AI_CFG.COVER_HP && !hasLOS(b.group.position, enemy.group.position)){
      return 'cover';
    }
    // 3) 视野被挡 → 推进/重新找角度
    if(!hasLOS(b.group.position, enemy.group.position)){
      return (b.aiRole === 'flanker') ? 'flank' : 'chase';
    }
    // 4) 在交火距离内 → 对枪走位；太远 → 压上
    const fr = b.fightRange || 13;
    if(nd > fr + 4 * (b.pushMul || 1)) return (b.aiRole === 'flanker') ? 'flank' : 'chase';
    return 'fight';
  }
  // 5) 没敌人：去最后已知位置搜一下，否则巡逻 / 找血
  if(b.lastSeen && (b._lostT || 0) < AI_CFG.SEARCH_TIME) return 'search';
  if(b.hp < AI_CFG.COVER_HP){
    let best = null, bd = 1e9;
    for(const mk of medkits){ if(!mk.active) continue; const d = b.group.position.distanceTo(mk.pos); if(d < bd){ bd = d; best = mk; } }
    if(best) return 'retreat';
  }
  return 'patrol';
}

function updateBot(b, dt){
  if(!b || !b.group) return;   // 铁桶守卫：任何空角色/已回收模型都直接跳过，绝不崩帧
  /* —— 倒地：缓慢爬向最近的存活队友，方便被救（不再原地躺平） —— */
  if(b.downed){
    b.downedT += dt;
    let ally = null, ad = 1e9;
    for(const c of characters){
      if(c === b || c.team !== b.team || !c.alive || c.downed) continue;
      const d = b.group.position.distanceTo(c.group.position);
      if(d < ad){ ad = d; ally = c; }
    }
    if(ally){
      const dx = ally.group.position.x - b.group.position.x;
      const dz = ally.group.position.z - b.group.position.z;
      const d = Math.hypot(dx, dz);
      if(d > 1.3){                                  // 还没贴到队友就继续爬
        const crawl = 1.5;
        b.group.position.x += dx / d * crawl * dt;
        b.group.position.z += dz / d * crawl * dt;
        resolveCollision(b.group.position);
        // 注意：倒地模型已绕 X 轴躺平(rotation.x≈π/2)，此处绝不改 rotation.y，
        // 否则躺平的身子会绕竖轴像陀螺一样高速自转（视觉上像开挂）
      }
    }
    return;
  }
  if(b.reloading){ b.reloadT -= dt; if(b.reloadT <= 0) finishReload(b); }
  ensureNav();

  /* —— 5.1+5.2 感知 + 状态决策（思考节流版）——
     1.2km 大地图 60+ bot：感知/决策全图扫 O(n²)，每帧跑会把 CPU 打爆。
     现在每 bot 每 0.16~0.24s 才「思考」一次，结果缓存到 b._th；
     移动/寻路跟随/开火仍然每帧执行，手感不变。 */
  b._thinkT = (b._thinkT || 0) - dt;
  if(!b._th || b._thinkT <= 0){
    b._thinkT = AI_CFG.THINK_MIN + Math.random() * AI_CFG.THINK_VAR;
    const enemy = perceive(b, dt);
    const nd = enemy ? b.group.position.distanceTo(enemy.group.position) : 1e9;
    const dtm = nearestDownedTeammate(b);
    b.aiTarget = enemy;                               // 给掷雷逻辑用方向
    if(!enemy) b._lostT = (b._lostT || 0) + AI_CFG.THINK_MIN;   // 丢失目标计时（按节流周期累计）
    b._th = { enemy, nd, dtm, state: decideState(b, enemy, dtm, nd) };
    // —— 降频缓存（原每帧全算，60 bot 时是 CPU 大头）——
    // 视线 hasLOS 每步遍历 40+ 柱子；teammateInLine / separation 每次全图扫角色。
    // 现在只在思考周期(0.16~0.24s)算一次，供每帧的开火/移动逻辑读缓存。
    b._losOK  = enemy ? hasLOS(b.group.position, enemy.group.position) : false;
    b._tmLine = enemy ? teammateInLine(b, enemy) : false;
    b._sep    = separation(b);
  b.aiState = b._th.state;
  }
  const _th = b._th;
  let enemy = _th.enemy, nd = _th.nd, dtm = _th.dtm;
  if(enemy && (!enemy.group || !enemy.alive)) enemy = null;   // 敌人模型已回收/已阵亡 → 视为失去目标
  if(dtm && (!dtm.ch || !dtm.ch.group || !dtm.ch.alive || !dtm.ch.downed)) dtm = null;   // 救援目标已离场/已救起 → 失效
  let state = _th.state;
  // 状态需要敌人却已丢失 → 降级巡逻；需要救援目标却失效 → 降级巡逻（下一思考周期会重新感知）
  if(!enemy && (state==='fight'||state==='chase'||state==='flank'||state==='cover')) state='patrol';
  if(!dtm && state==='revive') state='patrol';
  /* —— 指挥系统：玩家 @队友 后 TA 放下一切直奔标记点（超级AI同样听令）—— */
  if(b.orderGoal){
    if(b.group.position.distanceTo(b.orderGoal) < 3.5){
      b.orderGoal=null;
      if(b.team===playerTeam) toast(b.name+' 已到达标记点');
    } else state='order';
  }

  /* —— 5.3 选目标点 + 速度 + 行为 —— */
  let goal = null, speed = 4, fireTarget = null, strafe = false;
  switch(state){
    case 'revive':
      // 已在救援范围(3.2m)内：原地站定救人，绝不再追着「正在爬动的倒地队友」跑，
      // 否则目标点每帧甩动 → 救援者朝向狂摆 → 看着像高速自转开挂
      if(dtm.d <= REVIVE_RANGE){ goal = b.group.position.clone(); speed = 0; }
      else { goal = dtm.ch.group.position; speed = 4.5; }
      break;
    case 'order':   // 玩家指挥：放下一切，直奔标记点
      goal = b.orderGoal; speed = 6.2;
      break;
    case 'chase':
      goal = enemy.group.position; speed = 5.2 * (b.pushMul || 1);
      fireTarget = enemy;
      break;
    case 'flank': {
      goal = flankPoint(b, enemy.group.position); speed = 5.0;
      fireTarget = enemy;
      break; }
    case 'fight':
      // 维持在 fightRange 附近：远了压上、近了后撤、否则侧移
      goal = enemy.group.position; speed = 4.6;
      fireTarget = enemy; strafe = true;
      break;
    case 'cover': {
      const cv = bestCover(b, enemy.group.position) || enemy.group.position;
      goal = cv; speed = 5.0; fireTarget = enemy;
      break; }
    case 'retreat': {
      let best = null, bd = 1e9;
      for(const mk of medkits){ if(!mk.active) continue; const d = b.group.position.distanceTo(mk.pos); if(d < bd){ bd = d; best = mk; } }
      goal = best ? best.pos : (enemy ? enemy.group.position : patrolPoint());
      speed = 5.5;
      break; }
    case 'search':
      goal = b.lastSeen; speed = 4.5;
      break;
    case 'patrol':
    default:
      if(!b.moveTarget || b.group.position.distanceTo(b.moveTarget) < 2.5) b.moveTarget = b.lovesTower ? towerPoint() : patrolPoint();
      goal = b.moveTarget; speed = 3.4;
      break;
  }

  /* —— 5.3b 下包 / 拆包目标（覆盖普通目标；附近有敌人则优先战斗） —— */
  const brole = b.team ? bombRoleOf(b.team) : null;
  if(!b.orderGoal && brole==='T' && !bomb.planted && (!enemy || nd>24)){
    const st = nearestSite(b.group.position);
    if(st){ goal = st.site.pos.clone(); speed = 4.5;
      if(st.d <= BOMB_PLANT_R){ b.bombProg = (b.bombProg||0) + dt; if(b.bombProg>=PLANT_TIME) plantBomb(st.site, b.team); }
      else b.bombProg = 0; }
  } else if(!b.orderGoal && brole==='CT' && bomb.planted && bomb.pos && (!enemy || nd>24)){
    const db = b.group.position.distanceTo(bomb.pos);
    if(db <= BOMB_DEFUSE_R){ b.bombProg = (b.bombProg||0) + dt; if(b.bombProg>=DEFUSE_TIME) defuseBomb(b.team); goal = null; }
    else { goal = bomb.pos.clone(); speed = 5; }
  }
  if(!goal){ goal = b.group.position.clone(); speed = 0; }   // 拆弹中：原地不动

  /* —— 5.4 路径重算（节流） —— */
  b.pathTimer = (b.pathTimer || 0) - dt;
  const goalMoved = b.pathGoal && goal.distanceTo(b.pathGoal) > AI_CFG.REPATH_MOVE;
  const repath = !b.path || b.pathIdx >= (b.path ? b.path.length : 0) || b.pathTimer <= 0 || goalMoved || b.pathState !== state;
  if(repath){
    planTo(b, goal.x, goal.z, state);
    b.pathTimer = (state === 'chase' || state === 'flank' || state === 'retreat') ? AI_CFG.REPATH_CHASE : AI_CFG.REPATH_OTHER;
  }

  /* —— 5.5 合成移动向量（寻路 + 分离 + 侧移） —— */
  let mvx = 0, mvz = 0;
  if(b.path && b.pathIdx < b.path.length){
    const wp = b.path[b.pathIdx];
    const dx = wp.x - b.group.position.x, dz = wp.z - b.group.position.z;
    const d = Math.hypot(dx, dz);
    if(d < AI_CFG.WP_REACH) b.pathIdx++;
    if(d > 0.001){ mvx = dx / d; mvz = dz / d; }
  }
  if(b.pathIdx >= (b.path ? b.path.length : 0)) b.pathTimer = 0;   // 到站→下帧重算追移动目标

  const sep = b._sep || { x: 0, z: 0 };   // 思考周期缓存（每 0.16~0.24s 重算一次）
  mvx += sep.x * 0.8; mvz += sep.z * 0.8;

  // 交火时的横向走位（让bot成为更难打的移动靶）
  if(strafe && enemy){
    b.strafeT = (b.strafeT || 0) - dt;
    if(b.strafeT <= 0){ b.strafeT = AI_CFG.STRAFE_SWITCH; b.strafeSign = (b.strafeSign === 1) ? -1 : 1; }
    const dx = enemy.group.position.x - b.group.position.x, dz = enemy.group.position.z - b.group.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const px = -dz / d, pz = dx / d;               // 垂直方向
    mvx += px * (b.strafeSign || 1) * 0.9;
    mvz += pz * (b.strafeSign || 1) * 0.9;
  }

  // fight 状态：远了压上 / 近了后撤（微调，不覆盖寻路主体）
  if(state === 'fight' && enemy){
    const fr = b.fightRange || 13;
    if(nd > fr + 3)      { mvx += (enemy.group.position.x - b.group.position.x) / (nd || 1) * 0.6; mvz += (enemy.group.position.z - b.group.position.z) / (nd || 1) * 0.6; }
    else if(nd < fr - 3) { mvx -= (enemy.group.position.x - b.group.position.x) / (nd || 1) * 0.6; mvz -= (enemy.group.position.z - b.group.position.z) / (nd || 1) * 0.6; }
  }

  const vl = Math.hypot(mvx, mvz);
  if(vl > 0.001){
    mvx /= vl; mvz /= vl;
    const sp = speed * slowMul(b);   // 被 cold 凝固命中 → 移速减半
    b.group.position.x += mvx * sp * dt;
    b.group.position.z += mvz * sp * dt;
  }

  /* —— 5.6 卡死自救 —— */
  b._stuckAcc = (b._stuckAcc || 0) + b.group.position.distanceTo(b._stuckPrev || b.group.position);
  if(!b._stuckPrev) b._stuckPrev = b.group.position.clone();
  b._stuckWin = (b._stuckWin || 0) + dt;
  if(b._stuckWin >= AI_CFG.STUCK_WINDOW){
    if(b._stuckAcc < AI_CFG.STUCK_DIST && enemy){     // 想动却没动 → 强制重规划 + 随机抖
      b.path = null; b.pathTimer = 0;
      b.group.position.x += (Math.random() - 0.5) * 1.5;
      b.group.position.z += (Math.random() - 0.5) * 1.5;
    }
    b._stuckAcc = 0; b._stuckWin = 0;
  }
  b._stuckPrev.copy(b.group.position);

  /* —— 5.7 朝向 —— */
  if((state === 'chase' || state === 'flank' || state === 'fight' || state === 'cover') && enemy && nd < 24){
    // 战斗时面向敌人（保证枪口对准）
    b.yaw = Math.atan2(enemy.group.position.x - b.group.position.x, enemy.group.position.z - b.group.position.z);
  } else if(vl > 0.05){        // 仅在移动向量足够大时更新朝向，避免静止时数值抖动造成自转
    b.yaw = Math.atan2(mvx, mvz);
  }

  /* —— 5.8 行为动作 —— */
  if(state === 'revive'){
    if(dtm.d <= REVIVE_RANGE) tickRevive(dtm.ch, dt, b);
  } else if(fireTarget){
    botTryFire(b, fireTarget, nd, dt);
  }

  resolveCollision(b.group.position);
  b.group.position.y = 0;
  b.group.rotation.y = b.yaw;
}

/* ============================================================
   [6] 调试可视化（可选，不影响正常游玩）
   在控制台执行 window.__CS_AI_DEBUG=true 后刷新即可看到
   导航网格阻挡格(暗红)与掩体点(黄)的调试标记。
   ============================================================ */
function buildAIDebug(){
  if(!navGrid || window.__CS_AIDebug !== true) return;
  const grp = new THREE.Group(); grp.name = 'aiDebug';
  const blockedMat = new THREE.MeshBasicMaterial({ color: 0x882222, transparent: true, opacity: 0.25 });
  const cell = NAV_CELL;
  for(let j = 0; j < NAV_N; j++) for(let i = 0; i < NAV_N; i++){
    if(!navBlocked(i, j)) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(cell * 0.9, 0.2, cell * 0.9), blockedMat);
    m.position.set(_navWX(i), 0.1, _navWZ(j)); grp.add(m);
  }
  scene.add(grp);
}
// 场景就绪后挂载一次
if(typeof scene !== 'undefined'){
  const _t = setInterval(() => {
    if(sceneReady && navBuilt && !window.__aiDebugDone){
      window.__aiDebugDone = true; buildAIDebug(); clearInterval(_t);
    }
  }, 500);
}
