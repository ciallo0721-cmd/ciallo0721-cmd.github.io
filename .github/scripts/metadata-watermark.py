#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
抹除图片 / 视频的全部元数据，再写入统一的水印字段。

由 .github/workflows/metadata-watermark.yml 调用；也可本地运行：
    python3 .github/scripts/metadata-watermark.py --list        # 只看会处理哪些文件
    python3 .github/scripts/metadata-watermark.py --scope all   # 全仓库处理

优先用 exiftool（能写 EXIF + XMP + QuickTime，覆盖所有格式）；
本机没装 exiftool 时退回 Pillow（只能写 EXIF，且只处理图片），仅用于本地预览。
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

AUTHOR = "ciallo0721-cmd"
SITE = "ciallo0721-cmd.top"
PS_IMAGE = "本图来自ciallo0721-cmd.top,已经抹除大部分敏感元数据"
PS_VIDEO = "本视频来自ciallo0721-cmd.top,已经抹除大部分敏感元数据"

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".tif", ".tiff"}
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm"}
ALL_EXT = IMAGE_EXT | VIDEO_EXT


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, errors="replace", **kw)


# ────────────────────────── 选文件 ──────────────────────────
def pick_files(scope):
    if scope == "all":
        out = run(["git", "-c", "core.quotepath=off", "ls-files"]).stdout
        files = [ln for ln in out.splitlines() if ln.strip()]
    else:
        before = (os.environ.get("BEFORE") or "").strip()
        after = (os.environ.get("AFTER") or "").strip() or "HEAD"
        rng = None
        if before and set(before) != {"0"}:
            rng = [before, after]
        # 普通 push 优先用 before..after；浅克隆或首推时退回 HEAD^..HEAD
        cand = rng or ["HEAD^", "HEAD"]
        out = run(["git", "-c", "core.quotepath=off", "diff", "--name-only",
                   "--diff-filter=ACMR", *cand])
        if out.returncode != 0:
            out = run(["git", "-c", "core.quotepath=off", "diff", "--name-only",
                       "--diff-filter=ACMR", "HEAD^", "HEAD"])
        files = [ln for ln in out.stdout.splitlines() if ln.strip()]
    return [f for f in files
            if Path(f).suffix.lower() in ALL_EXT and Path(f).is_file()]


# ────────────────────────── exiftool 方案 ──────────────────────────
def exif_tags(path):
    """按格式给出要写入的标签（name, value）"""
    ps = PS_VIDEO if Path(path).suffix.lower() in VIDEO_EXT else PS_IMAGE
    name = Path(path).name
    common_xmp = [
        ("XMP-dc:Creator", AUTHOR),
        ("XMP-dc:Rights", SITE),
        ("XMP-dc:Title", name),
        ("XMP-dc:Description", ps),
        ("XMP-dc:Source", SITE),
        ("XMP-photoshop:Credit", "from %s" % SITE),
        ("XMP-xmpRights:Marked", "True"),
    ]
    if Path(path).suffix.lower() in VIDEO_EXT:
        return common_xmp + [
            ("QuickTime:Title", name),
            ("QuickTime:Artist", AUTHOR),
            ("QuickTime:Copyright", SITE),
            ("QuickTime:Comment", ps),
            ("QuickTime:Software", SITE),
        ]
    return common_xmp + [
        ("EXIF:Artist", AUTHOR),
        ("EXIF:Copyright", SITE),
        ("EXIF:ImageDescription", ps),
        ("EXIF:UserComment", ps),
        ("EXIF:DocumentName", name),
        ("EXIF:Make", "from %s" % SITE),
        ("EXIF:Software", SITE),
    ]


def process_exiftool(path):
    # 1) 抹掉全部元数据（含 EXIF / XMP / ICC / QuickTime / PNG 文本块）
    r1 = run(["exiftool", "-all=", "-overwrite_original", "-charset", "filename=UTF8",
              "-m", "-q", "--", path])
    # 2) 写入水印字段
    args = ["exiftool", "-overwrite_original", "-charset", "filename=UTF8", "-m", "-q"]
    for k, v in exif_tags(path):
        args.append("-%s=%s" % (k, v))
    args += ["--", path]
    r2 = run(args)
    ok = r1.returncode == 0 and r2.returncode == 0
    msg = (r1.stderr or "") + (r2.stderr or "")
    return ok, msg.strip().splitlines()[:2]


# ────────────────────────── Pillow 退路（本机没 exiftool 时） ──────────────────────────
def process_pillow(path):
    p = Path(path)
    if p.suffix.lower() in VIDEO_EXT:
        return None, "跳过：本机无 exiftool，无法写视频元数据"
    try:
        from PIL import Image
    except ImportError:
        return None, "跳过：没有 exiftool 也没有 Pillow"
    try:
        im = Image.open(p)
        is_jpeg = p.suffix.lower() in (".jpg", ".jpeg")
        im2 = im.convert("RGB") if is_jpeg else im
        tags = dict(exif_tags(path))
        if is_jpeg:
            ex = Image.Exif()
            ex[0x010D] = tags.get("EXIF:DocumentName", p.name)   # DocumentName
            ex[0x010E] = tags.get("EXIF:ImageDescription", PS_IMAGE)
            ex[0x010F] = tags.get("EXIF:Make", "from %s" % SITE)
            ex[0x0131] = tags.get("EXIF:Software", SITE)
            ex[0x013B] = tags.get("EXIF:Artist", AUTHOR)
            ex[0x8298] = tags.get("EXIF:Copyright", SITE)
            im2.save(p, format="JPEG", quality=92, exif=ex.tobytes())
        else:
            # PNG/GIF/WEBP：重存即已丢掉旧元数据，仅回写 PNG 文本块
            if p.suffix.lower() == ".png":
                from PIL import PngImagePlugin
                meta = PngImagePlugin.PngInfo()
                meta.add_text("Author", AUTHOR)
                meta.add_text("Copyright", SITE)
                meta.add_text("Title", p.name)
                meta.add_text("Description", PS_IMAGE)
                meta.add_text("Source", SITE)
                im2.save(p, pnginfo=meta)
            else:
                im2.save(p)
        return True, "Pillow 回写 EXIF"
    except Exception as e:                                    # noqa: BLE001
        return False, "Pillow 失败：%s" % e


# ────────────────────────── 主流程 ──────────────────────────
def main():
    argv = sys.argv[1:]
    scope = "changed"
    if "--scope" in argv:
        scope = argv[argv.index("--scope") + 1]
    elif os.environ.get("SCOPE"):
        scope = os.environ["SCOPE"]
    if os.environ.get("EVENT") == "schedule":
        scope = "all"
    if os.environ.get("DISPATCH_SCOPE", "").strip() == "全仓库":
        scope = "all"

    files = pick_files(scope)
    print("处理范围：%s，命中 %d 个媒体文件" % (scope, len(files)))
    for f in files:
        print("  -", f)
    if "--list" in argv:
        return 0
    if not files:
        return 0

    use_exiftool = shutil.which("exiftool") is not None
    print("工具：%s" % ("exiftool" if use_exiftool else "Pillow（退路）"))
    done = skipped = failed = 0
    for f in files:
        ok, msg = process_exiftool(f) if use_exiftool else process_pillow(f)
        if ok:
            done += 1
            print("✓ %s  %s" % (f, msg))
        elif ok is None:
            skipped += 1
            print("- %s  %s" % (f, msg))
        else:
            failed += 1
            print("✗ %s  %s" % (f, msg))
    print("完成：成功 %d / 跳过 %d / 失败 %d" % (done, skipped, failed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
