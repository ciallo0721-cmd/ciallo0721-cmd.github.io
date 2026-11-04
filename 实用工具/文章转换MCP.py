# -*- coding: utf-8 -*-
"""
文章转换 MCP 服务器（零依赖，纯标准库 stdio JSON-RPC）
================================================
让 AI 在对话里直接把 Markdown 转成博客文章并跑完全部后处理。

注册位置：~/.workbuddy/mcp.json
  "blog-converter": {
    "command": "python",
    "args": ["G:\\EmoScan Pro\\ciallo0721-cmd.github.io\\实用工具\\文章转换MCP.py"]
  }

工具：
  convert_article(md_path, category, tags, excerpt, featured=false, postprocess=true)
    - md_path:   本地 md 文件绝对路径（首个 "# 标题" 作为文章标题）
    - category:  教程/公告/ACG/心理学/生活/科技/医学/小说/日记/闲聊
    - tags:      逗号分隔，如 "GFW,互联网"
    - excerpt:   摘要（首页卡片用，建议一两句话）
    - postprocess: 是否重跑 CWBI转换器/注入穿越2000/注入面包屑/生成分类页（默认 true）
"""
import sys
import json
import subprocess
import importlib.util
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parent.parent
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

PROTOCOL_VERSION = "2024-11-05"

TOOLS = [
    {
        "name": "convert_article",
        "description": "把本地 Markdown 文件导出为博客文章（blog/{分类}/{id}/index.html），更新 articles-data.js，并可选重跑全部后处理脚本（CWBI转换器、注入穿越2000、注入面包屑、生成分类页）。新文章 id 自动 = 最大 id + 1。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "md_path": {"type": "string", "description": "Markdown 文件的绝对路径"},
                "category": {"type": "string", "description": "分类：教程/公告/ACG/心理学/生活/科技/医学/小说/日记/闲聊", "enum": ["教程", "公告", "ACG", "心理学", "生活", "科技", "医学", "小说", "日记", "闲聊"]},
                "tags": {"type": "string", "description": "逗号分隔的标签，如 GFW,互联网"},
                "excerpt": {"type": "string", "description": "文章摘要，用于首页卡片和 SEO description"},
                "featured": {"type": "boolean", "description": "是否精选，默认 false"},
                "postprocess": {"type": "boolean", "description": "是否重跑后处理脚本，默认 true"},
            },
            "required": ["md_path", "category", "tags", "excerpt"],
        },
    }
]


def load_editor():
    spec = importlib.util.spec_from_file_location(
        "editor", ROOT / "实用工具" / "文章编辑器.py")
    ed = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ed)
    return ed


def run_postprocess():
    """重跑四个后处理脚本，返回输出摘要"""
    logs = []
    for name, extra in [("CWBI转换器.py", []),
                        ("注入穿越2000.py", ["--apply"]),
                        ("注入面包屑.py", ["--apply"]),
                        ("生成分类页.py", ["--apply"])]:
        r = subprocess.run(
            [sys.executable, str(ROOT / "实用工具" / name)] + extra,
            capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT),
        )
        tail = (r.stdout or "").strip().splitlines()
        logs.append(f"[{name}] {' / '.join(tail[-2:]) if tail else ('exit ' + str(r.returncode))}")
        if r.returncode != 0:
            logs.append(f"[{name}] 失败: {(r.stderr or '')[:300]}")
    return "\n".join(logs)


def convert_article(args: dict) -> str:
    md_path = Path(args["md_path"])
    if not md_path.is_absolute() or not md_path.exists():
        return f"❌ md 文件不存在或不是绝对路径: {md_path}"
    category = args["category"]
    tags = [t.strip() for t in args["tags"].split(",") if t.strip()]
    excerpt = args["excerpt"].strip()
    featured = bool(args.get("featured", False))
    postprocess = bool(args.get("postprocess", True))

    ed = load_editor()
    raw = md_path.read_text(encoding="utf-8").strip()
    title, body_md = ed.extract_title(raw)
    if not title:
        return "❌ md 里没有找到 '# 标题' 行"
    content_html, toc_html = ed.md_to_html(body_md.strip())

    aid = ed.next_article_id()
    meta = {
        "id": aid,
        "category": category,
        "fileName": f"{category}/{aid}/",
        "title": title,
        "excerpt": excerpt,
        "date": date.today().isoformat(),
        "tags": tags,
        "readTime": ed.estimate_read_time(body_md),
        "featured": featured,
    }
    out_dir = ROOT / "blog" / category / str(aid)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "index.html").write_text(
        ed.build_article_html(meta, content_html, toc_html), encoding="utf-8")
    (out_dir / "文章.md").write_text(raw + "\n", encoding="utf-8")
    ed.update_articles_data(meta)

    lines = [
        f"✅ 文章已导出 id={aid}",
        f"   标题: {title}",
        f"   页面: blog/{category}/{aid}/index.html",
        f"   articles-data.js 已更新",
    ]
    if postprocess:
        lines.append("── 后处理 ──")
        lines.append(run_postprocess())
    lines.append(f"本地预览: http://localhost:8000/blog/{category}/{aid}/")
    return "\n".join(lines)


def handle(msg: dict):
    method = msg.get("method")
    mid = msg.get("id")
    if method == "initialize":
        return {"jsonrpc": "2.0", "id": mid, "result": {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "blog-converter", "version": "1.0.0"},
        }}
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": mid, "result": {"tools": TOOLS}}
    if method == "tools/call":
        try:
            text = convert_article(msg["params"].get("arguments") or {})
            return {"jsonrpc": "2.0", "id": mid, "result": {
                "content": [{"type": "text", "text": text}], "isError": False}}
        except Exception as e:
            return {"jsonrpc": "2.0", "id": mid, "result": {
                "content": [{"type": "text", "text": f"❌ {e}"}], "isError": True}}
    if method in ("ping",):
        return {"jsonrpc": "2.0", "id": mid, "result": {}}
    if mid is not None:
        return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"未知方法: {method}"}}
    return None  # notification，不回复


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        resp = handle(msg)
        if resp is not None:
            sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
