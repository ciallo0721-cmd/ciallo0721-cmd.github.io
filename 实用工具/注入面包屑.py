# -*- coding: utf-8 -*-
"""
全站面包屑注入脚本
------------------------------------------------------------
给站点 HTML 的 </head> 前插入 breadcrumb.css / breadcrumb.js 引用。

- 自动按页面所在深度计算相对路径（blog/X/N/ 三层 → ../../../）
- 幂等：已含 breadcrumb.js 的页面自动跳过
- 游戏 / 跳转 / 测试页通过白名单排除

用法：
    python 实用工具/注入面包屑.py            # 预演，只打印不写
    python 实用工具/注入面包屑.py --apply     # 实际写入
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 要处理的路径前缀（相对站点根）
INCLUDE_PREFIXES = [
    "index.html",
    "aboutme.html",
    "adss.html",
    "friends.html",
    "help.html",
    "status.html",
    "timeline.html",
    "app/",
    "tools/",
    "pages/",
    "doc/",
    "oops/",
    "blog/",
    "baicai/",
    "taffy/",
    "verity/",
    "mathtovideo/",
    "WeiShan/",
    "istaffylive/",
    "iswarmaupdate/",
    "ispopcornradioupdate/",
]

# 明确排除（测试页 / 灰度页 / 跳转页）
EXCLUDE_PARTS = [
    "_graytest_",
    "_aidebug",
    "_aintest",
    "_videotest",
    "test-userfrom",
    "redirect-template",
    "muban.html",  # 保留：模板也要带，供新文章继承
    "wenzhangyong",  # 章节页保留
]

EXCLUDE_EXACT = set()

MARK = "js/js/breadcrumb.js"

CSS_LINE = '<link rel="stylesheet" href="{p}css/css/breadcrumb.css">'
JS_LINE = '<script defer src="{p}js/js/breadcrumb.js"></script>'
BLOCK = (
    "    <!-- 全站面包屑导航（自动渲染，勿删） -->\n"
    "    " + CSS_LINE + "\n"
    "    " + JS_LINE + "\n"
)


def wanted(rel: str) -> bool:
    if not rel.endswith(".html"):
        return False
    for bad in EXCLUDE_PARTS:
        if bad in rel:
            # muban.html / wenzhangyong 只是恰好同名，实际不排除
            if bad in ("muban.html", "wenzhangyong"):
                continue
            return False
    if rel in EXCLUDE_EXACT:
        return False
    return any(
        rel == p or (p.endswith("/") and rel.startswith(p)) for p in INCLUDE_PREFIXES
    )


def depth_prefix(rel: str) -> str:
    parts = rel.split("/")
    return "../" * (len(parts) - 1)


def main():
    apply = "--apply" in sys.argv

    all_html = sorted(
        p.relative_to(ROOT).as_posix()
        for p in ROOT.rglob("*.html")
        if not any(
            seg in p.parts
            for seg in ("build", "node_modules", "blog_backup_20260822", ".workbuddy", ".md_preview", "tests")
        )
    )

    todo, done, skipped = [], [], []
    for rel in all_html:
        if not wanted(rel):
            skipped.append(rel)
            continue
        path = ROOT / rel
        try:
            text = path.read_text(encoding="utf-8", errors="surrogateescape")
        except Exception as e:
            print(f"[读取失败] {rel}: {e}")
            skipped.append(rel)
            continue

        if MARK in text:
            done.append(rel)
            continue

        if "</head>" not in text:
            print(f"[无 </head>] {rel}")
            skipped.append(rel)
            continue

        p = depth_prefix(rel)
        block = BLOCK.format(p=p)
        idx = text.index("</head>")
        # 保留 </head> 前的缩进换行
        new_text = text[:idx] + block + text[idx:]
        todo.append((rel, path, new_text))

    print(f"待注入: {len(todo)}  已存在: {len(done)}  跳过: {len(skipped)}")
    print("-" * 60)
    for rel, _, _ in todo:
        print("  +", rel)

    if not apply:
        print("\n[预演模式] 加 --apply 才写入")
        return

    ok = err = 0
    for rel, path, new_text in todo:
        try:
            path.write_text(new_text, encoding="utf-8", errors="surrogateescape", newline="")
            ok += 1
        except Exception as e:
            print(f"[写入失败] {rel}: {e}")
            err += 1

    print(f"\n写入完成: {ok} 成功 / {err} 失败")


if __name__ == "__main__":
    main()
