# -*- coding: utf-8 -*-
"""
生成 blog/<分类>/index.html —— 以 blog/index.html 为模板的深一级副本。

用法:
    python 实用工具/生成分类页.py            # 预演，只打印要生成什么
    python 实用工具/生成分类页.py --apply    # 真正写文件

特性:
    * 分类列表自动从 articles-data.js 提取，另补上 blog/ 下的空分类目录
    * 只显示当前分类的文章（CWBI 合并后二次过滤）
    * 路径深一级：模板里的 ../ 统一变 ../../，卡片链接补 ../
    * 幂等：重复运行结果一致
"""
import re
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
BLOG = ROOT / "blog"
TPL_PATH = BLOG / "index.html"
DATA_PATH = ROOT / "articles-data.js"

# 这些目录不是文章分类，跳过
SKIP_DIRS = {"muban", "emergency"}

# 分类顺序（按文章数降序，未列出的追加在后面）
ORDER = ["心理学", "教程", "ACG", "公告", "生活", "闲聊", "科技", "医学", "日记", "小说", "求助", "笔记"]


def parse_categories(js_text):
    """从 articles-data.js 里抠出 (id, category, fileName)"""
    out = []
    pat = re.compile(r"id:\s*(\d+)\s*,\s*category:\s*\"([^\"]*)\"\s*,\s*fileName:\s*\"([^\"]*)\"")
    for m in pat.finditer(js_text):
        out.append((int(m.group(1)), m.group(2), m.group(3)))
    return out


def render_chips(cats, counts, current=None, prefix=""):
    rows = []
    for c in cats:
        cls = ' class="is-current"' if c == current else ""
        rows.append(
            '            <a%s href="%s%s/index.html">%s<span class="cat-count">%d</span></a>'
            % (cls, prefix, quote(c), c, counts.get(c, 0))
        )
    return "\n".join(rows)


def build_page(tpl, cat, count, all_cats, counts):
    """把全站索引模板改造成单个分类页"""
    html = tpl

    # 1) 路径深一级（模板在 blog/ 下，全部是 ../ 前缀，替换一次安全）
    html = html.replace('href="../', 'href="../../').replace('src="../', 'src="../../')

    # 1.5) 去掉模板自带的分类导航区块（下面会按当前分类重插一份）
    html = re.sub(
        r"[ \t]*<!-- CAT_NAV_START.*?<!-- CAT_NAV_END -->\n?",
        "",
        html,
        flags=re.S,
    )

    enc = quote(cat)

    # 2) <head> 元信息
    html = html.replace(
        "<title>文章站 - ciallo0721-cmd 的博客</title>",
        "<title>%s · 文章分类 - ciallo0721-cmd 的博客</title>" % cat,
    )
    html = html.replace(
        '<meta property="og:title" content="文章站 - ciallo0721-cmd 的博客">',
        '<meta property="og:title" content="%s · 文章分类 - ciallo0721-cmd 的博客">' % cat,
    )
    html = html.replace(
        '<meta name="twitter:title" content="文章站 - ciallo0721-cmd 的博客">',
        '<meta name="twitter:title" content="%s · 文章分类 - ciallo0721-cmd 的博客">' % cat,
    )
    html = html.replace(
        'content="ciallo0721-cmd 的个人博客文章站，收录 80+ 篇原创文章，覆盖 VTuber 文化、心理学深度解析、Ren\'Py 游戏开发教程、编程技巧与生活随笔。一个初中生开发者的真实创作空间，一起探索有趣的知识喵～"',
        'content="ciallo0721-cmd 的博客「%s」分类，共 %d 篇文章。一个初中生开发者的真实创作空间，一起探索有趣的知识喵～"' % (cat, count),
    )
    html = html.replace(
        'content="ciallo0721-cmd 的个人博客文章站，涵盖 VTuber、心理学、技术教程等领域的原创文章。"',
        'content="ciallo0721-cmd 的博客「%s」分类，共 %d 篇文章。"' % (cat, count),
    )
    html = html.replace(
        '<meta property="og:url" content="https://ciallo0721-cmd.top/blog/">',
        '<meta property="og:url" content="https://ciallo0721-cmd.top/blog/%s/">' % enc,
    )
    html = html.replace(
        '<link rel="canonical" href="https://ciallo0721-cmd.top/blog/">',
        '<link rel="canonical" href="https://ciallo0721-cmd.top/blog/%s/">' % enc,
    )
    html = html.replace(
        "<meta name=\"keywords\" content=\"技术文章,Python教程,游戏开发,ciallo0721-cmd,文章站,VTuber,心理学\">",
        "<meta name=\"keywords\" content=\"%s,ciallo0721-cmd,文章站,博客分类\">" % cat,
    )

    # 3) 埋点
    html = html.replace(
        "page_name: 'blog-index',", "page_name: 'blog-category-%s'," % enc
    ).replace(
        "category: '文章列表'", "category: '%s'" % cat
    )

    # 4) 标题区
    html = html.replace(
        "            <h1>文章站</h1>\n            <p>所有文章的统一入口，点击卡片开始阅读喵～</p>",
        "            <h1>%s</h1>\n            <p>「%s」分类下的全部文章，共 %d 篇喵～</p>" % (cat, cat, count),
    )

    # 5) 列表小标题
    html = html.replace(
        "            <h2>所有文章</h2>", "            <h2>%s · 全部文章</h2>" % cat
    )

    # 6) 搜索框占位
    html = html.replace(
        'placeholder="搜索文章标题、标签或内容..."',
        'placeholder="在「%s」分类内搜索标题、标签或内容..."' % cat,
    )

    # 7) 空状态文案
    html = html.replace(
        "            <h3>未找到相关文章</h3>\n            <p>请尝试其他搜索关键词或标签</p>",
        "            <h3>这里还没有文章</h3>\n            <p>换个关键词试试，或者<a href=\"../index.html\">回文章站看全部</a></p>",
    )

    # 8) 页脚
    html = html.replace(
        "            <p>文章站 — 这里是所有文章的聚集地</p>",
        "            <p>%s分类 — 共 %d 篇文章</p>" % (cat, count),
    )

    # 9) 分类导航条 + 返回链接（插在 <main> 开头）
    nav_html = (
        '        <a class="cat-back" href="../index.html">'
        '<i class="fas fa-arrow-left"></i> 返回全部文章</a>\n'
        '        <!-- CAT_NAV_START 分类导航（由 实用工具/生成分类页.py 维护） -->\n'
        '        <nav class="cat-nav" aria-label="文章分类">\n'
        + render_chips(all_cats, counts, cat, "../") + "\n"
        "        </nav>\n"
        "        <!-- CAT_NAV_END -->\n"
    )
    html = html.replace(
        '    <main class="container articles-main-container">\n',
        '    <main class="container articles-main-container">\n' + nav_html,
        1,
    )

    # 10) 只保留本分类的文章
    html = html.replace(
        "            var allArticles = window.articlesData.getSortedArticles();",
        "            var CATEGORY = '%s';\n"
        "            function inCat(a) { return a && a.category === CATEGORY; }\n"
        "            var allArticles = window.articlesData.getSortedArticles().filter(inCat);" % cat,
    )
    # CWBI 合并后二次过滤（cwb 清单是全站的，别把别的分类带进来）
    html = html.replace(
        "                allArticles = window.CWBI.mergeArticles(cwbList, allArticles);",
        "                allArticles = window.CWBI.mergeArticles(cwbList, allArticles).filter(inCat);",
    )

    # 11) 卡片链接补一级（fileName 形如 "公告/123/"，从 blog/公告/ 出发要 ../公告/123/）
    html = html.replace(
        "                    articleCard.href = (article.fileName || '').replace(/.html$/, '');",
        "                    articleCard.href = '../' + (article.fileName || '').replace(/.html$/, '');",
    )

    # 12) tags 兜底，避免个别条目没 tags 就整个列表炸掉
    html = html.replace(
        "                    article.tags.forEach(function(tag) {",
        "                    (article.tags || []).forEach(function(tag) {",
    )
    html = html.replace(
        "                    article.tags.forEach(function(tag) { tagSet.add(tag); });",
        "                    (article.tags || []).forEach(function(tag) { tagSet.add(tag); });",
    )

    return html


def main():
    apply = "--apply" in sys.argv

    tpl = TPL_PATH.read_text(encoding="utf-8")
    data = DATA_PATH.read_text(encoding="utf-8")
    arts = parse_categories(data)

    counts = {}
    for _id, cat, _fn in arts:
        counts[cat] = counts.get(cat, 0) + 1

    # 目录里存在的空分类也补上（求助 / 笔记 之类）
    dirs = {d.name for d in BLOG.iterdir() if d.is_dir() and d.name not in SKIP_DIRS}
    cats = [c for c in ORDER if c in dirs or c in counts]
    for c in sorted(set(list(counts) + list(dirs))):
        if c not in cats:
            cats.append(c)

    print("模板: %s (%d 行)" % (TPL_PATH, tpl.count("\n") + 1))
    print("分类: %d 个" % len(cats))
    print("-" * 56)

    # 先维护 blog/index.html 自己的分类导航区块，再拿它当模板
    block = (
        '        <!-- CAT_NAV_START 分类导航（由 实用工具/生成分类页.py 维护） -->\n'
        '        <nav class="cat-nav" aria-label="文章分类">\n'
        + render_chips(cats, counts, None, "") + "\n"
        "        </nav>\n"
        "        <!-- CAT_NAV_END -->"
    )
    if re.search(r"<!-- CAT_NAV_START.*?<!-- CAT_NAV_END -->", tpl, re.S):
        new_tpl = re.sub(
            r"[ \t]*<!-- CAT_NAV_START.*?<!-- CAT_NAV_END -->",
            lambda _m: block,
            tpl,
            flags=re.S,
        )
    else:
        new_tpl = tpl.replace(
            '    <main class="container articles-main-container">\n',
            '    <main class="container articles-main-container">\n' + block + "\n",
            1,
        )

    if new_tpl != tpl:
        print("  %s blog/index.html（分类导航区块）" % ("更新" if apply else "将更新"))
        if apply:
            TPL_PATH.write_text(new_tpl, encoding="utf-8", newline="\n")
    tpl = new_tpl

    ok = fail = 0
    for cat in cats:
        cnt = counts.get(cat, 0)
        target_dir = BLOG / cat
        target = target_dir / "index.html"
        flag = "覆盖" if target.exists() else "新建"
        print("  %-6s %-8s %2d 篇  →  blog/%s/index.html" % (flag, cat, cnt, cat))

        if not apply:
            continue

        if not target_dir.is_dir():
            print("      ! 目录不存在，跳过")
            fail += 1
            continue

        html = build_page(tpl, cat, cnt, cats, counts)
        try:
            target.write_text(html, encoding="utf-8", newline="\n")
            ok += 1
        except Exception as e:  # noqa: BLE001
            print("      ! 写入失败: %s" % e)
            fail += 1

    print("-" * 56)
    if apply:
        print("写入完成: %d 成功 / %d 失败" % (ok, fail))
    else:
        print("预演模式，未写文件。加 --apply 执行。")


if __name__ == "__main__":
    main()
