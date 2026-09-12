window.timelineData = [
            {
                date: "2026年9月11日",
                title: "全站视觉重构：海青主题 + CSS 全外联",
                desc: "对首页、文章站（blog/）、网站状态页、404 页做了一次彻底的视觉重构：①统一为「海青 #0EA5E9 + 中性白底」的单强调色设计，大留白、细圆角、柔和阴影，桌面与移动端分别适配；②所有 CSS 全部外联——四个页面的 HTML 中不再有任何 <style> 块与内联 style 属性，只保留一个 <link>，方便直接阅读源码；③新建页面级样式表 blog-index.css，重写 index.css / status.css / 404.css；④字体由 12MB 的手写体 MaokenAssortedSans 换成系统无衬线栈，首屏更轻快；⑤顺带移除未使用的 Google Fonts 请求，并把 GA 同意条配色统一为海青。原文件均留有备份，时间线、折叠区、移动菜单、广告位、留言板等功能保持不变。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年9月11日",
                title: "新增全站搜索（Ctrl+K 呼出）+ 游戏预览扩充",
                desc: "①首页导航栏新增搜索入口，支持 Ctrl+K 快捷呼出、↑↓ 选择、Enter 打开、Esc 关闭，检索范围覆盖全站 80 篇文章（标题/摘要/标签）与 22 个站点页面，结果按「文章/页面」分组、标题命中优先、关键词高亮；②游戏预览区新增「12队大乱斗 fyGrid」（/CS/）与「HRAI 恐怖逃生」（/HRAI/）两个入口；③移除首页右下角「特效加速」浮动按钮。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年9月10日",
                title: "新增英文界面提示与 GA4 同意条，隐私政策迁至 /doc/",
                desc: "①新增海外访客英文界面提示：探测能否直连 YouTube，仅墙外显示、点击才跳转；②新增 GA4 同意条，用户可选择「同意」（加载 GA4）或「不用了」（停用 GA4，仅保留无 Cookie 的匿名访问计数）；③隐私政策等说明性页面统一迁移至 /doc/ 目录。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年9月8日",
                title: "新增 s/ 免费 HTML 托管工具",
                desc: "上线 s/ 免费 HTML 托管小工具：基于 tkinter 的生成器，文件名采用 sha256 取 8 位确定性哈希，方便把单页 HTML 快速挂到站点上分享。同时接入图片自动压缩流程。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年9月5日",
                title: "公告：adkey 抽奖活动",
                desc: "发布 adkey 抽奖活动公告；活动期间暂时隐藏节日公告自动工作流，计划 10 月 1 日恢复。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年9月4日",
                title: "SEO 大修：sitemap 零死链 + 文章编辑器自动注入结构化数据",
                desc: "①sitemap 生成器加入文件存在性过滤，已删除页面（废案游戏、下架 wiki 等）不再写入，URL 从 112 降到 99、实现零死链，并加 v2 版本标记强制 CDN 缓存失效；②文章编辑器整合 SEO 自动注入，导出与预览自动带上 og + twitter + BlogPosting JSON-LD；③修复 noscript 死链、补全结构化数据与爬虫白名单；④移除 aboutme 中 3 个已废弃的作品卡片。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年9月3日",
                title: "CS 接入本地 AI 对话模型（Qwen2.5-0.5B-Instruct）",
                desc: "为 CS 游戏内置聊天模型：选用 Qwen2.5-0.5B-Instruct（q4f16 量化，约 460MB 分 5 块），权重移至 onnx/ 子目录以匹配 transformers.js 的默认布局。此前一天已在云端 runner 跑通 int4 量化流程（改写 Gemm 为 MatMul 并折叠 Constant 权重，修掉原方案漏量化 192 层 Gemm 的伪量化问题）。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年8月31日",
                title: "CS：12队大乱斗 + Q-learning 超级 AI",
                desc: "CS 模式扩充为「12队大乱斗」，加入基于 Q-learning 的超级 AI 对手，并做渲染性能优化；新增无敌飞天训练沙盒用于练枪。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年8月29日",
                title: "新增 HRAI 恐怖逃生游戏 + 图片自动加水印工作流",
                desc: "①HRAI（Horror AI 恐怖逃生）上线：基于 CS 魔改的单人恐怖追逐玩法，在黑暗冰封竞技场里收集 20 把钥匙盒、合成大钥匙逃出生天；②新增图片自动加水印工作流（10% 透明度）。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年8月28日",
                title: "CS beta2：键位自定义 + 手机横屏 + 战术 AI 寻路",
                desc: "CS 进入 beta2：①支持键位自定义、手指拖拽转视角、手机横屏游玩；②新增战术 AI 寻路、三把新枪、双无人机、下包系统、高对比准星，修复弹药模型；③枪械数据改为 JSON 配置，新增排行榜与 AI 英文名；④完成模块化重构，拆分多文件、加入实时纹理、双渲染模式与蹲跳系统。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年8月27日",
                title: "CS 玩法扩充：医疗箱 / 击倒救人 / 团灭胜负",
                desc: "CS 新增医疗箱刷新、击倒后可缓慢爬行并由队友按住 E 救起、团灭判定胜负的完整回合玩法；配套加入敌人枪线与枪贴图、DEBUG 沙盒，并把游戏逻辑抽取为外链 JS，做共享材质与分辨率降级等性能优化。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年8月26日",
                title: "新增文章《怎么写好文章》+ 首页「每日一句」改用本地白名单",
                desc: "①新增教程文章 #79《怎么写好文章》；②首页「每日一句」不再请求 v1.hitokoto.cn 开放投稿接口（曾刷出不当内容），改为本地白名单语录随机展示，内容完全可控。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年8月2日",
                title: "付费文章系统测试上线：文章 #75 + paykey 工具",
                desc: "上线付费文章功能（测试版）：①文章 #75「测试付费文章功能」启用付费墙（key 解锁，复用 adkey 签名算法，页面仅存 uuid 哈希防伪造，解锁状态存 localStorage）②根目录新增站长工具 paykey.htm（选择文章自动带出 uuid，生成 paid-<id>-<uuid>-<sig> 格式的 key 发给已付款读者）③文章已注册进 articles-data.js，测试期间正文声明「误付款请找站长退款」。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年8月2日",
                title: "主页按钮调整：删除百科知识库入口，状态按钮指向新域名",
                desc: "删除主页「百科知识库喵～」按钮（wiki/ 目录保留）；页脚「查看网站状态」按钮链接从 ./status.html 改为 https://status.ciallo0721-cmd.top",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年8月1日",
                title: "公告 #74「一个决定」：永久停止政治写作",
                desc: "从2026年8月1日起永久停止对政治的写作。原因：①合法性——部分政治文章（如龙心事件那篇）使用了不恰当语句/词语，存在风险，相关文章已下架；②学识——本人仍是初中生，可能对政治过度曲解/理解不到位；③今后——保留文章 #9《关于 GitHub Issue 被恶意篡改的说明》作为立场，下架文章 #51《赤井心桐生可可事件（龙心事件）深度回顾》（页面已替换为「已下架」提示页，并同步从 articles-data.js 与 sitemap 中移除）。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年8月1日",
                title: "主页新增 lit.link 链接聚合页",
                desc: "在主页移动端菜单、桌面端社交区（改为 2x2 四卡布局：B站/抖音/TikTok/lit.link）和 JSON-LD 结构化数据中新增链接聚合页：https://lit.link/zh-tw/ciallo0721cmd",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年8月1日",
                title: "主页新增 TikTok 链接",
                desc: "在主页移动端菜单、桌面端社交区（B站/抖音/TikTok 三列布局）和 JSON-LD 结构化数据中新增 TikTok 主页：https://www.tiktok.com/@ciallo0721cmd",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年8月1日",
                title: "小说 #66「短篇-666.exe」润色扩充：全文突破1400+字",
                desc: "将文章 #66 两版内容（初版世界观+病毒入侵 + 2026-08-01 续写）整体润色扩充：①世界观部分扩充五国历史与氛围描写（电流与比特构成的世界、权限铭文、A 的兼容性传说、D 的没有门槛）②此刻部分补全 Unity.exe 更新场景与 666.exe 混入细节、E 的无力感、A 的 8086 呼喊 ③续写部分补全 /dev/ 权限门槛、ICACLS 提权过程、E 伪装 D 的反杀细节，结尾新增「战争，还没有结束」。全文正文 2460 字（纯汉字 1474 字），保留「未完待续」。同步更新阅读时间至10分钟。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年8月1日",
                title: "小说 #66「短篇-666.exe」追加续写（2026-08-01 版）",
                desc: "根据初版草稿为文章 #66 追加第二幕剧情：Unity.exe 更新带入 666.exe 的具体路径、K 高层已被感染的伏笔（tcp 请求 audio.rpa、可疑函数 decallfile/allfiletoserver）、完整权限链（guest < user < admin < Trustedinstaller < su < sudo < god）、666 通过 ICACLS 漏洞提权入侵 C:/ 调换 explorer.exe、E 效仿提权伪装成 D 从 666 身上扒下 8086toc++ 救下 D。末尾保留「未完待续」。同步更新阅读时间至8分钟、dateModified 至 2026-08-01。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月28日",
                title: "新文章三连发 #67 #68 #69：域名「ciallo」「0721」「cmd」分别讲清楚",
                desc: "一次性发布三篇科普文章，把域名 ciallo0721-cmd.top 的三个组成部分全部讲明白：①文章 #67「Ciallo~(∠・ω< )⌒★ —— 柚子社的二次元问候语」介绍《魔女的夜宴》因幡巡的自创问候语从游戏到柚子厨接头暗号的传播历程。②文章 #68「0721 —— 柚子厨心照不宣的数字暗号」讲解绫地宁宁与0721谐音梗的由来和圈内文化。③文章 #69「CMD —— 命令提示符，Windows 的灵魂之窗」科普命令提示符从 MS-DOS 到 Windows 11 的历史和实用命令。三篇文章均配站点样式，同步更新 articles-data.js 和 timeline.js。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月27日",
                title: "文章 #12 追加续篇：tname.net 真相 + 域名分销体系曝光",
                desc: "在文章 #12（关于本站广告位的说明）末尾追加 2026年7月27日补充章节，完整记录作者发现 tname.net 真假的过程：从域名长期 Hold 状态、审核 1 个月没动静、Hold/审核会让用户无法访问且 Bing 无法索引的疑惑点，到发现 FAQ 里'那个国家'错别字（少了一个'几'字，疑点：正规公司不会让这种低级错误挂一年），最后点击'开通分站'发现 tname.net 其实是招域名代理商的分销平台，作者从头到尾一直被蒙在鼓里——以为自己是个用户，其实只是其下级代理。新增三个方案（保留/转移/删除）向读者征集意见。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月27日",
                title: "新增三个博客板块：小说 / 笔记 / 求助 + 文章 #66「短篇-666.exe」",
                desc: "在 blog/ 下新增三个板块目录：①blog/小说/——原创小说板块，导入桌面 66.txt 的短篇故事「短篇-666.exe」作为文章 #66，标注「未完待续」。暗黑紫色赛博风UI，国家卡片/Curl代码框等自定义样式。②blog/笔记/——学习笔记板块（占位）。③blog/求助/——帮助解答板块（占位），用于发布帮他人缓解压力/解决常见问题的文章。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月25日",
                title: "统一分享按钮上线：全站66篇博客文章一键分享",
                desc: "创建 js/js/blog-share.js + css/css/blog-share.css 统一分享系统，自动创建浮动分享按钮（右下角）。支持复制链接、QQ分享、X(Twitter)分享、移动端原生分享，使用 window.location.href 动态获取当前地址。为全部66篇博客文章注入，同时清理21篇文章的旧硬编码分享代码。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月24日",
                title: "新游戏：塔珀自指公式·像素动画工坊",
                desc: "在 /mathtovideo/ 上线基于塔珀自指公式(Tupper's self-referential formula)的106×17像素画板与帧动画工具。支持绘制/擦除/翻转、k值编码解码、种子随机生成、预设图案、多帧保存、FPS调节、GIF/MP4导出。首页导航栏新增入口。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月24日",
                title: "新文章 #65：从0开始，用HTML和SQL和PHP做一个最简陋的论坛",
                desc: "在 blog/教程/65/ 下发布超长技术教程。从论坛的概念和历史讲起（CBBS、4chan、X岛、百度贴吧），详解 PHP、HTML、SQL 三大网页编程语言的基础知识，然后手把手教你从买服务器、装环境、写代码到部署上线的完整流程。涵盖前端怎么写、后端CRUD、审核机制（为什么要写、如果不写会怎样）、GA4分析、Google/Bing/百度SEO提交、IndexNow协议、备案、微信提交、论坛规则写法、防DDoS策略等二十多个小节，配代码示例和实用提示。阅读时长约40分钟。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月23日",
                title: "新文章 #64：16位, 32位, 64位操作系统, 都是什么东西",
                desc: "在 blog/科技/64/ 下发布科技科普文章。从8位一路讲到64位，全面解析CPU位数、寄存器宽度、地址总线与内存限制的关系。涵盖16位DOS时代、32位Windows革命到64位现代标准，附实用知识教你判断自己电脑的位数。包含对比表格、问答FAQ和历史回顾，用最直白的语言拆解计算机的'位'到底是什么。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月22日",
                title: "广告系统文章更新 + adkey 机制实现：关闭按钮、个性化权重、永久关广告",
                desc: "更新了博客文章#12「关于本站广告位的说明」，新增「2026年7月22日-补」章节：①每个广告都有关闭按钮了 ②广告个性化——完全由用户掌握（点击/关闭行为动态调整权重）③全站71页部署广告系统，覆盖范围扩展至心理学/医学/论文等领域 ④新增重置所有权重的调试面板入口 ⑤全新 adkey 永久关闭广告机制（提Issues获取专属值，在调试面板输入即可完全关闭广告）。同步实现 ad-system.js adkey 验证逻辑（ADMIN_ADKEY 常量 + validateAdkey/applyAdkey/removeAdkey API），ad-system-test.html 新增 adkey 输入面板（含输入框/验证/恢复/生成按钮）。同步更新 adss.html 广告适用范围标签的说喵～",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月21日",
                title: "新文章 #63：什么是 LGBT？——从心理学理解性少数群体的存在",
                desc: "在 blog/心理学/63/ 下发布 LGBTQIA+ 心理学科普。介绍什么是性少数群体，从基因、产前激素、大脑结构等角度解释同性恋和跨性别者的存在原因，分析偏见的心理学根源，最终呼吁相互尊重。附 MD 备份。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月20日",
                title: "修复 404 页面 CSS 在子路径下失效问题",
                desc: "GitHub Pages 404 fallback 会保留用户访问的子路径（如 /1），相对路径 ./css/css/404.css 被错误解析为 /1/css/css/404.css → 404 → 页面变成简陋白底黑字版。修复方案：①头部加 <base href=\"/\"> ②所有 ./xxx 相对路径改为绝对路径 /xxx（包括 fanv.ico、404.css、404.js、ad-data.js、ad-system.js、index.html 链接）③顺手删除一行重复的 icon 链接。同样的坑 access-denied.html 等其他错误页也可能中招喵～",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月19日",
                title: "用户协议与隐私政策合并至 /doc/all.html",
                desc: "①将分散的 privacy-policy.html、user-agreement.html、privacyandpolicy/index.html 等全部协议文件合并为一份综合文档 /doc/all.html（16章，包含用户协议、隐私政策、Cookie说明、广告系统说明、DMCA合规、免责声明、知识产权等全部法律条款）②删除所有旧协议相关文件（privacyandpolicy/ 目录 ×7 个 CSS ×7 个 JS）③更新全站所有页面链接指向 /doc/all.html④修正 GA4 描述：取消「同意/不同意」说法，如实说明本站无 Cookie 同意弹窗⑤新增第8章「广告系统说明」并引用博客文章12号的站长承诺",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月19日",
                title: "博客首页 UI 质感升级（DeepSeek 协作设计）",
                desc: "与 DeepSeek 协作改进 blog/index.html UI：①卡片双色渐变背景 + 22px 大圆角 + 黄金描边②悬停上浮 6px + scale(1.02) 微动效③搜索框/按钮改为 40px 超圆角，focus 绿色发光④标签药丸化（40px 圆角），激活态带阴影⑤书架背景透明度提高，增强氛围感⑥筛选区暖色渐变 + 金色边框。同步改造 ai-collaboration-bridge skill，新增 pyautogui 自动协作模式喵～",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月15日",
                title: "新开医学板块：文章模板（id 62）",
                desc: "在 blog/医学/62/ 下新建医学文章。",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月14日",
                title: "广告系统 v1.2：点击统计 + tname 推广广告化",
                desc: "①新增点击/展现/转化率统计系统：每次广告渲染记录展现，每次点击记录点击，自动计算 CTR ②存储于 localStorage('ciallo_ad_stats')，支持按广告维度汇总报表③测试面板新增「数据统计」板块，含总览卡片和每广告明细表④新增 tname.net 域名推广广告（第16种），紫色渐变 SVG，链接至 tname.net?sid=11078⑤暴露 AdSystem.getStats()/resetStats()/resetAll() API，控制台可直接调用的说喵～",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月14日",
                title: "广告系统 v1.1：数据与逻辑分离 + 全站覆盖",
                desc: "①抽离广告数据为独立文件 js/js/ad-data.js（格式：[类型, 图片链接, 跳转链接]），ad-system.js 改为从 ad-data.js 读取数据②重新生成 15 个 SVG 广告图，去掉「广告位招租」文字，改用简洁的分类名+AD角标③全站 71 个页面统一引用 ad-data.js + ad-system.js ④清理所有残留注释，统一为「广告系统 v1.1」的说明喵～",
                author: "ciallo0721-cmd"
            },
            {
                date: "2026年7月13日",
                title: "大规模 CSS/JS 外置 + 鼠标特效性能优化",
                desc: "①所有非文章 HTML 的内联 CSS/JS 全部提取为独立文件，存入 css/css/ 和 js/js/ 目录②移动 6 个独立 CSS 文件、17 个独立 JS 文件到对应目录③更新 59 个 HTML 文件的引用路径④重构鼠标特效引擎：FPS 自动检测降级（高/中/低三档），requestAnimationFrame 节流 mousemove，navigator.deviceMemory 检测低配设备，CSS will-change 提示 GPU 加速，粒子数量/频率按性能档位自适应⑤开放控制台 toggleLowPowerEffects() 手动切换低功耗模式⑥优化特效 CSS：缩短动画时长、降低复杂元素尺寸、减少 transition 范围",
                author: "ciallo0721-cmd"
    },
            {
                date: "2026年7月13日",
                title: "动态广告系统 v1.0 上线：智能标签偏好算法",
                desc: "①新增 15 种彩色 SVG 占位广告（对应 15 个标签：游戏/编程/AI/设计/音乐/影视等）②智能偏好算法：用户点击广告→该标签权重+10，点「不感兴趣」→权重-20+屏蔽该广告，加权随机选择推荐 ③ 4 个广告位分散在首页各处（顶部横幅、项目中、文章区下、底部）④localStorage 持久化偏好数据 ⑤测试面板：tests/ad-system-test.html 可查看权重/历史/模拟测试。",
                author: "ciallo0721-cmd"
    },
            {
                date: "2026年7月10日",
                title: "主页集成 Giscus 评论区（留言板）",
                desc: "将 Giscus 评论区直接嵌入首页 footer 上方，无需单独页面。使用 GitHub Discussions 讨论系统，已配置 repo-id 和 category-id。首页 footer 和 friends.html 导航栏均添加「留言板」入口锚点。",
                author: "ciallo0721-cmd"
    },
            {
                date: "2026年7月10日",
                title: "新文章 #61：暑期更新频率调整说明",
                desc: "发布网站公告：暑假期间因学业（和旅游(bushi)）忙，文章从每周5篇降至每周0.5~1篇（或每月5篇），GitHub热力图从每天1绿降至每周3绿，网站仍维护（看情况），9月开学后逐步恢复喵～"
    },
            {
                date: "2026年7月10日",
                title: "新文章 #60：git commit -m \"1\"——你的项目历史正在被一个字符毁掉",
                desc: "发布Git教程文章，从GitHub入门讲起，犀利拆解为什么commit message写「1」短期能忍长期是灾难。git log变天书、bisect报废、三个月后自己都看不懂——不是Git在惩罚你，是你自己在毁掉项目历史的喵～"
    },
            {
                date: "2026年7月9日",
                title: "博客页视觉重设计：深绿色书架主题",
                desc: "blog/index.html 全面视觉重构：①新增静态书架 SVG 背景（3层书架+书本几何图案，深绿色调）②配色从粉蓝 B站风 → 深绿+暖米色（#1A3C34/#F5F1E8），iOS 6/2017 简约高级感 ③动画系统升级：fadeInUp → cardReveal（16px微移+cubic-bezier缓动），卡片 hover 8px→4px 克制提升，header 标题呼吸发光 ④导航透明毛玻璃+方正圆角、卡片 20px→12px 圆角、按钮渐变→纯色。整体从活泼俏皮 → 沉稳知性书架风喵～"
    },
            {
                date: "2026年7月7日",
                title: "端测测测试基础设施 + 全站路径修复",
                desc: "搭建完整 Web 测试框架，含3个独立模块：静态代码分析（62个HTML）、链接健康检测（555个链接）、基础性能检测（8个关键页面，TTFB仅6ms）。修复 pages/ 目录 ~30处相对路径错误（./→../）、index.html 38处外链添加 rel=\"noopener noreferrer\"、3处 fanv.ico 路径错误。链接断裂数从35条降至12条（-66%）。首页新增更新公告横幅。综合评分：静态🟡70 + 链接🟡64 + 性能🟢94。"
            },
            {
                date: "2026年7月6日",
                title: "全站图标SVG化：移除 Font Awesome 依赖",
                desc: "75个HTML文件全部移除 Font Awesome CDN（6.4.0/6.5.1），替换为自建 SVG 图标系统（js/svg-icons.js，含60+种图标）。wz/ 安全警告 GIF 替换为动画 SVG，arg/ 游戏窗口控件 emoji → SVG，cn/ 诗人百科和 wiki/ 搜索 emoji → SVG。首页 favicon 保留不动。预计减少约80KB外部CDN请求，所有图标离线可用喵～"
            },
            {
                date: "2026年7月5日",
                title: "sitemap.xml 大更新：73→96个URL覆盖全站",
                desc: "重新生成 sitemap.xml，从旧版73个URL扩展到96个。新增 friends.html、baicai 纪念站、cn 诗人百科、ARG 镜中人、app 工具页、10个 wiki 词条子页面、work 打工模拟器、cs2 等。同步更新 generate-sitemap.py 脚本，下次改结构一键重生成的说喵～"
            },
            {
                date: "2026年7月4日",
                title: "全新 Admin 调试面板 v1.0 上线",
                desc: "纯前端本地调试面板，四合一：①存储编辑器（localStorage/sessionStorage/Cookies 增删改查）②URL参数注入（一键模拟16个地区 from=us/uk/hk... + touch=true 移动端模式）③功能测试（地区访问控制测试、存储压力测试、配额测试）④导入导出（JSON备份还原、剪贴板操作）。深色主题、响应式布局，从此调试网站不用手敲 URL 参数啦喵～"
            },
            {
                date: "2026年7月4日",
                title: "根目录文档归档：17个 .md/.txt 移入 foragent/",
                desc: "把博客语法、SEO策略、ArtiScript/BlockScript规范、网站重构计划等17个给agent看的文档全移到 ./foragent/ 目录，根目录清爽多了喵～搜索引擎验证文件和 robots.txt 保留原位不动。"
            },
            {
                date: "2026年7月4日",
                title: "项目大扫除：清理无用文件 37 个",
                desc: "删除未引用的12MB视频、18个无CDN层的错误页（400~505/不含404）、失效Jekyll配置、过期的local_server和打包脚本、10.html谜之页面、admin后台、peizhi配置残骸等。共释放约13MB空间，项目目录干净多了的说喵～"
            },
            {
                date: "2026年7月4日",
                title: "移除推广返佣板块",
                desc: "从首页和友链页移除域名推广返佣板块（含推广链接、返佣统计表格、相关CSS和JS），该信息属于个人返现数据不应对外展示的说喵～"
            },
            {
                date: "2026年7月4日",
                title: "新文章 #57：浪漫文案？那是词语废料",
                desc: "发布生活随笔，犀利批判当代朋友圈「浪漫文案」现象——前言不搭后语、逻辑混乱如乱码，扒皮「盲盒论」和「SEO论」两种荒唐辩护，呼吁好好写字好好表达感情的说喵～"
            },
            {
                date: "2026年7月4日",
                title: "文章模板更新：muban 新增自动推荐文章功能",
                desc: "在 blog/muban/ 样板模板中新增自动推荐文章区块。根据当前文章标签匹配相关文章（同标签+同分类加权），无匹配时回退显示最新精选文章。使用 articles-data.js 数据驱动，新文章复制模板即可自动获得推荐内容的说喵～"
            },
            {
                date: "2026年7月4日",
                title: "历代诗人百科：新增投稿&修复板块",
                desc: "在 cn/ 历代诗人百科页面底部新增投稿&修复板块。支持填写诗人信息表单自动生成投稿内容（可读文本+JSON），一键复制或跳转 GitHub Issue 提交；修复记录Tab可展示数据修正历史。方便雏草姬们一起完善诗人数据库的说喵～"
            },
            {
                date: "2026年7月4日",
                title: "新文章 #22：调色教程——复古蒸汽波",
                desc: "发布 Lightroom Classic 调色教程，完整收录复古蒸汽波风格的影调+HSL+校准+颗粒全参数，附带3个调色板方案和霓虹街头拍摄选址指南。高光-62阴影+46骨架、橙色-22绿色+17灵魂，一键复刻赛博浪漫的说喵～"
            },
            {
                date: "2026年7月3日",
                title: "ARG 游戏「镜中人」发布 & 主页游戏板块更新",
                desc: "发布全新 Win98 复古美学 ARG 解谜游戏「镜中人」，玩家在虚拟桌面中探索 2002 年神秘论坛「镜面论坛」，通过浏览器和终端与五个角色互动，最终面临四种结局。已将游戏加入主页游戏板块的说喵～"
            },
            {
                date: "2026年7月1日",
                title: "新文章 #55：我的音乐品味三年进化史（2023-2026）",
                desc: "发布个人回顾文章，完整列出从2023年7月到2026年7月三年间收藏的180+首歌曲。按时间线梳理每个月的歌单变化，从短视频BGM到Vocaloid电波系、从DDLC OST到俄语硬曲——记录一个初中生的音乐品味进化之路的说喵～"
            },
            {
                date: "2026年6月30日",
                title: "新文章 #54：为什么儿童会对高饱和度上瘾？——从脑腐到Cocomelon的色彩心理学",
                desc: "发布心理学深度文章，全面解析为什么儿童天然偏爱高饱和度色彩、为何婴幼儿玩具都是鲜艳色系、色彩对儿童认知情绪的影响。引入脑腐/烂梗概念分析Cocomelon为代表的儿童内容成瘾机制，外部链接使用 /oops/link/ 跳转提示保护的说喵～"
            },
            {
                date: "2026年6月29日",
                title: "新文章 #53：病娇（ヤンデレ）从萌属性到心理剖析",
                desc: "发布ACG文化深度解析文章，全面探讨「病娇」这一经典萌属性的定义、历史起源（1992年《狂った果実》到2005年《School Days》）、经典角色（桂言叶、我妻由乃）、心理学侧面分析，以及病娇与傲娇/郁娇等其他デレ系属性的区别。同时修改了文章 #25 斯德哥尔摩效应，新增YouTube/Bilibili双视频嵌入和4个外部延伸阅读链接。"
            },
            {
                date: "2026年6月29日",
                title: "新文章 #52：从 UTAU 到心理学——我的 51 篇文章进化路",
                desc: "发布个人回顾文章，审视从2025年12月到2026年6月写下的51篇文章风格演变。从UTAU教程、闲聊碎碎念、公告声明、VTB告别，到24篇心理学系列井喷，再到社会议题和行业深度分析——回顾一个初中生写作者从「怎么做」到「为什么」的9个月旅程的说喵～"
            },
            {
                date: "2026年6月29日",
                title: "新文章 #51：赤井心桐生可可事件（龙心事件）深度回顾",
                desc: "发布VTuber行业深度分析文章，全面回顾2020年9月赤井心与桐生可可先后展示YouTube后台将台湾列为「国家」数据引发的跨国争议事件。涵盖完整时间线、各方视角对比（中国大陆/台湾/日本/欧美/行业）、鲸落效应与中文Vup崛起、COVER公关灾难分析，以及深层矛盾反思。外部链接使用 /oops/link/ 跳转提示保护的说喵～"
            },
            {
                date: "2026年6月28日",
                title: "首页和友链页新增域名推广返佣板块",
                desc: "在 friends.html 和 index.html 添加 tname.net 推广返佣板块，含专属推广链接（https://tname.net?sid=11078）、返佣规则展示（注册¥3/购买¥2）、累计返佣金额和返佣记录表格的说喵～"
            },
            {
                date: "2026年6月26日",
                title: "网站挂上爱发电赞助链接",
                desc: "在首页导航栏、移动端菜单、页脚添加爱发电链接（https://ifdian.net/a/ciallo0721-cmd），同步修复 wz/index.html 断裂的赞助支持锚点链接，更新 i18n 映射使其准确匹配导航项的说喵～"
            },
            {
                date: "2026年6月26日",
                title: "修复 /blog/ 页面 Meta Description 过短问题",
                desc: "Bing Webmaster Tools 检测到 /blog/ 页面 meta description 仅16字符（ciallo0721-cmd 的文章站），不符合搜索引擎要求。已扩写为完整描述（~68字符），同时补充了 OGP（og:title/description/url/type/site_name）和 Twitter Card 元数据，提升搜索引擎和社会化分享表现的说喵～"
            },
            {
                date: "2026年6月26日",
                title: "新文章 #50：樱花校园模拟器桃子组神秘房间通关攻略",
                desc: "发布游戏攻略文章，介绍樱花校园模拟器中桃子组（黑帮团，持火箭筒）神秘房间的通关方法。文章以视频为主，无文字内容，视频文件位于 blog/ACG/50/1.mp4 的说喵～"
            },
            {
                date: "2026年6月26日",
                title: "自研视频播放器停用 · 替换为浏览器原生播放器",
                desc: "自研视频播放器（video-player.js / nice-video.js / MediaViewer视频功能）因2026/6/16后兼容性问题彻底失效，打了也播不了的说喵～ 已将其从4篇含有视频的文章（#15 真白花音退网视频、#16 注册GitHub教程、#17 优化X推荐、muban样板文章）中全部替换为标准HTML5 `<video controls>` 原生播放器，并清理3篇无实际视频内容的文章中残留的脚本引用的说喵～（状态标记为🔴红色）"
            },
            {
                date: "2026年6月26日",
                title: "sitemap 添加 /work/（打工模拟器）条目",
                desc: "将 https://ciallo0721-cmd.top/work/ 打工模拟器 WebAssembly 游戏页面加入站点地图（sitemap.xml），便于搜索引擎索引的说喵～"
            },
            {
                date: "2026年6月25日",
                title: "导航栏缩小 + MoeFace Web 前端 .moe 解析器重写",
                desc: "将导航栏 nav-container padding 从 15px 20px 缩小为 8px 15px，nav-links gap 从 35px 缩小为 18px，同步更新全部 29 个 HTML 文件。同时重写 app/moeface/index.html 的 loadDatabase()，将 JSON.parse 改为解析 .moe 实际文本格式（多部位特征取平均）的说喵～"
            },
            {
                date: "2026年6月25日",
                title: "修复 IndexNow 工作流：动态 URL 生成 + 密钥文件补全",
                desc: "重写 indexnow-submit.yml：从 articles-data.js 动态解析全部 49 篇文章的 URL，扩大触发路径（wiki/status/aboutme/wz/baicai/taffy 等），新增每6小时定时兜底提交和备用 Bing IndexNow 端点。补充 IndexNow 验证密钥文件 78e189d695964af9a74c8a4c0493ac7e.txt 的说喵～"
            },
            {
                date: "2026年6月22日",
                title: "新文章 #47：关于性别话题的一些想法",
                desc: "写了一篇关于网上性别话题的个人随想喵～ 纯个人观察，不说教不站队，加了弹窗警告和免责声明。感兴趣的朋友可以去看看的说～"
            },
            {
                date: "2026年6月21日",
                title: "新增18篇心理学深度探索系列文章",
                desc: "一口气上线18篇心理学深度文章喵～ 从PTSD/C-PTSD/NPD等临床障碍，到语义饱和/恐怖谷/中式恐怖等认知现象，再到精神分裂症与超雄综合征的去污名化科普，以及地雷妹/OD/改花刀等当代青少年心理危机话题。最后两篇为微表情心理学和说谎判断，末篇附个人心理学探究经历与感悟的说完喵～ 文章ID 29-46，全部收录于 blog/心理学/ 目录的说喵～"
            },
            {
                date: "2026年6月21日",
                title: "百科词条更新：真白花音（白菜）内容全面升级",
                desc: "参考 baicai.ciallo0721-cmd.top 纪念站，全面更新 wiki 中真白花音词条。修正出道时间（原错误写为2023年，实为2019年5月7日），补充基本资料（生日5月29日、身高144cm、白发红瞳、所属Chucolala/P家等）、完整16条事业时间线（2019-2026）、9条轶事、以及B站/YouTube/Twitter外部链接。同步更新 wiki/data.json 和 wiki/hanamine/index.html 的说喵～"
            },
            {
                date: "2026年6月20日",
                title: "二级域名系统上线：status / wiki / baicai / taffy",
                desc: "创建四个二级域名站点喵～ status.ciallo0721-cmd.top（状态页）、wiki.ciallo0721-cmd.top（百科）、baicai.ciallo0721-cmd.top（真白花音纪念站）、taffy.ciallo0721-cmd.top（塔菲AI人设展示）。客户端路由方案（_subdomain-router.js），tname DNS 配 CNAME 就能用，等以后能切 Cloudflare DNS 了还能无缝升级到 Worker 版喵！"
            },
            {
                date: "2026年6月20日",
                title: "文章加载双保险：首选 .blog + 备选 html.html",
                desc: "修复文章显示不全的问题！现在每篇文章都有 html.html 静态备份文件。decoder.js 加载策略改为：① 首选 .blog 文件（正常解析渲染）→ ② .blog 加载失败时自动回退到 html.html（提取内容显示）→ ③ 双重失败才显示错误提示。为全部 24 篇文章生成了完整的 html.html 备份喵～"
            },
            {
                date: "2026年6月20日",
                title: "SEO 大优化：预渲染24篇文章 + 修复 CSP + 新 sitemap",
                desc: "全面 SEO 优化：生成 24 篇博客文章的静态 HTML 文件（不再依赖 JS 加载）；放宽 CSP 以允许 Googlebot 渲染；重写 sitemap.xml 包含 39 个 URL；添加 noscript 静态链接回退；优化 robots.txt。附赠 `prerender-blog.py` 预渲染脚本喵～"
            },
            {
                date: "2026年6月19日",
                title: "首页 tools 区增加新番数据库 & 人脸识别",
                desc: "将 新番数据库 和 MoeFace 人脸识别 两张工具卡片加入首页 #tools 区，并移除了导航栏上重复的两个独立按钮，现在 tools 区共有 6 个工具的说喵～"
            },
            {
                date: "2026年6月19日",
                title: "更换域名：从 91vip.xn--32v.ink 到 ciallo0721-cmd.top",
                desc: "将网站全部域名的引用从 91vip.xn--32v.ink 更换为 ciallo0721-cmd.top，批量替换了 100+ 个文件中的所有旧域名引用的说喵～ (๑•̀ㅂ•́)و✧"
            },
            {
                date: "2026年6月18日",
                title: "修复文章24无法访问 + decoder.js 共享化",
                desc: "修复多个 bug：① decoder.js 未解析 URL 查询参数 ?blog_id=，导致嵌套路径下无法获取文章ID；② 文章 HTML 中 ../articles-data.js 在嵌套目录（如 blog/兴趣/另一个次元/24/）下解析不到根目录，window.articlesData 为 undefined；③ renderArticle 中 trimmedContent 变量名拼写不一致导致 JS 报错。将所有文章 HTML 的 decoder.js 引用统一为 /blog/decoder/decoder.js 共享版本，articles-data.js/wiki-data.js/wiki-linker.js 全部改为绝对路径，decoder.js 新增 ?blog_id= 解析和 _pathMap 路径拼接逻辑的说喵～"
            },
            {
                date: "2026年6月18日",
                title: "新增番剧分享文章 (24)",
                desc: "创建番剧分享文章，提供Google网盘链接分享收藏的番剧资源，并说明国内访问可能存在的问题，还请见谅的说～"
            },
            {
                date: "2026年6月17日",
                title: "articles-data.js 重构：灵活路径映射系统 v2",
                desc: "将 blog 架构从平铺目录改为分类嵌套后，重写 articles-data.js：移除所有硬编码 fileName，引入 _pathMap 映射表集中管理路径，所有查询方法自动附加计算后的 fileName，新增 getPath()/getCategories() 外部接口，改架构只需改一行映射表的说喵～"
            },
            {
                date: "2026年6月13日",
                title: "新增节日公告自动更新系统",
                desc: "建立 GitHub Actions 工作流，每天北京时间 00:00 自动检测 21 个节日/纪念日/特别日期，自动替换站点公告为对应节日文案（含春节动态日期农历查表，覆盖2027-2035年除夕到初六）的说喵～"
            },
            {
                date: "2026年6月13日",
                title: "节日公告新增：高考、端午、重阳、站长生日(5/24)、开学季(9/1)",
                desc: "在节日公告自动更新工作流中添加 4 个新节日：端午节（农历五月初五动态查表）、重阳节（农历九月初九动态查表）、站长生日(5/24)、开学季(9/1)的说喵～"
            },
            {
                date: "2026年6月13日",
                title: "新增加密流媒体播放器测试文章 (video-1)",
                desc: "创建 video-1 测试文章，内置 hls.js HLS 流媒体播放器，自动加载本地 ./1.m3u8 流文件，附带 mp4_to_hls.bat 转换脚本（纯英文）喵～"
            },
            {
                date: "2026年6月2日",
                title: "状态页面改版：新增历史回放 + 灰色状态",
                desc: "改造 status.html，新增历史回放时间线区域（从 status-data.js 加载），新增灰色「无记录」状态，四色体系（绿/黄/红/灰）覆盖全部场景，建立网站更新→状态记录工作流喵～"
            },
            {
                date: "2026年6月1日",
                title: "新增全套 HTTP 错误页面",
                desc: "基于 404 模板风格批量创建 24 个 HTTP 错误页面（400-418, 500-505），统一渐变背景/机器人动画/喵语风格，重写 403 去掉旧验证逻辑，418 为 RFC 2324 茶壶愚人节彩蛋喵～"
            },
            {
                date: "2026年5月23日",
                title: "修复Python在线编辑器多个bug",
                desc: "修复Python编辑器HTML/JS ID不匹配（codeEditor→pythonEditor）；修复dynamic-data.js数字换行SyntaxError；修复#注释被转为//后吃掉try/catch闭合括号导致Missing catch错误；修复Font Awesome preload integrity缺失警告喵～"
            },
            {
                date: "2026年5月22日",
                title: "上线免费工具集 + SEO长文矩阵",
                desc: "上线4个免费工具（VTuber名字生成器、Ren'Py模板生成器、VTuber人格测试、二次元色彩分析器）、友链页面、新增3篇SEO教程文章（Ren'Py立绘替换/存档系统/Python OCR），完善工具索引页和导航菜单喵～"
            },
            {
                date: "2026年5月18日",
                title: "新增心情追踪仪表板",
                desc: "集成 Mood-Tracker-Dashboard 项目，转为纯静态 HTML+JS 版本，支持全年热力图、散点图、localStorage 本地记录和数据导出喵～"
            },
            {
                date: "2026年5月17日",
                title: "更新 sitemap.xml",
                desc: "扫描 blog/ 目录所有文章（18篇+），检查静态页面和游戏页面，生成新 sitemap.xml，添加 blog/index.html，更新所有 lastmod 为实际修改时间喵～"
            },
            {
                date: "2026年5月17日",
                title: "简化验证流程",
                desc: "删除多余的验证环节，只保留 Cloudflare Turnstile 验证，用户可以直接访问主界面喵～"
            },
            {
                date: "2026年5月16日",
                title: "新增低版本浏览器跳转页面",
                desc: "添加了 oops 页面，当检测到 IE/Edge 1-17/其他低版本浏览器时，自动跳转到提示页面引导用户使用现代浏览器喵～"
            },
            {
                date: "2026年5月10日",
                title: "修复返回顶部按钮 + 升级音乐播放器UI",
                desc: "修复了全站文章页返回顶部按钮箭头不居中的bug，同时给首页悬浮音乐播放器换上了全新UI，包含封面展示、歌曲列表和可视化跳动条的说～ (๑•̀ㅂ•́)و✧"
            },
            {
                date: "2026年5月7日",
                title: "新增视频播放器（自研）",
                desc: "为网站新增自研视频播放器组件，支持视频在线播放的说～ (๑•̀ㅂ•́)و✧"
            },
            {
                date: "2026年3月31日",
                title: "添加后台 · 修复已知问题 · 修复SEO爬虫误判",
                desc: "上线后台管理系统 admin.html，修复多个已知 Bug 并完善网站细节，优化 SEO 爬虫检测逻辑，提升搜索引擎友好度和用户体验的说～ (๑>ᴗ<๑)"
            },
            {
                date: "2026年4月1日",
                title: "更新网站图标",
                desc: "更新了网站的 favicon 和多个社交平台的图标，采用了更符合二次元风格的设计，提升了整体视觉一致性和品牌形象的说～ (๑˃̵ᴗ˂̵)و"
            },
            {
                date: "2026年4月2日",
                title: "整理网站上的游戏",
                desc: "对网站上的游戏进行了整理和分类，更新了游戏预览的链接和描述，提升了用户浏览体验的说～ (◕‿◕✿)"
            },
            {
                date: "2026年4月3日",
                title: "换了个域名",
                desc: "将网站域名从 https://ciallo0721-cmd.github.io/ 更换为 https://91vip.xn--32v.ink/，提升了网站的专业形象和访问速度的说～ (๑•̀ㅂ•́)و✧"
            },
            {
                date: "2026年4月5日",
                title: "安全加固 · SEO移除 · 性能优化 · 新增状态页面",
                desc: "进行全面安全审计，移除硬编码密码并改为哈希验证；删除所有SEO文件和meta标签；收紧CSP策略；添加实时状态查看页面 (status.html)；优化DNS预解析和CSS异步加载的说～ (๑>ᴗ<๑)"
            },
            {
                date: "2026年6月21日",
                title: "新增5篇心理学效应科普文章",
                desc: "一口气上线5篇全新的心理学效应科普文章喵～ 达克效应（含家是本朱剑秋案例分析）、斯德哥尔摩效应（含娜塔莎案时间线）、幸存者偏差（二战弹孔经典案例）、踢猫效应（情绪传染链条可视化）、蝴蝶效应（洛伦兹混沌理论全解析），全部收录于 blog/心理学/ 目录的说喵～"
            },
            // ↑ 新条目加在最上面，最新的排最前
            {
                date: "2026年4月8日",
                title: "与google analytics对接",
                desc: "成功将网站流量数据接入google analytics，便于后续的数据分析和用户行为研究的说～ (๑•̀ㅂ•́)و✧"
            },
        ];

        // 渲染时间线（使用DOM创建防止XSS）
        function escapeHtml(str) {
            var d = document.createElement('div');
            d.textContent = String(str);
            return d.innerHTML;
        }
        function parseDate(str) {
            var m = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
            return m ? new Date(+m[1], +m[2]-1, +m[3]).getTime() : 0;
        }
        function renderTimeline() {
            var list = document.getElementById('timelineList');
            if (!list || !window.timelineData) return;
            // 按日期倒序排列，修复条目顺序错乱问题
            var sorted = window.timelineData.slice().sort(function(a, b) {
                return parseDate(b.date) - parseDate(a.date);
            });
            list.innerHTML = sorted.map(function(item, i) {
                var safeDate  = escapeHtml(item.date  || '');
                var safeTitle = escapeHtml(item.title || '');
                var safeDesc  = item.desc ? escapeHtml(item.desc) : '';
                return '<div class="timeline-item" style="animation-delay:' + (i * 0.08) + 's">'
                    + '<div class="timeline-date"><i class="fas fa-calendar-alt" style="margin-right:6px;"></i>' + safeDate + '</div>'
                    + '<div class="timeline-content">'
                    + '<div class="timeline-title">' + safeTitle + '</div>'
                    + (safeDesc ? '<p class="timeline-desc">' + safeDesc + '</p>' : '')
                    + '</div></div>';
            }).join('');
        }
        document.addEventListener('DOMContentLoaded', renderTimeline);
