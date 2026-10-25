/* ============================================================
   凶宅试睡员 · maps.js
   数据层：房间类型 / 5 张户型 / 5 个背景 / 任务池 / 物品 / 手册
   ============================================================ */
window.XZ = window.XZ || {};
(function (XZ) {
  'use strict';

  /* ---------------- 房间类型 ---------------- */
  // floor / ceil 用顶点色烘进合并网格；open=true 不封天花板（露天阳台）
  XZ.ROOM = {
    hall:    { name: '玄关走廊', floor: 0x5c4634, ceil: 0x2a2622 },
    living:  { name: '客厅',     floor: 0x7a5a3c, ceil: 0x322c26 },
    master:  { name: '主卧',     floor: 0x6a4c34, ceil: 0x302a24 },
    second:  { name: '次卧',     floor: 0x5e4430, ceil: 0x2c2622 },
    kitchen: { name: '厨房',     floor: 0x6c6c70, ceil: 0x33333a },
    toilet:  { name: '厕所',     floor: 0x767680, ceil: 0x34343c },
    storage: { name: '储物间',   floor: 0x4f4a44, ceil: 0x282624 },
    study:   { name: '书房',     floor: 0x62452e, ceil: 0x2e2822 },
    esports: { name: '电竞房',   floor: 0x4a4552, ceil: 0x2a2830 },
    balcony: { name: '露天阳台', floor: 0x56565c, ceil: 0x2a2a2e, open: true }
  };

  /* ---------------- 5 张户型 ----------------
     坐标系：格子 1m，x 向右、y 向下（映射到世界 z）。
     房间之间固定留 1 格实墙，跨过这格自动开门（build.js 里 flood 校验）。
     spawn 用格子坐标，build 时取格子中心。                       */
  XZ.MAPS = [
    {
      id: 'm1',
      name: '城郊两居 · 201 室',
      addr: 'A 市 云溪路 47 弄 3 号楼 201',
      area: 68,
      year: 1998,
      desc: '砖混老楼，两室一厅。墙皮一抠就掉渣，阳台被前任住户用铝合金窗封死了。楼道声控灯三天坏两天。',
      w: 23, h: 18,
      spawn: { x: 11, y: 15 },
      rooms: [
        { id: 'hall',    type: 'hall',    x: 10, y: 1,  w: 3, h: 16 },
        { id: 'master',  type: 'master',  x: 2,  y: 2,  w: 7, h: 5 },
        { id: 'toilet',  type: 'toilet',  x: 2,  y: 8,  w: 7, h: 3 },
        { id: 'living',  type: 'living',  x: 2,  y: 12, w: 7, h: 5 },
        { id: 'second',  type: 'second',  x: 14, y: 2,  w: 8, h: 5 },
        { id: 'storage', type: 'storage', x: 14, y: 8,  w: 8, h: 3 },
        { id: 'kitchen', type: 'kitchen', x: 14, y: 12, w: 8, h: 5 }
      ]
    },
    {
      id: 'm2',
      name: '电梯三居 · 1102 室',
      addr: 'A 市 锦绣家园 6 栋 1102',
      area: 96,
      year: 2011,
      desc: '十一层，南北通透。装修是十年前的风格，主卧衣柜后墙有一大块霉斑，物业说楼上漏水，楼上说没有。',
      w: 27, h: 19,
      spawn: { x: 13, y: 17 },
      rooms: [
        { id: 'hall',    type: 'hall',    x: 12, y: 4,  w: 3, h: 16 },
        { id: 'storage', type: 'storage', x: 12, y: 1,  w: 3, h: 2 },
        { id: 'master',  type: 'master',  x: 2,  y: 2,  w: 9, h: 5 },
        { id: 'toilet',  type: 'toilet',  x: 2,  y: 8,  w: 9, h: 3 },
        { id: 'living',  type: 'living',  x: 2,  y: 12, w: 9, h: 6 },
        { id: 'second',  type: 'second',  x: 16, y: 2,  w: 9, h: 5 },
        { id: 'kitchen', type: 'kitchen', x: 16, y: 8,  w: 9, h: 4 },
        { id: 'second2', type: 'second',  x: 16, y: 13, w: 9, h: 5, name: '儿子的房间' }
      ]
    },
    {
      id: 'm3',
      name: '城中村自建 · 顶楼',
      addr: 'A 市 后浦村 12 号 顶楼',
      area: 84,
      year: 2004,
      desc: '自建房顶楼加盖，夏天四十度。露台没装护栏门，一脚踩空就是四层楼。水压低得洗澡要等。',
      w: 27, h: 22,
      spawn: { x: 13, y: 19 },
      rooms: [
        { id: 'hall',    type: 'hall',    x: 12, y: 4,  w: 3, h: 18 },
        { id: 'master',  type: 'master',  x: 2,  y: 2,  w: 9, h: 5 },
        { id: 'toilet',  type: 'toilet',  x: 2,  y: 8,  w: 4, h: 4 },
        { id: 'kitchen', type: 'kitchen', x: 7,  y: 8,  w: 4, h: 4 },
        { id: 'living',  type: 'living',  x: 2,  y: 13, w: 9, h: 6 },
        { id: 'second',  type: 'second',  x: 16, y: 2,  w: 7, h: 5 },
        { id: 'storage', type: 'storage', x: 16, y: 8,  w: 4, h: 3 },
        { id: 'second2', type: 'second',  x: 16, y: 13, w: 10, h: 5, name: '儿子的房间' },
        { id: 'balcony', type: 'balcony', x: 16, y: 19, w: 10, h: 2 }
      ]
    },
    {
      id: 'm4',
      name: 'Loft 改造 · 独立电竞间',
      addr: 'A 市 创智园公寓 B 座 706',
      area: 78,
      year: 2019,
      desc: '商改住，层高四米二，房东隔了个夹层。主卧外面接了个小露台，栏杆只到腰。电竞房三面都是隔音棉，门一关，外面敲玻璃你都听不见。',
      w: 27, h: 24,
      spawn: { x: 13, y: 18 },
      rooms: [
        { id: 'hall',    type: 'hall',    x: 12, y: 4,  w: 3, h: 17 },
        { id: 'balcony', type: 'balcony', x: 2,  y: 21, w: 9, h: 2 },
        { id: 'living',  type: 'living',  x: 2,  y: 2,  w: 9, h: 6 },
        { id: 'kitchen', type: 'kitchen', x: 2,  y: 9,  w: 9, h: 4 },
        { id: 'master',  type: 'master',  x: 2,  y: 14, w: 9, h: 6 },
        { id: 'second',  type: 'second',  x: 16, y: 2,  w: 9, h: 5 },
        { id: 'esports', type: 'esports', x: 16, y: 8,  w: 9, h: 5 },
        { id: 'toilet',  type: 'toilet',  x: 16, y: 14, w: 4, h: 3 },
        { id: 'storage', type: 'storage', x: 21, y: 14, w: 4, h: 3 },
        { id: 'study',   type: 'study',   x: 16, y: 18, w: 9, h: 3 }
      ]
    },
    {
      id: 'm5',
      name: '独栋六口宅 · 老周家',
      addr: 'A 市 梧桐巷 9 号',
      area: 148,
      year: 1987,
      desc: '巷子最深的那一栋。铁门锈得推不动，院子里长到腰高的草。九个房间，六个人，同一天。',
      w: 29, h: 25,
      spawn: { x: 14, y: 21 },
      rooms: [
        { id: 'hall',    type: 'hall',    x: 13, y: 4,  w: 3, h: 19 },
        { id: 'living',  type: 'living',  x: 2,  y: 2,  w: 10, h: 7 },
        { id: 'kitchen', type: 'kitchen', x: 2,  y: 10, w: 10, h: 4 },
        { id: 'toilet',  type: 'toilet',  x: 2,  y: 15, w: 10, h: 3 },
        { id: 'master',  type: 'master',  x: 2,  y: 19, w: 10, h: 5 },
        { id: 'second',  type: 'second',  x: 17, y: 2,  w: 11, h: 5 },
        { id: 'study',   type: 'study',   x: 17, y: 8,  w: 11, h: 4 },
        { id: 'esports', type: 'esports', x: 17, y: 13, w: 11, h: 4 },
        { id: 'storage', type: 'storage', x: 17, y: 18, w: 11, h: 3 },
        { id: 'balcony', type: 'balcony', x: 17, y: 22, w: 11, h: 2 }
      ]
    }
  ];

  /* ---------------- 5 个背景 / 难度 ---------------- */
  // room: 灵异触发点（room id）。events 由 game.js 按 level 解释。
  XZ.BGS = [
    {
      id: 'b1', maps: ['m1'], level: '轻', levelTag: '自然死亡 · 无恶意', families: ['light'],
      ghost: '张冯', years: '1948.3.8 — 2025.4.6', died: '2025 年 4 月 6 日',
      cause: '胃癌晚期 · 自然死亡',
      deathRoom: 'master', triggers: ['master'],
      color: 0x9fb8c8,
      title: '他撑了十年，就为了等一个不回来的人',
      story: [
        '张冯，1948 年 3 月 8 日生，A 市本地人，退休前是印刷厂排版工。',
        '老伴走得早。2015 年，一儿一女都去了外地，走的时候说「爸，等安顿好了就接你过去」。这句话之后再没兑现。屋子里的座钟、收音机、黑白电视、掉漆的五斗柜，都是他这辈子没舍得扔的东西。他不会用智能手机，也不爱看电视，每天就是收音机 + 手工 + 楼下晒太阳。',
        '2014 年 9 月 8 日，他查出肚子里有个肿瘤。医生说得委婉，他听懂了，回家把诊断书塞进床底下的铁盒子，谁也没告诉。',
        '之后十年，他一个人在这个屋子里，慢慢瘦成一把骨头。2025 年 4 月 6 日清晨，邻居闻到味道不对，撞开门——他躺在床上，被子盖得整整齐齐，收音机还在响，频道停在戏曲台。',
        '他没有任何怨气。他连死都是在等，不是在恨。',
        '这户不伤人。他只是还在等，等一个人推门进来说「爸，我来接你了」。'
      ]
    },
    {
      id: 'b2', maps: ['m2'], level: '中', levelTag: '非正常死亡 · 怨', families: ['mid'],
      ghost: '王艳芳', years: '1988.9.2 — 2026.7.1', died: '2026 年 7 月 1 日',
      cause: '上吊 · 自杀',
      deathRoom: 'master', triggers: ['living', 'master'],
      color: 0xb08a9a,
      title: '她不是想死，她是没路走了',
      story: [
        '王艳芳，1988 年 9 月 2 日生，G 工厂流水线工人，月薪两千。',
        '前些年离了婚，儿子判给了丈夫。她一个人租在这间屋里，工资一大半交房租，剩下的钱舍不得吃舍不得穿，全花在那个叫「S」的偶像身上——墙上贴满海报，床头摆着应援灯牌，那是她一周里唯一笑得出来的事。',
        '2026 年 4 月 1 日，厂子裁员，她在名单上。之后三个月，简历投出去石沉大海，年龄卡在三十八，工厂嫌她老，写字楼嫌她没学历。',
        '6 月 2 日，精神科诊断：重度抑郁。她在群里发过一句「我好像真的不行了」，没人回。',
        '7 月 1 日晚上，她在客厅的吊灯钩上系了根绳子。手机还开着，循环播放 S 的那首歌。',
        '她不是恶鬼。她只是走得很难看，很不甘，很吵。',
        '这户会闹：抓腿、跳闸、电视自己开、浅眠时看见人形在走。不会要你的命——她要的只是有人听她说完。'
      ]
    },
    {
      id: 'b3', maps: ['m4'], level: '高', levelTag: '横死 · 附身', families: ['high'],
      ghost: '郑德尘', years: '2008.8.4 — 2020.1.6', died: '2020 年 1 月 6 日',
      cause: '他杀 · 菜刀砍击头部',
      deathRoom: 'master', triggers: ['esports', 'master', 'kitchen'],
      color: 0x8f9f6a,
      title: '他在游戏里赢了一把，输了一辈子',
      story: [
        '郑德尘，2008 年 8 月 4 日生。父母在外地打工，他一个人住，网瘾，但不至于废——饿了会自己下楼买菜做饭，只是锅常年糊。',
        '他打 PUBG，也打 CS2。2020 年 1 月 5 日夜里，一局排位，他把对面一个成年男人用拳头补了。对面在公屏骂了半宿，然后开了他的盒——真实姓名、住址、学校、父母电话，全扒出来了。',
        '1 月 6 日下午，那个人按着地址找上门。门没锁。他从厨房拿了那把切菜的刀，走进主卧。',
        '郑德尘当时戴着耳机，屏幕上还在跑跳伞动画。',
        '凶手判了无期。屋子里剩下一台还开着的电脑、一把没洗的刀、和满墙没撕的电竞海报。',
        '这户会附身：电竞房的电脑一开，你就不是你了。主卧的床上，他会托梦让你别躺。厨房里，千万、千万别碰刀。'
      ]
    },
    {
      id: 'b4', maps: ['m5'], level: '噩梦', levelTag: '灭门 · 六亡', families: ['chase'],
      ghost: '周家六口', years: '1987 — 2022.5.2', died: '2022 年 5 月 2 日',
      cause: '灭门 · 凶手在逃',
      deathRoom: 'master', triggers: ['toilet', 'kitchen', 'master', 'second', 'living'],
      color: 0xa8443c,
      title: '凶手至今没找到',
      story: [
        '周氏逢（1987.2.2 — 2022.5.2），周夏富（1989.9.6 — 2022.5.2），儿子周戴皋（2013.5.5 — 2022.5.2），女儿周富贵（2013.5.24 — 2022.5.2），爷爷周腊莺（1956.3.21 — 2022.5.2），奶奶周凯丹（1957.9.6 — 2022.5.2）。',
        '六个人，同一个死亡日期。',
        '2022 年 5 月 2 日傍晚，一家六口在自家大门口。监控拍到一个人影走进去，手里有东西，反光。之后的十七分钟，监控什么都没拍到——摄像头被人先一步拧向了墙。',
        '邻居说听见了喊叫，很短，然后就没声音了。警察到时，门槛上的血已经渗进水泥缝里，冲不掉。',
        '凶手逃了。四年了，没有落网。',
        '这户不问规矩。五个房间，哪个房间触发，哪个房间就是灵异现场。它们不是在吓你，它们是在找那个还活着的人。',
        '别让他们认错人。'
      ]
    }
  ];

  /* ---------------- 任务池 ---------------- */
  // reset: 'day' 表示每天重置进度；'run' 表示整局累计
  XZ.TASKS = [
    { id: 'shoot',   name: '九区取证', desc: '给每个区域各拍一张照',                icon: '📷', per: 'day' },
    { id: 'toilet',  name: '厕所试胆', desc: '在厕所里待满 5 分钟',                  icon: '🚽', per: 'day', need: 5 },
    { id: 'cook',    name: '下厨取证', desc: '在厨房做一顿饭，并拍照',                icon: '🍳', per: 'day' },
    { id: 'cameras', name: '布设机位', desc: '在三个不同房间各放一台记录相机',        icon: '🎥', per: 'day' },
    { id: 'allOn',   name: '全屋通电', desc: '打开所有灯和电子产品',                  icon: '💡', per: 'day' },
    { id: 'phone',   name: '客厅刷手机', desc: '在客厅玩手机累计 1 个时间条',         icon: '📱', per: 'day' },
    { id: 'sleepD',  name: '睡出事那间', desc: '在出事的卧室里睡一晚',                icon: '🛏', per: 'run' }
  ];

  /* ---------------- 物品 ---------------- */
  XZ.ITEMS = [
    { id: 'phone',   name: '手机',   key: 'Q', desc: '看时间、翻培训手册、玩手机。拍照不行。' },
    { id: 'manual',  name: '培训手册', key: 'H', desc: '公司发的《凶宅试睡操作规范》。' },
    { id: 'medkit',  name: '止痛药 / 创可贴', key: '3', desc: '吃一片，压一压心跳。恐惧 -15。' },
    { id: 'amulet',  name: '护身符', key: '1', desc: '庙里求的。30 秒内灵异事件对你无效。' },
    { id: 'salt',    name: '一包食盐', key: '2', desc: '在身后撒一道。60 秒内它靠不近。' },
    { id: 'cash',    name: '2000 元现金', key: '', desc: '尾款。或者……遇到什么就给什么。' },
    { id: 'torch',   name: '手电筒', key: 'F', desc: '照明。电池不多，省着用。' },
    { id: 'camera',  name: '相机',   key: 'C', desc: '拍照取证。取景框对准目标再按左键。' }
  ];

  /* ---------------- 手册 ---------------- */
  XZ.MANUAL = [
    ['一、总则', [
      '凶宅试睡员的工作，是在委托期内入住目标房屋，完成取证与居住记录，以证明该房屋「可正常居住」。',
      '委托期 2 天。每天 3 个时间条，耗尽即为一天结束。',
      '每完成 2 个任务，时间条提前推进 1 格 —— 干得越快，越早收工。',
      '2 天期满，所有任务完成，交付 2000 元尾款。'
    ]],
    ['二、任务', [
      '每个区域拍一张照（相机取景对准房间，左键快门）。',
      '在厕所待满 5 分钟，记录体感。',
      '在厨房做一顿饭，并拍照。',
      '在三个不同房间布置记录相机。',
      '打开所有灯光与电子产品。',
      '在客厅玩手机累计 1 个时间条。',
      '在出事的卧室睡一晚 —— 第 2 天必须完成。',
      '注意：所有「停留 / 累计」类任务都是累加计时的，中断不重置。被追了就先跑，回来接着干。'
    ]],
    ['三、安全', [
      '不要回应任何呼唤你名字的声音。',
      '不要在镜子前停留超过 10 秒。',
      '听到敲击声，先数清楚是几下。三下以上，立刻离开该房间。',
      '护身符只能用一次，撒盐只能用一次。用完就没了。',
      '恐惧值到顶会昏厥，损失一个时间条。别硬撑。'
    ]],
    ['四、免责', [
      '本公司不对试睡员在委托期内发生的任何生理、心理、以及「身份认定」层面的问题承担责任。',
      '若您发现房间里的东西开始记得您，请立即终止合同。',
      '——但合同没有终止条款。'
    ]]
  ];

  /* ---------------- 结局文案 ---------------- */
  XZ.ENDINGS = {
    revenge: {
      title: '委托完成 · 案子破了',
      text: '第二天下午三点，两个警察敲开了院子的铁门。\n你把这一晚记的东西全交了出去——他们本来只是想做个笔录。\n\n案子在第三周破了。两个人在邻市落网，其中一个人在审讯室里说了句：\n「那栋楼里，我明明捅了七刀。」\n\n公司给你结了尾款。你多问了一句：这一单的户主是谁。\n中介翻了翻档案，说：\n「没人。那房子空了四年。」'
    },
    encounter: {
      title: '委托完成 · 四个人',
      text: '第二天早上，屋子里坐着三个人，站着一个人。\n\n阿哲还在念叨他的押金能不能退；\n上一任试睡员把公文包打开，里面是七本写满了的记录本，字迹从工整到潦草；\n房东站在窗边，没有影子。\n\n中介最后把这单结成了「特殊情况」，扣了你一半尾款，理由是「样本污染」。\n\n你问他：另外那两个人怎么办。\n他说：什么另外两个人。\n\n你回头，客厅只剩你一个。桌上的记录本还在。'
    },
    clear: {
      title: '委托完成 · 交付',
      text: '第二天清晨，你把最后一张照片传上去，锁门，下楼。\n中介在楼下等你，看了看你的黑眼圈，什么也没问，把两千块塞进你手里。\n\n你回头看了一眼那扇窗。\n窗帘是拉着的。\n你走的时候，明明拉开了。'
    },
    dead: {
      title: '委托终止 · 失联',
      text: '公司隔了两天才报警。\n警察进门的时候，屋子很整洁，所有东西都摆得整整齐齐。\n\n桌上放着一份写完了的试睡记录，最后一页只有一行字：\n「这里挺好的，我打算多住几天。」\n\n笔迹是你的。'
    },
    quit: {
      title: '委托终止 · 违约',
      text: '你在第一晚就跑了出去，行李都没拿。\n违约金扣光了定金，你还在楼下吐了十分钟。\n\n中介打电话来骂你，你听着，忽然问了一句：\n「上一任试睡员，后来怎么样了？」\n\n电话那头安静了很久。\n「……上一任？」'
    },
    blackout: {
      title: '委托终止 · 昏迷',
      text: '你在走廊里倒下，醒来的时候不知道过了多久。\n手机没电，门锁从里面反锁着，钥匙还在你兜里。\n\n你打开手电筒，照见地板上有一串脚印。\n不是你的。\n\n它们从你躺着的位置，往主卧去了。'
    },
    timeout: {
      title: '委托终止 · 超期',
      text: '两天到了，任务没做完。\n公司按合同扣掉全部尾款，还倒扣了违约金。\n\n你站在楼下，抬头看那扇窗。\n窗户后面有个人也在看你。\n\n你掏出手机拍了一张。\n相册里，窗户是空的。'
    }
  };

  /* ============================================================
     追加户型（m6~m9）：给新增的 4 个故事用
     —— 结构比前 5 张更绕：双走廊 / 分叉 / 更多房间
     ============================================================ */
  XZ.MAPS.push(
    {
      id: 'm6',
      name: '复式错层 · 两户打通',
      addr: 'A 市 长乐坊 8 号 2-3 层',
      area: 132,
      year: 2003,
      desc: '上下两层被人从中间砸开打通，多出来一条横走廊和一堆不知道通向哪的门。层高不均，有的地方一抬头就撞梁。',
      w: 29, h: 22,
      spawn: { x: 15, y: 18 },
      rooms: [
        { id: 'hall',    type: 'hall',    x: 14, y: 2,  w: 3,  h: 18 },
        { id: 'hallB',   type: 'hall',    x: 6,  y: 10, w: 8,  h: 2 },
        { id: 'hallC',   type: 'hall',    x: 17, y: 5,  w: 11, h: 2 },
        { id: 'living',  type: 'living',  x: 2,  y: 2,  w: 11, h: 3 },
        { id: 'master',  type: 'master',  x: 2,  y: 6,  w: 11, h: 4 },
        { id: 'kitchen', type: 'kitchen', x: 2,  y: 13, w: 6,  h: 4 },
        { id: 'toilet',  type: 'toilet',  x: 9,  y: 13, w: 4,  h: 3 },
        { id: 'storage', type: 'storage', x: 2,  y: 18, w: 11, h: 2 },
        { id: 'second',  type: 'second',  x: 18, y: 2,  w: 10, h: 2 },
        { id: 'study',   type: 'study',   x: 18, y: 8,  w: 10, h: 4 },
        { id: 'esports', type: 'esports', x: 18, y: 13, w: 10, h: 4 },
        { id: 'balcony', type: 'balcony', x: 18, y: 18, w: 10, h: 2 }
      ]
    },
    {
      id: 'm7',
      name: '拆迁区自建院 · 三层',
      addr: 'A 市 后街 22 号',
      area: 118,
      year: 1996,
      desc: '整条街都围了挡板，只剩这一户没签字。三层只住一层，上两层封死。院子里堆着没搬走的旧家具。',
      w: 30, h: 24,
      spawn: { x: 14, y: 20 },
      rooms: [
        { id: 'hall',    type: 'hall',    x: 13, y: 2,  w: 3,  h: 20 },
        { id: 'hallB',   type: 'hall',    x: 16, y: 8,  w: 11, h: 2 },
        { id: 'living',  type: 'living',  x: 2,  y: 2,  w: 10, h: 5 },
        { id: 'master',  type: 'master',  x: 2,  y: 8,  w: 10, h: 4 },
        { id: 'toilet',  type: 'toilet',  x: 2,  y: 13, w: 4,  h: 3 },
        { id: 'kitchen', type: 'kitchen', x: 7,  y: 13, w: 5,  h: 3 },
        { id: 'second',  type: 'second',  x: 17, y: 2,  w: 10, h: 4 },
        { id: 'study',   type: 'study',   x: 17, y: 11, w: 10, h: 4 },
        { id: 'storage', type: 'storage', x: 17, y: 16, w: 10, h: 3 },
        { id: 'balcony', type: 'balcony', x: 17, y: 20, w: 10, h: 2 }
      ]
    },
    {
      id: 'm8',
      name: '城西合租公寓 · 三室',
      addr: 'A 市 西环三路 5 号 601',
      area: 108,
      year: 2014,
      desc: '三个房间三把锁，中间客厅谁都能过。冰箱上贴满了便利贴，写的最好的一句是「谁再把我的酸奶喝了」。',
      w: 29, h: 22,
      spawn: { x: 14, y: 17 },
      rooms: [
        { id: 'hall',    type: 'hall',    x: 13, y: 2,  w: 3,  h: 18 },
        { id: 'hallB',   type: 'hall',    x: 5,  y: 10, w: 8,  h: 2 },
        { id: 'living',  type: 'living',  x: 2,  y: 2,  w: 10, h: 6 },
        { id: 'master',  type: 'master',  x: 2,  y: 13, w: 7,  h: 4 },
        { id: 'second',  type: 'second',  x: 10, y: 13, w: 2,  h: 4 },
        { id: 'kitchen', type: 'kitchen', x: 2,  y: 18, w: 5,  h: 2 },
        { id: 'toilet',  type: 'toilet',  x: 7,  y: 18, w: 5,  h: 2 },
        { id: 'study',   type: 'study',   x: 17, y: 2,  w: 10, h: 4 },
        { id: 'esports', type: 'esports', x: 17, y: 7,  w: 10, h: 4 },
        { id: 'storage', type: 'storage', x: 17, y: 12, w: 10, h: 3 },
        { id: 'balcony', type: 'balcony', x: 17, y: 16, w: 10, h: 2 }
      ]
    },
    {
      id: 'm9',
      name: '样板间 · 白盒',
      addr: 'A 市 演示中心 B1',
      area: 96,
      year: 2026,
      desc: '开发商做的样板房，四面墙都是新的，一件生活用品都没有。空气里是新家具的味道。这里没有任何人死过——理论上。',
      w: 29, h: 20,
      spawn: { x: 14, y: 16 },
      rooms: [
        { id: 'hall',    type: 'hall',    x: 13, y: 2,  w: 3,  h: 16 },
        { id: 'living',  type: 'living',  x: 2,  y: 2,  w: 10, h: 4 },
        { id: 'master',  type: 'master',  x: 2,  y: 7,  w: 10, h: 3 },
        { id: 'kitchen', type: 'kitchen', x: 2,  y: 11, w: 10, h: 3 },
        { id: 'toilet',  type: 'toilet',  x: 2,  y: 15, w: 10, h: 2 },
        { id: 'second',  type: 'second',  x: 17, y: 2,  w: 10, h: 4 },
        { id: 'study',   type: 'study',   x: 17, y: 7,  w: 10, h: 3 },
        { id: 'esports', type: 'esports', x: 17, y: 11, w: 10, h: 3 },
        { id: 'balcony', type: 'balcony', x: 17, y: 15, w: 10, h: 2 }
      ]
    }
  );

  /* ============================================================
     追加背景（b6~b10）
     families = 灵异事件家族（light/mid/high/chase/friend）
     special  = 专属机制
     ============================================================ */
  XZ.BGS.push(
    {
      id: 'b6', maps: ['m3'], level: '轻中', levelTag: '意外死亡 · 有点黏人',
      families: ['light', 'mid'],
      ghost: '李桂芝', years: '1966.11.4 — 2024.12.19', died: '2024 年 12 月 19 日',
      cause: '一氧化碳中毒 · 意外',
      deathRoom: 'master', triggers: ['master', 'living', 'kitchen'],
      color: 0xb8b09a,
      title: '她只想知道猫有没有人喂',
      story: [
        '李桂芝，1966 年 11 月 4 日生，退休前在街道办做会计。丈夫早逝，一个人把女儿供到研究生。',
        '女儿在南方工作，一年回来一次。她养了一只橘猫叫「馒头」，每天六点准时喂。',
        '2024 年冬天特别冷，她把老式燃气热水器开了一整夜，窗户关死。第二天早上没起来，第三天邻居闻到味道才报警。',
        '警察进门的时候，猫坐在她旁边，瘦了一圈，没叫。',
        '她不是恶意。她只是还没搞明白自己已经不在了——每天六点，她还在找那只猫。',
        '这户会闹，但不会伤人。开着的门会自己关上，厨房偶尔有猫粮倒进碗里的声音。'
      ]
    },
    {
      id: 'b7', maps: ['m6'], level: '中高', levelTag: '自杀 · 半附身',
      families: ['mid', 'high'],
      ghost: '孙野', years: '2001.5.17 — 2023.3.9', died: '2023 年 3 月 9 日',
      cause: '烧炭 · 自杀',
      deathRoom: 'second', triggers: ['second', 'esports', 'study', 'kitchen'],
      color: 0x88787f,
      title: '他欠的钱，比他活过的年数还多',
      story: [
        '孙野，2001 年 5 月 17 日生，网吧代练，一天能打十四个小时。',
        '大二那年退学，说读书没用，靠打游戏一个月能挣八千。头一年确实挣到了，第二年平台压价，第三年开始借网贷。',
        '到 2023 年初，七个平台，本金加罚息三十二万。催收电话打到他母亲那里，他母亲在电话里哭了一整晚。',
        '3 月 8 日晚上，他在合租的次卧里封了窗，烧了一盆炭。桌上留了张纸，写着「对不起」和六个平台的还款账号。',
        '他的电脑还开着，游戏没退。挂机脚本跑到第二天中午才断线。',
        '这户会附身，但附不彻底——他会让你打开游戏，让你坐在那张椅子上，让你觉得再打一局也没关系。'
      ]
    },
    {
      id: 'b8', maps: ['m7'], level: '复仇', levelTag: '凶案未破 · 求告',
      families: ['chase'],
      special: 'revenge',
      ghostSpeed: 0.95,
      ghost: '陈默', years: '1990.7.21 — 2019.10.2', died: '2019 年 10 月 2 日',
      cause: '入室抢劫 · 凶杀（未破）',
      deathRoom: 'master', triggers: ['master', 'living', 'study', 'storage'],
      color: 0x9fb4c8,
      title: '凶手还在外面，他在等你打电话',
      story: [
        '陈默，1990 年 7 月 21 日生，做装修的，工地上人缘很好。',
        '2019 年 10 月 2 日夜里，两个人翻进院子。他醒了，起来看了一眼。就这一眼，被捅了七刀。',
        '案子立了，四年没破。监控是坏的，指纹对不上，现场被翻得乱七八糟——不像抢劫，更像找什么东西。',
        '他母亲每年十月都来这条街，站在围挡外面看一会儿，然后走。',
        '他一直在这栋楼里，一遍一遍地把那一晚重放。他不是想吓人，他是想让有人替他打个电话。',
        '这户的鬼走得慢，但会一直跟着你。你要是拿出手机，按住两秒——它会停下来。'
      ]
    },
    {
      id: 'b9', maps: ['m8'], level: '特殊', levelTag: '四个人（其中一个是鬼）',
      families: ['light', 'mid'],
      special: 'encounter',
      ghost: '房东 · 老周', years: '——', died: '2021 年',
      cause: '死在这间房里，具体不详',
      deathRoom: 'master', triggers: ['living', 'master', 'second', 'kitchen'],
      color: 0xc8b0a0,
      title: '上一任试睡员没交报告，一个大学生不知道自己租了凶宅',
      story: [
        '公司给的档案里，这户只写了半页。上一任试睡员的报告，状态栏是「未提交」。',
        '人没失踪，也没死——就是第七天早上锁门走了，之后再没回过公司，电话空号。',
        '还有一个麻烦：这房子上个月被中介私下租出去了。租客是个大学生，签合同的时候没人告诉他这里死过人。',
        '所以今晚这间屋子里，理论上应该有四个人：你、上一任试睡员（如果他还在）、一个什么都不知道的大学生，以及本来就住在这里的那个。',
        '你唯一的优势是：他们和你一样，都不知道该怎么办。',
        '这户不咬人。它只会在你身后多说一句话。'
      ]
    },
    {
      id: 'b10', maps: ['m9'], level: 'DEBUG', levelTag: '不该出现在正式委托里',
      families: [],
      special: 'debug',
      ghost: '——', years: '——', died: '——',
      cause: '资料空白',
      deathRoom: 'master', triggers: ['master', 'living', 'second'],
      color: 0x6ee7a0,
      title: 'Shift + C 进入调试',
      story: [
        '这一单不该派给任何人。',
        '房子是新的，墙是白的，什么味道都没有。档案里所有字段都是空的，连「死因」那一栏都只有一条横线。',
        '但你注意到一件事：HUD 左上角的天数显示成了「DEBUG」。',
        '按 Shift + C。你自己看看会出来什么。',
        '（调试键：G 召唤鬼 · V 飞天 · T 一键完成任务 · N 时间条 +1 · B 恐惧清零）'
      ]
    }
  );

})(window.XZ);
