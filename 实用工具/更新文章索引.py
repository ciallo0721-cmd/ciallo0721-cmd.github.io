# -*- coding: utf-8 -*-
"""
更新文章索引.py — 写完博客跑一下，把新文章塞进单文件索引 cwb-index.json

用法（在仓库根目录运行）:
    python "实用工具/更新文章索引.py"                # 自动对比：新增入库 / 删除出库 / 有改动才重写
    python "实用工具/更新文章索引.py" 心理学 90       # 只更新这一篇（最快，只动一条 + 它自己的 .cwb）

它做的事:
1. 重新提取 blog/{分类}/{id}/index.html 的元数据
2. 内容有变才写 blog/{分类}/{id}/{id}.cwb（没变一个字节都不碰，git 里不会出现 88 个改动）
3. 同步根目录 cwb-index.json（前端只读这一个文件）和 cwb-manifest.json
4. 打印新增 / 删除 / 修改了哪些文章

跟 CWBI转换器.py 的区别:
  · CWBI转换器.py  = 全量重建（改了标题、批量改标签、想彻底重来时用）
  · 更新文章索引.py = 日常写完一篇就用它，只补索引里的那一条
"""
import importlib.util
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONV_PATH = os.path.join(ROOT, "实用工具", "CWBI转换器.py")


def load_converter():
    """复用 CWBI转换器.py 里的提取/生成逻辑，保证两条链路产出完全一致"""
    spec = importlib.util.spec_from_file_location("cwbi_converter", CONV_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)   # 模块名不是 __main__，不会触发它的 main()
    return mod


conv = load_converter()
INDEX = conv.INDEX
MANIFEST = conv.MANIFEST


def load_index():
    obj = conv.read_json(INDEX) or {"name": "CialloWebBlogInformation index",
                                   "generator": "实用工具/CWBI转换器.py",
                                   "version": 1, "count": 0, "articles": []}
    obj.setdefault("articles", [])
    return obj


def save_index(obj):
    obj["articles"].sort(key=lambda e: e["id"])
    obj["count"] = len(obj["articles"])
    return conv.write_if_changed(INDEX, json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


def save_manifest(entries):
    entries.sort(key=lambda e: e["id"])
    manifest = {
        "name": "CialloWebBlogInformation manifest",
        "generator": "实用工具/CWBI转换器.py",
        "count": len(entries),
        "articles": entries,
    }
    return conv.write_if_changed(MANIFEST, json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


def manifest_entry(a):
    return {
        "id": a["id"],
        "category": a["category"],
        "cwbPath": "blog/%s/%s/%s.cwb" % (a["category"], a["id"], a["id"]),
    }


def one(cat, aid):
    """只更新一篇：读 HTML → 重写它自己的 .cwb → 替换索引里的那一条"""
    meta = conv.build_article_meta(cat, aid)
    if not meta:
        print("[错误] 没找到 blog/%s/%s/index.html" % (cat, aid))
        return 2
    cwb_path = os.path.join(ROOT, "blog", cat, str(aid), "%d.cwb" % aid)
    cwb_changed = conv.write_if_changed(cwb_path, conv.build_cwb_text(meta))

    obj = load_index()
    arts = obj["articles"]
    entry = conv.build_index_entry(meta)
    old = next((e for e in arts if e["id"] == meta["id"]), None)
    if old is None:
        arts.append(entry)
        action = "新增"
    elif old != entry:
        arts[arts.index(old)] = entry
        action = "更新"
    else:
        action = "无变化"
    idx_changed = save_index(obj)

    manifest = conv.read_json(MANIFEST) or {"articles": []}
    entries = [e for e in manifest.get("articles", []) if e.get("id") != meta["id"]]
    entries.append(manifest_entry(meta))
    m_changed = save_manifest(entries)

    print("#%s %s · %s" % (meta["id"], meta["title"], action))
    print("  .cwb %s / cwb-index.json %s / cwb-manifest.json %s"
          % ("已写" if cwb_changed else "无变化",
             "已写" if idx_changed else "无变化",
             "已写" if m_changed else "无变化"))
    print("  索引共 %d 篇" % len(obj["articles"]))
    return 0


def all_mode():
    stats = conv.rebuild(verbose=True)
    print()
    if stats["new_ids"]:
        print("新增: " + ", ".join("#%s" % i for i in stats["new_ids"]))
    if stats["removed_ids"]:
        print("删除: " + ", ".join("#%s" % i for i in stats["removed_ids"]))
    if not stats["new_ids"] and not stats["removed_ids"] and not stats["index_written"]:
        print("索引已是最新，没有需要写的东西。")
    print("索引共 %d 篇" % stats["total"])
    return 0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if len(args) >= 2:
        cat, aid = args[0], args[1]
        if not aid.isdigit():
            print("[错误] 第二参数要是文章编号，例如: 心理学 90")
            return 2
        return one(cat, int(aid))
    if len(args) == 1:
        print("[提示] 只给了分类名，需要「分类 编号」两个参数；例如: python \"实用工具/更新文章索引.py\" 心理学 90")
        return 2
    return all_mode()


if __name__ == "__main__":
    sys.exit(main())
