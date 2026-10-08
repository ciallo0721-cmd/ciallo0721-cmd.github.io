# -*- coding: utf-8 -*-
"""
CWBI转换器.py — CialloWebBlogInformation 转换工具
用法（在仓库根目录运行）:
    python "实用工具/CWBI转换器.py"            # 生成全部 .cwb + cwb-manifest.json
    python "实用工具/CWBI转换器.py" --inject   # 额外给所有文章页注入 cwbiblog.js 脚本标签

功能:
1. 用 node 把 articles-data.js dump 成 JSON（articles-data.js 是 JS 对象字面量，node 求值最准）
2. 逐篇生成 blog/{分类}/{id}/{id}.cwb（含扩展字段 excerpt/readTime/featured，向后兼容规格）
3. 生成根目录 cwb-manifest.json（首页 cwbi.js 的发现清单）
4. --inject: 给 blog/*/数字*/index.html 注入 <script src="../../../js/js/cwbiblog.js"></script>（幂等）
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JS = os.path.join(ROOT, "articles-data.js")
MANIFEST = os.path.join(ROOT, "cwb-manifest.json")

DEFAULT_AUTHOR = "ciallo0721-cmd"


def dump_articles_via_node():
    """node 求值 articles-data.js → JSON 文章数组"""
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


def esc(s):
    """cwb 字符串值转义：双引号与反斜杠"""
    return str(s).replace("\\", "\\\\").replace('"', '\\"')


def build_cwb_text(a):
    """单篇文章 → .cwb 文本"""
    tags = a.get("tags") or []
    tag_line = ",".join('"%s"' % esc(t) for t in tags)
    # 布尔转 True/False
    def b(v):
        return "True" if v else "False"

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
    lines.append('        "featured"=%s //精选(扩展字段)' % b(a.get("featured")))
    lines.append("    }")
    lines.append("    {")
    lines.append("    is?:")
    lines.append('        "isadult"=False //轻度或重度成人')
    lines.append('        "istop"=False //置顶')
    lines.append('        "isPsychology"=%s //心理学' % b(a.get("category") == "心理学"))
    lines.append('        "isMedical"=%s //医学' % b(a.get("category") == "医学"))
    lines.append('        "isOpposition"=False //有争议的')
    lines.append('        "istest"=False //测试文章(不显示在首页或blog页)')
    lines.append('        "isCopyProtection"=False //有版权保护')
    lines.append('        "isAIGC"=False //完全AI生成且未查资料')
    lines.append('        "isiframe"=False //使用iframe')
    lines.append('        "isuseArticleEditor.py"=True //使用了 实用工具/文章编辑器.py')
    lines.append('        "canCompatible"=True //兼容旧版文章data')
    lines.append("    }")
    lines.append("    {")
    lines.append("    html:")
    lines.append('        "path"="blog/%s/%s"' % (esc(a["category"]), a["id"]))
    lines.append('        "html"="index.html"')
    lines.append("    }")
    lines.append("]")
    return "\n".join(lines) + "\n"


def main():
    inject = "--inject" in sys.argv
    articles = dump_articles_via_node()
    print("[1/3] node 解析 articles-data.js: %d 篇" % len(articles))

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
                # 部分老页面没有 </body> 结尾，追加到文件末尾
                html = html.rstrip() + "\n" + script_tag.replace("\n</body>", "")
            with open(html_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(html)
            injected += 1
        print("[附加] 注入 cwbiblog.js 脚本标签: %d 个页面 (已有跳过)" % injected)

    print("完成。")


if __name__ == "__main__":
    main()
