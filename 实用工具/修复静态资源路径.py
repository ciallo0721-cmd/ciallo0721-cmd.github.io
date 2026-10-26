# -*- coding: utf-8 -*-
"""
静态资源路径修复：消灭三个稳定复现的 404
------------------------------------------------------------
本地/线上稳定报的三个 404：
    404 -> /css/wiki-linker.js
    404 -> /js/svg-icons.js
    404 -> /blog/css/MaokenAssortedSans.ttf

根因（2026-10-26 实查）：
1. wiki-linker.js / wiki-data.js —— 文件在 js/js/ 与根目录，但引用写成 /css/wiki-linker.js；
   并且 wiki-linker 的 wikiBaseUrl 指向的 wiki/ 目录**全站已不存在**
   （全站 href 零命中 wiki/ 路径）→ 修好路径也只会产生一组死链。
   处理：把「百科词条系统」三行引用整体移除。脚本本体保留在 js/js/，随时可恢复。

2. svg-icons.js —— 实际在 js/js/svg-icons.js，blog 下部分页面写成 /js/svg-icons.js 或 ../js/svg-icons.js。
   处理：统一改成绝对路径 /js/js/svg-icons.js。

3. MaokenAssortedSans.ttf —— 实际在 css/MaokenAssortedSans.ttf，
   三层文章页写 url('../../css/...')，会解析成 /blog/css/...（不存在）。
   处理：直接移除该字体的 @font-face 块，回落系统无衬线（符合项目视觉基线，
   且该字体单文件 12MB，逐页加载会明显拖慢首屏）。font-family 列表保留，
   浏览器自动 fallback 到后面的系统字体。

用法：
    python 实用工具/修复静态资源路径.py            # 预演
    python 实用工具/修复静态资源路径.py --apply     # 写入
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

EXCLUDE_DIRS = (
    "build",
    "node_modules",
    ".workbuddy",
    ".md_preview",
    "tests",
    "__pycache__",
    "blog_backup_20260822",  # 历史备份，不在维护范围
)

# 行级删除：百科词条系统整块
RE_COMMENT = re.compile(r"^<!--\s*百科词条系统\s*-->$")
RE_WIKI_SCRIPT = re.compile(r'^<script[^>]*src="[^"]*(?:wiki-data|wiki-linker)\.js"[^>]*></script>$')

# svg-icons 路径归一
SVG_PATTERNS = [
    ('src="/js/svg-icons.js"', 'src="/js/js/svg-icons.js"'),
    ('src="../js/svg-icons.js"', 'src="/js/js/svg-icons.js"'),
    ('src="../../js/svg-icons.js"', 'src="/js/js/svg-icons.js"'),
    ('src="./js/svg-icons.js"', 'src="/js/js/svg-icons.js"'),
    ('src="js/svg-icons.js"', 'src="/js/js/svg-icons.js"'),
]

# @font-face 块（MaokenAssortedSans）
RE_FONTFACE = re.compile(r"@font-face\s*\{[^}]*MaokenAssortedSans[^}]*\}[ \t]*\n?")


def fix_text(text, stat):
    # 1. 删百科词条系统三行
    lines = text.split("\n")
    kept = []
    for ln in lines:
        s = ln.strip()
        if RE_COMMENT.match(s) or RE_WIKI_SCRIPT.match(s):
            stat["wiki_lines"] += 1
            continue
        kept.append(ln)
    text = "\n".join(kept)

    # 2. svg-icons 路径
    for old, new in SVG_PATTERNS:
        if old in text:
            stat["svg_fixed"] += text.count(old)
            text = text.replace(old, new)

    # 3. 移除 MaokenAssortedSans 的 @font-face
    text, n = RE_FONTFACE.subn("", text)
    stat["font_removed"] += n

    return text


def main():
    apply = "--apply" in sys.argv

    all_html = sorted(
        p for p in ROOT.rglob("*.html")
        if not any(seg in p.parts for seg in EXCLUDE_DIRS)
    )

    todo = []
    total = {"wiki_lines": 0, "svg_fixed": 0, "font_removed": 0}

    for path in all_html:
        rel = path.relative_to(ROOT).as_posix()
        try:
            text = path.read_text(encoding="utf-8", errors="surrogateescape")
        except Exception as e:
            print(f"[读取失败] {rel}: {e}")
            continue

        stat = {"wiki_lines": 0, "svg_fixed": 0, "font_removed": 0}
        new_text = fix_text(text, stat)
        if new_text != text:
            todo.append((rel, path, new_text, stat))
            for k in total:
                total[k] += stat[k]

    print(f"待修复: {len(todo)} 个页面")
    print(f"  删除词条系统引用行: {total['wiki_lines']}")
    print(f"  修正 svg-icons 路径: {total['svg_fixed']}")
    print(f"  移除 12MB 字体 @font-face: {total['font_removed']}")
    print("-" * 60)
    for rel, _, _, st in todo[:12]:
        print(f"  * {rel}  (wiki-{st['wiki_lines']} svg-{st['svg_fixed']} font-{st['font_removed']})")
    if len(todo) > 12:
        print(f"  …… 等共 {len(todo)} 个页面")

    if not apply:
        print("\n[预演模式] 加 --apply 才写入")
        return

    ok = err = 0
    for rel, path, new_text, _ in todo:
        try:
            path.write_text(new_text, encoding="utf-8", errors="surrogateescape", newline="")
            ok += 1
        except Exception as e:
            print(f"[写入失败] {rel}: {e}")
            err += 1
    print(f"\n写入完成: {ok} 成功 / {err} 失败")


if __name__ == "__main__":
    main()
