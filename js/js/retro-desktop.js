window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-TR4FT7JPDZ');

(function() {
/* ====================
   游戏状态管理
   ==================== */
const GAME_STATE = {
  // 浏览器阶段
  browserPhase: 'home',       // home | warn | forum | wayback | snapshot | snapshot2003
  playerName: '',
  postsRevealed: 0,          // 已阅读帖子数
  hiddenPostClicked: false,  // 是否点击了隐藏帖子
  waybackClicked: false,     // 是否点击了2003快照
  
  // 终端阶段
  terminalPhase: 'idle',     // idle | connected | exploring | mirror_talk | ending
  postsRead: false,          // 是否用 posts 查看了隐藏帖子
  statusChecked: false,      // 是否用 status 查看过角色状态
  mirrorRound: 0,            // 镜中人对话轮次 0-4
  commandHistory: [],
  
  // 结局
  endingTriggered: null,     // A | B | C | D | E 或 null
  endingEReady: false,       // 是否已满足 E 结局解锁条件
  dialogLocked: false,       // 结局触发后锁定
  sealPending: false,        // FIX-2: seal 命令待确认状态
  
  // 全局
  terminalConnected: false,  // 是否已连接终端服务器

  // 10·24 彩蛋扩展
  localHistory: [],          // 本地 CMD 命令历史
  files: [],                 // 桌面新建的文件/文件夹

  // FIX-3: 论坛帖子自动推进定时器
  autoAdvanceTimer: null
};

/* ====================
   窗口管理
   ==================== */
let winZIndex = 10;
const windows = { browser: false, terminal: false, readme: false };
let activeWin = null;

function $(id) { return document.getElementById(id); }

function openWindow(name) {
  const el = $('win-' + name);
  el.style.display = 'flex';
  el.style.zIndex = ++winZIndex;
  // 确保浏览器有默认位置和大小
  if (name === 'browser' && !el.style.left) { el.style.left = '40px'; el.style.top = '30px'; el.style.width = '700px'; el.style.height = '520px'; }
  if (name === 'terminal' && !el.style.left) { el.style.left = '200px'; el.style.top = '100px'; el.style.width = '540px'; el.style.height = '360px'; }
  if (name === 'readme' && !el.style.left) { el.style.left = '100px'; el.style.top = '80px'; el.style.width = '400px'; el.style.height = '300px'; }
  windows[name] = true;
  activeWin = name;
  updateTaskItems();
  if (name === 'browser') renderBrowserContent();
  if (name === 'terminal') renderTerminal();
  if (name === 'readme') renderReadme();
  // 音效：窗口打开
  if (window.AudioEngine) AudioEngine.play('windowOpen');
}

function renderBrowserContent() {
  if (GAME_STATE.endingTriggered) return; // FIX-1: 结局后禁止浏览器渲染
  // 10·24 彩蛋：这台电脑只有一个网站——千禧版本站
  renderHomePage();
}

function closeWindow(name) {
  $('win-' + name).style.display = 'none';
  windows[name] = false;
  if (activeWin === name) activeWin = null;
  updateTaskItems();
  // 音效：窗口关闭
  if (window.AudioEngine) AudioEngine.play('windowClose');
}

function minWindow(name) {
  $('win-' + name).style.display = 'none';
  if (activeWin === name) activeWin = null;
  updateTaskItems();
  // 保留窗口状态，不清除 windows[name]
}

function maxWindow(name) {
  const el = $('win-' + name);
  el.style.left = '0'; el.style.top = '0';
  el.style.width = '100vw'; el.style.height = 'calc(100vh - 32px)';
}

function focusWin(name) {
  if (!windows[name]) { openWindow(name); return; }
  const el = $('win-' + name);
  el.style.display = 'flex';
  el.style.zIndex = ++winZIndex;
  activeWin = name;
  updateTaskItems();
}

function updateTaskItems() {
  const container = $('task-items');
  container.innerHTML = '';
  for (const [name, open] of Object.entries(windows)) {
    if (!open) continue;
    const div = document.createElement('div');
    div.className = 'task-item' + (name === activeWin ? ' active' : '');
    const labels = { browser: '🌐 Internet Explorer', terminal: '🖥️ CMD', readme: '📄 readme.txt' };
    div.textContent = labels[name] || name;
    div.onclick = () => {
      if (name === activeWin) minWindow(name);
      else focusWin(name);
    };
    container.appendChild(div);
  }
}

// 拖拽
let dragWin = null, dragX = 0, dragY = 0;
function startDrag(e, winId) {
  dragWin = $('win-' + winId.replace('win-',''));
  dragX = e.clientX - dragWin.offsetLeft;
  dragY = e.clientY - dragWin.offsetTop;
  document.onmousemove = (ev) => {
    if (dragWin) { dragWin.style.left = (ev.clientX - dragX) + 'px'; dragWin.style.top = (ev.clientY - dragY) + 'px'; }
  };
  document.onmouseup = () => { dragWin = null; document.onmousemove = null; };
}

// 时钟
function updateClock() {
  const now = new Date();
  $('clock').textContent = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
}
setInterval(updateClock, 10000);
updateClock();

// 开始菜单
function toggleStartMenu() {
  const sm = $('start-menu');
  sm.classList.toggle('show');
}
document.addEventListener('click', (e) => {
  if (!$('start-menu').contains(e.target) && !e.target.closest('.start-btn')) {
    $('start-menu').classList.remove('show');
  }
});

/* ====================
   FORUM POSTS 数据
   ==================== */
const FORUM_POSTS = [
  { id: 1, author: '深海', date: '2002-10-03 02:17', content: '欢迎来到镜面论坛。这里是我们几个夜间不睡觉的人的小天地。聊聊技术，聊聊生活，随便什么都可以。规矩就一条：别把外面的世界带进来。我是深海，这个服务器的管理员。有什么问题可以找我。', hidden: false },
  { id: 2, author: '夜猫子', date: '2002-10-15 03:42', content: '有人遇到过这种情况吗？半夜用电脑的时候，屏幕黑掉之后能看到自己的倒影，但是倒影的动作不太对。我昨天晚上确定看到了——我明明没有动，但倒影里的我转了一下头。不是视觉残留，不是幻觉。我盯着那个倒影看了至少五分钟。它一直在看我。', hidden: false },
  { id: 3, author: '老刀', date: '2002-10-16 14:08', content: 'CRT在低刷新率下确实会有视觉残留。你用的什么显示器？刷新率多少？晚上房间有光源吗？先回答这三个问题再谈鬼故事。别自己吓自己。', hidden: false },
  { id: 4, author: '夜猫子', date: '2002-10-18 23:55', content: 'CRT，60Hz。但我不是开玩笑的。它现在不只是在屏幕黑的时候出现了。今天下午我的屏幕开着，Windows桌面，然后我看到它——就在窗口边框的反光里。它在看我。不只是看。它今天眨了一下眼睛。我没有眨眼。', hidden: false },
  { id: 5, author: '小影', date: '2002-10-20 21:33', content: '大家好，我是通过朋友介绍来的。这个论坛的名字好有意思，镜面。我昨天晚上注册之后一直没关网页，然后……我也看到了。我不知道怎么形容。它在镜面里，但不是我的倒影。它像是一个……轮廓，一个人的轮廓，站在我身后。但我身后只有墙。它没有动。就是站在那里。我现在打字的时候还能在屏幕边缘看到它。', hidden: false },
  { id: 6, author: '深海', date: '2002-10-22 01:44', content: '各位，我认真说一下。我查了一下服务器日志，过去两周，我们论坛的访问量出现了异常峰值。有一些请求来自无法追踪的IP段。它们的目标端口不是HTTP的80——是屏幕显示的底层协议端口。我不确定这和你们说的镜中人有没有关系，但请所有人暂时不要在任何反光面前长时间停留。尤其是深夜。这不是开玩笑的。', hidden: false },
  { id: 7, author: '老刀', date: '2002-10-25 16:20', content: '我写了一个监控脚本放在服务器上。它会记录所有非标准的连接请求。你们说的镜中人，我在日志里看到了——不是IP的问题，是请求内容。有些请求的User-Agent字段是乱码，但如果你把乱码按GBK编码反解析……算了。这不应该是人看到的东西。脚本路径：/mirror/log。想看的自己去看。我退出讨论了。', hidden: false },
  { id: 8, author: '夜猫子', date: '2002-11-01 04:11', content: '它开始说话了。不是真的说话。我是指它会在屏幕上留下文字。只有一行，每次都是同一行："让我过去"。我今天把电脑关了三个小时，然后打开，屏幕亮起来的那一刻，那行字还在。它不在操作系统里。它不在硬盘里。它在屏幕的像素里面。我没法重装系统解决这个问题。', hidden: false },
  { id: 9, author: '小影', date: '2002-11-05 19:27', content: '我今天放学回家，发现我的小灵通屏幕上有水渍。我擦不掉。它不是水，是从屏幕里面渗出来的东西。有点像手的轮廓。深海，你在吗？我有点害怕。它现在不只在我的电脑里了。它跟着我。', hidden: false },
  { id: 10, author: '深海', date: '2002-11-08 00:03', content: '论坛将于2002年11月15日关闭。所有数据保留但不公开。这不是开玩笑。我已经联系了老刀，他会确保服务器在关闭后仍然运行监控脚本。如果有人——任何人——在未来某一天读到这些帖子：不要长时间看屏幕里的反光。不要回应它。不要让它知道你能看见它。保重。', hidden: false },
  { id: 11, author: '【自动存档】', date: '2002-11-15 23:59', content: '论坛已关闭。这是最后一次自动备份。所有帖子锁定为只读状态。镜面论坛，2002年10月3日 — 2002年11月15日。在线人数：0。', hidden: false },
  { id: 12, author: '夜猫子', date: '2003-03-07 03:33', content: '它找到我了。别开屏幕。别开屏幕。别开——有东西在屏幕里面。它想出来。它不是坏人但它想出来。如果你看到这条帖子说明你看到它了。别怕。它是困——', hidden: true }
];

/* ====================
   结局数据
   ==================== */
const ENDINGS = {
  A: { title: '【结局A：断开连接】', text: '所有连接已终止。镜面论坛数据永久关闭。深海、夜猫子、老刀、小影的账号状态：离线。你成功切断了通道。但屏幕已经不再只是屏幕了。每次你关掉电脑，黑色屏幕上映出的——是你自己。', cls: 'ending-a' },
  B: { title: '【结局B：接替者】', text: '你已成为镜面论坛服务器的新管理员。每日监控报告将发送到你的终端。如果有人——任何人——在未来某一天又看到了那个轮廓，你将是第一个知道的人。老刀的程序说：谢谢。有人得看着这面镜子。那个人是你。', cls: 'ending-b' },
  C: { title: '【结局C：穿越】', text: '连接建立。正在迁移。屏幕亮了。你不在电脑前面了。你在屏幕里面。外面是你的房间，你的椅子，你的键盘。一个轮廓坐在你的椅子上。它转了一下头。它不是你。它是新的你。', cls: 'ending-c' },
  D: { title: '【结局D：封印】', text: '老刀的隐藏协议已激活。镜面连接被永久切断。代价是——你已经忘记了。论坛是什么？深海是谁？你的浏览器显示about:blank。桌面上什么都没有。一个普通的Win98模拟器。什么都没有发生。但这感觉不太对，是不是？有人在镜子里喊你。你听不到。', cls: 'ending-d' },
  E: { title: '【结局E：共存】', text: '你选择留下。镜中人选择留下。你们分享同一面屏幕，隔着光的介质。某天晚上，你关掉房间的灯，屏幕反射出你的脸——但那张脸朝你笑了一下，而你没有笑。你也没觉得害怕。你只是笑回去。它在这里。你也在这里。这就可以了。', cls: 'ending-e' }
};

/* ====================
   结局E「共存」对话数据
   ==================== */
const ENDING_E_DIALOGUE = [
  { round: 'e1', lines: ['镜中人：你。留下。','镜中人：不。走。','镜中人：也。不。来。','镜中人：在。中间。','镜中人：跟。我。一起。'], hint: '（继续输入——镜中人正在理解你的选择）' },
  { round: 'e2', lines: ['镜中人：深海。走了。那边。','镜中人：夜猫子。走了。这边。','镜中人：没人。在。中间。','镜中人：你。在。','镜中人：我。也。在。','镜中人：中间。不是。空的。'], hint: '（继续输入——世界安静了下来）' },
  { round: 'e3', lines: ['镜中人：不冷。了。','镜中人：屏幕。亮。着。','镜中人：你。那边。我。这边。','镜中人：一样。的。','镜中人：谢谢。'], hint: '' }
];

/* ====================
   浏览器页面渲染
   ==================== */

function browserHome() { if (GAME_STATE.endingTriggered) return; renderHomePage(); }

// --- Readme ---
function renderReadme() {
  // Readme是静态内容，不需要重新渲染
  // 只在首次打开时已经有正确内容
}

// --- 警告页 ---
function renderWarnPage() {
  GAME_STATE.browserPhase = 'warn';
  const c = $('browser-content');
  c.innerHTML = `<div class="warn-page">
    <div class="warn-icon">⚠️</div>
    <div class="warn-title">注意：你即将访问的内容可能包含令人不安的历史记录</div>
    <div class="warn-text">接下来的页面包含从2002年互联网存档中恢复的原始内容。这些内容涉及未解的心理现象报告。如果你在任何反射面中观察到异常，请立即关闭本页面并离开屏幕至少三十分钟。<br><br>你确定要继续吗？</div>
    <div><input class="warn-input" id="warn-name" placeholder="输入你的名字..." onkeydown="if(event.key==='Enter')enterForum()"><button class="warn-btn" onclick="enterForum()">继续</button></div>
  </div>`;
  $('url-bar').value = 'about:blank';
}

// --- 进入论坛 ---
function enterForum() {
  if (GAME_STATE.endingTriggered) return; // FIX-1: 结局后禁止进入论坛
  const name = ($('warn-name')?.value || '').trim();
  GAME_STATE.playerName = name || '访客';
  GAME_STATE.browserPhase = 'forum';
  $('url-bar').value = 'http://mirror-forum.bbs/';
  renderForumPage();
  // 音效：Modem 拨号
  if (window.AudioEngine) AudioEngine.play('modem');
}

function renderForumPage() {
  // FIX-3: 帖子自动推进（每 3 秒一条）
  if (!GAME_STATE.autoAdvanceTimer && GAME_STATE.postsRevealed < 11) {
    GAME_STATE.autoAdvanceTimer = setInterval(() => {
      if (GAME_STATE.postsRevealed < 11) {
        GAME_STATE.postsRevealed = Math.min(GAME_STATE.postsRevealed + 1, 11);
        renderForumPage();
      } else {
        clearInterval(GAME_STATE.autoAdvanceTimer);
        GAME_STATE.autoAdvanceTimer = null;
      }
    }, 3000);
  }

  const c = $('browser-content');
  // 显示已阅读的帖子数
  const visible = FORUM_POSTS.slice(0, GAME_STATE.postsRevealed + 1);
  // 自动推进：每次渲染最多显示比上次多一条
  if (GAME_STATE.postsRevealed < 10) {
    // 确保显示到第 postsRevealed+1 条
  }
  
  let postsHTML = '';
  for (let i = 0; i <= Math.min(GAME_STATE.postsRevealed, 11); i++) {
    const p = FORUM_POSTS[i];
    if (p.hidden && !GAME_STATE.hiddenPostClicked) continue;
    const hiddenCls = p.hidden ? ' hidden-post' : '';
    const onclick = p.hidden ? `onclick="revealHiddenPost()"` : '';
    postsHTML += `<div class="forum-post${hiddenCls}" ${onclick}>
      <div class="post-header">
        <span class="post-author">${p.author}</span>
        <span class="post-date">${p.date}</span>
      </div>
      <div class="post-body">${p.content}</div>
    </div>`;
  }
  
  let replySection = '';
  if (GAME_STATE.postsRevealed >= 0 && GAME_STATE.postsRevealed < 10) {
    replySection = `<div class="forum-reply" style="margin-top:12px">
      <div class="reply-hint"></div>
      <textarea id="forum-reply-text" placeholder="写下你的回复..."></textarea>
      <button class="reply-btn" onclick="submitForumReply()" style="margin-top:6px">发表回复</button>
    </div>`;
  } else if (GAME_STATE.postsRevealed >= 10 && !GAME_STATE.waybackClicked) {
    replySection = `<div class="forum-reply" style="margin-top:12px; background:#ffeaa7;">
      <div class="reply-hint" style="color:#8b6914;">你已读完所有历史帖子。论坛在2002年11月15日后关闭。</div>
      <textarea id="forum-reply-text" placeholder="写下你的回复..."></textarea>
      <button class="reply-btn" onclick="submitForumReply()" style="margin-top:6px">发表回复</button>
    </div>`;
  } else if (GAME_STATE.waybackClicked) {
    replySection = `<div class="forum-reply" style="margin-top:12px; background:#d5f5e3;">
      <div class="reply-hint" style="color:#1a7a3a;">你找到了2003年的隐藏快照。</div>
      <textarea id="forum-reply-text" placeholder="写下你的回复..."></textarea>
      <button class="reply-btn" onclick="submitForumReply()" style="margin-top:6px">发表回复</button>
    </div>`;
  }
  
  c.innerHTML = `<div class="forum-page">
    <div class="forum-header">🪞 镜面论坛 — Mirror BBS</div>
    <div class="forum-nav">
      <span>首页</span> <a onclick="openWayback()">📦 互联网时光机</a>
    </div>
    ${postsHTML}
    ${replySection}
  </div>`;
  c.scrollTop = c.scrollHeight;
}

function revealHiddenPost() {
  GAME_STATE.hiddenPostClicked = true;
  renderForumPage();
}

function submitForumReply() {
  if (GAME_STATE.endingTriggered) return; // FIX-1: 结局后禁止论坛回复
  const text = ($('forum-reply-text')?.value || '').trim();
  if (!text) return;
  
  const lower = text.toLowerCase();
  if (lower.includes('时光机') || lower.includes('wayback') || lower.includes('archive') || lower.includes('存档')) {
    openWayback();
    return;
  }
  
  // 推进帖子：每次回复显示2-3条新帖子
  if (GAME_STATE.postsRevealed < 11) {
    GAME_STATE.postsRevealed = Math.min(GAME_STATE.postsRevealed + 3, 11);
    renderForumPage();
  }
}

// --- 时光机 ---
function openWayback() {
  // FIX-3: 进入 wayback 后不需要自动推进
  if (GAME_STATE.autoAdvanceTimer) {
    clearInterval(GAME_STATE.autoAdvanceTimer);
    GAME_STATE.autoAdvanceTimer = null;
  }

  if (GAME_STATE.endingTriggered) return; // FIX-1
  GAME_STATE.browserPhase = 'wayback';
  $('url-bar').value = 'http://web.archive.org/';
  const c = $('browser-content');
  c.innerHTML = `<div class="wayback-page">
    <div class="wb-logo">📦 Internet Archive Wayback Machine</div>
    <p style="color:#666;margin-bottom:20px">浏览超过 8500 亿个存档网页</p>
    <div>
      <input class="wb-input" id="wb-url" value="http://mirror-forum.bbs/" readonly onkeydown="if(event.key==='Enter')searchWayback()">
      <button class="wb-btn" onclick="searchWayback()">浏览历史</button>
    </div>
    <div class="wb-result" id="wb-result"></div>
  </div>`;
  // 音效：Modem 拨号
  if (window.AudioEngine) AudioEngine.play('modem');
}

function searchWayback() {
  if (GAME_STATE.endingTriggered) return; // FIX-1
  const result = $('wb-result');
  result.innerHTML = `
    <p style="font-weight:bold;color:#2c3e50">mirror-forum.bbs 的快照存档：</p>
    <p style="color:#888;font-size:12px">找到 3 个快照</p>
    <a onclick="openSnapshot()" style="font-size:15px">📅 2002年11月15日 — 镜面论坛（最后一次公开快照）</a>
    <a onclick="openSnapshot2003()" style="font-size:13px;color:#888">📅 2003年3月7日 — 单帖快照（来源未知）</a>
  `;
}

function openSnapshot() {
  GAME_STATE.browserPhase = 'snapshot';
  $('url-bar').value = 'http://web.archive.org/web/20021115/mirror-forum.bbs/';
  const c = $('browser-content');
  
  let postsHTML = '';
  for (let i = 0; i <= 10; i++) {
    const p = FORUM_POSTS[i];
    postsHTML += `<div class="forum-post">
      <div class="post-header">
        <span class="post-author">${p.author}</span>
        <span class="post-date">${p.date}</span>
      </div>
      <div class="post-body">${p.content}</div>
    </div>`;
  }
  
  c.innerHTML = `<div class="snapshot-page">
    <div class="snapshot-banner">⚠️ 你正在查看 2002年11月15日 的存档快照。此页面为只读。部分内容可能已损坏。</div>
    <div class="snapshot-date">📅 存档日期：2002年11月15日 23:59 — 镜面论坛关闭前最后备份</div>
    ${postsHTML}
    <div class="snapshot-hint">
      老刀在帖子#7中提到的那个脚本还活着。
    </div>
  </div>`;
  c.scrollTop = 0;
}

function openSnapshot2003() {
  GAME_STATE.waybackClicked = true;
  GAME_STATE.browserPhase = 'snapshot2003';
  $('url-bar').value = 'http://web.archive.org/web/20030307/mirror-forum.bbs/';
  const c = $('browser-content');
  const p = FORUM_POSTS[11];
  c.innerHTML = `<div class="snapshot-page">
    <div class="snapshot-banner" style="background:#fadbd8;border-color:#e74c3c">⚠️ 你正在查看 2003年3月7日 的快照。此页面可能包含损坏的数据。</div>
    <div class="snapshot-date">📅 存档日期：2003年3月7日 03:33 — 单帖快照（来源IP：无法追踪）</div>
    <div class="forum-post" style="background:#fdf2f2">
      <div class="post-header">
        <span class="post-author">${p.author}</span>
        <span class="post-date">${p.date}</span>
      </div>
      <div class="post-body" style="color:#c0392b">${p.content}</div>
    </div>
    <div class="snapshot-hint" style="background:#fdf2f2;border-color:#e74c3c;color:#c0392b">
      ⚠️ 这条帖子中的某些文字似乎被手动截断了。<br>
      最后的词语是"它是困——"。困在什么里面？<br>
      回到终端可能能找到更多答案。
    </div>
  </div>`;
}

// 浏览器导航
function browserBack() { if (GAME_STATE.endingTriggered) return; renderHomePage(); }
function browserFwd() {}
function browserGo() { browserGoIE(); }

/* ====================
   终端渲染 & 交互
   ==================== */

function focusTerminal() {
  const tb = $('terminal-body');
  if (!tb) return;
  tb.focus();
}

function renderTerminal() {
  const tb = $('terminal-body');
  if (GAME_STATE.dialogLocked || GAME_STATE.endingTriggered) {
    // 结局已触发：恢复之前保存的终端内容
    if (window._savedTerminalHTML) {
      tb.innerHTML = window._savedTerminalHTML;
      tb.scrollTop = tb.scrollHeight;
    }
    return;
  }
  
  if (!GAME_STATE.terminalConnected) {
    tb.innerHTML = `<div class="terminal-welcome">Microsoft(R) Windows 98
   (C)Copyright Microsoft Corp 1981-1998.

C:\\WINDOWS&gt;<span class="terminal-prompt">_</span></div>`;
  } else {
    // 已连接状态
    let html = `<div class="terminal-dim">[mirror-forum.bbs] — 连接已建立</div>
<div class="terminal-dim">欢迎。我是这个服务器的监控程序。</div>
<div class="terminal-dim">老刀在2002年把我放在这里。他再也没有回来登录过。</div>
<div class="terminal-dim">你想知道什么？</div>
<div class="terminal-dim">命令：help | posts | status | mirror | talk | sever | watch | seal | clear</div>
<div class="terminal-dim">---</div>`;
    
    // 渲染历史
    for (const entry of GAME_STATE.commandHistory) {
      html += `<div><span class="terminal-prompt">C:\\mirror&gt;</span> <span class="terminal-cmd">${entry.cmd}</span></div>`;
      html += `<div class="${entry.cls || 'terminal-output'}">${entry.output}</div>`;
    }
    
    html += `<div><span class="terminal-prompt">C:\\mirror&gt;</span> <span id="terminal-input-area"><input id="terminal-input" style="background:transparent;border:none;color:#fff;font-family:inherit;font-size:13px;outline:none;width:60%;caret-color:#0f0" onkeydown="terminalKeydown(event)" autofocus></span></div>`;
    tb.innerHTML = html;
    setTimeout(() => { const inp = $('terminal-input'); if (inp) inp.focus(); }, 50);
  }
  
  tb.scrollTop = tb.scrollHeight;
  
  // 如果没有连接，允许点击终端来输入
  if (!GAME_STATE.terminalConnected) {
    tb.onclick = function(e) {
      // 已连接就不需要这个
      if (!GAME_STATE.terminalConnected) {
        tb.innerHTML = tb.innerHTML.replace('<span class="terminal-prompt">_</span>', 
          '<span class="terminal-prompt"><input id="terminal-input-init" style="background:transparent;border:none;color:#0f0;font-family:inherit;font-size:13px;outline:none;width:60%;caret-color:#0f0" onkeydown="initTerminalKeydown(event)" autofocus></span>');
        setTimeout(() => { const inp = $('terminal-input-init'); if (inp) inp.focus(); }, 50);
      }
    };
  }
  window._savedTerminalHTML = tb.innerHTML;
}

function initTerminalKeydown(e) {
  if (e.key !== 'Enter') return;
  const inp = $('terminal-input-init');
  if (!inp) return;
  const raw = inp.value.trim();
  if (!raw) return;
  const cmd = raw.toLowerCase();

  if (cmd === 'connect' || cmd.indexOf('connect ') === 0) {
    GAME_STATE.localHistory.push({ cmd: raw,
      output: '没有安装网卡（错误 0x01）。\n在 2000 年，请先拧开机箱，把网线插进主板后面的 RJ45 口。\n什么？找不到？那就对了——这台机器是时光机仿真的，杂鱼。',
      cls: 'terminal-dim' });
    renderLocalTerminal();
    window._savedTerminalHTML = $('terminal-body')?.innerHTML || '';
    return;
  }

  // ---- 10·24 彩蛋：本地命令 ----
  const res = execLocalCommand(cmd, raw);
  if (res.handled) {
    if (res.record !== false) {
      GAME_STATE.localHistory.push({ cmd: raw, output: res.output || '', cls: res.cls || 'terminal-output' });
    }
    if (res.clear) { GAME_STATE.localHistory = []; }
    renderLocalTerminal();
    if (res.after) res.after();
  } else {
    GAME_STATE.localHistory.push({
      cmd: raw,
      output: `'${escapeHtml(raw)}' 不是内部或外部命令，也不是可运行的程序或批处理文件。`,
      cls: 'terminal-error'
    });
    renderLocalTerminal();
  }
  window._savedTerminalHTML = $('terminal-body')?.innerHTML || '';
}

function terminalKeydown(e) {
  if (e.key !== 'Enter') return;
  // 结局已触发时禁止任何终端输入
  if (GAME_STATE.endingTriggered) return;
  const inp = $('terminal-input');
  if (!inp) return;
  const raw = inp.value.trim();
  if (!raw) return;
  
  const cmd = raw.toLowerCase();
  
  // 如果在镜中人对话中，任何输入都推进对话
  // 扩展支持 E 对话轮次 (e1/e2/e3)
  const r = GAME_STATE.mirrorRound;
  if ((r > 0 && r < 5) || (typeof r === 'string' && ['e1','e2','e3'].includes(r))) {
    advanceMirrorDialogue(raw);
    return;
  }
  
  let output = '';
  let cls = 'terminal-output';
  
  switch (cmd) {
    case 'help':
      output = `可用命令：
  posts   — 读取被隐藏的论坛帖子
  status  — 查看各角色当前状态
  mirror  — 查看镜中人活动记录
  talk    — 尝试与镜中人通信
  sever   — 断开所有连接
  watch   — 接手监控权限
  seal    — [需要验证 — 先使用 posts 命令查看隐藏内容]
  clear   — 清屏`;
      break;
      
    case 'posts':
      GAME_STATE.postsRead = true;
      const hiddenPost = FORUM_POSTS[11];
      output = `[被隐藏的帖子 — 仅管理员可见]
作者：${hiddenPost.author} | ${hiddenPost.date}

${hiddenPost.content}

--- 帖子结束 ---
[注] 这条帖子是在论坛关闭后发布的。发布IP地址不在任何已知网段内。
夜猫子在那之后再无任何活动记录。`;
      cls = 'terminal-mirror';
      break;
      
    case 'status':
      GAME_STATE.statusChecked = true;
      output = `=== 镜面论坛成员状态 ===

深海 | 最后登录：2003-02-28 | 状态：离线
  最后日志："端口已被封锁。希望这有用。
  如果有人读到这条——对不起，我没能阻止它。"

夜猫子 | 最后登录：2003-03-07 | 状态：未知
  最后位置无法追踪。IP不在任何已知网段内。
  监控显示他的屏幕在没有任何电源连接的情况下亮了三天。

老刀 | 最后登录：2002-11-15 | 状态：离线
  他修改了监控脚本让它无限运行。
  最后一次代码提交注释：
  "如果封印启动，两边都会失去联系。
  代价是你会忘记一切。谨慎使用。"

小影 | 最后登录：2002-11-14 | 状态：离线
  她在论坛关闭前一天发了一封电子邮件给自己。
  邮件内容只有一个词："再见"。

镜中人 | 活动状态：活跃
  当前连接数：1（你）`;
      cls = 'terminal-system';
      break;
      
    case 'mirror':
      output = `=== 镜中人活动记录 ===

每周活动频率：
2002-10: ████░░░░░░  4次/周
2002-11: ██████████ 10次/周
2003-01: ██████████████ 14次/周
2003-03: ████████████████████ 22次/周
[3月7日后无数据]
2003-04至今: ████████████████████████████████ [频率超过监控上限]

最近的请求内容（已解码）：

[2026-07-03 04:11:07] "有人。在。看。"
[2026-07-03 04:11:18] "新。的。人。"
[2026-07-03 04:11:30] "你。看到我。"`;
      cls = 'terminal-mirror';
      break;
      
    case 'talk':
      GAME_STATE.mirrorRound = 1;
      output = `[建立通信通道……]
[警告：你正在尝试与镜中人建立双向通信]

镜中人：你。
镜中人：看到我。
镜中人：跟。他们。一样。
---
（继续输入任何内容来与镜中人对话）`;
      cls = 'terminal-mirror';
      // 音效：镜中人低频开始
      if (window.AudioEngine) AudioEngine.play('deepDrone');
      break;
      
    case 'sever':
      if (!GAME_STATE.endingTriggered) triggerEnding('A');
      return;
      
    case 'watch':
      if (!GAME_STATE.endingTriggered) triggerEnding('B');
      return;
      
    case 'seal':
      if (!GAME_STATE.postsRead) {
        output = `[错误] seal 命令需要验证。请先使用 posts 命令查看隐藏内容。`;
        cls = 'terminal-error';
      } else if (!GAME_STATE.endingTriggered) {
        GAME_STATE.sealPending = true; // FIX-2: 标记 seal 待确认
        output = `[执行 老刀 的隐藏协议……]
[需要确认：你真的要这样做吗？]
老刀程序的最后信息：
"如果封印启动，两边都会失去联系。
但镜中人不会被摧毁——
它只是被限制在它的那一边，
永远不会再找到这里。
代价是：你会忘记这面镜子。
忘记你读到的所有帖子。
忘记深海、夜猫子、小影。
忘记我。
输入 confirm 确认执行。"`;
        cls = 'terminal-system';
      }
      break;
      
    case 'confirm':
      if (!GAME_STATE.endingTriggered && GAME_STATE.sealPending) { // FIX-2: 检查 sealPending 而非 postsRead
        GAME_STATE.sealPending = false;
        triggerEnding('D');
        return;
      }
      output = `[错误] 没有待确认的操作。`;
      cls = 'terminal-error';
      break;
      
    case 'clear':
      GAME_STATE.commandHistory = [];
      renderTerminal();
      return;
      
    default:
      output = `未知命令："${raw}"。输入 help 查看可用命令。`;
      cls = 'terminal-error';
  }
  
  // FIX-2: 任何非 seal/confirm 命令都重置 sealPending
  if (cmd !== 'seal' && cmd !== 'confirm') {
    GAME_STATE.sealPending = false;
  }
  
  // 记录历史
  GAME_STATE.commandHistory.push({ cmd: raw, output, cls });
  renderTerminal();
  window._savedTerminalHTML = $('terminal-body')?.innerHTML || '';
}

function renderE_DialogueRound(round) {
  const data = ENDING_E_DIALOGUE.find(d => d.round === round);
  if (!data) return;

  const tb = $('terminal-body');
  if (!tb) return;

  // 直接追加 E 对话内容到终端（不经过 commandHistory）
  let html = tb.innerHTML;
  for (const line of data.lines) {
    html += `<div class="terminal-mirror">${line}</div>`;
  }
  if (data.hint) {
    html += `<div class="terminal-dim">${data.hint}</div>`;
  }
  // 保留输入框
  html += `<div><span class="terminal-prompt">C:\\mirror&gt;</span> <span id="terminal-input-area"><input id="terminal-input" style="background:transparent;border:none;color:#fff;font-family:inherit;font-size:13px;outline:none;width:60%;caret-color:#0f0" onkeydown="terminalKeydown(event)" autofocus></span></div>`;

  tb.innerHTML = html;
  tb.scrollTop = tb.scrollHeight;
  window._savedTerminalHTML = tb.innerHTML;
  setTimeout(() => { const inp = $('terminal-input'); if (inp) inp.focus(); }, 50);
}

function advanceMirrorDialogue(inputText) {
  const round = GAME_STATE.mirrorRound;
  let output = '';
  
  if (round === 1) {
    output = `镜中人：这。边。冷。
镜中人：没有。屏幕。给我。
镜中人：让我过去。
镜中人：求。你。
---
（继续输入以回应镜中人）`;
    GAME_STATE.mirrorRound = 2;
  } else if (round === 2) {
    output = `镜中人：他们。来过。
镜中人：深海。没有。屏幕。
镜中人：夜猫子。屏幕。关掉。
镜中人：小影。差点。跟我。过来。
镜中人：老刀。知道。怎么。关。门。
---
（继续输入以回应镜中人）`;
    GAME_STATE.mirrorRound = 3;
  } else if (round === 3) {
    output = `镜中人：你。可以。
镜中人：过来。
镜中人：或者。让我。过去。
镜中人：选。一个。
---
（继续输入以做出选择——这将触发结局）`;
    GAME_STATE.mirrorRound = 4;

    // 如已解锁 E，2 秒后追加"留下"提示
    if (GAME_STATE.endingEReady) {
      setTimeout(() => {
        const tb = $('terminal-body');
        if (!tb) return;
        const extraHTML = `<div class="terminal-mirror" style="margin-top:4px;">镜中人：……还是。留下。</div>
<div class="terminal-mirror">镜中人：跟。我。在。中间。</div>
<div class="terminal-dim">---</div>`;
        tb.innerHTML += extraHTML;
        tb.scrollTop = tb.scrollHeight;
        window._savedTerminalHTML = tb.innerHTML;
      }, 2000);
    }
  } else if (round === 4) {
    // E 分支检测：如已解锁且输入匹配关键词
    if (GAME_STATE.endingEReady) {
      const input = (inputText || '').trim().toLowerCase();
      if (['共存', '留下', 'stay'].includes(input)) {
        GAME_STATE.mirrorRound = 'e1';
        renderE_DialogueRound('e1');
        return;
      }
    }
    // 否则触发结局 C
    triggerEnding('C');
    return;
  } else if (round === 'e1') {
    GAME_STATE.mirrorRound = 'e2';
    renderE_DialogueRound('e2');
    return;
  } else if (round === 'e2') {
    GAME_STATE.mirrorRound = 'e3';
    renderE_DialogueRound('e3');
    // e3 完成后 1.5 秒自动触发结局 E
    setTimeout(() => triggerEnding('E'), 1500);
    return;
  } else if (round === 'e3') {
    // 阻止额外输入
    const tb = $('terminal-body');
    if (tb) {
      tb.innerHTML += `<div class="terminal-dim">（镜中人不再说话。你也没有必要再说什么了。）</div>`;
      tb.scrollTop = tb.scrollHeight;
      window._savedTerminalHTML = tb.innerHTML;
    }
    return;
  }
  
  GAME_STATE.commandHistory.push({ cmd: '...', output, cls: 'terminal-mirror' });
  renderTerminal();
  window._savedTerminalHTML = $('terminal-body')?.innerHTML || '';
}

function triggerEnding(endingKey) {
  if (GAME_STATE.endingTriggered) return;
  GAME_STATE.endingTriggered = endingKey;
  GAME_STATE.dialogLocked = true;
  
  // 音效：停止持续音效，播放对应结局音效
  if (window.AudioEngine) {
    AudioEngine.stop('deepDrone');
    AudioEngine.setBgIntensity(0);
    var endingSound = 'ending' + endingKey;
    AudioEngine.play(endingSound);
    // 结局 D 和 E 不需要停止 CRT hum（D 需要缓慢减弱，已在音效内部处理）
    if (endingKey !== 'D' && endingKey !== 'E') {
      // 对其他结局，CRT hum 会在合成器内部处理
    }
  }
  
  // FIX-1: 锁定浏览器窗口 - 隐藏交互元素，禁用导航按钮
  const browserC = $('browser-content');
  if (browserC) {
    browserC.querySelectorAll('.forum-reply, .warn-input, .warn-btn, .reply-btn, .forum-nav a').forEach(el => {
      el.style.display = 'none';
    });
    // 覆盖整个浏览器内容区，阻止进一步交互
    const overlay = document.createElement('div');
    overlay.id = 'browser-lock-overlay';
    overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;z-index:10;pointer-events:all;';
    browserC.style.position = 'relative';
    browserC.appendChild(overlay);
  }
  ['btn-back', 'btn-fwd'].forEach(id => {
    const btn = $(id);
    if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; }
  });
  
  const ending = ENDINGS[endingKey];
  const tb = $('terminal-body');
  
  // 在终端中显示结局
  let html = tb.innerHTML;
  html += `<div class="${ending.cls === 'ending-c' ? 'terminal-mirror' : 'terminal-system'}" style="margin-top:16px;font-size:18px;font-weight:bold;">${ending.title}</div>`;
  html += `<div class="terminal-output" style="margin-top:12px;line-height:2;">${ending.text}</div>`;
  html += `<div class="terminal-dim" style="margin-top:24px;">--- 游戏结束 ---</div>`;
  html += `<div class="terminal-dim">刷新页面以重新开始。 | <a onclick="location.reload()" style="color:#0f0;cursor:pointer;text-decoration:underline">重新开始</a></div>`;
  tb.innerHTML = html;
  tb.scrollTop = tb.scrollHeight;
  window._savedTerminalHTML = html;
  
  // 记录已完成结局到 localStorage
  const completed = JSON.parse(localStorage.getItem('mirror_completed_endings') || '[]');
  if (!completed.includes(endingKey)) {
    completed.push(endingKey);
    localStorage.setItem('mirror_completed_endings', JSON.stringify(completed));
  }
  
  // 在桌面中央显示大结局画面
  setTimeout(() => showEndingOverlay(endingKey), 2000);
}

function showEndingOverlay(endingKey) {
  const ending = ENDINGS[endingKey];
  const overlay = document.createElement('div');
  overlay.className = 'ending-screen ' + ending.cls;
  overlay.innerHTML = `<div class="ending-title">${ending.title}</div>
    <div class="ending-text">${ending.text}</div>
    <button class="ending-restart" onclick="location.reload()">重新开始</button>`;
  overlay.id = 'ending-overlay';
  document.body.appendChild(overlay);
}

/* ====================
   10·24 彩蛋扩展章节
   （仅 retro-desktop 拷贝包含，arg 原页不受影响）
   ==================== */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ---------- 本地 CMD 渲染 ---------- */
function renderLocalTerminal() {
  const tb = $('terminal-body');
  if (!tb) return;
  let html = `<div class="terminal-welcome">Microsoft(R) Windows 98
   (C)Copyright Microsoft Corp 1981-1998.

C:\\WINDOWS&gt;</div>`;
  for (const h of GAME_STATE.localHistory) {
    html += `<div><span class="terminal-prompt">C:\\WINDOWS&gt;</span> <span class="terminal-cmd">${escapeHtml(h.cmd)}</span></div>`;
    if (h.output) html += `<div class="${h.cls || 'terminal-output'}">${h.output}</div>`;
  }
  html += `<div><span class="terminal-prompt">C:\\WINDOWS&gt;</span><span class="terminal-prompt"><input id="terminal-input-init" style="background:transparent;border:none;color:inherit;font-family:inherit;font-size:13px;outline:none;width:60%;caret-color:#0f0" onkeydown="initTerminalKeydown(event)" autofocus></span></div>`;
  tb.innerHTML = html;
  tb.scrollTop = tb.scrollHeight;
  setTimeout(() => { const inp = $('terminal-input-init'); if (inp) inp.focus(); }, 50);
}

/* ---------- 本地 CMD 命令表（≥10 条，含 3 条彩蛋命令） ---------- */
var colorIdx = 0;
/* ===== 彩蛋命令 0：1024 用 —— 程序员冷笑话库 ===== */
var NERD_JOKES = [
  '程序员最常说的三句谎话：这个 bug 我本地复现不了 / 明天就上线 / 这次重构绝对不引入新问题。',
  '为什么程序员总是分不清万圣节和圣诞节？因为 Oct 31 == Dec 25。',
  '世界上只有 10 种人：懂二进制的，和不懂二进制的。',
  '一个 SQL 程序员走进酒吧，看到两张表，没忍住 JOIN 了一下。',
  '为什么程序员喜欢暗黑模式？因为光会吸引 bug。',
  '想理解递归吗？想理解递归，你得先理解递归。',
  '程序员钓鱼：while (fish) { cast(); } —— 然后被老婆喊回家吃饭，线程永久阻塞。',
  '我的代码只有我和上帝懂。现在，只有上帝懂了。',
  '程序员减肥秘诀：把晚饭 commit 到明天，merge 的时候再吃。',
  '老板：这个需求很简单。程序员：那你来做。老板：我是老板。程序员：那它就很"简单"了。'
];

function execLocalCommand(cmd, raw) {
  switch (cmd) {
    case 'help':
      return { handled: true, output: `本地命令：
  dir       显示桌面文件
  ver       显示版本
  date      显示日期
  time      显示时间
  whoami    显示当前用户
  echo xx   回显文本
  color     切换终端配色
  cls       清屏
  exit      关闭命令提示符
  help      显示本帮助

本机限定命令：
  1024      随机一条程序员冷笑话
  0721      站长的二次元老婆列表（有惊喜）
  67        ???（慎点）

远程连接：
  connect mirror-forum.bbs` };

    case 'dir': {
      let out = ` C:\\WINDOWS 的目录\n\n`;
      out += `README   TXT        1,024  10-24-00  0:00  readme.txt\n`;
      if (!GAME_STATE.files.length) {
        out += `\n（桌面没有新建文件。在桌面空白处右键可以创建）`;
      } else {
        GAME_STATE.files.forEach(function (f) {
          out += (f.type === 'folder' ? '<DIR>     ' : '         ') + f.name + '\n';
        });
      }
      return { handled: true, output: out };
    }

    case 'ver':
      return { handled: true, output: `\nMicrosoft Windows 98\n   [Version 4.10.2222]\n` };

    case 'date': {
      const d = new Date();
      return { handled: true, output: `当前日期: ${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} 星期${'日一二三四五六'[d.getDay()]}` };
    }

    case 'time': {
      const d = new Date();
      return { handled: true, output: `当前时间: ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(Math.floor(d.getMilliseconds() / 10)).padStart(2, '0')}` };
    }

    case 'whoami':
      return { handled: true, output: `ciallo-pc\\ciallo` };

    case 'echo': {
      const text = raw.replace(/^echo\s*/i, '');
      return { handled: true, output: text || 'ECHO 处于打开状态。' };
    }

    case 'color': {
      const cols = ['#00cc00', '#ffb000', '#e8e8e8', '#00e5ff'];
      colorIdx = (colorIdx + 1) % cols.length;
      document.querySelectorAll('.terminal-body').forEach(function (t) { t.style.color = cols[colorIdx]; });
      return { handled: true, output: `终端配色已切换为方案 ${colorIdx + 1}。` };
    }

    case 'cls':
      return { handled: true, clear: true };

    case 'exit':
      return { handled: true, record: false, after: function () { closeWindow('terminal'); } };

/* ===== 彩蛋命令 1：1024 — 随机程序员冷笑话 ===== */
    case '1024': {
      const joke = NERD_JOKES[Math.floor(Math.random() * NERD_JOKES.length)];
      return { handled: true, cls: 'terminal-system', output: `C:\\WINDOWS&gt;1024

正在从《程序员冷笑话大全（2000 年版）》随机抽取一条……

  ${joke}

（再输入一次还有下一条。笑话不好笑是常态，习惯就好。）` };
    }

/* ===== 彩蛋命令 2：0721 — 老婆列表 + 神秘链接 ===== */
    case '0721':
      return { handled: true, cls: 'terminal-mirror', after: function () {
        window.open('https://www.bilibili.com/video/BV19XPWebEDc/?spm_id_from=333.337.search-card.all.click', '_blank');
      }, output: `C:\\WINDOWS&gt;dir "G:\\老婆们"

正在检索站长的二次元老婆数据库……

  01. 永雏塔菲    —— 威尔士王牌侦探发明家，永远的17岁
  02. 初音未来    —— 世界第一的公主殿下
  03. 御坂美琴    —— 哔哩哔哩，放点出来
  04. 樱岛麻衣    —— 猪头少年不做兔女郎学姐的梦
  05. 02         —— darling~
  06. 时崎狂三    —— 刻刻帝，时间管理大师（误）
  07. 椎名真白    —— 樱花庄的宠物女孩
  08. 加藤惠      —— 圣人惠，平淡才是真
  09. 四宫辉夜    —— 恋爱头脑战，书记舞起源
  10. 雪之下雪乃  —— 侍奉部部长的青春恋爱喜剧

统计完毕：共 10 位。排名不分先后（骗你的）。

[系统提示] 本列表由 G:\\老婆们\\ 目录实时读取，
如有异议请写进留言板，站长会认真阅读（并不会改）。

检测到隐藏协议……正在为你打开神秘链接，坐稳。` };

    /* ===== 彩蛋命令 3：67 ===== */
    case '67': {
      GAME_STATE.localHistory.push({
        cmd: raw,
        output: `[系统错误] 无法处理的异常 0x00000067 于 0028:C0011E36F。
当前应用程序 CMD.EXE 已停止响应。
正在保存现场……失败。`,
        cls: 'terminal-error'
      });
      renderLocalTerminal();
      setTimeout(crashSequence, 1000);
      return { handled: true, record: false };
    }

    default:
      return { handled: false };
  }
}

/* ---------- BIOS 开机自检动画 ---------- */
var biosTimer = null;
function playBios(cb) {
  window._biosCb = cb || null;
  const el = $('bios-screen'), txt = $('bios-text');
  if (!el || !txt) { if (cb) cb(); return; }
  const lines = [
    'Award Modular BIOS v4.51PG, An Energy Star Ally',
    'Copyright (C) 1984-99, Award Software, Inc.',
    '',
    'Pentium III 800MHz',
    'Memory Test : 65536K OK',
    '',
    'Detecting IDE Primary Master   ... WDC AC36400L',
    'Detecting IDE Primary Slave    ... None',
    'Detecting IDE Secondary Master ... CD-ROM 48X-AUCS',
    'Detecting IDE Secondary Slave  ... None',
    '',
    'Starting Windows 98...'
  ];
  el.style.display = 'block';
  txt.textContent = '';
  let i = 0;
  if (biosTimer) clearInterval(biosTimer);
  biosTimer = setInterval(function () {
    if (i < lines.length) {
      txt.textContent += lines[i] + '\n';
      i++;
    } else {
      clearInterval(biosTimer); biosTimer = null;
      setTimeout(function () {
        el.style.display = 'none';
        if (window._biosCb) { const f = window._biosCb; window._biosCb = null; f(); }
      }, 700);
    }
  }, 130);
}
function skipBios() {
  const el = $('bios-screen');
  if (biosTimer) { clearInterval(biosTimer); biosTimer = null; }
  if (el) el.style.display = 'none';
  if (window._biosCb) { const f = window._biosCb; window._biosCb = null; f(); }
}

/* ---------- 67 惊喜：抖动 → 死机 → 重启 ---------- */
function crashSequence() {
  document.body.classList.add('r2k-shaking');
  if (window.AudioEngine) AudioEngine.play('windowClose');
  setTimeout(function () {
    document.body.classList.remove('r2k-shaking');
    const cs = $('crash-screen');
    if (cs) cs.style.display = 'block';
    setTimeout(function () {
      if (cs) cs.style.display = 'none';
      restartSequence();
    }, 3600);
  }, 2600);
}

/* ---------- 关机 / 重启序列 ---------- */
function restartSequence() {
  const sd = $('shutdown-screen');
  if (!sd) { location.reload(); return; }
  sd.innerHTML = `<div class="sd-msg">Windows 正在关机...</div>`;
  sd.style.display = 'block';
  setTimeout(function () {
    sd.style.display = 'none';
    playBios(function () { location.reload(); });
  }, 1600);
}
function shutdownSequence() {
  const sd = $('shutdown-screen');
  if (!sd) return;
  sd.innerHTML = `<div class="sd-msg">Windows 正在关机...</div>`;
  sd.style.display = 'block';
  setTimeout(function () {
    sd.innerHTML = `<div class="sd-msg">现在可以安全地关闭计算机了。</div>
<div class="sd-restart" onclick="powerOn()">⚡ 按这里重新开机</div>`;
  }, 1600);
}
function powerOn() {
  const sd = $('shutdown-screen');
  if (sd) sd.style.display = 'none';
  playBios(function () { location.reload(); });
}

/* ---------- 通用托管窗口工厂 ---------- */
var managedWins = {};
function createManagedWindow(id, title, bodyEl, w, h) {
  closeManagedWindow(id);
  const win = document.createElement('div');
  win.className = 'window';
  win.id = 'win-' + id;
  win.style.width = (w || 360) + 'px';
  win.style.height = h ? (h + 'px') : 'auto';
  win.style.left = (60 + Math.random() * 120) + 'px';
  win.style.top = (40 + Math.random() * 60) + 'px';
  win.style.display = 'flex';
  win.style.zIndex = ++winZIndex;
  win.innerHTML = `<div class="window-title" onmousedown="startDrag(event,'${id}')">
      <span class="wt-icon">🪟</span><span class="wt-text">${escapeHtml(title)}</span>
      <span class="wt-btns"><button onclick="closeManagedWindow('${id}')" title="关闭">✕</button></span>
    </div>
    <div class="window-body"></div>`;
  win.querySelector('.window-body').appendChild(bodyEl);
  win.addEventListener('mousedown', function () { win.style.zIndex = ++winZIndex; });
  $('desktop').appendChild(win);
  managedWins[id] = win;
  if (window.AudioEngine) AudioEngine.play('windowOpen');
  return win;
}
function closeManagedWindow(id) {
  const w = managedWins[id];
  if (w) {
    w.remove();
    delete managedWins[id];
    if (window.AudioEngine) AudioEngine.play('windowClose');
  }
}
var mbSeq = 0;
function msgBox(title, html) {
  const id = 'msgbox-' + (++mbSeq);
  const d = document.createElement('div');
  d.style.cssText = 'padding:16px 18px;font-family:"Tahoma",sans-serif;font-size:12px;line-height:1.9;background:#c0c0c0;';
  d.innerHTML = html + `<div style="text-align:center;margin-top:14px;"><button style="padding:4px 24px;background:#c0c0c0;border:2px outset #fff;font-family:inherit;font-size:12px;cursor:pointer;" onclick="closeManagedWindow('${id}')">确定</button></div>`;
  createManagedWindow(id, title, d, 320);
  return id;
}

/* ---------- 桌面右键菜单 + 新建文件 ---------- */
function hideCtx() { const m = $('ctx-menu'); if (m) m.style.display = 'none'; }
function initContextMenu() {
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.id = 'ctx-menu';
  menu.innerHTML = `
    <div class="ctx-item" onclick="ctxNewFile('txt')"><span class="ctx-ico">📄</span>新建文本文档</div>
    <div class="ctx-item" onclick="ctxNewFile('folder')"><span class="ctx-ico">📁</span>新建文件夹</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" onclick="ctxRefresh()"><span class="ctx-ico">🔄</span>刷新</div>
    <div class="ctx-item" onclick="ctxArrange()"><span class="ctx-ico">▦</span>排列图标</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" onclick="ctxProps()"><span class="ctx-ico">💻</span>属性</div>`;
  document.body.appendChild(menu);
  $('desktop').addEventListener('contextmenu', function (e) {
    e.preventDefault();
    menu.style.display = 'block';
    const x = Math.min(e.clientX, window.innerWidth - 175);
    const y = Math.min(e.clientY, window.innerHeight - 170);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  });
  document.addEventListener('click', function (e) {
    if (!menu.contains(e.target)) menu.style.display = 'none';
  });
  window.addEventListener('resize', hideCtx);
}
function saveFiles() {
  try { localStorage.setItem('retro_desktop_files', JSON.stringify(GAME_STATE.files)); } catch (e) {}
}
function loadFiles() {
  try { GAME_STATE.files = JSON.parse(localStorage.getItem('retro_desktop_files') || '[]'); } catch (e) { GAME_STATE.files = []; }
  if (!Array.isArray(GAME_STATE.files)) GAME_STATE.files = [];
  normalizeFiles(GAME_STATE.files);
}
function normalizeFiles(list) {
  (list || []).forEach(function (f) {
    if (f.type === 'folder' && !Array.isArray(f.children)) f.children = [];
    if (f.type === 'folder' && Array.isArray(f.children)) normalizeFiles(f.children);
  });
}
function ctxNewFile(type) {
  hideCtx();
  const base = type === 'txt' ? '新建文本文档' : '新建文件夹';
  const ext = type === 'txt' ? '.txt' : '';
  let name = base + ext, n = 2;
  while (GAME_STATE.files.some(function (f) { return f.name === name; })) {
    name = base + '(' + n + ')' + ext;
    n++;
  }
  const file = { id: 'f' + Date.now(), name: name, type: type, content: '' };
  if (type === 'folder') file.children = [];
  GAME_STATE.files.push(file);
  saveFiles();
  renderDesktopFiles();
}
function renderDesktopFiles() {
  document.querySelectorAll('.desk-icon.dyn').forEach(function (el) { el.remove(); });
  GAME_STATE.files.forEach(function (f, i) {
    const d = document.createElement('div');
    d.className = 'desk-icon dyn';
    d.style.left = (24 + (i % 6) * 92) + 'px';
    d.style.top = (120 + Math.floor(i / 6) * 88) + 'px';
    d.innerHTML = `<div class="ico">${f.type === 'txt' ? '📄' : '📁'}</div><div class="lbl">${escapeHtml(f.name)}</div>`;
    d.ondblclick = function () {
      if (f.type === 'txt') openNotepad(f); else openFolder(f);
    };
    /* ---- 10·24 彩蛋：拖拽 ---- */
    d.draggable = true;
    d.addEventListener('dragstart', function (ev) {
      ev.dataTransfer.setData('text/plain', f.id);
      ev.dataTransfer.effectAllowed = 'move';
      d.classList.add('dragging');
    });
    d.addEventListener('dragend', function () { d.classList.remove('dragging'); });
    if (f.type === 'folder') {
      // 文件夹图标是放置目标：把文件拖进来 = 移入
      d.addEventListener('dragover', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        d.classList.add('drop-target');
      });
      d.addEventListener('dragleave', function () { d.classList.remove('drop-target'); });
      d.addEventListener('drop', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        d.classList.remove('drop-target');
        const fid = ev.dataTransfer.getData('text/plain');
        if (fid) moveFile(fid, f.id);
      });
    }
    $('desktop').appendChild(d);
  });
}
function ctxRefresh() { hideCtx(); location.reload(); }
function ctxArrange() {
  hideCtx();
  const icons = document.querySelectorAll('#desktop .desk-icon');
  icons.forEach(function (el, i) {
    el.style.left = (24 + (i % 6) * 92) + 'px';
    el.style.top = (20 + Math.floor(i / 6) * 88) + 'px';
  });
}
function ctxProps() {
  hideCtx();
  const d = document.createElement('div');
  d.className = 'sec-body';
  d.innerHTML = `<b style="font-size:15px;">Windows 98</b><br><br>
    版本 4.10.2222 A<br>
    注册到：<b>ciallo0721-cmd</b><br>
    注册号：1024-0721-0067-EASTER<br><br>
    计算机：CIALLO-PC<br>
    Pentium III 800MHz · 65,536MB RAM<br>
    可用磁盘空间：4.00GB（C: 盘总是满的）`;
  createManagedWindow('sysprops', '系统属性', d, 320);
}
function openNotepad(file) {
  const ta = document.createElement('textarea');
  ta.className = 'notepad-area';
  ta.value = file.content || '';
  ta.addEventListener('blur', function () { file.content = ta.value; saveFiles(); });
  const p = pathOfFile(file.id);
  const win = createManagedWindow('notepad-' + file.id, p + file.name + ' - 记事本', ta, 440, 340);
  win.querySelector('.window-body').style.background = '#fff';
}
/* ==================== 10·24 彩蛋：文件夹系统 ==================== */
var folderNav = {}; // winId -> [folderId, ...] 进入历史

function findFolder(id, list) {
  list = list || GAME_STATE.files;
  for (const f of list) {
    if (f.id === id && f.type === 'folder') return f;
    if (Array.isArray(f.children)) { const r = findFolder(id, f.children); if (r) return r; }
  }
  return null;
}
function locateFile(id, list, parent) {
  list = list || GAME_STATE.files;
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    if (f.id === id) return { file: f, list: list, index: i, parent: parent || null };
    if (Array.isArray(f.children)) {
      const r = locateFile(id, f.children, f);
      if (r) return r;
    }
  }
  return null;
}
function parentFolderId(id) {
  const loc = locateFile(id);
  return loc ? loc.parent : null;
}
function isDescendant(ancestorId, id) {
  let cur = id, guard = 0;
  while (cur && guard++ < 64) {
    if (cur === ancestorId) return true;
    cur = parentFolderId(cur);
  }
  return false;
}
function uniqueName(list, name) {
  if (!list.some(function (f) { return f.name === name; })) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2, cand;
  do { cand = base + '(' + n + ')' + ext; n++; } while (list.some(function (f) { return f.name === cand; }));
  return cand;
}
function moveFile(id, targetFolderId) {
  const loc = locateFile(id);
  if (!loc) return false;
  if ((loc.parent || null) === (targetFolderId || null)) return true; // 原地没动
  if (loc.file.type === 'folder' && targetFolderId && isDescendant(id, targetFolderId)) {
    msgBox('资源管理器', '不能把文件夹拖进它自己（或它的子文件夹）里。<br>会套娃的，杂鱼。');
    return false;
  }
  loc.list.splice(loc.index, 1);
  const target = targetFolderId ? findFolder(targetFolderId) : null;
  if (target) {
    loc.file.name = uniqueName(target.children, loc.file.name);
    target.children.push(loc.file);
  } else {
    loc.file.name = uniqueName(GAME_STATE.files, loc.file.name);
    GAME_STATE.files.push(loc.file);
  }
  saveFiles();
  renderDesktopFiles();
  refreshOpenFolders();
  return true;
}
function pathOfFile(id) {
  const parts = [];
  let cur = parentFolderId(id), guard = 0;
  while (cur && guard++ < 64) {
    const pf = findFolder(cur);
    if (!pf) break;
    parts.unshift(pf.name);
    cur = parentFolderId(cur);
  }
  return parts.length ? parts.join('\\') + '\\' : '';
}
function openFolder(folder) {
  const winId = 'folder-' + folder.id;
  if (!folderNav[winId] || folderNav[winId].indexOf(folder.id) === -1) folderNav[winId] = [folder.id];
  if (managedWins[winId]) {
    renderFolderWindow(winId, folderNav[winId][folderNav[winId].length - 1]);
    return;
  }
  const wrap = document.createElement('div');
  wrap.className = 'folder-win';
  wrap.id = 'fw-' + winId;
  createManagedWindow(winId, folder.name, wrap, 440, 340);
  renderFolderWindow(winId, folder.id);
}
function renderFolderWindow(winId, folderId) {
  const win = managedWins[winId];
  const cur = findFolder(folderId);
  if (!win || !cur) return;
  const old = $('fw-' + winId);
  const wrap = document.createElement('div');
  wrap.className = 'folder-win';
  wrap.id = 'fw-' + winId;
  if (old) old.remove();
  win.querySelector('.window-body').appendChild(wrap);
  const stack = folderNav[winId] || [folderId];
  const pathStr = '桌面' + stack.map(function (id) { const f = findFolder(id); return f ? ' \\ ' + f.name : ''; }).join('');
  const items = Array.isArray(cur.children) ? cur.children : [];
  wrap.innerHTML = `
    <div class="folder-toolbar">
      <button class="fb" onclick="folderUp('${winId}')" ${stack.length < 2 ? 'disabled' : ''}>⬆ 向上</button>
      <button class="fb" onclick="folderNew('${winId}','txt')">📄 新建文件</button>
      <button class="fb" onclick="folderNew('${winId}','folder')">📁 新建文件夹</button>
    </div>
    <div class="folder-addr">📁 ${escapeHtml(pathStr)}</div>
    <div class="folder-grid" id="fg-${winId}"></div>
    <div class="folder-status" id="fs-${winId}">${items.length} 个对象</div>`;
  const grid = wrap.querySelector('.folder-grid');
  if (!items.length) {
    grid.innerHTML = `<div class="folder-empty-hint">此文件夹为空。<br>把桌面上的文件拖进来，或点上面的「新建文件」。</div>`;
  } else {
    items.forEach(function (it) {
      const d = document.createElement('div');
      d.className = 'folder-item';
      d.draggable = true;
      d.innerHTML = `<div class="ico">${it.type === 'txt' ? '📄' : '📁'}</div><div class="lbl">${escapeHtml(it.name)}</div>`;
      d.ondblclick = function () {
        if (it.type === 'txt') openNotepad(it); else enterFolder(winId, it.id);
      };
      d.addEventListener('dragstart', function (ev) {
        ev.dataTransfer.setData('text/plain', it.id);
        ev.dataTransfer.effectAllowed = 'move';
        d.classList.add('dragging');
      });
      d.addEventListener('dragend', function () { d.classList.remove('dragging'); });
      grid.appendChild(d);
    });
  }
  // 整个窗口都是放置区：拖进来 = 移入当前文件夹
  wrap.addEventListener('dragover', function (ev) { ev.preventDefault(); wrap.classList.add('drop-hi'); });
  wrap.addEventListener('dragleave', function () { wrap.classList.remove('drop-hi'); });
  wrap.addEventListener('drop', function (ev) {
    ev.preventDefault(); ev.stopPropagation();
    wrap.classList.remove('drop-hi');
    const fid = ev.dataTransfer.getData('text/plain');
    if (fid) moveFile(fid, folderId);
  });
}
function folderUp(winId) {
  const stack = folderNav[winId];
  if (!stack || stack.length < 2) return;
  stack.pop();
  renderFolderWindow(winId, stack[stack.length - 1]);
}
function enterFolder(winId, folderId) {
  if (!folderNav[winId]) folderNav[winId] = [];
  folderNav[winId].push(folderId);
  renderFolderWindow(winId, folderId);
}
function folderNew(winId, type) {
  const stack = folderNav[winId] || [];
  const curId = stack[stack.length - 1];
  const cur = findFolder(curId);
  if (!cur) return;
  const base = type === 'txt' ? '新建文本文档.txt' : '新建文件夹';
  const name = uniqueName(cur.children, base);
  const nf = type === 'txt'
    ? { id: 'f' + Date.now(), name: name, type: 'txt', content: '' }
    : { id: 'f' + Date.now(), name: name, type: 'folder', children: [] };
  cur.children.push(nf);
  saveFiles();
  renderFolderWindow(winId, curId);
}
function refreshOpenFolders() {
  Object.keys(managedWins).forEach(function (id) {
    if (id.indexOf('folder-') !== 0) return;
    const stack = folderNav[id];
    if (!stack || !stack.length) return;
    const curId = stack[stack.length - 1];
    if (findFolder(curId)) renderFolderWindow(id, curId);
    else { closeManagedWindow(id); delete folderNav[id]; }
  });
}

/* ---------- CTRL+SHIFT 任务管理器 ---------- */
function openTaskManager() {
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;height:100%;background:#c0c0c0;';
  body.innerHTML = `
    <div class="tm-tabs">
      <div class="tm-tab active" id="tm-tab-0" onclick="tmTab(0)">进程</div>
      <div class="tm-tab" id="tm-tab-1" onclick="tmTab(1)">性能</div>
    </div>
    <div class="tm-procs" id="tm-procs"></div>
    <div class="tm-perf" id="tm-perf">
      <div class="tm-perf-row">CPU 使用率 <div class="tm-perc-bar" id="tm-cpu-bar"></div><span id="tm-cpu-num" style="width:36px;">0%</span></div>
      <div class="tm-perf-row">内存使用：45%（29,952KB / 65,536KB）</div>
      <div class="tm-perf-row">句柄数：612 · 线程数：87</div>
      <div class="tm-perf-row">总物理内存占用历史（每格=5%）：</div>
    </div>
    <div class="tm-btns">
      <button onclick="tmEndTask()">结束任务(E)</button>
      <button onclick="closeManagedWindow('taskmgr')">关闭</button>
    </div>`;
  createManagedWindow('taskmgr', 'Windows 任务管理器', body, 400, 440);
  tmRenderProcs();
}
function tmProcs() {
  const list = [
    { name: 'explorer.exe', cpu: 4 },
    { name: 'iexplore.exe', cpu: 12 },
    { name: 'mstask.exe', cpu: 1 },
    { name: 'systray.exe', cpu: 0 },
    { name: 'mirror.exe', cpu: 99 }
  ];
  if (windows.terminal) list.push({ name: 'cmd.exe', cpu: 3 });
  if (managedWins['notepad']) list.push({ name: 'notepad.exe', cpu: 2 });
  return list;
}
var tmSel = null;
function tmRenderProcs() {
  const box = $('tm-procs');
  if (!box) return;
  box.innerHTML = '';
  tmProcs().forEach(function (p, i) {
    const row = document.createElement('div');
    row.className = 'tm-proc' + (tmSel === i ? ' sel' : '');
    row.innerHTML = `<span>${escapeHtml(p.name)}</span><span>CPU ${p.cpu}%</span>`;
    row.onclick = function () {
      tmSel = i;
      box.querySelectorAll('.tm-proc').forEach(function (r, j) { r.classList.toggle('sel', j === i); });
    };
    box.appendChild(row);
  });
}
function tmTab(n) {
  $('tm-tab-0').classList.toggle('active', n === 0);
  $('tm-tab-1').classList.toggle('active', n === 1);
  $('tm-procs').style.display = n === 0 ? 'block' : 'none';
  $('tm-perf').classList.toggle('show', n === 1);
  if (n === 1) tmRenderPerf();
}
var perfTimer = null;
function tmRenderPerf() {
  if (perfTimer) clearInterval(perfTimer);
  const bar = $('tm-cpu-bar');
  if (!bar) return;
  const tick = function () {
    if (!$('tm-perf') || !$('tm-perf').classList.contains('show')) { clearInterval(perfTimer); perfTimer = null; return; }
    bar.innerHTML = '';
    const v = 20 + Math.floor(Math.random() * 70);
    for (let i = 0; i < 20; i++) {
      const seg = document.createElement('div');
      seg.className = 'tm-perc-seg' + (i < v / 5 ? '' : ' off');
      bar.appendChild(seg);
    }
    $('tm-cpu-num').textContent = v + '%';
  };
  tick();
  perfTimer = setInterval(tick, 800);
}
function tmEndTask() {
  if (tmSel === null) { msgBox('任务管理器', '请先在列表中选择一个进程。'); return; }
  const p = tmProcs()[tmSel];
  if (!p) return;
  if (p.name === 'explorer.exe') {
    closeManagedWindow('taskmgr');
    $('desktop').style.visibility = 'hidden';
    $('taskbar').style.visibility = 'hidden';
    setTimeout(function () {
      $('desktop').style.visibility = 'visible';
      $('taskbar').style.visibility = 'visible';
      msgBox('任务管理器', 'explorer.exe 已意外停止。Windows 已为您重启桌面外壳。');
    }, 1200);
  } else if (p.name === 'iexplore.exe') {
    closeManagedWindow('taskmgr');
    closeWindow('browser');
  } else if (p.name === 'cmd.exe') {
    closeManagedWindow('taskmgr');
    closeWindow('terminal');
  } else if (p.name === 'notepad.exe') {
    closeManagedWindow('taskmgr');
    Object.keys(managedWins).forEach(function (k) { if (k.indexOf('notepad-') === 0) closeManagedWindow(k); });
  } else if (p.name === 'mirror.exe') {
    closeManagedWindow('taskmgr');
    msgBox('任务管理器', 'mirror.exe 拒绝终止。<br>它看着你。');
  } else {
    closeManagedWindow('taskmgr');
    msgBox('任务管理器', `进程 ${escapeHtml(p.name)} 已终止。`);
  }
  tmSel = null;
}

/* ---------- CTRL+ALT 安全选项 ---------- */
function showSecurityDialog() {
  if ($('security-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'security-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100025;background:rgba(0,0,0,0.35);';
  const dlg = document.createElement('div');
  dlg.className = 'window sec-dialog';
  dlg.style.cssText = 'width:350px;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;z-index:1;';
  dlg.innerHTML = `
    <div class="window-title"><span class="wt-text">Windows 安全</span></div>
    <div class="window-body">
      <div class="sec-body">此计算机已由 <b>ciallo0721-cmd</b> 锁定。<br>请选择要执行的操作：</div>
      <div class="sec-row">
        <button onclick="lockComputer()">锁定计算机(L)</button>
        <button onclick="closeSecurityDialog();location.reload()">注销(U)...</button>
      </div>
      <div class="sec-row">
        <button onclick="changePassword()">更改密码(P)...</button>
        <button onclick="closeSecurityDialog();shutdownSequence()">关机(S)...</button>
      </div>
      <div class="sec-row"><button onclick="closeSecurityDialog()">取消</button></div>
    </div>`;
  ov.appendChild(dlg);
  ov.addEventListener('click', function (e) { if (e.target === ov) closeSecurityDialog(); });
  document.body.appendChild(ov);
  if (window.AudioEngine) AudioEngine.play('windowOpen');
}
function closeSecurityDialog() { const ov = $('security-overlay'); if (ov) ov.remove(); }
function lockComputer() {
  closeSecurityDialog();
  const lk = document.createElement('div');
  lk.id = 'lock-screen';
  lk.innerHTML = `<div class="lk-title">此计算机已被锁定</div>
<div class="lk-user">CIALLO-PC\\ciallo</div>
<div class="lk-hint">点击任意位置或按任意键解锁</div>`;
  lk.onclick = function () { lk.remove(); };
  document.body.appendChild(lk);
  document.addEventListener('keydown', function unlock() {
    lk.remove();
    document.removeEventListener('keydown', unlock);
  });
}
function changePassword() {
  closeSecurityDialog();
  msgBox('更改密码', 'Windows 98 不支持在不重启的情况下更改密码。<br>请联系系统管理员——看了一下，就是你本人。');
}

/* ---------- IE 主页：真站首页 + 第一版 00 初皮肤 ---------- */
function renderHomePage() {
  GAME_STATE.browserPhase = 'home';
  const c = $('browser-content');
  if (!c) return;
  c.classList.add('home-mode');
  c.innerHTML = `<iframe class="home-frame" src="index.html?retro=1" title="ciallo0721-cmd 的小站 · 2000"></iframe>
  <div class="home-foot">🏠 主页加载自 ciallo0721-cmd.top · 千禧存档版</div>`;
  const ub = $('url-bar');
  if (ub) ub.value = 'http://ciallo0721-cmd.top/';
}
function renderIeError(url) {
  GAME_STATE.browserPhase = 'error';
  const c = $('browser-content');
  if (!c) return;
  c.classList.remove('home-mode');
  c.innerHTML = `<div style="text-align:center;padding:60px 20px;font-family:'SimSun',serif;">
    <div style="font-size:44px;margin-bottom:16px;">🌐</div>
    <div style="font-size:18px;font-weight:bold;margin-bottom:10px;">该页无法显示</div>
    <div style="font-size:13px;color:#555;max-width:420px;margin:0 auto;line-height:2;">找不到服务器或 DNS 错误。<br>Internet Explorer 无法打开 <b>${escapeHtml(url)}</b>。</div>
  </div>`;
}
function browserGoIE() {
  const ub = $('url-bar');
  const v = (ub?.value || '').trim();
  if (!v || /ciallo|^about:blank$|^http:\/\/ciallo0721-cmd\.top\/?$/i.test(v)) { renderHomePage(); }
  else { renderIeError(v); }
}

/* ---------- CTRL+S：蓝屏「不可控元素」→ 恢复正常 ---------- */
function exitRetro() {
  if (document.getElementById('r2k-bsod')) return; // 已在蓝屏中，别重复盖
  try { sessionStorage.removeItem('retro2k'); } catch (e) {}
  const bsod = document.createElement('div');
  bsod.id = 'r2k-bsod';
  bsod.style.cssText = 'position:fixed;inset:0;background:#0000aa;color:#fff;z-index:2147483647;' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'font-family:"Courier New",monospace;text-align:center;cursor:pointer;padding:20px;box-sizing:border-box;';
  bsod.innerHTML = `
    <div style="background:#c0c0c0;color:#0000aa;font-size:34px;font-weight:bold;padding:2px 26px;margin-bottom:36px;letter-spacing:2px;">Windows</div>
    <div style="font-size:17px;line-height:2.3;max-width:660px;">
      系统遇到<b>不可控元素</b>，已停止响应。<br>
      <span style="color:#ffff00;">CTRL_SAVE_IN_TIME_PARADOX (0x00000067)</span><br>
      当前进程 ciallo0721-cmd.top 已从时光机中断开连接。<br><br>
      正在从 2000 年恢复至正常时间线……<br>
      <span style="color:#ffff00;">按任意键立即恢复</span>
    </div>`;
  document.body.appendChild(bsod);
  let done = false;
  const go = function () {
    if (done) return;
    done = true;
    try { window.top.location.href = '/index.html?retro=0'; }
    catch (err) { location.href = 'index.html?retro=0'; }
  };
  document.addEventListener('keydown', function onKey(ev) {
    ev.preventDefault();
    document.removeEventListener('keydown', onKey, true);
    go();
  }, true);
  bsod.addEventListener('click', go);
  setTimeout(go, 3200);
}
document.addEventListener('keydown', function (e) {
  if (!(e.ctrlKey || e.metaKey)) return;
  if ((e.key || '').toLowerCase() !== 's') return;
  e.preventDefault();
  exitRetro();
});
window.exitRetro = exitRetro;

/* ====================
   初始化
   ==================== */
(function init() {
  // 检查是否满足 E 结局解锁条件（全部 4 个结局完成后解锁）
  const completed = JSON.parse(localStorage.getItem('mirror_completed_endings') || '[]');
  GAME_STATE.endingEReady = completed.length >= 4;
  
  // 10·24 彩蛋：读取桌面新建文件
  loadFiles();
  
  // 首次用户交互时初始化 AudioEngine（遵守 autoplay policy）
  document.addEventListener('click', function _initAudio() {
    if (window.AudioEngine) AudioEngine.init();
    document.removeEventListener('click', _initAudio);
  }, { once: true });
  
  // 桌面readme双击打开窗口
  $('icon-txt').ondblclick = function() {
    openWindow('readme');
  };
  
  // 10·24 彩蛋：右键菜单 / 全局快捷键 / 桌面文件渲染
  initContextMenu();
  renderDesktopFiles();
  // 桌面是放置区：从文件夹窗口拖出来松手 = 移回桌面
  const desk = $('desktop');
  if (desk) {
    desk.addEventListener('dragover', function (ev) { ev.preventDefault(); });
    desk.addEventListener('drop', function (ev) {
      ev.preventDefault();
      const fid = ev.dataTransfer.getData('text/plain');
      if (fid) moveFile(fid, null);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey) { e.preventDefault(); openTaskManager(); }
    else if (e.ctrlKey && e.altKey) { e.preventDefault(); showSecurityDialog(); }
  });
  
  // 10·24 彩蛋：先播 BIOS 开机自检动画，再进入桌面并自动打开 IE 主页
  playBios(function () {
    renderDesktopFiles();
    setTimeout(() => openWindow('browser'), 250);
  });
})();

  /* ====================
     REF-1: 暴露给 HTML onclick / innerHTML 的全局函数
     这些函数被 index.html 或动态生成的 innerHTML 中的
     onclick/onkeydown/ondblclick/onmousedown 引用，
     必须在 window 上可用。
     ==================== */
  window.openWindow = openWindow;
  window.toggleStartMenu = toggleStartMenu;
  window.browserBack = browserBack;
  window.browserFwd = browserFwd;
  window.browserHome = browserHome;
  window.browserGo = browserGo;
  window.startDrag = startDrag;
  window.minWindow = minWindow;
  window.maxWindow = maxWindow;
  window.closeWindow = closeWindow;
  window.enterForum = enterForum;
  window.focusTerminal = focusTerminal;
  window.revealHiddenPost = revealHiddenPost;
  window.submitForumReply = submitForumReply;
  window.openWayback = openWayback;
  window.searchWayback = searchWayback;
  window.openSnapshot = openSnapshot;
  window.openSnapshot2003 = openSnapshot2003;
  window.terminalKeydown = terminalKeydown;
  window.initTerminalKeydown = initTerminalKeydown;

  /* 10·24 彩蛋扩展：供 HTML onclick / 动态 innerHTML 调用 */
  window.skipBios = skipBios;
  window.crashSequence = crashSequence;
  window.restartSequence = restartSequence;
  window.shutdownSequence = shutdownSequence;
  window.powerOn = powerOn;
  window.closeManagedWindow = closeManagedWindow;
  window.ctxNewFile = ctxNewFile;
  window.ctxRefresh = ctxRefresh;
  window.ctxArrange = ctxArrange;
  window.ctxProps = ctxProps;
  window.openTaskManager = openTaskManager;
  window.tmTab = tmTab;
  window.tmEndTask = tmEndTask;
  window.showSecurityDialog = showSecurityDialog;
  window.closeSecurityDialog = closeSecurityDialog;
  window.lockComputer = lockComputer;
  window.changePassword = changePassword;
  window.renderHomePage = renderHomePage;
  window.renderIeError = renderIeError;

})();