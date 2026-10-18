#!/usr/bin/env python3
"""生成完整的 sitemap.xml

重要：
- 文章 lastmod 优先使用 articles-data.js 中的 date 字段（文章发布时间）
- 如果文章对应的 index.html 文件修改时间晚于 date 字段，取较新的那个
- 可在 articles-data.js 中为文章添加 sitemapLastmod 字段手动覆盖
"""
import re, os, datetime
from urllib.parse import quote

blog_root = r"G:\EmoScan Pro\ciallo0721-cmd.github.io"
domain = "https://ciallo0721-cmd.top"
today = datetime.date.today().isoformat()

# 读取文章数据
with open(os.path.join(blog_root, 'articles-data.js'), 'r', encoding='utf-8') as f:
    content = f.read()

articles = []
lines = content.split('\n')
in_articles = False
brace_depth = 0
current_block = ''
for line in lines:
    stripped = line.strip()
    if 'articles:' in stripped or 'articles: [' in stripped:
        in_articles = True
        continue
    if not in_articles:
        continue
    if stripped.startswith('];'):
        break
    for ch in line:
        if ch == '{':
            brace_depth += 1
            if brace_depth == 1:
                current_block = ''
        elif ch == '}':
            brace_depth -= 1
            if brace_depth == 0:
                block = current_block + '}'
                a = {}
                id_m = re.search(r'id:\s*(\d+)', block)
                if id_m: a['id'] = id_m.group(1)
                title_m = re.search(r'title:\s*"([^"]*)"', block)
                if title_m: a['title'] = title_m.group(1)
                fileName_m = re.search(r'fileName:\s*"([^"]*)"', block)
                if fileName_m: a['fileName'] = fileName_m.group(1)
                date_m = re.search(r'date:\s*"([^"]*)"', block)
                if date_m: a['date'] = date_m.group(1)
                sitemap_lastmod_m = re.search(r'sitemapLastmod:\s*"([^"]*)"', block)
                if sitemap_lastmod_m: a['sitemapLastmod'] = sitemap_lastmod_m.group(1)
                if a.get('id'):
                    articles.append(a)
                current_block = ''
        if brace_depth >= 1:
            current_block += ch

# 按日期排序
articles.sort(key=lambda x: x.get('date', ''), reverse=True)

def encode_url_path(path):
    """URL 编码路径中的非 ASCII 字符"""
    encoded = quote(path, safe='/:@!$\'()*+,;=-._~')
    encoded = encoded.replace('&', '&amp;')
    if not encoded.endswith('/') and '.' not in encoded:
        encoded += '/'
    return encoded

def get_file_lastmod(rel_path):
    """获取文件实际修改时间"""
    full = os.path.join(blog_root, rel_path.lstrip('/'))
    try:
        mtime = os.path.getmtime(full)
        return datetime.date.fromtimestamp(mtime).isoformat()
    except OSError:
        return None

def pick_lastmod(article):
    """确定文章的 lastmod：
       1) sitemapLastmod 手动覆盖
       2) 否则取 max(文章date, 文件mtime)
    """
    if article.get('sitemapLastmod'):
        return article['sitemapLastmod']
    
    article_date = article.get('date', '2026-06-01')
    fileName = article.get('fileName', str(article['id']))
    file_path = f'/blog/{fileName}index.html'
    file_mtime = get_file_lastmod(file_path)
    
    if file_mtime and file_mtime > article_date:
        return file_mtime
    return article_date

# ===== 生成 sitemap =====
urls = []

# 首页（规范写法：/ 而不是 /index.html）
urls.append((encode_url_path('/'), get_file_lastmod('/index.html') or today, 'weekly', '1.0'))

# 文章列表页（主入口）
urls.append((encode_url_path('/wz/'), get_file_lastmod('/wz/index.html') or today, 'daily', '0.9'))

# 博客分类首页
urls.append((encode_url_path('/blog/'), get_file_lastmod('/blog/index.html') or today, 'daily', '0.8'))

# 其他静态页面
static_pages = [
    ('/aboutme.html', 'yearly', '0.7'),
    ('/adss.html', 'yearly', '0.6'),
    ('/friends.html', 'monthly', '0.7'),
    ('/privacy.html', 'yearly', '0.5'),
    ('/help.html', 'yearly', '0.5'),
    ('/status.html', 'monthly', '0.6'),
]
for path, freq, pri in static_pages:
    if not os.path.exists(os.path.join(blog_root, path.lstrip('/'))):
        continue  # 页面已删除，不写入 sitemap（防死链）
    ld = get_file_lastmod(path) or today
    urls.append((encode_url_path(path), ld, freq, pri))

# 游戏页面（已废弃下架的项目若目录被删，自动跳过）
games = [
    ('/bjqy/index.html', '0.6'),
    ('/fors/index.html', '0.6'),
    ('/LAIDB/index.html', '0.6'),
    ('/zmdspp/indexzm.html', '0.6'),
    ('/91/index.html', '0.6'),
    ('/dkdfj/index.html', '0.6'),
    ('/work/index.html', '0.6'),
]
for path, pri in games:
    if not os.path.exists(os.path.join(blog_root, path.lstrip('/'))):
        continue  # 游戏已下架，不写入 sitemap
    ld = get_file_lastmod(path) or '2026-06-01'
    urls.append((encode_url_path(path), ld, 'monthly', pri))

# 百科页面（wiki 站点存在才收录）
if os.path.exists(os.path.join(blog_root, 'wiki', 'index.html')):
    wiki_ld = get_file_lastmod('/wiki/index.html') or '2026-06-13'
    urls.append((encode_url_path('/wiki/index.html'), wiki_ld, 'weekly', '0.8'))

    # 百科词条子页面
    wiki_terms = [
        'dashichang', 'mediapipe', 'openutau', 'paddleocr',
        'python', 'renpy', 'tongshiting', 'unity', 'utau', 'vocaloid'
    ]
    for term in wiki_terms:
        if not os.path.exists(os.path.join(blog_root, 'wiki', term, 'index.html')):
            continue
        path = f'/wiki/{term}/index.html'
        ld = get_file_lastmod(path) or wiki_ld
        urls.append((encode_url_path(path), ld, 'monthly', '0.5'))

# 特色站点
feature_sites = [
    ('/baicai/index.html', 'monthly', '0.7'),   # 真白花音纪念站
    ('/cn/index.html', 'monthly', '0.7'),         # 历代诗人百科
    ('/arg/index.html', 'monthly', '0.6'),         # ARG游戏
    ('/WeiShan/index.html', 'weekly', '0.8'),      # 伪善Club 超自然行动组陪玩服务
]
for path, freq, pri in feature_sites:
    if not os.path.exists(os.path.join(blog_root, path.lstrip('/'))):
        continue  # 已下线，不写入 sitemap
    ld = get_file_lastmod(path) or today
    urls.append((encode_url_path(path), ld, freq, pri))

# 工具/应用页面
app_pages = [
    ('/app/moeface/index.html', '0.6'),
    ('/app/tools/index.html', '0.7'),
    ('/app/tools/anime-color-analyzer/index.html', '0.5'),
    ('/app/tools/renpy-template-generator/index.html', '0.5'),
    ('/app/tools/vtuber-name-generator/index.html', '0.5'),
    ('/app/tools/vtuber-personality-test/index.html', '0.5'),
    ('/cs2/index.html', '0.5'),
]
for path, pri in app_pages:
    if not os.path.exists(os.path.join(blog_root, path.lstrip('/'))):
        continue  # 已删除，不写入 sitemap
    ld = get_file_lastmod(path) or today
    urls.append((encode_url_path(path), ld, 'monthly', pri))

# 博客分类页 blog/<分类>/index.html（自动扫描，新增分类无需手改）
_blog_dir = os.path.join(blog_root, 'blog')
_SKIP_CAT = {'muban', 'emergency'}
if os.path.isdir(_blog_dir):
    for _name in sorted(os.listdir(_blog_dir)):
        _dir = os.path.join(_blog_dir, _name)
        _idx = os.path.join(_dir, 'index.html')
        if not os.path.isdir(_dir) or not os.path.exists(_idx):
            continue
        if _name in _SKIP_CAT or _name.startswith('_'):
            continue
        _ld = datetime.date.fromtimestamp(os.path.getmtime(_idx)).isoformat()
        urls.append((encode_url_path(f'/blog/{_name}/'), _ld, 'weekly', '0.7'))

# 所有博客文章（目录不存在的旧数据自动跳过）
for a in articles:
    fileName = a.get('fileName', str(a['id']))
    lastmod = pick_lastmod(a)
    full_path = f'/blog/{fileName}'
    _t = full_path.lstrip('/')
    _f = _t if _t.endswith('.html') else os.path.join(_t, 'index.html')
    if not os.path.exists(os.path.join(blog_root, _f)):
        continue  # 文章文件已不存在，不写入 sitemap（防死链）
    urls.append((encode_url_path(full_path), lastmod, 'monthly', '0.6'))

# 生成 XML
xml_parts = ['<?xml version="1.0" encoding="UTF-8"?>']
xml_parts.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
xml_parts.append(f'  <!-- ========== 站点地图 (自动生成 {today}) ========== -->')

for loc, lastmod, changefreq, priority in urls:
    xml_parts.append('  <url>')
    xml_parts.append(f'    <loc>{domain}{loc}</loc>')
    xml_parts.append(f'    <lastmod>{lastmod}</lastmod>')
    xml_parts.append(f'    <changefreq>{changefreq}</changefreq>')
    xml_parts.append(f'    <priority>{priority}</priority>')
    xml_parts.append('  </url>')

xml_parts.append('</urlset>')
xml_content = '\n'.join(xml_parts)

output_path = os.path.join(blog_root, 'sitemap.xml')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(xml_content)

print(f"已生成 sitemap.xml: {len(urls)} 个 URL")
for u in urls:
    print(f"  {domain}{u[0]}  lastmod={u[1]}")
