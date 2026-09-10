// articles-data.js — 文章数据源
window.articlesData = {
    articles: (function() {
        var raw = [
        {
            id: 1,
            category: "教程",
            fileName: "教程/1/",
            title: "UTAU教程：从调音到发布完全指南",
            excerpt: "学习如何使用UTAU进行歌声合成，从基础调音到高级技巧，完整指南带你入门。",
            date: "2025-12-28",
            tags: ["UTAU", "虚拟歌姬", "调音", "歌声合成", "教程", "音乐制作"],
            readTime: 15,
            featured: true
        },
        {
            id: 2,
            category: "教程",
            fileName: "教程/2/",
            title: "Unity 2D角色移动系统完全指南",
            excerpt: "从零开始构建一个完整的2D角色移动系统，包含平滑移动、跳跃、冲刺和动画控制。",
            date: "2025-12-29",
            tags: ["Unity", "2D游戏开发", "角色移动", "C#编程", "游戏物理"],
            readTime: 20,
            featured: true
        },
        {
            id: 3,
            category: "教程",
            fileName: "教程/3/",
            title: "2.5头身小人绘画全攻略：从基础到头发细节",
            excerpt: "本教程将详细讲解如何绘制可爱的2.5头身小人，涵盖比例结构、面部表情、头发与呆毛绘制技巧，适合初学者和有一定基础的画手。",
            date: "2025-12-30",
            tags: ["绘画教程", "Q版人物", "2.5头身", "头发绘制", "呆毛技巧", "角色设计"],
            readTime: 15,
            featured: true
        },
        {
            id: 4,
            category: "公告",
            fileName: "公告/4/",
            title: "关于为什么主页变成了这样",
            excerpt: "网站被攻击、性能问题大揭秘！详细解释网站主页暂时变成公告页面的原因，以及维护到1月18日的恢复计划。",
            date: "2026-01-10",
            tags: ["网站公告", "被攻击", "性能优化", "DDoS攻击", "维护", "GitHub Pages", "未来计划"],
            readTime: 15,
            featured: true
        },
        {
            id: 5,
            category: "公告",
            fileName: "公告/5/",
            title: "主页大更新",
            excerpt: "修复了加载时间过长的问题，更新音乐播放器。",
            date: "2026-01-13",
            tags: ["主页", "更新", "新设计", "用户体验", "功能改进"],
            readTime: 7,
            featured: true
        },
        {
            id: 6,
            category: "闲聊",
            fileName: "闲聊/6/",
            title: "闲聊",
            excerpt: "一些日常闲聊和碎碎念。",
            date: "2026-01-13",
            tags: ["闲聊"],
            readTime: 4,
            featured: true
        },
        {
            id: 7,
            category: "ACG",
            fileName: "ACG/7/",
            title: "新歌姬发布",
            excerpt: "新歌姬发布：沙雕の贤者V2 正式上线！",
            date: "2026-01-17",
            tags: ["UTAU", "虚拟歌姬", "沙雕の贤者", "音源发布"],
            readTime: 3,
            featured: true
        },
        {
            id: 8,
            category: "公告",
            fileName: "公告/8/",
            title: "网站小更新",
            excerpt: "网站小更新：增加了一些实用工具和功能。",
            date: "2026-01-28",
            tags: ["更新"],
            readTime: 1,
            featured: true
        },
        {
            id: 9,
            category: "公告",
            fileName: "公告/9/",
            title: "关于GitHub Issue被恶意篡改的说明",
            excerpt: "一份严肃的记录：我的 Issue 被仓库管理员篡改，真相在此。",
            date: "2026-03-04",
            tags: ["声明", "GitHub", "立场"],
            readTime: 8,
            featured: true
        },
        {
            id: 10,
            category: "公告",
            fileName: "公告/10/",
            title: "喜报",
            excerpt: "喜报！网站PV达到了111。",
            date: "2026-04-11",
            tags: ["喜报", "分析"],
            readTime: 1,
            featured: true
        },
        {
            id: 11,
            category: "公告",
            fileName: "公告/11/",
            title: "网站建议收集帖 | 欢迎来提想法",
            excerpt: "网站内容建议收集帖 · 想让我加什么/删什么？每天都会看。",
            date: "2026-04-11",
            tags: ["公告", "互动", "建议收集", "GitHub"],
            readTime: 3,
            featured: true
        },
        {
            id: 12,
            category: "公告",
            fileName: "公告/12/",
            title: "关于本站广告位的说明：为什么会有广告？以及我们不会成为\"邪恶网站\"",
            excerpt: "针对近期访客对广告位设置的疑问，本文将详细解释放置广告的原因、广告的具体形式，以及本站绝不会成为弹窗满天飞的\"邪恶网站\"的承诺。",
            date: "2026-04-23",
            tags: ["网站公告", "广告说明", "用户体验", "承诺", "FAQ"],
            readTime: 8,
            featured: true
        },
        {
            id: 13,
            category: "ACG",
            fileName: "ACG/13/",
            title: "再见了，我的白菜——写给真白花音的告别",
            excerpt: "2026年4月17日，B站第一日V真白花音宣布将于5月1日毕业。作为从2023年开始关注她的老粉，写下这篇告别文章。",
            date: "2026-04-29",
            tags: ["VTuber", "真白花音", "毕业", "告别", "V圈"],
            readTime: 6,
            featured: true
        },
        {
            id: 14,
            category: "ACG",
            fileName: "ACG/14/",
            title: "再见，白菜",
            excerpt: "2026年5月1日，真白花音正式毕业了。再见，我的第一个V，再见，白菜。",
            date: "2026-05-01",
            tags: ["VTuber", "真白花音", "毕业", "告别"],
            readTime: 2,
            featured: true
        },
        {
            id: 15,
            category: "ACG",
            fileName: "ACG/15/",
            title: "真白花音退网前最后五分钟",
            excerpt: "记录真白花音退网前的最后五分钟，永远的回忆。",
            date: "2026-05-01",
            tags: ["视频"],
            readTime: 1,
            featured: false
        },
        {
            id: 16,
            category: "教程",
            fileName: "教程/16/",
            title: "从零开始，怎么注册GitHub并克隆仓库",
            excerpt: "从零开始学习如何注册GitHub账号并克隆仓库到本地，适合完全新手。",
            date: "2026-05-07",
            tags: ["GitHub", "Git", "教程", "入门", "仓库管理"],
            readTime: 10,
            featured: true
        },
        {
            id: 17,
            category: "科技",
            fileName: "科技/17/",
            title: "优化X(Twitter)推荐算法",
            excerpt: "如何优化X(Twitter)的时间线推荐，获取更有价值的内容。",
            date: "2026-05-13",
            tags: ["X(Twitter)", "推荐算法"],
            readTime: 10,
            featured: true
        },
        {
            id: 18,
            category: "生活",
            fileName: "生活/18/",
            title: "泰式柠檬番茄酸辣炸鸡腿",
            excerpt: "酸辣开胃、香喷喷又下饭——这道泰式炸鸡腿是整个家庭的最爱！泰式辣椒酱配柠檬和番茄，一上桌孩子们就忍不住多盛一碗饭。附完整食材清单和分步做法。（转载自 lifangcook）",
            date: "2026-05-17",
            tags: ["美食", "炸鸡", "泰式料理", "家常菜", "菜谱", "转载"],
            readTime: 5,
            featured: true
        },
        {
            id: 19,
            category: "教程",
            fileName: "教程/19/",
            title: "Ren'Py 人物立绘怎么换？完整替换指南",
            excerpt: "详细教程：3种方法更换 Ren'Py 视觉小说的人物立绘，包括文件替换、代码修改和动态立绘切换，附常见问题排查。",
            date: "2026-05-22",
            tags: ["Ren'Py", "视觉小说", "立绘", "游戏开发", "教程"],
            readTime: 10,
            featured: true
        },
        {
            id: 20,
            category: "教程",
            fileName: "教程/20/",
            title: "Ren'Py 存档系统完全教程：自定义存档位置与多存档槽",
            excerpt: "深入讲解 Ren'Py 存档系统，涵盖默认存档位置、自定义存档路径、多存档槽管理、存档缩略图、加密防篡改和自动存档配置，附完整代码示例。",
            date: "2026-05-22",
            tags: ["Ren'Py", "存档系统", "游戏开发", "教程", "save"],
            readTime: 12,
            featured: true
        },
        {
            id: 21,
            category: "教程",
            fileName: "教程/21/",
            title: "Python 截图识别文字完全教程：从 Tesseract 到深度学习",
            excerpt: "完整教程：使用 Python 实现截图文字识别，涵盖 Tesseract、PaddleOCR、截图工具选型、图像预处理技巧和性能优化，附实战代码。",
            date: "2026-05-22",
            tags: ["Python", "OCR", "Tesseract", "PaddleOCR", "图像识别", "教程"],
            readTime: 15,
            featured: true
        },
        {
            id: 22,
            category: "ACG",
            fileName: "ACG/22/",
            title: "雌小鬼：从贬义词到萌属性的进化史",
            excerpt: "深度解析ACG萌属性「雌小鬼（メスガキ）」——从日语贬称到二次元文化标签的完整进化史，包含典型形象、与傲娇/小恶魔的区别、让你明白担当解析，以及典型角色一览。",
            date: "2026-06-04",
            tags: ["ACG", "萌属性", "二次元", "雌小鬼", "文化解析"],
            readTime: 10,
            featured: true
        },
        {
            id: 23,
            category: "心理学",
            fileName: "心理学/23/",
            title: "占卜的原理：心理学拆解\"为什么总觉得很准\"",
            excerpt: "超6800字深度心理学文章：从巴纳姆效应、冷读术、确认偏误、自我实现预言到安慰剂效应，用科学实验与认知科学彻底解释占卜为何让人觉得\"神准\"。批判性思维必读。",
            date: "2026-06-09",
            tags: ["心理学", "巴纳姆效应", "冷读术", "认知偏误", "科学思维", "占卜揭秘"],
            readTime: 35,
            featured: true
        },
        {
            id: 24,
            category: "心理学",
            fileName: "心理学/24/",
            title: "达克效应：为什么越无知的人越自信？",
            excerpt: "深度解析达克效应（邓宁-克鲁格效应）——从经典研究到家是本朱剑秋事件，全面拆解这条「愚昧之山」曲线，看认知偏差如何让能力低者高估自己。",
            date: "2026-06-21",
            tags: ["达克效应", "邓宁-克鲁格效应", "认知偏差", "自我认知", "社会心理学"],
            readTime: 12,
            featured: true
        },
        {
            id: 25,
            category: "心理学",
            fileName: "心理学/25/",
            title: "斯德哥尔摩效应：人质为什么会对绑匪产生感情？",
            excerpt: "从1973年瑞典银行劫案到娜塔莎·坎普施被囚八年案，揭秘受害者与加害者之间复杂情感纽带的心理学机制——创伤绑定与生存本能。",
            date: "2026-06-21",
            tags: ["斯德哥尔摩效应", "反常心理学", "受害者心理", "创伤绑定", "社会心理学"],
            readTime: 12,
            featured: true
        },
        {
            id: 26,
            category: "心理学",
            fileName: "心理学/26/",
            title: "幸存者偏差：为什么我们总是忽略失败者的声音？",
            excerpt: "从二战飞机弹孔到创业成功学——幸存者偏差全面解析。活下来的经验不一定对，失败者的沉默证据才是最有价值的信息。",
            date: "2026-06-21",
            tags: ["幸存者偏差", "认知偏误", "逻辑谬误", "批判性思维", "统计学"],
            readTime: 12,
            featured: true
        },
        {
            id: 27,
            category: "心理学",
            fileName: "心理学/27/",
            title: "踢猫效应：坏情绪是如何向下传染的？",
            excerpt: "老板骂员工，员工回家吼老婆，老婆打孩子，孩子踢猫——攻击转移与情绪溢出的心理学解析，以及如何打破这个伤害链条。",
            date: "2026-06-21",
            tags: ["踢猫效应", "情绪管理", "负面情绪", "社会心理学", "情绪传染"],
            readTime: 10,
            featured: true
        },
        {
            id: 28,
            category: "心理学",
            fileName: "心理学/28/",
            title: "蝴蝶效应：一只蝴蝶扇动翅膀如何引发一场飓风？",
            excerpt: "从混沌理论到日常生活的连锁反应——洛伦兹的偶然发现如何揭示初始条件的微小差异导致结果的巨大不同。",
            date: "2026-06-21",
            tags: ["蝴蝶效应", "混沌理论", "系统思维", "非线性思维", "复杂科学"],
            readTime: 12,
            featured: true
        },
        {
            id: 29,
            category: "心理学",
            fileName: "心理学/29/",
            title: "PTSD：创伤后应激障碍——当记忆成为伤口",
            excerpt: "深入解析PTSD的神经机制、诊断标准、症状表现与治疗路径，理解创伤如何在大脑中留下永久的印记。",
            date: "2026-06-21",
            tags: ["PTSD", "创伤后应激障碍", "创伤心理学", "心理健康", "心理咨询"],
            readTime: 15,
            featured: true
        },
        {
            id: 30,
            category: "心理学",
            fileName: "心理学/30/",
            title: "C-PTSD：复杂性创伤后应激障碍——看不见的伤口",
            excerpt: "当创伤不是一次性事件，而是漫长的、重复的、无法逃脱的经历——长期暴露于控制与虐待形成的复杂创伤反应。",
            date: "2026-06-21",
            tags: ["C-PTSD", "复杂性创伤", "童年创伤", "心理虐待", "依恋创伤"],
            readTime: 18,
            featured: true
        },
        {
            id: 31,
            category: "心理学",
            fileName: "心理学/31/",
            title: "NPD：自恋型人格障碍——镜中人的孤独",
            excerpt: "不是每个爱自拍的人都是NPD——深入解析自恋型人格的病理内核、成因与伪装。",
            date: "2026-06-21",
            tags: ["NPD", "自恋型人格障碍", "人格障碍", "心理虐待", "心理健康"],
            readTime: 16,
            featured: true
        },
        {
            id: 32,
            category: "心理学",
            fileName: "心理学/32/",
            title: "语义饱和：为什么盯着一个字看久了就不认识了？",
            excerpt: "一个熟悉的汉字盯着看30秒后突然变得陌生——这不是眼睛出了问题，而是大脑的自我保护机制。",
            date: "2026-06-21",
            tags: ["语义饱和", "认知心理学", "神经适应", "视觉感知", "语言加工"],
            readTime: 10,
            featured: true
        },
        {
            id: 33,
            category: "心理学",
            fileName: "心理学/33/",
            title: "恐怖谷效应：为什么越像人的东西越让人毛骨悚然？",
            excerpt: "当机器人与人类的相似度达到某个临界点时好感度急剧下降——森政弘的经典理论与四种科学解释。",
            date: "2026-06-21",
            tags: ["恐怖谷效应", "认知心理学", "机器人学", "进化心理学", "社会认知"],
            readTime: 13,
            featured: true
        },
        {
            id: 34,
            category: "心理学",
            fileName: "心理学/34/",
            title: "文字恐怖谷效应：当AI写的文字像人但又不完全像人",
            excerpt: "AI生成的文字语法完全正确但总有一种莫名的'不对劲'——文字版的恐怖谷效应正在发生。",
            date: "2026-06-21",
            tags: ["文字恐怖谷", "AI写作", "认知心理学", "自然语言处理", "信息加工"],
            readTime: 13,
            featured: true
        },
        {
            id: 35,
            category: "心理学",
            fileName: "心理学/35/",
            title: '"中式"恐怖：根植于文化基因的恐惧之源',
            excerpt: "不同于欧美的血浆和日式的压抑——中式恐怖有着独特的文化根源：家庭伦理、因果报应、集体记忆中的禁忌。",
            date: "2026-06-21",
            tags: ["中式恐怖", "文化心理学", "民俗心理", "恐怖美学", "集体潜意识"],
            readTime: 14,
            featured: true
        },
        {
            id: 47,
            category: "生活",
            fileName: "生活/47/",
            title: "关于性别话题的一些想法",
            excerpt: "一个普通初中生对网上某些讨论的个人观察和困惑。纯主观想法，不带节奏，理性交流喵～",
            date: "2026-06-22",
            tags: ["个人观点", "日常思考", "友好交流"],
            readTime: 5,
            featured: false
        },
        {
            id: 48,
            category: "生活",
            fileName: "生活/48/",
            title: "红烧五花肉——入口即化的幸福",
            excerpt: "红烧五花肉，肥而不腻、入口即化，是家庭聚餐的明星菜！详细步骤教你做出餐厅级别的红烧肉。",
            date: "2026-06-22",
            tags: ["美食", "红烧肉", "中式菜肴", "家常菜", "菜谱"],
            readTime: 8,
            featured: true
        },
        {
            id: 49,
            category: "生活",
            fileName: "生活/49/",
            title: "蒜蓉西兰花——健康又美味的快手菜",
            excerpt: "蒜蓉西兰花，健康又美味的快手菜！西兰花爽脆，蒜香浓郁，是一道适合任何餐桌的素食佳肴。",
            date: "2026-06-22",
            tags: ["美食", "西兰花", "健康素食", "快手菜", "菜谱"],
            readTime: 4,
            featured: true
        },
        {
            id: 36,
            category: "心理学",
            fileName: "心理学/36/",
            title: '"我的父亲是一扇门"——被误解的精神分裂症',
            excerpt: "从小红书经典怪谈出发，深度解析精神分裂症的真实面貌——它不是'多重人格'，而是世界上最孤独的疾病之一。原帖并非关于父亲，而是关于发帖人自身可能存在的精神疾病感知障碍。",
            date: "2026-06-21",
            tags: ["精神分裂症", "被误解的精神疾病", "贴吧故事", "心理健康", "去污名化"],
            readTime: 20,
            featured: true
        },
        {
            id: 37,
            category: "心理学",
            fileName: "心理学/37/",
            title: '被误解的"超雄综合征"：染色体不是你的命运',
            excerpt: "超雄综合征长期被错误贴上'天生犯罪基因'的标签——还原这个科学谬误背后的真相与不公。",
            date: "2026-06-21",
            tags: ["超雄综合征", "XYY综合征", "基因歧视", "被误解的医学", "产前诊断"],
            readTime: 14,
            featured: true
        },
        {
            id: 38,
            category: "心理学",
            fileName: "心理学/38/",
            title: "躯体化现象：当心理的痛苦说不出来，身体就会替你说",
            excerpt: "为什么长期压力会导致胃痛？你的身体是你最诚实的翻译官——东方文化中特有的躯体化现象。",
            date: "2026-06-21",
            tags: ["躯体化", "心身医学", "心理防御机制", "躯体症状障碍", "跨文化心理学"],
            readTime: 15,
            featured: true
        },
        {
            id: 39,
            category: "心理学",
            fileName: "心理学/39/",
            title: '"地雷妹"现象深度分析：可爱外表下的脆弱心灵',
            excerpt: "拨开猎奇和污名化的标签，理解这些隐藏在可爱笑容之下的破碎灵魂——从心理学角度看'地雷系女子'。",
            date: "2026-06-21",
            tags: ["地雷妹", "地雷系女子", "心理创伤", "自伤行为", "亚文化心理"],
            readTime: 16,
            featured: true
        },
        {
            id: 40,
            category: "心理学",
            fileName: "心理学/40/",
            title: '"OD"：不只是"想死"——过度服药背后的心理真相',
            excerpt: "OD不是简单的自杀行为，而是一种在无法承受的心理痛苦中发出的求救信号。",
            date: "2026-06-21",
            tags: ["OD", "过量服药", "自伤行为", "青少年危机", "心理急救"],
            readTime: 14,
            featured: true
        },
        {
            id: 41,
            category: "心理学",
            fileName: "心理学/41/",
            title: '"改花刀"——当刀口成为无法言说的语言',
            excerpt: "自伤行为（NSSI）的心理机制——为何有人要用伤害身体的方式来忍受心理的痛苦？",
            date: "2026-06-21",
            tags: ["改花刀", "自伤", "非自杀性自伤", "情绪调节", "青少年心理危机"],
            readTime: 14,
            featured: true
        },
        {
            id: 42,
            category: "心理学",
            fileName: "心理学/42/",
            title: "致家长：警惕小升初阶段儿童的心理健康危机",
            excerpt: "小升初（11-13岁）是儿童心理发展的关键敏感期，也是CPTSD和自伤行为的高发期。",
            date: "2026-06-21",
            tags: ["小升初", "儿童心理健康", "家长教育", "青春期", "亲子沟通"],
            readTime: 17,
            featured: true
        },
        {
            id: 43,
            category: "心理学",
            fileName: "心理学/43/",
            title: '"脑控组织"现象——当精神疾病被误解为超自然力量',
            excerpt: "当精神疾病被误解为超自然力量——从'脑控组织'看被害妄想和思维被控制感的精神医学本质。",
            date: "2026-06-21",
            tags: ["脑控组织", "被害妄想", "精神分裂症", "妄想症", "思维被控制"],
            readTime: 15,
            featured: true
        },
        {
            id: 44,
            category: "心理学",
            fileName: "心理学/44/",
            title: "被害妄想症专题：当整个世界都在与你作对",
            excerpt: "从日常多疑到临床被害妄想——这条界线在哪？当怀疑变成不可动摇的信念时会发生什么。",
            date: "2026-06-21",
            tags: ["被害妄想症", "妄想性障碍", "精神分裂症", "精神病学", "偏执型人格"],
            readTime: 16,
            featured: true
        },
        {
            id: 45,
            category: "心理学",
            fileName: "心理学/45/",
            title: "微表情心理学：脸上藏不住的0.04秒真相",
            excerpt: "从保罗·艾克曼的奠基研究到美剧《别对我说谎》——微表情真的能准确揭示真实情绪吗？",
            date: "2026-06-21",
            tags: ["微表情", "面部表情", "保罗·艾克曼", "情绪识别", "非语言沟通"],
            readTime: 14,
            featured: true
        },
        {
            id: 46,
            category: "心理学",
            fileName: "心理学/46/",
            title: "如何判断一个人是否在说谎？——以及我为什么走上了心理学的道路",
            excerpt: "从科学的角度拆解读谎的真相——以及本系列最后一篇文章中，分享对心理学产生浓厚兴趣的个人故事与感悟。",
            date: "2026-06-21",
            tags: ["测谎", "说谎心理学", "行为分析", "个人感悟", "心理学入门"],
            readTime: 18,
            featured: true
        },
        {
            id: 50,
            category: "ACG",
            fileName: "ACG/50/",
            title: "樱花校园模拟器：桃子组神秘房间通关攻略",
            excerpt: "桃子组神秘房间通关视频攻略，直接看视频。",
            date: "2026-06-26",
            tags: ["樱花校园模拟器", "桃子组", "游戏攻略", "视频"],
            readTime: 1,
            featured: true
        },
                {
            id: 52,
            category: "生活",
            fileName: "生活/52/",
            title: "从 UTAU 到心理学——我的 51 篇文章进化路",
            excerpt: "一个初中生写作者从2025年12月到2026年6月，51篇文章的写作风格演变全记录。从UTAU教程、闲聊碎碎念，到告别白菜的情感宣泄，再到24篇心理学系列的井喷——回顾这9个月的写作轨迹。",
            date: "2026-06-29",
            tags: ["个人回顾", "写作进化", "总结", "心理学", "教程"],
            readTime: 12,
            featured: true,
        },
        {
            id: 53,
            category: "ACG",
            fileName: "ACG/53/",
            title: "病娇（ヤンデレ）：从萌属性到心理剖析",
            excerpt: "深入解析ACG文化中经典萌属性「病娇（ヤンデレ）」——从《School Days》到《未来日记》，从病态的定义到社会反响，带你理解这个让人又爱又怕的属性。",
            date: "2026-06-29",
            tags: ["病娇", "ヤンデレ", "ACG", "萌属性", "二次元", "文化解析"],
            readTime: 15,
            featured: true
        },
        {
            id: 54,
            category: "心理学",
            fileName: "心理学/54/",
            title: "为什么儿童会对高饱和度上瘾？——从脑腐到Cocomelon的色彩心理学",
            excerpt: "为什么婴幼儿玩具几乎都是高饱和的鲜艳色系？色彩对孩子的大脑发育有什么影响？从进化心理学到脑腐（烂梗），从Cocomelon到蒙台梭利教具，深度解析高饱和度色彩对儿童认知的影响。",
            date: "2026-06-30",
            tags: ["色彩心理学", "儿童发展", "高饱和度", "脑腐", "烂梗", "Cocomelon", "视觉发育"],
            readTime: 15,
            featured: true
        },
        {
            id: 55,
            category: "生活",
            fileName: "生活/55/",
            title: "我的音乐品味三年进化史（2023-2026）",
            excerpt: "从2023年7月到2026年7月，三年间收藏的180+首歌完整回顾——从洗脑神曲到Vocaloid电波系，从DDLC OST到俄语硬曲，记录一个初中生的音乐品味进化之路。",
            date: "2026-07-01",
            tags: ["音乐", "品味", "个人回顾", "歌单", "Vocaloid", "OST"],
            readTime: 15,
            featured: true
        },
        {
            id: 56,
            category: "教程",
            fileName: "教程/22/",
            title: "调色教程——复古蒸汽波",
            excerpt: "Lightroom Classic复古蒸汽波调色教程：完整影调+HSL+校准+颗粒参数，附带3个调色板方案和霓虹街头拍摄选址指南，一键复刻赛博浪漫。",
            date: "2026-07-04",
            tags: ["Lightroom", "调色教程", "蒸汽波", "Vaporwave", "霓虹", "摄影"],
            readTime: 5,
            featured: true
        },
        {
            id: 57,
            category: "生活",
            fileName: "生活/57/",
            title: "浪漫文案？那是词语废料——当朋友圈文案变成「1+1=2 uxdjdbskakdbs」",
            excerpt: "现在的朋友圈浪漫文案全是词语废料——前言不搭后语，逻辑混乱像乱码。当「今天天气不错，我喜欢你」配上不露脸自拍成为标准模板，浪漫已经不是浪漫，是SEO。",
            date: "2026-07-04",
            tags: ["浪漫文案", "朋友圈", "批判", "词语废料", "逻辑", "社交媒体"],
            readTime: 5,
            featured: true
        },
        {
            id: 58,
            category: "ACG",
            fileName: "ACG/58/",
            title: "永雏塔菲真的夹不动了吗？——六年声线演变全记录",
            excerpt: "从2020到2026，横跨黑桃影时期和永雏塔菲时期，用三段音频切片+三张声纹图，科学分析塔菲的「夹子音」到底还在不在。答案可能和你想的不一样——不是她夹不动了，是你的塔语太好了。",
            date: "2026-07-05",
            tags: ["永雏塔菲", "VTuber", "声线分析", "夹子音", "塔语", "黑桃影", "声纹"],
            readTime: 8,
            featured: true
        },
        {
            id: 59,
            category: "公告",
            fileName: "公告/web/",
            title: "网站大更新！2026年7月7日更新日志",
            excerpt: "测试基础设施上线、修复30+处路径错误、52处外链安全加固——断裂链接从35条降到12条，全站性能和安全性大幅提升。",
            date: "2026-07-07",
            tags: ["更新日志", "测试", "修复", "安全", "网站公告"],
            readTime: 4,
            featured: true
        },
        {
            id: 60,
            category: "教程",
            fileName: "教程/60/",
            title: "git commit -m \"1\"——你的项目历史正在被一个字符毁掉",
            excerpt: "犀利拆解为什么「git commit -m 1」短期能忍，长期是慢性自杀。一个人写的时候可以偷懒，但项目一旦认真起来，每一个'1'都是在给未来的自己挖坑。",
            date: "2026-07-10",
            tags: ["Git", "commit", "最佳实践", "版本控制", "GitHub", "教程"],
            readTime: 5,
            featured: true
        },
        {
            id: 61,
            category: "公告",
            fileName: "公告/61/",
            title: "暑期更新频率调整说明",
            excerpt: "关于2026暑假期间更新频率降低的通知——学业繁忙，摸鱼旅游，偶尔码字，9月归来。",
            date: "2026-07-10",
            tags: ["网站公告", "更新计划", "暑假", "降频"],
            readTime: 2,
            featured: true
        },
        {
            id: 62,
            category: "医学",
            fileName: "医学/62/",
            title: "阿斯伯格综合征 ",
            excerpt: "什么是阿斯伯格综合征（AS）？阿斯伯格综合征的症状、诊断、治疗方法以及生活建议。了解AS的特征和应对策略，帮助患者及其家人更好地理解和支持。",
            date: "2026-07-15",
            tags: ["医学", "神经发育障碍", "孤独症"],
            readTime: 5,
            featured: false
        },
        {
            id: 63,
            category: "心理学",
            fileName: "心理学/63/",
            title: "什么是 LGBT？——从心理学理解性少数群体的存在",
            excerpt: "什么是 LGBT？为什么会有同性恋和跨性别者？从心理学与生物学的角度，科学解读性取向与性别认同的多样性，并呼吁相互尊重。",
            date: "2026-07-21",
            tags: ["LGBT", "性少数群体", "同性恋", "跨性别", "心理学", "性取向", "性别认同", "科普"],
            readTime: 15,
            featured: true
        },
        {
            id: 64,
            category: "科技",
            fileName: "科技/64/",
            title: "16位, 32位, 64位操作系统, 都是什么东西",
            excerpt: "从8位到64位，操作系统的'位'到底代表什么？寄存器、地址总线、内存限制——用最直白的语言拆解电脑位数的一切。看完这篇你就懂了。",
            date: "2026-07-23",
            tags: ["科技", "计算机原理", "操作系统", "16位", "32位", "64位", "CPU架构", "科普", "内存"],
            readTime: 12,
            featured: true
        },
        {
            id: 65,
            category: "教程",
            fileName: "教程/65/",
            title: "从0开始，用HTML和SQL和PHP做一个最简陋的论坛",
            excerpt: "一篇面向完全新手的论坛搭建指南。从HTML、PHP、SQL的基础概念讲起，到买服务器、写前端后端、发布上线，最后聊聊备案、SEO、防DDoS——帮你从一个会打开浏览器的人，变成能搭出论坛的人。",
            date: "2026-07-24",
            tags: ["PHP", "HTML", "SQL", "论坛", "服务器", "后端", "前端", "教程"],
            readTime: 50,
            featured: true
        },
        {
            id: 66,
            category: "小说",
            fileName: "小说/66/",
            title: "短篇-666.exe",
            excerpt: "一个关于五个国家（C/D/E/A/K）的数字世界短篇故事。银狐病毒悄悄潜入，一场无声的战争正在上演……",
            date: "2026-07-27",
            tags: ["小说", "短篇", "科幻", "数字世界", "银狐病毒", "原创"],
            readTime: 10,
            featured: true
        },
        {
            id: 67,
            category: "ACG",
            fileName: "ACG/67/",
            title: "Ciallo~(∠・ω< )⌒★ —— 柚子社的二次元问候语",
            excerpt: "Ciallo 到底是什么？为什么柚子厨见面就要喊 Ciallo~？从《魔女的夜宴》因幡巡的自创问候到柚子厨接头暗号，一文讲清这个二次元圈最知名问候语的起源、传播和影响。",
            date: "2026-07-28",
            tags: ["Ciallo", "柚子社", "YUZU SOFT", "魔女的夜宴", "因幡巡", "ACG文化", "二次元"],
            readTime: 8,
            featured: true
        },
        {
            id: 68,
            category: "ACG",
            fileName: "ACG/68/",
            title: "0721 —— 柚子厨心照不宣的数字暗号",
            excerpt: "为什么一提到 0721 柚子厨就会心一笑？绫地宁宁、图书馆桌角和那个隐晦的数字谐音——柚子社粉丝圈最经久不衰的数字梗全解析。",
            date: "2026-07-28",
            tags: ["0721", "柚子社", "YUZU SOFT", "魔女的夜宴", "绫地宁宁", "数字梗"],
            readTime: 7,
            featured: true
        },
        {
            id: 69,
            category: "科技",
            fileName: "科技/69/",
            title: "CMD —— 命令提示符，Windows 的灵魂之窗",
            excerpt: "从 MS-DOS 时代到 Windows 11，那个黑底白字的窗口为什么至今仍被开发者使用？CMD 的历史、常用命令和它与本站域名的故事。",
            date: "2026-07-28",
            tags: ["CMD", "命令提示符", "Windows", "MS-DOS", "命令行", "电脑知识"],
            readTime: 8,
            featured: true
        },
        {
            id: 70,
            category: "ACG",
            fileName: "ACG/70/",
            title: "悼念吉他手 猫月めい",
            excerpt: "2026年7月26日，年仅25岁的吉他手猫月めい（MEI）离世。距她的生日演唱会 猫月めい 仅剩三天。她是终末的钻石的吉他手，也是 BanG Dream! 企划的支援乐手。谨以此文纪念那位在舞台上闪闪发光的女孩。",
            date: "2026-07-28",
            tags: ["猫月めい", "MEI", "终末的钻石", "BanG Dream!", "悼念", "RIP", "Ave Mujica", "millsage"],
            readTime: 8,
            featured: true
        },
        {
            id: 71,
            category: "医学",
            fileName: "医学/71/",
            title: "什么是猝死？年轻人为什么也会猝死？科学预防与警示",
            excerpt: "猝死到底是什么？为什么看似健康的年轻人也会猝死？有哪些预警信号？普通人该怎么预防？从猫月めい的离世说起，一文讲清猝死的医学真相。",
            date: "2026-07-28",
            tags: ["猝死", "心源性猝死", "心脏骤停", "预防", "年轻人猝死", "医学科普", "急救", "黄金四分钟"],
            readTime: 12,
            featured: true
        },
        {
            id: 72,
            category: "闲聊",
            fileName: "闲聊/72/",
            title: "NN 聊天室 —— 一个 Flask 项目的血泪修复史",
            excerpt: "从「注册卡十分钟没反应」到「图片显示成'图片'标题」，从「E2E 加密后乱码」到「彻底关掉加密全明文」——记录一个初中生自建聊天室的所有踩坑与修复。",
            date: "2026-07-28",
            tags: ["项目记录", "Flask", "WebSocket", "Bug 修复", "SQLite", "NN 聊天室", "玻璃拟态"],
            readTime: 8,
            featured: true
        },
        {
            id: 73,
            category: "日记",
            fileName: "日记/73/",
            title: "2026年7月29日",
            excerpt: "把全站 404 页面整个推倒重做了——从普通版改成了 ASCII art + 赛博朋克风，用「4」拼出 4、用「0」拼出 0，组合成大号「404」霓虹标语。",
            date: "2026-07-29",
            tags: ["日记", "404 改造", "ASCII art", "网站", "CSS 动画"],
            readTime: 2,
            featured: false
        },
        {
            id: 74,
            category: "公告",
            fileName: "公告/74/",
            title: "一个决定",
            excerpt: "从2026年8月1日起，我永久停止对政治的写作。原因有三：合法性、学识、今后。保留文章9，下架文章51。",
            date: "2026-08-01",
            tags: ["公告", "声明", "决定"],
            readTime: 4,
            featured: true
        },
        {
            id: 75,
            category: "闲聊",
            fileName: "闲聊/75/",
            title: "测试付费文章功能",
            excerpt: "付费文章功能测试文章。测试期间请勿付费，如需查看请联系站长获取测试key。",
            date: "2026-08-02",
            tags: ["测试", "付费文章", "新功能"],
            readTime: 1,
            featured: false
        },
        {
            id: 76,
            category: "生活",
            fileName: "生活/76/",
            title: "我与AI",
            excerpt: "我与AI在Minecraft里的日子——Numen mod × DeepSeek V4 Flash × NeoForge 1.21.8，19张截图记录taffy从怕苦力怕到会道晚安。",
            date: "2026-08-19",
            tags: ["Minecraft", "Numen", "DeepSeek", "AI", "NeoForge", "我的世界", "我与AI"],
            readTime: 2,
            featured: true
        },
        {
            id: 77,
            category: "生活",
            fileName: "生活/77/",
            title: "【个人记录】关于B站用户“雪ing江西省郑丽婷”的发现与追踪",
            excerpt: "【个人记录】关于B站用户“雪ing江西省郑丽婷”的发现与追踪 记录开始于2025年12月12日，随发现持续更新 一、我是怎么注意到这个人的？ 前几天我在B站闲逛的时候，偶然点进了一…",
            date: "2026-08-20",
            tags: ["bilibili", "lost media", "精神疾病"],
            readTime: 6,
            featured: true
        },
        {
            id: 78,
            category: "教程",
            fileName: "教程/78/",
            title: "13天赚到1000万坤币,成为坤城首付(打工模拟器秘籍)",
            excerpt: "不聊虚的,不用任何修改器,13个游戏天,赚到1000万",
            date: "2026-08-20",
            tags: ["打工模拟器", "教程", "赚钱"],
            readTime: 7,
            featured: true
        },
        {
            id: 79,
            category: "教程",
            fileName: "教程/79/",
            title: "怎么写好文章",
            excerpt: "怎么写好文章",
            date: "2026-08-26",
            tags: ["文章", "写作"],
            readTime: 9,
            featured: true
        },
        {
            id: 80,
            category: "心理学",
            fileName: "心理学/80/",
            title: "锐评“BV1yRFQzqEyo”和“游乐园在前面左边”这个人",
            excerpt: "一篇从心理学视角，对“读书先看作者性别”言论的深度拆解。用认知行为疗法、防御机制等工具，剖析其中的绝对化、二极管、投射等七重认知谬误，并以《实践论》《论持久战》等经典作为反例，论证“思想的价值与性别无关”。言辞激烈，逻辑在线。",
            date: "2026-09-01",
            tags: ["心理学", "认知偏差", "性别批判", "逻辑谬误", "阅读思考", "社会评论"],
            readTime: 11,
            featured: true
        },
];
        return raw.sort(function(a, b) { return a.id - b.id; });
    })(),
    // ██ 辅助方法 ██
    getArticleById: function(id) {
        return this.articles.find(function(a) { return a.id === id; });
    },
    getAdjacentArticles: function(id) {
        var idx = this.articles.findIndex(function(a) { return a.id === id; });
        if (idx === -1) return { prev: null, next: null };
        return {
            prev: idx > 0 ? this.articles[idx - 1] : null,
            next: idx < this.articles.length - 1 ? this.articles[idx + 1] : null
        };
    },
    getSortedArticles: function() {
    return this.articles.slice().sort(function(a, b) {
        // 先按日期倒序
        var dateDiff = new Date(b.date) - new Date(a.date);

        // 日期不同直接返回
        if (dateDiff !== 0) {
            return dateDiff;
        }

        // 同一天按文章ID倒序
        return b.id - a.id;
    });
},
    getFeaturedArticles: function(excludeId, limit) {
        if (limit === undefined) limit = 3;
        return this.articles
            .filter(function(a) { return a.id !== excludeId && a.featured; })
            .slice(0, limit);
    }
};
