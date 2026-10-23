# -*- coding: utf-8 -*-
"""
CWBI转换器.py — CialloWebBlogInformation 转换工具
用法（在仓库根目录运行）:
    python "实用工具/CWBI转换器.py"            # 扫描 blog 目录生成全部 .cwb + cwb-manifest.json（默认模式）
    python "实用工具/CWBI转换器.py" --from-data # 旧模式：从 articles-data.js 读取（已退役，保留兼容）
    python "实用工具/CWBI转换器.py" --inject   # 额外给所有文章页注入 cwbiblog.js 脚本标签

功能:
1. 【默认·扫描模式】遍历 blog/{分类}/{数字id}/ 目录，从各篇 index.html 提取元数据
   （标题/摘要/日期/标签/阅读时间），生成 blog/{分类}/{id}/{id}.cwb
   —— 目录即真相，新增文章只要落盘 + 跑一次本脚本即上架，无需改 articles-data.js
2. 生成根目录 cwb-manifest.json（首页 cwbi.js 的发现清单）
3. 已有 .cwb 的 is? 手动标记（isCopyProtection 等）与 featured 会被继承，不被人为抹掉
4. --inject: 给 blog/*/数字*/index.html 注入 <script src="../../../js/js/cwbiblog.js"></script>（幂等）
"""
import json
import os
import re
import sys
from html import unescape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "cwb-manifest.json")
DATA_JS = os.path.join(ROOT, "articles-data.js")
BLOG_DIR = os.path.join(ROOT, "blog")

DEFAULT_AUTHOR = "ciallo0721-cmd"

# is? 块的全部键（用于继承旧 .cwb 的手动标记）
IS_KEYS = [
    "isadult", "istop", "isPsychology", "isMedical", "isOpposition",
    "istest", "isCopyProtection", "isAIGC", "isiframe",
    "isuseArticleEditor.py", "canCompatible",
]


def esc(s):
    """cwb 字符串值转义：双引号与反斜杠"""
    return str(s).replace("\\", "\\\\").replace('"', '\\"')


def strip_tags(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    return unescape(s).strip()


# ── 从 index.html 提取元数据 ──────────────────────────────

def extract_meta(html, cat, aid):
    def grab(pattern, default=""):
        m = re.search(pattern, html, re.S)
        return m.group(1).strip() if m else default

    # class 属性后可能还带 id 等属性（老模板：<h1 class="article-title" id="articleTitle">）
    title = grab(r'<h1 class="article-title"[^>]*>([\s\S]*?)</h1>')
    if not title:
        # 兜底 1：<title>xxx - ciallo0721-cmd的文章</title>
        t = grab(r"<title>([\s\S]*?)</title>")
        if t:
            title = re.split(r"\s+[-|·—]\s+", t)[0].strip()
    if not title:
        # 兜底 2：og:title
        title = grab(r'og:title" content="([^"]*)"')
    excerpt = grab(r'<p class="article-intro"[^>]*>([\s\S]*?)</p>')
    if not excerpt:
        # 兜底：meta description
        excerpt = grab(r'name="description" content="([^"]*)"')
    # 发布日期：取 article-date 里第一个 <span>…</span>
    m = re.search(r"发布日期：<span>([\d-]+)</span>", html)
    date = m.group(1) if m else ""
    # 阅读时间：约N分钟
    m = re.search(r"阅读时间：<span>约?(\d+)\s*分钟</span>", html)
    read_time = int(m.group(1)) if m else 0
    # 标签
    tags = re.findall(r'<span class="article-tag">([\s\S]*?)</span>', html)
    tags = [strip_tags(t) for t in tags if strip_tags(t)]
    return {
        "id": aid,
        "category": cat,
        "title": strip_tags(title),
        "excerpt": strip_tags(excerpt) or strip_tags(title),
        "date": date,
        "tags": tags,
        "readTime": read_time,
        "author": DEFAULT_AUTHOR,
    }


def inherit_old_cwb(cwb_path):
    """读旧 .cwb：取整个 index 块（title/date/tag/excerpt/readTime/featured）
    与 is? 手动标记。HTML 提取不到的字段用旧值兜底，防止老文章元数据被抹掉。"""
    result = {"index": {}, "featured": None, "is": {}}
    if not os.path.isfile(cwb_path):
        return result
    try:
        text = open(cwb_path, encoding="utf-8").read()
    except OSError:
        return result
    m = re.search(r'"title"="((?:[^"\\]|\\.)*)"', text)
    if m:
        result["index"]["title"] = m.group(1).replace('\\"', '"')
    m = re.search(r'"date"="([^"]*)"', text)
    if m:
        result["index"]["date"] = m.group(1)
    m = re.search(r'"excerpt"="((?:[^"\\]|\\.)*)"', text)
    if m:
        result["index"]["excerpt"] = m.group(1).replace('\\"', '"')
    m = re.search(r'"readTime"=(\d+)', text)
    if m:
        result["index"]["readTime"] = int(m.group(1))
    m = re.search(r'"tag"=([^\n]*)', text)
    if m:
        tagpart = m.group(1).split("//")[0].strip()
        result["index"]["tags"] = [
            t.strip().strip('"').replace('\\"', '"')
            for t in tagpart.split(",") if t.strip().strip('"')
        ]
    m = re.search(r'"featured"=(True|False)', text)
    if m:
        result["featured"] = (m.group(1) == "True")
    for k in IS_KEYS:
        m = re.search(r'"%s"=(True|False)' % re.escape(k), text)
        if m:
            result["is"][k] = (m.group(1) == "True")
    return result


def build_cwb_text(a):
    tags = a.get("tags") or []
    tag_line = ",".join('"%s"' % esc(t) for t in tags)

    def b(v):
        return "True" if v else "False"

    isv = a.get("is", {})

    def isb(k, default=False):
        return b(isv.get(k, default))

    lines = []
    lines.append("// CWBI 文章信息文件 · 由 实用工具/CWBI转换器.py 生成 · 手动编辑请保留格式")
    lines.append("// 文章 #%s" % a["id"])
    lines.append("[")
    lines.append("    {")
    lines.append("    index:")
    lines.append('        "title"="%s" //标题' % esc(a.get("title", "")))
    lines.append('        "author"="%s" //作者' % esc(a.get("author") or DEFAULT_AUTHOR))
    lines.append('        "date"="%s" //日期' % esc(a.get("date", "")))
    lines.append('        "tag"=%s //标签' % (tag_line or '""'))
    lines.append('        "excerpt"="%s" //摘要(扩展字段)' % esc(a.get("excerpt", "")))
    lines.append('        "readTime"=%s //预计阅读分钟(扩展字段)' % (a.get("readTime") or 0))
    lines.append('        "featured"=%s //精选(扩展字段)' % b(a.get("featured", False)))
    lines.append("    }")
    lines.append("    {")
    lines.append("    is?:")
    lines.append('        "isadult"=%s //轻度或重度成人' % isb("isadult"))
    lines.append('        "istop"=%s //置顶' % isb("istop"))
    lines.append('        "isPsychology"=%s //心理学' % isb("isPsychology", a.get("category") == "心理学"))
    lines.append('        "isMedical"=%s //医学' % isb("isMedical", a.get("category") == "医学"))
    lines.append('        "isOpposition"=%s //有争议的' % isb("isOpposition"))
    lines.append('        "istest"=%s //测试文章(不显示在首页或blog页)' % isb("istest"))
    lines.append('        "isCopyProtection"=%s //有版权保护' % isb("isCopyProtection"))
    lines.append('        "isAIGC"=%s //完全AI生成且未查资料' % isb("isAIGC"))
    lines.append('        "isiframe"=%s //使用iframe' % isb("isiframe"))
    lines.append('        "isuseArticleEditor.py"=%s //使用了 实用工具/文章编辑器.py' % isb("isuseArticleEditor.py", True))
    lines.append('        "canCompatible"=%s //兼容旧版文章data' % isb("canCompatible", True))
    lines.append("    }")
    lines.append("    {")
    lines.append("    html:")
    lines.append('        "path"="blog/%s/%s"' % (esc(a["category"]), a["id"]))
    lines.append('        "html"="index.html"')
    lines.append("    }")
    lines.append("]")
    return "\n".join(lines) + "\n"


# ── 模式一：扫描 blog 目录（默认） ────────────────────────

def scan_blog():
    articles = []
    if not os.path.isdir(BLOG_DIR):
        print("[错误] blog 目录不存在")
        sys.exit(1)
    seen_ids = {}  # aid -> (category, had_old_cwb)
    for cat in sorted(os.listdir(BLOG_DIR)):
        cat_path = os.path.join(BLOG_DIR, cat)
        if not os.path.isdir(cat_path):
            continue
        for name in sorted(os.listdir(cat_path)):
            if not re.fullmatch(r"\d+", name):
                continue
            aid = int(name)
            html_path = os.path.join(cat_path, name, "index.html")
            cwb_path = os.path.join(cat_path, name, "%d.cwb" % aid)
            if not os.path.isfile(html_path):
                print("  [跳过] #%s 目录无 index.html: %s" % (aid, html_path))
                continue
            # 重复 id（不同分类同编号）：优先保留有旧 .cwb 的正式文章
            if aid in seen_ids:
                prev_cat, prev_old = seen_ids[aid]
                if prev_old or not os.path.isfile(cwb_path):
                    print("  [跳过] #%s 重复 id（%s 已收录，跳过 %s）" % (aid, prev_cat, cat))
                    continue
                # 后来者有旧 .cwb，把先前的顶掉
                articles = [a for a in articles if a["id"] != aid]
                print("  [提示] #%s 重复 id：%s 无 .cwb，改收录 %s" % (aid, prev_cat, cat))
            seen_ids[aid] = (cat, os.path.isfile(cwb_path))
            html = open(html_path, encoding="utf-8", errors="replace").read()
            meta = extract_meta(html, cat, aid)
            # 合并策略：
            #  title/date/tags —— HTML 优先（硬事实，改标题应生效），HTML 没有才用旧值
            #  excerpt/readTime —— 旧 .cwb 优先（data 时代人工撰写的软内容更好），旧没有才用 HTML
            old = inherit_old_cwb(cwb_path)
            for k in ("title", "date", "tags"):
                if not meta.get(k) and old["index"].get(k):
                    meta[k] = old["index"][k]
            for k in ("excerpt", "readTime"):
                if old["index"].get(k):
                    meta[k] = old["index"][k]
            # date 兜底：空 date 会让前端 sort 比较器产出 NaN，导致整个列表乱序
            if not meta.get("date"):
                print("  [提示] #%s 无日期，兜底为 1970-01-01（排列表末尾）" % aid)
                meta["date"] = "1970-01-01"
            if not meta["title"]:
                print("  [警告] #%s 未能提取标题，用分类名兜底" % aid)
                meta["title"] = "%s #%s" % (cat, aid)
            if old["featured"] is not None:
                meta["featured"] = old["featured"]
            meta["is"] = old["is"]
            articles.append(meta)
    articles.sort(key=lambda a: a["id"])
    return articles


# ── 模式二：从 articles-data.js 读取（旧，保留兼容） ──────

def dump_articles_via_node():
    import subprocess
    js = (
        "global.window={};"
        "eval(require('fs').readFileSync(%s,'utf8'));"
        "console.log(JSON.stringify(window.articlesData.articles));"
    ) % json.dumps(DATA_JS.replace("\\", "/"))
    out = subprocess.run(
        ["node", "-e", js], capture_output=True, text=True, encoding="utf-8", cwd=ROOT
    )
    if out.returncode != 0:
        print("[错误] node 求值失败:\n" + out.stderr)
        sys.exit(1)
    return json.loads(out.stdout.strip())


# ── 主流程 ──────────────────────────────────────────────

def main():
    inject = "--inject" in sys.argv
    from_data = "--from-data" in sys.argv

    if from_data:
        articles = dump_articles_via_node()
        print("[1/3] node 解析 articles-data.js: %d 篇" % len(articles))
    else:
        articles = scan_blog()
        print("[1/3] 扫描 blog 目录: %d 篇" % len(articles))

    ok, skip = 0, 0
    manifest_entries = []
    for a in articles:
        cat, aid = a["category"], str(a["id"])
        dir_ = os.path.join(ROOT, "blog", cat, aid)
        if not os.path.isdir(dir_):
            print("  [跳过] #%s 目录不存在: %s" % (aid, dir_))
            skip += 1
            continue
        cwb_path = os.path.join(dir_, aid + ".cwb")
        with open(cwb_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(build_cwb_text(a))
        manifest_entries.append({
            "id": a["id"],
            "category": cat,
            "cwbPath": "blog/%s/%s/%s.cwb" % (cat, aid, aid),
        })
        ok += 1
    print("[2/3] 生成 .cwb: %d 篇 (跳过 %d)" % (ok, skip))

    manifest_entries.sort(key=lambda e: e["id"])
    manifest = {
        "name": "CialloWebBlogInformation manifest",
        "generator": "实用工具/CWBI转换器.py",
        "count": len(manifest_entries),
        "articles": manifest_entries,
    }
    with open(MANIFEST, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("[3/3] 清单: cwb-manifest.json (%d 篇)" % len(manifest_entries))

    if inject:
        injected = 0
        script_tag = '<script src="../../../js/js/cwbiblog.js"></script>\n</body>'
        for e in manifest_entries:
            html_path = os.path.join(ROOT, "blog", e["category"], str(e["id"]), "index.html")
            if not os.path.isfile(html_path):
                continue
            with open(html_path, "r", encoding="utf-8") as f:
                html = f.read()
            if "cwbiblog.js" in html:
                continue
            if "</body>" in html:
                html = html.replace("</body>", script_tag, 1)
            else:
                html = html.rstrip() + "\n" + script_tag.replace("\n</body>", "")
            with open(html_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(html)
            injected += 1
        print("[附加] 注入 cwbiblog.js 脚本标签: %d 个页面 (已有跳过)" % injected)

    print("完成。")


if __name__ == "__main__":
    main()
