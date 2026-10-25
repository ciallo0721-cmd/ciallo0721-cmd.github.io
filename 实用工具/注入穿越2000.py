# -*- coding: utf-8 -*-
"""
全站「10·24 穿越 2000」注入脚本
------------------------------------------------------------
给站点 HTML 的 </body> 前插入 retro-1024.js 引用。
该脚本每年 10 月 24 日自动把全站切换成 2000 年初风格，
其余时间直接 return，对站点零影响。

- 自动按页面所在深度计算相对路径（blog/X/N/ 三层 → ../../../）
- 幂等：已含 retro-1024.js 的页面自动跳过
- 模板页 blog/muban.html 也注入，新文章自动继承
- 备份 / 测试 / 错误页排除

用法：
    python 实用工具/注入穿越2000.py            # 预演，只打印不写
    python 实用工具/注入穿越2000.py --apply     # 实际写入
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 明确排除的目录片段
EXCLUDE_DIRS = (
    "build",
    "node_modules",
    "blog_backup_20260822",
    ".workbuddy",
    ".md_preview",
    "tests",
    "__pycache__",
)

# 明确排除的文件名片段（测试页 / 灰度页 / 跳转页 / 错误页 / 桌面页自身）
# arg/ 排除原因：该目录本身就是刻意模仿 2000 年代初的页面，无需彩蛋覆盖
# _retro-desktop 排除原因：首页 10/24 变身用的桌面页自身，注入会套娃
EXCLUDE_PARTS = (
    "_graytest_",
    "_aidebug",
    "_aintest",
    "_videotest",
    "test-userfrom",
    "redirect-template",
    "404.html",
    "access-denied.html",
    "privacy.html",
    "arg/",
    "_retro-desktop",
    "retro-desktop",
    "xzssy/",   # 3D 游戏页：全屏 canvas + 自定义 HUD，套 2000 风格 CSS 会直接花掉
)

MARK = "retro-1024.js"

BLOCK = (
    "    <!-- 每年10月24日限定：全站穿越回2000年初风格（勿删，由 实用工具/注入穿越2000.py 维护） -->\n"
    '    <script defer src="{p}js/js/retro-1024.js"></script>\n'
)


def depth_prefix(rel: str) -> str:
    parts = rel.split("/")
    return "../" * (len(parts) - 1)


def main():
    apply = "--apply" in sys.argv

    all_html = sorted(
        p.relative_to(ROOT).as_posix()
        for p in ROOT.rglob("*.html")
        if not any(seg in p.parts for seg in EXCLUDE_DIRS)
    )

    todo, done, skipped = [], [], []
    for rel in all_html:
        if any(bad in rel for bad in EXCLUDE_PARTS):
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

        p = depth_prefix(rel)
        if "</body>" in text:
            # 插到最后一个 </body> 前
            idx = text.rindex("</body>")
            new_text = text[:idx] + BLOCK.format(p=p) + text[idx:]
        else:
            # 兜底：文件缺 </body>（历史遗留），直接追加到文末
            sep = "" if text.endswith("\n") else "\n"
            new_text = text + sep + BLOCK.format(p=p)
        todo.append((rel, path, new_text))

    print(f"待注入: {len(todo)}  已存在: {len(done)}  跳过: {len(skipped)}")
    print("-" * 60)
    for rel, _, _ in todo[:15]:
        print("  +", rel)
    if len(todo) > 15:
        print(f"  …… 等共 {len(todo)} 个页面")

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
