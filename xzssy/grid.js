/* ============================================================
   凶宅试睡员 · grid.js
   纯数据网格：把「房间矩形」变成可碰撞格子 + 自动开门
   （不依赖 three.js，可单独用 node 跑校验）
   ============================================================ */
window.XZ = window.XZ || {};
(function (XZ) {
  'use strict';

  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* 生成网格
     返回 { W,H,rooms,cells,doors,at,walk,roomIdAt,connectivity } */
  XZ.makeGrid = function (map) {
    var W = map.w, H = map.h;
    var cells = new Array(W * H);
    for (var i = 0; i < cells.length; i++) cells[i] = null;

    var at = function (x, y) { return (x < 0 || y < 0 || x >= W || y >= H) ? -1 : y * W + x; };

    // 1. 填房间
    map.rooms.forEach(function (r) {
      for (var y = r.y; y < r.y + r.h; y++) {
        for (var x = r.x; x < r.x + r.w; x++) {
          var k = at(x, y);
          if (k >= 0) cells[k] = r.id;
        }
      }
    });

    // 2. 候选门：实墙格，四邻里有 >=2 个不同房间
    var cand = [];
    for (var y2 = 0; y2 < H; y2++) {
      for (var x2 = 0; x2 < W; x2++) {
        var k2 = at(x2, y2);
        if (cells[k2] !== null) continue;
        var ids = [];
        for (var d = 0; d < 4; d++) {
          var nk = at(x2 + DIRS[d][0], y2 + DIRS[d][1]);
          if (nk < 0) continue;
          var rid = cells[nk];
          if (rid && ids.indexOf(rid) < 0) ids.push(rid);
        }
        if (ids.length >= 2) cand.push({ x: x2, y: y2, ids: ids, used: false });
      }
    }

    // 3. 并查集
    var parent = {};
    map.rooms.forEach(function (r) { parent[r.id] = r.id; });
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    function union(a, b) { a = find(a); b = find(b); if (a !== b) { parent[b] = a; return true; } return false; }

    var doors = [];
    function place(c) {
      c.used = true;
      var k3 = at(c.x, c.y);
      // 通行轴：左右都是房间且上下是墙 → 沿 x 通行
      var l = cells[at(c.x - 1, c.y)], r = cells[at(c.x + 1, c.y)];
      var u = cells[at(c.x, c.y - 1)], dn = cells[at(c.x, c.y + 1)];
      var horiz = !!(l && r && !u && !dn);
      cells[k3] = 'door';
      doors.push({ x: c.x, y: c.y, axis: horiz ? 'x' : 'z' });
    }

    // 4. 优先：每个房间都朝走廊开门
    var hall = null;
    map.rooms.forEach(function (r) { if (r.type === 'hall') hall = r; });
    if (!hall) hall = map.rooms[0];

    map.rooms.forEach(function (r) {
      if (r.id === hall.id) return;
      var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      var list = cand.filter(function (c) {
        return !c.used && c.ids.indexOf(hall.id) >= 0 && c.ids.indexOf(r.id) >= 0;
      });
      if (!list.length) return;
      list.sort(function (a, b) {
        var da = Math.abs(a.x + 0.5 - cx) + Math.abs(a.y + 0.5 - cy);
        var db = Math.abs(b.x + 0.5 - cx) + Math.abs(b.y + 0.5 - cy);
        return da - db;
      });
      place(list[0]);
      union(hall.id, r.id);
    });

    // 5. 剩下的房间用任意相邻候选补齐
    cand.forEach(function (c) {
      if (c.used) return;
      for (var i = 0; i < c.ids.length; i++) {
        for (var j = i + 1; j < c.ids.length; j++) {
          if (union(c.ids[i], c.ids[j])) { place(c); return; }
        }
      }
    });

    // 6. 连通性
    var roots = {};
    map.rooms.forEach(function (r) { roots[r.id] = find(r.id); });
    var uniq = {};
    Object.keys(roots).forEach(function (k5) { uniq[roots[k5]] = 1; });
    var connectivity = Object.keys(uniq).length;

    var roomIdAt = function (x, y) {
      var k = at(Math.floor(x), Math.floor(y));
      if (k < 0) return null;
      return cells[k];
    };
    var walk = function (x, y) {
      var k = at(Math.floor(x), Math.floor(y));
      if (k < 0) return false;
      return cells[k] !== null;
    };

    return {
      W: W, H: H, rooms: map.rooms, cells: cells, doors: doors,
      at: at, roomIdAt: roomIdAt, walk: walk, connectivity: connectivity
    };
  };

  XZ.roomMeta = function (room) {
    var t = XZ.ROOM[room.type] || XZ.ROOM.hall;
    return { type: room.type, name: t.name, floor: t.floor, ceil: t.ceil, open: !!t.open };
  };

  /* 需要拍照的区域 = 除走廊外的所有房间 */
  XZ.areasOf = function (map) {
    return map.rooms.filter(function (r) { return r.type !== 'hall'; });
  };

})(window.XZ);
