# -*- coding: utf-8 -*-
"""
抓取 B 站 UP 主「更新快照」 → data/bili-watch.json
====================================================================
给 /iswarmaupdate/ 与 /ispopcornradioupdate/ 两个页面提供同源数据。

为什么不在页面里直接拉：
    页面是纯静态的，浏览器 fetch 带 Origin 会被 B 站 403；
    公共 CORS 中继又不可靠。所以改为「脚本定时抓 → 写同源 JSON → 页面直读」，
    零跨域、零风控、秒开。

用到的接口（实测 2026-09-26 免登录可用，风控等级低）：
    /x/web-interface/card                        UP 档案（昵称/头像/粉丝/获赞）
    /x/polymer/web-space/home/seasons_series     该 UP 的全部合集（含预览）
    /x/polymer/web-space/seasons_archives_list   某个合集的完整视频列表（需 wbi 签名）

注意：UP 的「全部投稿列表」接口（/x/space/wbi/arc/search）已被强风控锁死
（未登录 + 签名 + ticket 均返回 -352），所以快照只覆盖「合集/系列内的视频」。

用法：
    python 实用工具/bili_watch.py                    # 默认写到 data/bili-watch.json
    python 实用工具/bili_watch.py --out 别的路径.json
    python 实用工具/bili_watch.py --quiet            # 只在数据变化时打印摘要（给 Actions 用）
"""

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# 监控目标：mid → 备注名
WATCH_MIDS = [106320250, 53456]
# 需要单独成页的合集（/ispopcornradioupdate/）
POPCORN = {"mid": 106320250, "season_id": 5906893}

# 单个合集最多保留多少条视频（控制快照体积）
MAX_ARCHIVES = 30

MIXIN_TAB = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
             33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
             26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
             20, 34, 44, 52]

_wbi_cache = {"key": "", "at": 0}


def http_get(url, cookie=None, timeout=20):
    """返回 (status, text)。status 为 0 表示请求异常。"""
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Referer": "https://space.bilibili.com/",
        "Accept": "application/json, text/plain, */*",
    })
    if cookie:
        req.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read().decode("utf-8", "ignore")
        except Exception:
            return e.code, ""
    except Exception as e:
        return 0, str(e)


def get_json(url, cookie=None):
    st, txt = http_get(url, cookie)
    try:
        return json.loads(txt)
    except Exception:
        return {"code": -1, "message": "非 JSON 响应（HTTP %s）" % st}


def wbi_key():
    """拿 wbi 的 mixin key（nav 接口免登录也返回）。缓存 10 分钟。"""
    if _wbi_cache["key"] and time.time() - _wbi_cache["at"] < 600:
        return _wbi_cache["key"]
    nav = get_json("https://api.bilibili.com/x/web-interface/nav")
    img = nav.get("data", {}).get("wbi_img", {})
    if not img.get("img_url"):
        return ""
    iu = img["img_url"].rsplit("/", 1)[-1].split(".")[0]
    su = img["sub_url"].rsplit("/", 1)[-1].split(".")[0]
    raw = iu + su
    key = "".join(raw[i] for i in MIXIN_TAB if i < len(raw))[:32]
    _wbi_cache.update({"key": key, "at": time.time()})
    return key


def wbi_query(params):
    """给参数加上 wts + w_rid，返回 query 串。"""
    key = wbi_key()
    if not key:
        return urllib.parse.urlencode(params)
    p = dict(params)
    p["wts"] = str(int(time.time()))
    items = sorted(p.items())
    q = "&".join("%s=%s" % (k, urllib.parse.quote(str(v), safe="")) for k, v in items)
    p["w_rid"] = hashlib.md5((q + key).encode()).hexdigest()
    return "&".join("%s=%s" % (k, urllib.parse.quote(str(p[k]), safe=""))
                    for k in sorted(p))


def webp(url, w, h):
    """B 站封面：补 https 并加等比缩略参数，省流量。
       封面可能来自 i0.hdslb.com（普通视频）或 archive.biliimg.com（合集封面），两处都支持 @ 参数。"""
    if not url:
        return ""
    u = url.replace("http://", "https://", 1)
    if ("hdslb.com" in u or "biliimg.com" in u) and "@" not in u:
        u += "@%dw_%dh_1c.webp" % (w, h)
    return u


def norm_archive(a):
    return {
        "aid": a.get("aid"),
        "bvid": a.get("bvid", ""),
        "title": (a.get("title") or "").strip(),
        "pubdate": a.get("pubdate") or a.get("ctime") or 0,
        "duration": a.get("duration") or 0,
        "cover": webp(a.get("pic"), 320, 200),
        "views": (a.get("stat") or {}).get("view", 0),
        "danmaku": (a.get("stat") or {}).get("danmaku", 0),
    }


def fetch_card(mid):
    d = get_json("https://api.bilibili.com/x/web-interface/card?mid=%d" % mid).get("data") or {}
    c = d.get("card") or {}
    if not c.get("mid"):
        return None
    return {
        "mid": int(c["mid"]),
        "name": c.get("name", ""),
        "face": webp(c.get("face"), 120, 120),
        "sign": (c.get("sign") or "").strip(),
        "fans": d.get("follower", 0),
        "likes": d.get("like_num", 0),
        "level": (c.get("level_info") or {}).get("current_level", 0),
        "official": ((c.get("Official") or {}).get("title") or "").strip(),
    }


def fetch_seasons(mid):
    """该 UP 的全部合集 + 每个合集的预览视频。（page_size 上限 20，需翻页）"""
    items = []
    page = 1
    while page <= 5:
        j = get_json("https://api.bilibili.com/x/polymer/web-space/home/seasons_series"
                     "?mid=%d&page_num=%d&page_size=20" % (mid, page))
        if j.get("code") != 0:
            print("  [!] seasons_series mid=%d page=%d code=%s %s"
                  % (mid, page, j.get("code"), j.get("message")), file=sys.stderr)
            break
        box = ((j.get("data") or {}).get("items_lists") or {})
        batch = box.get("seasons_list") or []
        items.extend(batch)
        pg = box.get("page") or {}
        if not batch or page >= (pg.get("total") or 1):
            break
        page += 1

    out = []
    for s in items:
        m = s.get("meta") or {}
        arcs = [norm_archive(a) for a in (s.get("archives") or [])]
        out.append({
            "season_id": m.get("season_id"),
            "title": (m.get("title") or "").strip(),
            "total": m.get("total", len(arcs)),
            "cover": webp(m.get("cover"), 320, 200),
            "desc": (m.get("description") or "").strip(),
            "archives": arcs,
        })
    return out


def fetch_season_archives(mid, season_id, page_size=MAX_ARCHIVES):
    """合集完整列表（新 → 旧）。需 wbi 签名。"""
    q = wbi_query({
        "mid": str(mid), "season_id": str(season_id),
        "sort_reverse": "true", "page_num": "1", "page_size": str(page_size),
    })
    j = get_json("https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?" + q)
    if j.get("code") != 0:
        return None, j.get("message", "code=%s" % j.get("code"))
    d = j.get("data") or {}
    arcs = [norm_archive(a) for a in (d.get("archives") or [])]
    arcs.sort(key=lambda a: a["pubdate"] or 0, reverse=True)
    return arcs, ""


def build():
    snap = {"generated_at": int(time.time()), "ups": {}}
    errors = []

    for mid in WATCH_MIDS:
        card = fetch_card(mid)
        if not card:
            errors.append("mid=%d 档案抓取失败" % mid)
            continue
        seasons = fetch_seasons(mid)
        for s in seasons:
            full, err = fetch_season_archives(mid, s["season_id"])
            if full is not None and full:
                s["archives"] = full
                s["total"] = max(s["total"], len(full))
            elif err:
                errors.append("mid=%d season=%s 列表抓取失败：%s" % (mid, s["season_id"], err))
            # 兜底：用接口自带的 total 校正
        card["seasons"] = seasons
        latest = None
        for s in seasons:
            for a in s["archives"]:
                if not a.get("pubdate"):
                    continue
                if latest is None or a["pubdate"] > latest["pubdate"]:
                    latest = dict(a, season_id=s["season_id"], season_title=s["title"])
        card["latest"] = latest
        card["season_count"] = len(seasons)
        card["archive_in_seasons"] = sum(len(s["archives"]) for s in seasons)
        snap["ups"][str(mid)] = card
        print("[ok] %s (%d) 合集 %d 个 · 视频 %d 条" %
              (card["name"], mid, len(seasons), card["archive_in_seasons"]))

    # 爆米花电台单独整理
    owner = snap["ups"].get(str(POPCORN["mid"]))
    if owner:
        season = next((s for s in owner["seasons"]
                       if str(s["season_id"]) == str(POPCORN["season_id"])), None)
        if season:
            full, err = fetch_season_archives(POPCORN["mid"], POPCORN["season_id"])
            if full:
                season = dict(season, archives=full, total=max(season["total"], len(full)))
            elif err:
                errors.append("爆米花电台列表抓取失败：%s" % err)
            snap["popcorn"] = {
                "mid": POPCORN["mid"],
                "season_id": POPCORN["season_id"],
                "title": season["title"],
                "cover": season["cover"],
                "desc": season.get("desc", ""),
                "total": season["total"],
                "owner": {"name": owner["name"], "face": owner["face"]},
                "archives": season["archives"],
            }
            print("[ok] 爆米花电台 %d 期" % len(season["archives"]))
        else:
            errors.append("未在合集列表里找到 season_id=%s" % POPCORN["season_id"])

    if errors:
        snap["errors"] = errors
    return snap


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join("data", "bili-watch.json"))
    ap.add_argument("--quiet", action="store_true", help="只在变化时输出（Actions 用）")
    args = ap.parse_args()

    snap = build()

    # 先读旧快照：① 用来做变化比较 ② 某个 UP 抓失败时沿用旧数据，避免页面上整块消失
    old = None
    if os.path.isfile(args.out):
        try:
            with open(args.out, "r", encoding="utf-8") as f:
                old = json.load(f)
        except Exception:
            old = None

    old_ups = (old or {}).get("ups") or {}
    carried = []
    for mid, ou in old_ups.items():
        if mid not in snap["ups"]:
            snap["ups"][mid] = ou
            carried.append("mid=%s 本次未抓到，沿用上次数据" % mid)
    if not snap.get("popcorn") and (old or {}).get("popcorn"):
        snap["popcorn"] = old["popcorn"]
        carried.append("popcorn 本次未抓到，沿用上次数据")
    if carried:
        snap["errors"] = (snap.get("errors") or []) + carried
        for c in carried:
            print("[carry] " + c, file=sys.stderr)

    if not snap["ups"]:
        print("[fail] 一个 UP 都没抓到，放弃写入", file=sys.stderr)
        for e in snap.get("errors", []):
            print("  - " + e, file=sys.stderr)
        return 1

    out = args.out
    d = os.path.dirname(out)
    if d and not os.path.isdir(d):
        os.makedirs(d, exist_ok=True)

    def bare(s):
        """剥掉「每次抓都会变、但不代表有新内容」的字段，用于判断是否值得提交。
           粉丝数 / 获赞 / 播放量都在实时增长，不剥离的话每 20 分钟都要 commit 一次。"""
        if not s:
            return None
        c = json.loads(json.dumps(s, ensure_ascii=False))
        c.pop("generated_at", None)
        c.pop("errors", None)
        c.pop("source", None)

        def strip_archive(a):
            a.pop("views", None)
            a.pop("danmaku", None)

        for u in (c.get("ups") or {}).values():
            u.pop("fans", None)
            u.pop("likes", None)
            for se in (u.get("seasons") or []):
                se.pop("cover", None)
                for a in (se.get("archives") or []):
                    strip_archive(a)
        pc = c.get("popcorn")
        if pc:
            pc.pop("cover", None)
            for a in (pc.get("archives") or []):
                strip_archive(a)
        return c

    changed = bare(old) != bare(snap)

    txt = json.dumps(snap, ensure_ascii=False, indent=1, separators=(",", ": "))
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(txt + "\n")

    print("[write] %s（%.1f KB）%s" % (out, len(txt.encode("utf-8")) / 1024.0,
                                      "内容有变化" if changed else "内容无变化"))

    if args.quiet:
        # 给 Actions 判断用：GITHUB_OUTPUT
        gh = os.environ.get("GITHUB_OUTPUT")
        if gh:
            with open(gh, "a", encoding="utf-8") as f:
                f.write("changed=%s\n" % ("true" if changed else "false"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
