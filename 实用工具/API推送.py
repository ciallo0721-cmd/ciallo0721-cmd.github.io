# -*- coding: utf-8 -*-
"""
通过 GitHub Git Data API 把当前 HEAD 推到远端 main。

用途：本机到 github.com:443 的 TLS 被 SNI 阻断（git push 报 Connection reset），
但 api.github.com 可达，于是用 Git Data API 走等价流程。

特点：
  * base_tree 用【远端最新 tree】→ 不会覆盖 Actions 机器人（bili-watch / GA4 注入）的提交
  * 先拉远端 tree 比对，内容相同的 blob 直接跳过，重复推送很快
  * 推送后逐个文件核验 blob sha，不一致就报错退出

用法：
    python 实用工具/API推送.py            # 预演，只看要推什么
    python 实用工具/API推送.py --apply    # 真推
"""
import base64
import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = "ciallo0721-cmd/ciallo0721-cmd.github.io"
BRANCH = "main"
CD = str(Path(__file__).resolve().parent.parent)


def sh(*args, binary=False):
    r = subprocess.run(args, cwd=CD, capture_output=True)
    if r.returncode != 0:
        raise SystemExit("git 失败: %s\n%s" % (" ".join(args), r.stderr.decode("utf-8", "replace")))
    return r.stdout if binary else r.stdout.decode("utf-8").strip()


def get_token():
    r = subprocess.run(
        ["git", "credential", "fill"],
        cwd=CD, capture_output=True,
        input=b"protocol=https\nhost=github.com\n\n",
    )
    for line in r.stdout.decode("utf-8", "replace").splitlines():
        if line.startswith("password="):
            return line[9:]
    raise SystemExit("拿不到 token（git credential 里没有 github.com 的密码）")


TOKEN = get_token()


def api(method, path, data=None):
    url = "https://api.github.com" + path
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "ciallo-api-push")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:600]
        raise SystemExit("API %s %s -> %s\n%s" % (method, path, e.code, detail))


def list_changes(rev):
    """返回 [(status, path)]"""
    out = sh("git", "-c", "core.quotepath=off", "diff-tree",
             "--no-commit-id", "--name-status", "-r", rev)
    rows = []
    for line in out.splitlines():
        parts = line.split("\t")
        rows.append((parts[0], parts[-1]))
    return rows


def main():
    apply = "--apply" in sys.argv

    local_head = sh("git", "rev-parse", "HEAD")
    msg = sh("git", "log", "-1", "--format=%B")
    an = sh("git", "log", "-1", "--format=%an")
    ae = sh("git", "log", "-1", "--format=%ae")
    ad = sh("git", "log", "-1", "--format=%aI")

    ref = api("GET", "/repos/%s/git/refs/heads/%s" % (REPO, BRANCH))
    remote_head = ref["object"]["sha"]
    remote_commit = api("GET", "/repos/%s/git/commits/%s" % (REPO, remote_head))
    remote_tree = remote_commit["tree"]["sha"]

    print("本地 HEAD :", local_head)
    print("远端 HEAD :", remote_head)
    print("远端最新  :", remote_commit["message"].splitlines()[0][:60])

    if remote_head == local_head:
        print("两边一致，无需推送")
        return 0

    rows = list_changes(local_head)
    adds = [p for s, p in rows if not s.startswith("D")]
    dels = [p for s, p in rows if s.startswith("D")]
    status_of = {p: s for s, p in rows}
    print("提交涉及 %d 改/增 + %d 删除" % (len(adds), len(dels)))

    # 远端现有 blob，用来跳过没变的
    rt = api("GET", "/repos/%s/git/trees/%s?recursive=1" % (REPO, remote_tree))
    if rt.get("truncated"):
        print("! 远端 tree 被截断，将上传全部文件")
        remote_blobs = {}
    else:
        remote_blobs = {e["path"]: e["sha"] for e in rt["tree"] if e["type"] == "blob"}
    print("远端已有文件: %d 个" % len(remote_blobs))

    tree_items, need = [], []
    for path in adds:
        sha = sh("git", "rev-parse", "HEAD:" + path)
        if remote_blobs.get(path) == sha:
            continue
        # 新增文件若远端已有同路径（多半已被 Actions 处理过，比如水印/元数据抹除），别再覆盖
        if remote_blobs.get(path) and status_of.get(path, "").startswith("A"):
            continue
        need.append((path, sha))
        tree_items.append({"path": path, "mode": "100644", "type": "blob", "sha": sha})

    # 远端有、本地这次删掉的
    for path in dels:
        if path in remote_blobs:
            tree_items.append({"path": path, "mode": "100644", "type": "blob", "sha": None})

    print("需要上传: %d 个 blob，tree 变更 %d 项" % (len(need), len(tree_items)))

    if not tree_items:
        print("内容已经一致（只差提交记录），无需推送")
        return 0

    if not apply:
        for p, _s in need[:20]:
            print("   上传", p)
        if len(need) > 20:
            print("   ... 还有 %d 个" % (len(need) - 20))
        print("预演结束，加 --apply 真推")
        return 0

    for i, (path, sha) in enumerate(need, 1):
        raw = sh("git", "cat-file", "blob", sha, binary=True)
        r = api("POST", "/repos/%s/git/blobs" % REPO,
                {"content": base64.b64encode(raw).decode("ascii"), "encoding": "base64"})
        if r["sha"] != sha:
            raise SystemExit("blob sha 不一致: %s" % path)
        if i % 20 == 0:
            print("   blob %d/%d" % (i, len(need)))
    print("blob 上传完成")

    tree = api("POST", "/repos/%s/git/trees" % REPO,
               {"base_tree": remote_tree, "tree": tree_items})
    print("新 tree   :", tree["sha"])

    commit = api("POST", "/repos/%s/git/commits" % REPO, {
        "message": msg,
        "tree": tree["sha"],
        "parents": [remote_head],
        "author": {"name": an, "email": ae, "date": ad},
        "committer": {"name": an, "email": ae, "date": ad},
    })
    print("新 commit :", commit["sha"])

    api("PATCH", "/repos/%s/git/refs/heads/%s" % (REPO, BRANCH),
        {"sha": commit["sha"], "force": False})
    print("ref 已更新")

    # 核验
    rt2 = api("GET", "/repos/%s/git/trees/%s?recursive=1" % (REPO, commit["sha"]))
    now = {e["path"]: e["sha"] for e in rt2["tree"] if e["type"] == "blob"}
    bad = [p for p in adds if now.get(p) != sh("git", "rev-parse", "HEAD:" + p)]
    bad += ["残留:" + p for p in dels if p in now]
    if bad:
        print("核验失败 %d 项" % len(bad))
        for b in bad[:10]:
            print("   ", b)
        return 1
    print("核验通过：%d 个文件一致，%d 个删除生效" % (len(adds), len(dels)))
    print("远端地址: https://github.com/%s/commit/%s" % (REPO, commit["sha"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
