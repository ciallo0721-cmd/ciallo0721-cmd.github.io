/* ============================================================
   凶宅试睡员 · build.js
   几何构建：合并地板/天花/墙体 → 单网格；家具；灯光；SVG 户型图
   依赖：three.js + maps.js + grid.js
   ============================================================ */
window.XZ = window.XZ || {};
(function (XZ) {
  'use strict';

  var WALL_H = 2.8;
  var RAIL_H = 1.1;
  var WALL_T = 0.12;

  /* ---------- 顶点缓冲 ---------- */
  function Buf() { this.p = []; this.n = []; this.c = []; }
  Buf.prototype.box = function (cx, cy, cz, sx, sy, sz, color) {
    var hx = sx / 2, hy = sy / 2, hz = sz / 2;
    var x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
    var col = new THREE.Color(color);
    var r = col.r, g = col.g, b = col.b;
    var P = this.p, N = this.n, C = this.c;
    function quad(ax, ay, az, bx, by, bz, cx2, cy2, cz2, dx2, dy2, dz2, nx, ny, nz) {
      P.push(ax, ay, az, bx, by, bz, cx2, cy2, cz2, ax, ay, az, cx2, cy2, cz2, dx2, dy2, dz2);
      for (var i = 0; i < 6; i++) { N.push(nx, ny, nz); C.push(r, g, b); }
    }
    quad(x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0, 0, 1, 0);
    quad(x0, y0, z1, x0, y0, z0, x1, y0, z0, x1, y0, z1, 0, -1, 0);
    quad(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1);
    quad(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1);
    quad(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0);
    quad(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0);
  };
  Buf.prototype.build = function (mat) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.n), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.c), 3));
    return new THREE.Mesh(geo, mat);
  };

  function shade(hex, k) {
    var c = new THREE.Color(hex);
    c.multiplyScalar(k);
    if (c.r > 1) c.r = 1;
    if (c.g > 1) c.g = 1;
    if (c.b > 1) c.b = 1;
    return c.getHex();
  }

  function makeOff(map) { return { x: -map.w / 2, z: -map.h / 2 }; }

  var FURN = {
    wood: 0x4a3423, wood2: 0x5c4230, dark: 0x2a2622, fabric: 0x3b3a42,
    metal: 0x5a5a62, white: 0xa8a49c, screen: 0x14161c, glass: 0x2a3a42
  };

  /* ============================================================
     主构建
     ============================================================ */
  XZ.buildHouse = function (scene, map, grid, opt) {
    var off = makeOff(map);
    var buf = new Buf();
    var group = new THREE.Group();
    var lights = [];
    var interact = [];
    var blockers = {};
    var doorIdx = {}, nearDoor = {};
    grid.doors.forEach(function (d) {
      doorIdx[grid.at(d.x, d.y)] = 1;
      // 门格 + 其前后格 = 禁止摆家具（保证门口留出通道）
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].forEach(function (o) {
        var k = grid.at(d.x + o[0], d.y + o[1]);
        if (k >= 0) nearDoor[k] = 1;
      });
    });

    var roomMap = {};
    grid.rooms.forEach(function (r) { roomMap[r.id] = r; });

    function metaOf(id) {
      var r = roomMap[id];
      if (!r) return { type: 'hall', name: '走廊', floor: 0x5c4634, ceil: 0x2a2622, open: false };
      var t = XZ.ROOM[r.type] || XZ.ROOM.hall;
      return { type: r.type, name: t.name, floor: t.floor, ceil: t.ceil, open: !!t.open };
    }

    function wr(r) {
      return {
        x0: r.x + off.x, z0: r.y + off.z,
        x1: r.x + r.w + off.x, z1: r.y + r.h + off.z,
        cx: r.x + r.w / 2 + off.x, cz: r.y + r.h / 2 + off.z,
        w: r.w, h: r.h
      };
    }

    function blockCells(x0, z0, x1, z1) {
      for (var z = Math.floor(z0 - off.z); z < Math.ceil(z1 - off.z); z++) {
        for (var x = Math.floor(x0 - off.x); x < Math.ceil(x1 - off.x); x++) {
          if (x < 0 || z < 0 || x >= grid.W || z >= grid.H) continue;
          var idx = z * grid.W + x;
          if (!grid.cells[idx]) continue;
          if (doorIdx[idx] || nearDoor[idx]) continue;
          blockers[idx] = 1;
        }
      }
    }

    function piece(cx, cz, sx, sy, sz, color, y0, solid) {
      buf.box(cx, (y0 || 0) + sy / 2, cz, sx, sy, sz, color);
      if (solid) blockCells(cx - sx / 2 * 0.92, cz - sz / 2 * 0.92, cx + sx / 2 * 0.92, cz + sz / 2 * 0.92);
    }

    /* ---------- 1. 地板 / 天花 / 墙体 ---------- */
    var NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var gy = 0; gy < grid.H; gy++) {
      for (var gx = 0; gx < grid.W; gx++) {
        var id = grid.cells[gy * grid.W + gx];
        if (!id) continue;
        var M = metaOf(id === 'door' ? 'hall' : id);
        var wx = gx + 0.5 + off.x, wz = gy + 0.5 + off.z;

        // 地板：相邻格明暗交错，看着像地板缝
        var jit = ((gx * 7 + gy * 13) % 5) * 0.016;
        var fc = id === 'door' ? shade(M.floor, 0.76) : shade(M.floor, (((gx + gy) % 2) ? 0.93 : 1.0) + jit);
        buf.box(wx, -0.05, wz, 1.0, 0.1, 1.0, fc);

        // 天花
        buf.box(wx, WALL_H + 0.05, wz, 1.0, 0.1, 1.0, M.ceil);

        // 门洞上方封板
        if (id === 'door') {
          buf.box(wx, (2.05 + WALL_H) / 2, wz, 1.0, WALL_H - 2.05, 1.0, shade(M.floor, 0.5));
        }

        // 四邻墙
        for (var k = 0; k < 4; k++) {
          var nx = gx + NB[k][0], ny = gy + NB[k][1];
          var nid = (nx < 0 || ny < 0 || nx >= grid.W || ny >= grid.H) ? null : grid.cells[ny * grid.W + nx];
          if (nid) continue;
          var open = (id !== 'door') && M.open;
          if (open) {
            buf.box(wx + NB[k][0] * 0.5, RAIL_H / 2, wz + NB[k][1] * 0.5,
              NB[k][0] ? WALL_T * 0.6 : 1.0, RAIL_H, NB[k][1] ? WALL_T * 0.6 : 1.0, 0x43434a);
          } else {
            var wallCol = (id === 'door')
              ? shade(0x6b665e, 0.52 + ((gx + gy) % 3) * 0.06)          // 门洞侧壁压暗，读成「开口」而不是「白板」
              : shade(0x6b665e, 0.86 + ((gx * 7 + gy * 13) % 5) * 0.04);
            buf.box(wx + NB[k][0] * 0.5, WALL_H / 2, wz + NB[k][1] * 0.5,
              NB[k][0] ? WALL_T : 1.0, WALL_H, NB[k][1] ? WALL_T : 1.0, wallCol);
          }
        }
      }
    }

    /* ---------- 2. 家具（按「哪面墙没有门」自动选面） ---------- */
    function doorSides(r) {
      var res = { w: false, e: false, n: false, s: false };
      grid.doors.forEach(function (d) {
        if (d.x === r.x - 1 && d.y >= r.y && d.y < r.y + r.h) res.w = true;
        if (d.x === r.x + r.w && d.y >= r.y && d.y < r.y + r.h) res.e = true;
        if (d.y === r.y - 1 && d.x >= r.x && d.x < r.x + r.w) res.n = true;
        if (d.y === r.y + r.h && d.x >= r.x && d.x < r.x + r.w) res.s = true;
      });
      return res;
    }

    function freeWalls(R, DS) {
      var arr = [];
      if (!DS.w) arr.push({ s: 'w', len: R.z1 - R.z0 });
      if (!DS.e) arr.push({ s: 'e', len: R.z1 - R.z0 });
      if (!DS.n) arr.push({ s: 'n', len: R.x1 - R.x0 });
      if (!DS.s) arr.push({ s: 's', len: R.x1 - R.x0 });
      arr.sort(function (a, b) { return b.len - a.len; });
      return arr;
    }

    // 沿墙摆一件：side=墙，along=沿墙偏移(0 居中)，len=沿墙长度，depth=进深
    function wallBox(R, side, along, len, h, depth, y0, color, solid) {
      var cx, cz, sx, sz;
      if (side === 'w') { cx = R.x0 + depth / 2; cz = R.cz + along; sx = depth; sz = len; }
      else if (side === 'e') { cx = R.x1 - depth / 2; cz = R.cz + along; sx = depth; sz = len; }
      else if (side === 'n') { cz = R.z0 + depth / 2; cx = R.cx + along; sx = len; sz = depth; }
      else { cz = R.z1 - depth / 2; cx = R.cx + along; sx = len; sz = depth; }
      piece(cx, cz, sx, h, sz, color, y0, solid);
      return { cx: cx, cz: cz, sx: sx, sz: sz, side: side };
    }

    function sideLen(R, s) { return (s === 'w' || s === 'e') ? (R.z1 - R.z0) : (R.x1 - R.x0); }

    grid.rooms.forEach(function (r) {
      var R = wr(r);
      var t = r.type;
      var W2 = R.x1 - R.x0, H2 = R.z1 - R.z0;
      var cx = R.cx, cz = R.cz;
      var DS = doorSides(r);
      var fw = freeWalls(R, DS);
      var w0 = fw[0] ? fw[0].s : 'w';
      var w1 = fw[1] ? fw[1].s : w0;

      if (t === 'living') {
        // 沙发贴一面没有门的长墙
        var sLen = Math.max(1.6, Math.min(2.9, sideLen(R, w0) - 2.0));
        wallBox(R, w0, 0, sLen, 0.34, 1.02, 0, FURN.fabric, true);
        wallBox(R, w0, 0, sLen, 0.72, 0.28, 0, FURN.fabric, false);
        // 地毯 + 茶几
        piece(cx, cz, Math.max(1.6, Math.min(2.8, W2 - 2.6)), 0.02, 1.9, 0x4a3b33, 0, false);
        piece(cx, cz, 1.05, 0.34, 0.62, FURN.wood2, 0, true);
        piece(cx, cz, 0.5, 0.06, 0.34, 0x8f7a58, 0.34, false);
        // 电视放另一面墙
        var tvWall = w1;
        var tvW = Math.max(1.0, Math.min(1.4, sideLen(R, tvWall) - 1.2));
        var tvPos, tvDim;
        if (tvWall === 'n' || tvWall === 's') {
          tvPos = new THREE.Vector3(R.cx, 1.08, tvWall === 'n' ? R.z0 + 0.34 : R.z1 - 0.34);
          tvDim = [tvW, 0.8, 0.09];
        } else {
          tvPos = new THREE.Vector3(tvWall === 'w' ? R.x0 + 0.34 : R.x1 - 0.34, 1.08, R.cz);
          tvDim = [0.09, 0.8, tvW];
        }
        wallBox(R, tvWall, 0, tvW + 0.5, 0.42, 0.5, 0, FURN.dark, true);
        // 落地灯挂沙发那面墙的角落
        var lampAlong = (sideLen(R, w0) - 1.0) / 2 * 0.9;
        var lp = wallBox(R, w0, lampAlong, 0.1, 1.45, 0.12, 0, FURN.metal, false);
        piece(lp.cx, lp.cz, 0.44, 0.28, 0.44, 0x8a7448, 1.45, false);
        lights.push({ room: r, pos: new THREE.Vector3(cx, WALL_H - 0.12, cz) });
        interact.push({ kind: 'tv', room: r, pos: tvPos, sx: tvDim[0], sy: tvDim[1], sz: tvDim[2] });
      }

      if (t === 'master' || t === 'second') {
        var bw = t === 'master' ? 1.76 : 1.3, bl = 2.05;
        var bSide = (w0 === 'n' || w0 === 's') ? w0 : ((w1 === 'n' || w1 === 's') ? w1 : 'n');
        var headZ = bSide === 'n' ? R.z0 : R.z1;
        var dir = bSide === 'n' ? 1 : -1;
        var bx = cx, bz = headZ + dir * (bl / 2 + 0.08);
        piece(bx, bz, bw, 0.4, bl, 0x5a4c40, 0, true);
        piece(bx, headZ + dir * 0.08, bw, 1.0, 0.16, FURN.wood, 0, false);
        piece(bx, bz + dir * 0.02, bw - 0.12, 0.2, bl * 0.56, 0x9d9488, 0.4, false);
        piece(bx, headZ + dir * 0.42, bw * 0.78, 0.15, 0.42, 0xc8c2b7, 0.6, false);
        // 床头柜在被门挡住的那一侧留空
        var nOff = DS.w && !DS.e ? -(bw / 2 + 0.42) : (DS.e && !DS.w ? (bw / 2 + 0.42) : -(bw / 2 + 0.42));
        piece(bx + nOff, headZ + dir * 0.5, 0.5, 0.5, 0.42, FURN.wood2, 0, true);
        piece(bx + nOff, headZ + dir * 0.5, 0.16, 0.3, 0.16, 0x8a7a55, 0.5, false);
        // 衣柜贴另一面没有门的侧墙
        var wSide = (w0 === 'e' || w0 === 'w') ? w0 : ((w1 === 'e' || w1 === 'w') ? w1 : 'w');
        wallBox(R, wSide, 0.4, Math.max(1.0, Math.min(2.3, sideLen(R, wSide) - 2.1)), 2.0, 0.62, 0, FURN.wood2, true);
        lights.push({ room: r, pos: new THREE.Vector3(cx, WALL_H - 0.12, cz) });
        interact.push({ kind: 'bed', room: r, pos: new THREE.Vector3(bx, 0.5, bz) });
      }

      if (t === 'kitchen') {
        var cLen = Math.max(1.6, sideLen(R, w0) - 1.4);
        var cb = wallBox(R, w0, 0, cLen, 0.88, 0.66, 0, FURN.metal, true);
        wallBox(R, w0, 0, cLen, 0.46, 0.5, 1.95, 0x3a3f45, false);          // 吊柜
        // 灶 / 水槽沿台面方向各挪一点
        var ax = (w0 === 'w' || w0 === 'e') ? 0 : 1;
        piece(cb.cx + (ax ? -0.55 : 0), cb.cz + (ax ? 0 : -0.55), 0.52, 0.05, 0.54, 0x26262a, 0.88, false);
        piece(cb.cx + (ax ? 0.55 : 0), cb.cz + (ax ? 0 : 0.55), 0.4, 0.05, 0.4, 0x8f9298, 0.88, false);
        // 冰箱放另一面墙
        var fb = wallBox(R, w1, sideLen(R, w1) / 2 - 0.6, 0.74, 1.86, 0.7, 0, FURN.white, true);
        piece(fb.cx, fb.cz, 0.02, 1.2, 0.02, 0x6f7479, 0.4, false);
        lights.push({ room: r, pos: new THREE.Vector3(cx, WALL_H - 0.12, cz) });
        interact.push({
          kind: 'stove', room: r,
          pos: new THREE.Vector3(cb.cx + (ax ? -0.55 : 0), 0.95, cb.cz + (ax ? 0 : -0.55))
        });
      }

      if (t === 'toilet') {
        var sb = wallBox(R, w0, 0, 0.52, 0.82, 0.62, 0, FURN.white, true);   // 洗手台
        piece(sb.cx, sb.cz, 0.36, 0.08, 0.4, 0x8f9298, 0.82, false);
        // 马桶放另一面墙
        var tb = wallBox(R, w1, sideLen(R, w1) / 2 - 0.65, 0.56, 0.42, 0.64, 0.02, FURN.white, true);
        piece(tb.cx, tb.cz, 0.5, 0.46, 0.18, FURN.white, 0.42, false);
        lights.push({ room: r, pos: new THREE.Vector3(cx, WALL_H - 0.12, cz) });

        // 镜子：只做一块，贴在洗手台那面墙内侧（墙面内表面在 ±0.06，这里放 0.075 留 1.5cm 缝，避免 Z-fighting）
        var mw = Math.max(0.55, Math.min(0.78, sideLen(R, w0) - 2.0));
        var mirPos, mirDim;
        if (w0 === 'w' || w0 === 'e') {
          mirPos = new THREE.Vector3(w0 === 'w' ? R.x0 + 0.075 : R.x1 - 0.075, 1.55, sb.cz);
          mirDim = [0.05, 0.95, mw];
        } else {
          mirPos = new THREE.Vector3(sb.cx, 1.55, w0 === 'n' ? R.z0 + 0.075 : R.z1 - 0.075);
          mirDim = [mw, 0.95, 0.05];
        }
        interact.push({ kind: 'mirror', room: r, pos: mirPos, mx: mirDim[0], my: mirDim[1], mz: mirDim[2] });
      }

      if (t === 'storage') {
        var sn = Math.max(1, Math.min(3, Math.floor(sideLen(R, w0) / 1.2)));
        for (var i = 0; i < sn; i++) {
          wallBox(R, w0, (i - (sn - 1) / 2) * 1.1, 0.95, 1.65, 0.62, 0, FURN.wood2, true);
        }
        var ob = wallBox(R, w1, sideLen(R, w1) / 2 - 0.9, 1.2, 0.72, 0.85, 0, FURN.wood, true);
        piece(ob.cx, ob.cz, ob.sx * 1.02, 0.06, ob.sz * 1.02, 0x6a5232, 0.72, false);
        lights.push({ room: r, pos: new THREE.Vector3(cx, WALL_H - 0.12, cz) });
      }

      if (t === 'study') {
        var dLen = Math.max(1.4, Math.min(2.2, sideLen(R, w0) - 1.4));
        var db = wallBox(R, w0, 0, dLen, 0.75, 0.74, 0, FURN.wood2, true);   // 桌
        piece(db.cx - (w0 === 'w' || w0 === 'e' ? 0 : 0.6), db.cz - (w0 === 'n' ? 0 : 0.5), 0.3, 0.32, 0.3, 0x6b5a3c, 0.75, false);
        wallBox(R, w1, 0, Math.max(1.0, Math.min(2.4, sideLen(R, w1) - 1.4)), 2.05, 0.58, 0, FURN.wood, true);
        piece(cx - 0.9, cz + 0.9, 0.44, 0.9, 0.44, FURN.fabric, 0, true);
        lights.push({ room: r, pos: new THREE.Vector3(cx, WALL_H - 0.12, cz) });
        interact.push({ kind: 'pc', room: r, pos: new THREE.Vector3(db.cx, 1.15, db.cz), small: true });
      }

      if (t === 'esports') {
        var eLen = Math.max(1.8, Math.min(2.8, sideLen(R, w0) - 1.6));
        var eb = wallBox(R, w0, 0, eLen, 0.75, 0.8, 0, 0x1a1a20, true);
        wallBox(R, w0, 0.55, 0.62, 1.42, 0.62, 0.75, 0x14141a, false);        // 椅背
        piece(eb.cx + (w0 === 'e' || w0 === 'w' ? 0 : 0.55), eb.cz + (w0 === 'n' || w0 === 's' ? 0.42 : 0),
          0.5, 0.32, 0.05, 0x2a2a34, 0.75, false);
        wallBox(R, w1, 0, Math.max(1.0, Math.min(2.2, sideLen(R, w1) - 1.6)), 2.0, 0.58, 0, 0x241f2c, true);
        lights.push({ room: r, pos: new THREE.Vector3(cx, WALL_H - 0.12, cz) });
        interact.push({ kind: 'pc', room: r, pos: new THREE.Vector3(eb.cx, 1.14, eb.cz) });
      }

      if (t === 'balcony') {
        var wb = wallBox(R, w0, sideLen(R, w0) / 2 - 0.55, 0.66, 0.96, 0.66, 0, FURN.white, true);
        piece(wb.cx, wb.cz, 0.42, 0.02, 0.42, 0x7b828a, 0.96, false);
        var pb = wallBox(R, w1, sideLen(R, w1) / 2 - 0.55, 0.48, 1.1, 0.48, 0, 0x53412c, true);
        piece(pb.cx, pb.cz, 0.66, 0.3, 0.66, 0x2f4a30, 1.1, false);
        lights.push({ room: r, pos: new THREE.Vector3(cx, 2.3, cz) });
      }

      if (t === 'hall') {
        interact.push({ kind: 'breaker', room: r, pos: new THREE.Vector3(R.x1 - 0.18, 1.45, cz + 1.6) });
        lights.push({ room: r, pos: new THREE.Vector3(cx, WALL_H - 0.25, cz) });
      }
    });

    /* ---------- 3. 提交静态网格 ---------- */
    var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    var staticMesh = buf.build(mat);
    staticMesh.name = 'house';
    group.add(staticMesh);

    /* ---------- 4. 灯泡 + 点光源 ---------- */
    var bulbGeo = new THREE.SphereGeometry(0.07, 8, 6);
    var lightList = [];
    lights.forEach(function (L) {
      var bulb = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0x141414 }));
      bulb.position.copy(L.pos);
      group.add(bulb);

      var pl = new THREE.PointLight(
        (L.room.type === 'toilet' || L.room.type === 'kitchen') ? 0xd6e6ff : 0xffd6a0,
        0, 0, 2);
      pl.distance = Math.max(L.room.w, L.room.h) * 1.55 + 1.4;
      pl.position.copy(L.pos);
      pl.intensity = 0;
      pl.visible = false;   // 关灯时光源直接移出渲染，省掉逐像素光照开销
      group.add(pl);

      lightList.push({ room: L.room, light: pl, bulb: bulb, on: false, hasLight: true });
    });

    /* ---------- 5. 可亮设备（电视 / 电脑 / 电闸 / 镜子） ---------- */
    interact.forEach(function (it) {
      if (it.kind === 'tv') {
        it.mat = new THREE.MeshBasicMaterial({ color: 0x0a0a0c });
        it.mesh = new THREE.Mesh(new THREE.BoxGeometry(it.sx, it.sy, it.sz), it.mat);
        it.mesh.position.copy(it.pos);
        group.add(it.mesh);
      } else if (it.kind === 'pc') {
        it.mat = new THREE.MeshBasicMaterial({ color: 0x0a0a0c });
        it.mesh = new THREE.Mesh(
          new THREE.BoxGeometry(it.small ? 0.62 : 0.74, it.small ? 0.4 : 0.46, 0.05), it.mat);
        it.mesh.position.copy(it.pos);
        group.add(it.mesh);
      } else if (it.kind === 'breaker') {
        it.mat = new THREE.MeshBasicMaterial({ color: 0x2a2d33 });
        it.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.4), it.mat);
        it.mesh.position.copy(it.pos);
        group.add(it.mesh);
      } else if (it.kind === 'mirror') {
        // 镜子：Lambert 就够（Phong 会被手电打出一坨白斑）
        it.mat = new THREE.MeshLambertMaterial({ color: 0x33485a });
        it.mesh = new THREE.Mesh(new THREE.BoxGeometry(it.mx || 0.05, it.my || 0.8, it.mz || 0.62), it.mat);
        it.mesh.position.copy(it.pos);
        group.add(it.mesh);
      }
    });

    scene.add(group);

    return {
      group: group, off: off, lights: lightList, interact: interact,
      blockers: blockers,
      dyn: interact.filter(function (i) { return !!i.mat; })
    };
  };

  /* ============================================================
     SVG 户型图
     ============================================================ */
  XZ.planSVG = function (map, grid, opts) {
    opts = opts || {};
    var C = 22, PAD = 18;
    var W = map.w * C + PAD * 2, H = map.h * C + PAD * 2;
    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" class="plan-svg" role="img" aria-label="凶宅户型图">');
    out.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0d1013"/>');

    grid.rooms.forEach(function (r) {
      var meta = XZ.ROOM[r.type] || XZ.ROOM.hall;
      var c = '#' + new THREE.Color(meta.floor).getHexString();
      out.push('<rect x="' + (PAD + r.x * C) + '" y="' + (PAD + r.y * C) + '" width="' + (r.w * C) + '" height="' + (r.h * C) +
        '" fill="' + c + '" fill-opacity=".55" stroke="#59616b" stroke-width="1.5"/>');
      var fs = Math.max(9, Math.min(13, r.w * C / 5.2));
      out.push('<text x="' + (PAD + (r.x + r.w / 2) * C) + '" y="' + (PAD + (r.y + r.h / 2) * C + fs * 0.36) +
        '" text-anchor="middle" font-size="' + fs + '" fill="#e8eef4" font-family="inherit">' + (r.name || meta.name) + '</text>');
      if (r.w >= 3 && r.h >= 2) {
        out.push('<text x="' + (PAD + (r.x + r.w / 2) * C) + '" y="' + (PAD + (r.y + r.h / 2) * C + fs * 1.9) +
          '" text-anchor="middle" font-size="8" fill="#8e99a4" font-family="inherit">' + r.w + '×' + r.h + 'm</text>');
      }
    });

    grid.doors.forEach(function (d) {
      var x = PAD + d.x * C, y = PAD + d.y * C;
      if (d.axis === 'x') {
        out.push('<rect x="' + x + '" y="' + (y + C * 0.14) + '" width="' + C + '" height="' + (C * 0.72) + '" fill="#0d1013" fill-opacity=".85"/>');
        out.push('<line x1="' + x + '" y1="' + (y + C * 0.16) + '" x2="' + x + '" y2="' + (y + C * 0.84) + '" stroke="#d9b676" stroke-width="2"/>');
      } else {
        out.push('<rect x="' + (x + C * 0.14) + '" y="' + y + '" width="' + (C * 0.72) + '" height="' + C + '" fill="#0d1013" fill-opacity=".85"/>');
        out.push('<line x1="' + (x + C * 0.16) + '" y1="' + y + '" x2="' + (x + C * 0.84) + '" y2="' + y + '" stroke="#d9b676" stroke-width="2"/>');
      }
    });

    if (map.spawn) {
      var sx = PAD + (map.spawn.x + 0.5) * C, sy = PAD + (map.spawn.y + 0.5) * C;
      out.push('<circle cx="' + sx + '" cy="' + sy + '" r="7" fill="none" stroke="#5be1a0" stroke-width="2"/>');
      out.push('<text x="' + (sx + 10) + '" y="' + (sy + 4) + '" font-size="9" fill="#5be1a0" font-family="inherit">入口</text>');
    }

    (opts.triggers || []).forEach(function (rid) {
      var r = grid.rooms.filter(function (q) { return q.id === rid; })[0];
      if (!r) return;
      out.push('<g class="plan-haunt">');
      out.push('<circle cx="' + (PAD + (r.x + r.w / 2) * C) + '" cy="' + (PAD + (r.y + r.h / 2) * C) +
        '" r="' + (Math.min(r.w, r.h) * C * 0.42) + '" fill="none" stroke="#d1463c" stroke-width="1.5" stroke-dasharray="4 3" opacity=".85"/>');
      out.push('</g>');
    });

    out.push('<text x="' + PAD + '" y="' + (H - 5) + '" font-size="9" fill="#5d6772" font-family="inherit">比例 1 格 ≈ 1m · ┃ 门洞 · ◯ 入口 · ◌ 灵异触发点</text>');
    out.push('</svg>');
    return out.join('');
  };

})(window.XZ);
