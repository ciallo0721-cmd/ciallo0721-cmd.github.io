# -*- coding: utf-8 -*-
"""
免费 HTML 托管生成器
- 上面粘贴 HTML
- 下面实时显示 8 位内容哈希（sha256 前 8 位，内容不变哈希不变）
- 点「创建」→ 在仓库根目录 s/<哈希>/index.html 写入文件
- push 到 GitHub Pages 后访问: https://ciallo0721-cmd.top/s/<哈希>/
"""
import os
import sys
import hashlib
import subprocess
import tkinter as tk
from tkinter import messagebox, filedialog

# 仓库根目录（本文件放在 实用工具/ 下，往上一级就是仓库根）
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S_DIR = os.path.join(ROOT, "s")
SITE_BASE = "https://ciallo0721-cmd.top/s/"

APP_TITLE = "免费HTML托管生成器 - s/目录"


def content_hash(text: str) -> str:
    """8 位确定性哈希：内容不变则哈希不变，绝不随机"""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:8]


class App:
    def __init__(self, master: tk.Tk):
        self.master = master
        master.title(APP_TITLE)
        master.geometry("860x640")
        master.minsize(640, 480)

        # ---- 顶部：说明 ----
        tip = tk.Label(
            master,
            text="粘贴你的 HTML（完整页面或片段都行），push 后就是免费托管页面",
            anchor="w", fg="#555",
        )
        tip.pack(fill="x", padx=10, pady=(8, 2))

        # ---- 中部：HTML 编辑区 ----
        editor_frame = tk.LabelFrame(master, text=" HTML 内容 ")
        editor_frame.pack(fill="both", expand=True, padx=10, pady=6)

        self.text = tk.Text(editor_frame, wrap="none", undo=True,
                            font=("Consolas", 11))
        scroll_y = tk.Scrollbar(editor_frame, orient="vertical",
                                command=self.text.yview)
        scroll_x = tk.Scrollbar(editor_frame, orient="horizontal",
                                command=self.text.xview)
        self.text.configure(yscrollcommand=scroll_y.set,
                            xscrollcommand=scroll_x.set)
        scroll_x.pack(side="bottom", fill="x")
        scroll_y.pack(side="right", fill="y")
        self.text.pack(fill="both", expand=True)
        self.text.bind("<KeyRelease>", self.on_edit)

        # 预置一个最小模板
        self.text.insert("1.0",
            '<!DOCTYPE html>\n<html lang="zh">\n<head>\n'
            '<meta charset="UTF-8">\n<meta name="viewport" '
            'content="width=device-width, initial-scale=1.0">\n'
            "<title>我的页面</title>\n</head>\n<body>\n"
            "<h1>Hello!</h1>\n</body>\n</html>\n")

        # ---- 下部：哈希 + 按钮 ----
        bottom = tk.Frame(master)
        bottom.pack(fill="x", padx=10, pady=8)

        self.hash_var = tk.StringVar(value="哈希: ——")
        hash_label = tk.Label(bottom, textvariable=self.hash_var,
                              font=("Consolas", 14, "bold"), fg="#0a6")
        hash_label.pack(side="left")

        self.create_btn = tk.Button(bottom, text="创建", width=14,
                                    font=("微软雅黑", 11, "bold"),
                                    command=self.create_page)
        self.create_btn.pack(side="right")

        self.open_btn = tk.Button(bottom, text="打开 s/ 目录", width=12,
                                  command=self.open_s_dir)
        self.open_btn.pack(side="right", padx=(0, 8))

        self.url_var = tk.StringVar(value="")
        url_label = tk.Label(master, textvariable=self.url_var,
                             fg="#369", anchor="w")
        url_label.pack(fill="x", padx=10, pady=(0, 6))

        self.on_edit()  # 初始化哈希显示

    # ---- 逻辑 ----
    def on_edit(self, event=None):
        content = self.text.get("1.0", "end-1c")
        if not content.strip():
            self.hash_var.set("哈希: ——（内容为空）")
            self.url_var.set("")
            return
        h = content_hash(content)
        self.hash_var.set(f"哈希: {h}")
        self.url_var.set(f"上线地址: {SITE_BASE}{h}/")

    def create_page(self):
        content = self.text.get("1.0", "end-1c")
        if not content.strip():
            messagebox.showwarning(APP_TITLE, "HTML 内容是空的，先粘贴点东西喵")
            return
        h = content_hash(content)
        target_dir = os.path.join(S_DIR, h)
        target_file = os.path.join(target_dir, "index.html")

        if os.path.exists(target_file):
            messagebox.showinfo(APP_TITLE,
                f"这个内容已经创建过啦：\n{target_file}\n\n内容没变，无需重复创建喵~")
            return

        os.makedirs(target_dir, exist_ok=True)
        with open(target_file, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)

        messagebox.showinfo(APP_TITLE,
            f"创建成功！\n\n文件: {target_file}\n\n"
            f"git push 之后访问:\n{SITE_BASE}{h}/")
        self.open_s_dir()

    def open_s_dir(self):
        os.makedirs(S_DIR, exist_ok=True)
        if sys.platform == "win32":
            subprocess.Popen(["explorer", S_DIR])
        else:
            subprocess.Popen(["xdg-open", S_DIR])


def main():
    os.makedirs(S_DIR, exist_ok=True)  # 确保 s/ 文件夹存在
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
