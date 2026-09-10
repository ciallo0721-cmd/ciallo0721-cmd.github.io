# -*- coding: utf-8 -*-
"""
套模板生成说明页 —— 用 blog/muban 模板产出「说明类」页面（隐私政策 / 用户协议 / 关于 / 帮助…）

为什么这么做：模板自带全站统一样式、导航、目录、分享、返回顶部、图片放大等机制，
手写一份新的既费事又容易和博客文章长得不一样。套模板只需换正文。

用法（在项目根目录运行）：
    python 实用工具/套模板生成说明页.py

要生成新页面时，改这三处即可：
    1) DST        输出路径
    2) 第 4 步     文章头（小标签 / 标题 / 导语 / 标签）
    3) 第 5、6 步   目录（TOC）与正文 BODY（正文里 h2 的 id 要和 TOC 的锚点对上）

脚本会做的事：
    - 复用模板的全部样式与脚本；相对路径 ../../ 一律转为站根绝对路径 /
    - GA4 由「一进页面就加载」改为「同意后才加载」（模板里硬编码且重复了两份 gtag 块）
    - 裁掉正文里不存在的重型组件（PDF 阅读器 JS + PDF.js），避免空引用报错
    - 修复模板自带缺陷：灰度预览按钮的空引用会中断同块后续脚本，已加保护
    - 结尾打印每项替换的匹配情况，有未匹配项会以非 0 退出码结束

⚠️ 已知与模板的差异：本脚本输出的页面不含 PDF 阅读器与图表组件的 DOM。
   若新正文里需要这些组件，请注释掉脚本中「3.5 裁掉正文里不存在的重型组件」那两步。
"""
import re
import sys

SRC = 'blog/muban/index.html'
DST = 'doc/privacy.html'

s = open(SRC, encoding='utf-8').read()
before_len = len(s)
report = []


def rep(old, new, cnt=1, label=''):
    global s
    if old not in s:
        report.append('!! 未匹配: ' + (label or old[:50]))
        return False
    s = s.replace(old, new, cnt)
    report.append('OK  ' + (label or old[:40]))
    return True


# ─────────── 1. head 元信息 ───────────
rep('<link rel="canonical" href="https://ciallo0721-cmd.top/blog/muban/">',
    '<link rel="canonical" href="https://ciallo0721-cmd.top/doc/privacy.html">', 1, 'canonical')

rep('<title>样板文章·全机制展示 - ciallo0721-cmd</title>',
    '<title>隐私政策 - ciallo0721-cmd</title>', 1, 'title')

rep('<meta name="description" content="这篇文章展示了 ciallo0721-cmd 个人网站文章系统中所有支持的内容机制：表格、超链接、按钮、图表、代码块、引用、音视频播放器等">',
    '<meta name="description" content="ciallo0721-cmd 个人网站的隐私政策：说明本站收集哪些数据、如何使用 Cookie 与本地存储、涉及哪些第三方服务，以及你如何拒绝或清除这些数据。">',
    1, 'description')

# ─────────── 2. GA4 改造：删掉重复块 + 改同意模式 ───────────
rep("""<script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-TR4FT7JPDZ');
    </script>""", '', 1, '删除 head 早期重复 gtag 块')

rep("""<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TR4FT7JPDZ"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-TR4FT7JPDZ');
</script>""",
    """<!-- Google tag (gtag.js) · 同意后才加载：这里只定义 gtag 队列 -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  gtag('js', new Date());
</script>
<!-- GA4 同意提示条（同意才注入 gtag.js；拒绝则完全不请求 Google） -->
<script src="/js/js/consent-analytics.js"></script>""",
    1, 'GA4 改为同意后加载')

# ─────────── 3. 相对路径 → 根绝对（privacy.html 在站点根目录）───────────
cnt_rel = s.count('../../')
s = s.replace('../../', '/')
report.append('OK  相对路径 ../../ → / 共 %d 处' % cnt_rel)

# ─────────── 3.5 裁掉正文里不存在的重型组件 ───────────
# PDF 阅读器 JS 里的 el('pdfUrlLoadBtn') 没有空值保护，
# 而隐私政策正文不含 PDF 组件，会抛 TypeError 中断脚本 → 整段移除。
pdf_js_start = s.index('<!-- ─── PDF 阅读器 JS ─── -->')
pdf_js_end = s.index('</script>', pdf_js_start) + len('</script>')
s = s[:pdf_js_start] + '<!-- PDF 阅读器 JS 已移除：本页正文不含 PDF 组件 -->' + s[pdf_js_end:]
report.append('OK  已移除 PDF 阅读器 JS 段')

# 同时不再引入 PDF.js（少一个 cdnjs 请求，本页也不需要用）
rep('    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>\n',
    '', 1, '移除 PDF.js CDN 引用')

# ─────────── 4. 文章头 ───────────
h_start = s.index('<header class="article-header">')
h_end = s.index('</header>', h_start) + len('</header>')
new_header = '''<header class="article-header">
                <div class="article-number">站点文档 · 合规说明</div>
                <h1 class="article-title">🔒 隐私政策</h1>
                <p class="article-intro">
                    这份文档说明本站收集什么、不收集什么，以及在第三方统计服务面前你有哪些选择权。写得比较细，是想让你能自己核对，而不是只能选择相信喵～
                </p>
                <div class="article-meta">
                    <div class="article-date"><i class="far fa-calendar"></i> 最后更新：<span>2026-09-10</span></div>
                    <div class="article-date"><i class="far fa-clock"></i> 阅读时间：<span>约7分钟</span></div>
                </div>
                <div class="article-tags">
                    <span class="article-tag">隐私政策</span>
                    <span class="article-tag">Cookie</span>
                    <span class="article-tag">数据说明</span>
                    <span class="article-tag">GA4</span>
                </div>
            </header>'''
s = s[:h_start] + new_header + s[h_end:]
report.append('OK  文章头已替换')

# ─────────── 5. 目录 ───────────
t_start = s.index('<nav class="toc-box"')
t_end = s.index('</nav>', t_start) + len('</nav>')
new_toc = '''<nav class="toc-box" aria-label="隐私政策目录">
                <h4><i class="fas fa-list-ul"></i> &nbsp;目录</h4>
                <ol>
                    <li><a href="#sec-scope">一、适用范围与承诺</a></li>
                    <li><a href="#sec-collect">二、本站收集哪些信息</a></li>
                    <li><a href="#sec-storage">三、Cookie 与本地存储清单</a></li>
                    <li><a href="#sec-third">四、第三方服务清单</a></li>
                    <li><a href="#sec-purpose">五、这些信息用来做什么</a></li>
                    <li><a href="#sec-never">六、本站不会做的事</a></li>
                    <li><a href="#sec-rights">七、你的选择与控制权</a></li>
                    <li><a href="#sec-security">八、数据安全</a></li>
                    <li><a href="#sec-minor">九、未成年人保护</a></li>
                    <li><a href="#sec-change">十、政策变更</a></li>
                    <li><a href="#sec-contact">十一、联系方式</a></li>
                </ol>
            </nav>'''
s = s[:t_start] + new_toc + s[t_end:]
report.append('OK  目录已替换')

# ─────────── 6. 正文 ───────────
c_open = '<div class="article-content">'
c_start = s.index(c_open) + len(c_open)
c_end = s.index('</div><!-- /article-content -->', c_start)

BODY = '''

                <h2 id="sec-scope">一、适用范围与承诺</h2>
                <p>本政策适用于 <code>ciallo0721-cmd.top</code> 及其子域名（如 <code>status.ciallo0721-cmd.top</code>）下的所有页面，包括博客文章、在线工具、Wiki、NAS 与状态页。</p>
                <p>本站是个人非商业站点，由站长一人维护。我们遵循四条原则：</p>
                <ul>
                    <li><span class="hl">最小必要</span>——只收集实现「访问统计」与「问题排查」所必需的最少信息；</li>
                    <li><span class="hl">不涉身份</span>——不要求注册，不收集姓名、手机号、身份证件等身份信息；</li>
                    <li><span class="hl-blue">不可逆优先</span>——IP 等敏感信息一律经加盐哈希处理后使用；</li>
                    <li><span class="hl-blue">知情可控</span>——凡涉及第三方追踪的服务，均在下方明确列出，并提供拒绝方式。</li>
                </ul>

                <div class="callout callout-pink">
                    <span class="callout-icon">🎀</span>
                    <div class="callout-body">
                        <p class="callout-title">一句话版本</p>
                        <p class="callout-text">本站不卖东西、不投放广告、不收集你的姓名与联系方式，也不会把数据卖给任何人。记录的只是「有多少人来过、从哪里来」这类统计信息，以及一个随机生成的访客编号——用于你反馈 Bug 时定位那台机器的运行环境。</p>
                    </div>
                </div>

                <hr>

                <h2 id="sec-collect">二、本站收集哪些信息</h2>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>类别</th>
                                <th>具体内容</th>
                                <th>存放位置</th>
                                <th>能否识别到个人</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>访客编号 userid</td>
                                <td>随机生成的编号，如 <code>cialloblog-10-1a85-2026</code></td>
                                <td>浏览器 localStorage + Cookie</td>
                                <td>不含任何身份信息，无法对应到真实的人</td>
                            </tr>
                            <tr>
                                <td>设备环境</td>
                                <td>操作系统类型与版本（从浏览器 User-Agent 推导）</td>
                                <td>仅用于生成编号段与水印</td>
                                <td>否（宏观环境信息）</td>
                            </tr>
                            <tr>
                                <td>IP 哈希</td>
                                <td>公网 IP 经 SHA-256 加盐后取前 12 位十六进制</td>
                                <td>仅出现在隐形水印中</td>
                                <td>否（不可逆，无法还原为 IP）</td>
                            </tr>
                            <tr>
                                <td>访问统计</td>
                                <td>页面路径、来源域名、停留与点击等聚合指标</td>
                                <td>第三方统计服务（见第四节）</td>
                                <td>Google Analytics 在同意后可能关联到浏览器级标识</td>
                            </tr>
                            <tr>
                                <td>本地偏好</td>
                                <td>如「是否同意分析」「是否已关闭英文提示」</td>
                                <td>浏览器 localStorage</td>
                                <td>否（仅存你的选择，不上传）</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="callout callout-info">
                    <span class="callout-icon">ℹ️</span>
                    <div class="callout-body">
                        <p class="callout-title">关于公网 IP</p>
                        <p class="callout-text">本站通过第三方接口 <code>api.ip.sb</code> 查询你的公网 IP，<strong>仅用于生成上述不可逆哈希</strong>。查询在浏览器侧发起，IP 本身不会被本站存储、不会公开、不会出售。该接口不可用时会自动降级为内网 IP 哈希或占位符 <code>ip-xxxxxxxxxxxx</code>，不影响正常浏览。</p>
                    </div>
                </div>

                <h3>关于隐形水印</h3>
                <p>页面会叠加一层肉眼几乎不可见的透明水印（不透明度约 3.5%），内容为你的 userid、系统编码与 IP 哈希。它不遮挡内容、不收集额外数据，用途有二：</p>
                <ul>
                    <li>你截图反馈 Bug 时，站长可凭水印定位到对应的访客环境，更快复现问题；</li>
                    <li>原创内容被截图搬运时，用于确认来源。</li>
                </ul>
                <p>水印随页面渲染产生，关闭页面即消失，不会在你的设备上留下文件，也不会展示给其他访客。</p>

                <hr>

                <h2 id="sec-storage">三、Cookie 与本地存储清单</h2>
                <p>本站使用的 Cookie 与浏览器存储条目如下，你可以打开浏览器「开发者工具 → Application → Storage」自行核对或删除：</p>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>名称</th>
                                <th>类型</th>
                                <th>用途</th>
                                <th>有效期</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><code>cb_userid</code></td>
                                <td>localStorage + Cookie</td>
                                <td>访客编号，双写兜底以防其一被清理</td>
                                <td>Cookie 10 年 / 直到你清除</td>
                            </tr>
                            <tr>
                                <td><code>site_user_from</code></td>
                                <td>localStorage</td>
                                <td>记住你首次从哪个站点来到这里，用于统计来源渠道</td>
                                <td>直到你清除</td>
                            </tr>
                            <tr>
                                <td><code>cb_ga_consent</code></td>
                                <td>localStorage</td>
                                <td>你对 Google Analytics 的选择（同意 / 拒绝）</td>
                                <td>180 天</td>
                            </tr>
                            <tr>
                                <td><code>cb_en_hint</code></td>
                                <td>localStorage</td>
                                <td>是否已处理「切换英文界面」的提示</td>
                                <td>拒绝后静默 30 天</td>
                            </tr>
                            <tr>
                                <td><code>turnstile_pass</code> / <code>auth_passed</code></td>
                                <td>localStorage / sessionStorage</td>
                                <td>记录机器人校验已通过，避免重复验证</td>
                                <td>24 小时 / 当前会话</td>
                            </tr>
                            <tr>
                                <td><code>_ga</code>、<code>_ga_G-TR4FT7JPDZ</code></td>
                                <td>Cookie（第三方）</td>
                                <td>Google Analytics 用于区分访客的标识</td>
                                <td>约 2 年（<strong>仅在同意后才写入</strong>）</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="callout callout-success">
                    <span class="callout-icon">✅</span>
                    <div class="callout-body">
                        <p class="callout-title">关于 GA4：先询问，后加载</p>
                        <p class="callout-text">在你点击「同意」之前，<code>gtag.js</code> 脚本不会被加载，<strong>不会有任何请求发往 Google</strong>，也不会写入 <code>_ga</code> 系列 Cookie。点击「不用了」后，本站将在 180 天内不再询问，GA4 始终不会加载。</p>
                    </div>
                </div>

                <hr>

                <h2 id="sec-third">四、第三方服务清单</h2>
                <p>页面运行时会向以下第三方发起请求，请知悉它们各自会接触到什么：</p>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>服务</th>
                                <th>提供方</th>
                                <th>用途</th>
                                <th>是否可拒绝</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Google Analytics 4</td>
                                <td>Google LLC</td>
                                <td>访问统计（页面浏览、来源渠道、事件）</td>
                                <td><strong>可拒绝</strong>，同意后才加载</td>
                            </tr>
                            <tr>
                                <td>Umami</td>
                                <td>Umami Cloud</td>
                                <td>匿名访问计数（不写 Cookie、不做跨站追踪）</td>
                                <td>可用脚本拦截扩展阻止</td>
                            </tr>
                            <!-- Google Fonts 一行已按需求移除 -->
                            <tr>
                                <td>Giscus</td>
                                <td>开源项目（基于 GitHub Discussions）</td>
                                <td>留言与评论功能，需使用 GitHub 账号登录后发言</td>
                                <td>不滚动到留言区则不会加载</td>
                            </tr>
                            <tr>
                                <td>Cloudflare Turnstile</td>
                                <td>Cloudflare, Inc.</td>
                                <td>机器人检测。仅疑似自动化程序会被要求验证，真人直接放行</td>
                                <td>脚本请求无法单独关闭</td>
                            </tr>
                            <tr>
                                <td>cdnjs</td>
                                <td>Cloudflare, Inc.</td>
                                <td>托管部分页面使用的前端开源库</td>
                                <td>否</td>
                            </tr>
                            <tr>
                                <td>api.ip.sb</td>
                                <td>第三方 IP 查询接口</td>
                                <td>查询公网 IP 以生成不可逆哈希，见第二节</td>
                                <td>否</td>
                            </tr>
                            <tr>
                                <td>YouTube（连通性探测）</td>
                                <td>Google LLC</td>
                                <td>仅探测网络能否访问 YouTube，用于判断访客是否位于中国大陆境外，从而决定是否提示英文界面。<strong>不发送任何访客数据，不加载视频，不记录结果到服务器</strong></td>
                                <td>可用脚本拦截扩展阻止（仅影响该提示）</td>
                            </tr>
                            <tr>
                                <td>v1.hitokoto.cn（一言）</td>
                                <td>第三方开放接口</td>
                                <td>当前<strong>未启用</strong>。首页「每日一句」使用本站内置的本地语录白名单，不发起网络请求</td>
                                <td>—</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="callout callout-warning">
                    <span class="callout-icon">⚠️</span>
                    <div class="callout-body">
                        <p class="callout-title">第三方日志超出本站控制</p>
                        <p class="callout-text">第三方服务的数据处理行为受各自隐私政策约束。本站无法控制第三方如何存储请求日志（例如 Google、Cloudflare 出于安全与运维目的记录的访问日志），这部分超出本站能力范围。</p>
                    </div>
                </div>

                <hr>

                <h2 id="sec-purpose">五、这些信息用来做什么</h2>
                <ul>
                    <li><strong>了解内容效果</strong>——哪些文章受欢迎、访客从哪里来，用于决定接下来写什么；</li>
                    <li><strong>排查问题</strong>——你反馈 Bug 时，通过 userid 与水印快速定位浏览器环境；</li>
                    <li><strong>防滥用</strong>——识别恶意爬取、刷量与自动化攻击，保护站点可用性；</li>
                    <li><strong>内容溯源</strong>——原创文章被搬运时，确认截图来源。</li>
                </ul>
                <p>以上用途均不涉及向第三方出售或共享你的个人数据。</p>

                <hr>

                <h2 id="sec-never">六、本站不会做的事</h2>
                <ul>
                    <li>不会出售、出租或以任何形式交易你的数据；</li>
                    <li>不会将数据用于广告投放、用户画像或定向营销；</li>
                    <li>不会收集你的姓名、手机号、身份证号、精确地理位置；</li>
                    <li>不会读取你的浏览历史、书签、剪贴板或其他网站的数据；</li>
                    <li>不会使用指纹识别（canvas / 音频指纹等）暗中追踪你；</li>
                    <li>不会把水印中的信息用于人肉搜索，也不支持任何形式的网络暴力。</li>
                </ul>

                <hr>

                <h2 id="sec-rights">七、你的选择与控制权</h2>

                <h3>1. 拒绝 Google Analytics</h3>
                <p>访问首页时底部会弹出询问条，点击「不用了」，GA4 将永不加载，且 180 天内不再询问。你也可以在浏览器扩展层面直接拦截 <code>googletagmanager.com</code>。</p>

                <h3>2. 改变主意（撤销或重新授权）</h3>
                <p>清除站点数据后，下次访问会重新询问。若只想重置这一项，可在浏览器控制台执行：</p>
                <pre><code>localStorage.removeItem('cb_ga_consent');
location.reload();</code></pre>

                <h3>3. 清除全部本地数据</h3>
                <p>清除浏览器中本网站的「Cookie 与网站数据」即可删除 userid 与所有偏好记录。之后再次访问，你会获得一个全新的访客编号。</p>

                <h3>4. 使用无痕模式</h3>
                <p>无痕 / 隐私模式下每次会话都会生成临时编号，关闭窗口即丢弃。</p>

                <h3>5. 拒绝匿名统计</h3>
                <p>Umami 为无 Cookie 的匿名统计，本站默认启用。若你不希望产生任何统计请求，可使用 uBlock Origin 等扩展拦截 <code>cloud.umami.is</code>，不影响站点任何功能。</p>

                <hr>

                <h2 id="sec-security">八、数据安全</h2>
                <ul>
                    <li>本站为纯静态站点，<strong>没有服务器数据库</strong>，不存在集中存放访客资料的数据库；</li>
                    <li>所有本地数据存放在你自己的浏览器中，只有你能直接读取；</li>
                    <li>IP 一律加盐哈希后使用，哈希过程不可逆，无法还原为原始地址；</li>
                    <li>统计数据以聚合形式查看，站长日常关注的是「某篇文章有多少阅读」而非「某个具体的人」；</li>
                    <li>全站通过 HTTPS 传输，防止内容在传输过程中被篡改。</li>
                </ul>

                <hr>

                <h2 id="sec-minor">九、未成年人保护</h2>
                <p>本站内容面向一般公众，没有针对儿童设计的功能，也不会主动收集未成年人的个人信息。如果你是未成年人，建议在监护人知情的前提下浏览本站；如监护人认为站内某处内容或数据处理方式不妥，欢迎通过第十一节的方式联系站长，我们会优先处理。</p>

                <hr>

                <h2 id="sec-change">十、政策变更</h2>
                <p>本政策可能随站点功能调整而更新（例如新增统计服务、调整 Cookie 用途）。更新时我们会同步修改页面顶部的「最后更新」日期；涉及数据用途的重要变更，会在首页以公告形式提示。继续使用本站即视为接受更新后的政策。</p>

                <hr>

                <h2 id="sec-contact">十一、联系方式</h2>
                <p>如对本政策有任何疑问、异议，或希望行使上述任何一项权利，欢迎联系站长：</p>
                <ul>
                    <li>QQ：3627742771</li>
                    <li>邮箱：ciallo0721cmd@gmail.com / 3627742771@qq.com</li>
                </ul>
                <p>一般在 3 个工作日内回复。未成年人相关请求会优先处理。</p>

                <blockquote>
                    <p>把该说的说清楚，让每个人都能自己判断要不要留下痕迹——这比一句「我们重视您的隐私」有用得多。</p>
                    <cite>— ciallo0721-cmd</cite>
                </blockquote>

            '''

s = s[:c_start] + BODY + s[c_end:]
report.append('OK  正文已替换（%d 字符）' % len(BODY))

# ─────────── 6.5 修复灰度预览按钮的空引用（模板缺陷）───────────
# 模板里这两行在 script 顶层执行且没有空值保护，本页正文不含这些按钮，
# 若不处理会抛 TypeError 并中断同一 <script> 块后续的图片放大/分享/返回顶部逻辑。
old_gray = """    // ── 灰度预览按钮 ──
    var isGrayscale = false;
    document.getElementById('previewGrayscale').addEventListener('click', function() {
        document.documentElement.style.filter = 'grayscale(1)';
        isGrayscale = true;
        this.style.display = 'none';
        document.getElementById('removeGrayscale').style.display = '';
    });
    document.getElementById('removeGrayscale').addEventListener('click', function() {
        document.documentElement.style.filter = '';
        isGrayscale = false;
        this.style.display = 'none';
        document.getElementById('previewGrayscale').style.display = '';
    });"""

new_gray = """    // ── 灰度预览按钮（本页无此组件，加空值保护以免中断后续脚本）──
    var isGrayscale = false;
    var grayPv = document.getElementById('previewGrayscale');
    var grayRm = document.getElementById('removeGrayscale');
    if (grayPv) grayPv.addEventListener('click', function() {
        document.documentElement.style.filter = 'grayscale(1)';
        isGrayscale = true;
        this.style.display = 'none';
        if (grayRm) grayRm.style.display = '';
    });
    if (grayRm) grayRm.addEventListener('click', function() {
        document.documentElement.style.filter = '';
        isGrayscale = false;
        this.style.display = 'none';
        if (grayPv) grayPv.style.display = '';
    });"""

rep(old_gray, new_gray, 1, '修复灰度按钮空引用')

# ─────────── 6.6 移除说明类页面不需要的模板组件（2026-09-10 用户要求）───────────

# 导航栏：说明页不需要「开发者ciallo0721-cmd的空间 / 返回首页」
rep('''<!-- 导航栏 -->
    <nav>
        <div class="container nav-container">
            <a href="/index.html" class="logo">
                <i class="fas fa-gamepad"></i> 开发者ciallo0721-cmd的空间
            </a>
            <a href="/index.html" class="back-btn">
                <i class="fas fa-arrow-left"></i> 返回首页
            </a>
        </div>
    </nav>''', '<!-- 导航栏：说明类页面不显示，已移除 -->', 1, '移除导航栏')

# 分享按钮：模板 JS 用的是 ['shareButton','shareButton2'].forEach + if (el) 判断，
# 元素不存在会自动跳过，因此直接删 DOM 不会报错
rep('''            <!-- ── 分享按钮 ── -->
            <div style="text-align:center;margin-top:20px;">
                <button class="share-btn" id="shareButton2">
                    <i class="fas fa-share-alt"></i> 分享这篇文章
                </button>
            </div>''', '            <!-- 分享按钮已按需求移除 -->', 1, '移除分享按钮')

# 分享弹窗：按钮删掉后弹窗已成为死代码（标题里也有「分享这篇文章」），一并移除
rep('''    <!-- 分享弹窗 -->
    <div class="share-modal" id="shareModal">
        <div class="share-modal-content">
            <div class="share-modal-header">
                <h3 class="share-modal-title"><i class="fas fa-share-alt"></i> 分享这篇文章</h3>
                <button class="share-close-btn" id="closeShareModal"><i class="fas fa-times"></i></button>
            </div>
            <div class="share-text" id="shareText">快来看看这篇文章: https://ciallo0721-cmd.top/blog/muban/</div>
            <div class="share-actions">
                <button class="share-copy-btn" id="copyShareText"><i class="far fa-copy"></i> 复制分享链接</button>
                <button class="share-close-modal-btn" id="closeShareModalBtn">关闭</button>
            </div>
        </div>
    </div>''', '    <!-- 分享弹窗已随分享功能一并移除 -->', 1, '移除分享弹窗')

# 分享 JS：弹窗与按钮移除后，下面几处 addEventListener 会拿到 null，
# 模板里没有空值保护 → 必须补上，否则会中断整个 DOMContentLoaded 回调（返回顶部等全失效）
rep('''        function openShare() { shareModal.classList.add('active'); }
        function closeShare() {
            shareModal.classList.remove('active');
            copyBtn.innerHTML = '<i class="far fa-copy"></i> 复制分享链接';
            copyBtn.classList.remove('copied');
        }''',
    '''        function openShare() { if (shareModal) shareModal.classList.add('active'); }
        function closeShare() {
            if (!shareModal) return;
            shareModal.classList.remove('active');
            if (copyBtn) { copyBtn.innerHTML = '<i class="far fa-copy"></i> 复制分享链接'; copyBtn.classList.remove('copied'); }
        }''', 1, '分享函数加空值保护')

rep('''        document.getElementById('closeShareModal').addEventListener('click', closeShare);
        document.getElementById('closeShareModalBtn').addEventListener('click', closeShare);
        shareModal.addEventListener('click', function(e) { if (e.target === shareModal) closeShare(); });
        copyBtn.addEventListener('click', function() {''',
    '''        var _closeShareModal = document.getElementById('closeShareModal');
        var _closeShareModalBtn = document.getElementById('closeShareModalBtn');
        if (_closeShareModal) _closeShareModal.addEventListener('click', closeShare);
        if (_closeShareModalBtn) _closeShareModalBtn.addEventListener('click', closeShare);
        if (shareModal) shareModal.addEventListener('click', function(e) { if (e.target === shareModal) closeShare(); });
        if (copyBtn) copyBtn.addEventListener('click', function() {''',
    1, '分享监听加空值保护')

# 页脚 logo 文字与导航栏重复，一并移除（页脚的「返回首页」链接保留，作为页面出口）
rep('            <div class="footer-logo">开发者ciallo0721-cmd的空间</div>',
    '            <!-- 页脚 logo 文字已按需求移除 -->', 1, '移除页脚 logo 文字')

# ─────────── 7. 页脚与分享文案 ───────────
rep('<p>© 2026 ciallo0721-cmd · 全机制样板文章</p>',
    '<p>© 2026 ciallo0721-cmd · 隐私政策</p>', 1, '页脚版权行')
rep('<p>感谢阅读！这篇文章展示了网站所有内容机制喵～</p>',
    '<p>有疑问欢迎随时联系站长喵～ · <a href="/index.html" style="color:var(--bili-pink);">返回首页</a></p>',
    1, '页脚说明行')
# 分享弹窗的分享文案已随弹窗一并移除，此处不再需要替换

open(DST, 'w', encoding='utf-8').write(s)

print('\n'.join(report))
print('-' * 46)
print('模板 %d 字符 → 输出 %d 字符' % (before_len, len(s)))
miss = [r for r in report if r.startswith('!!')]
print('未匹配项：%d %s' % (len(miss), miss if miss else ''))
sys.exit(1 if miss else 0)
