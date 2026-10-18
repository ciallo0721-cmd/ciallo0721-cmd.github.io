/**
 * ==========================================
 *  广告 / 推荐数据文件 v3
 *  格式：[类型, 图片链接, 跳转链接, 推荐语]
 *  · 前 3 项：硬广位用（728 横幅 + 跳转链接）
 *  · 第 4 项「推荐语」：只在软性推荐位（容器加 data-ad-soft="1"）显示。
 *    写成一句人话，别写成广告词；不写则用默认句。
 *  供 ad-system.js 使用
 * ==========================================
 */
var AD_DATA = [
  ['游戏',    '/css/ads/ad-game.svg?t=20260808-2',    '/adss.html',                  '我在这几个小游戏里花了不少时间，你也试试？'],
  ['工具',    '/css/ads/ad-tool.svg?t=20260808-2',    '/adss.html',                  '这几个在线工具我自己日常在用，省事'],
  ['教育',    '/css/ads/ad-edu.svg?t=20260808-2',     '/adss.html',                  '学习向的资源，整理得还不错'],
  ['设计',    '/css/ads/ad-design.svg?t=20260808-2',  '/adss.html',                  '做图做封面用得上的东西'],
  ['音乐',    '/css/ads/ad-music.svg?t=20260808-2',   '/adss.html',                  '写代码的时候放着当背景音刚刚好'],
  ['编程',    '/css/ads/ad-code.svg?t=20260808-2',    '/adss.html',                  '写代码的顺手工具，踩坑记录也在这儿'],
  ['AI智能',  '/css/ads/ad-ai.svg?t=20260808-2',      '/adss.html',                  '最近在折腾的东西，感兴趣可以看看'],
  ['应用',    '/css/ads/ad-app.svg?t=20260808-2',     '/adss.html',                  '手机上常驻的几个应用'],
  ['影视',    '/css/ads/ad-video.svg?t=20260808-2',   '/adss.html',                  '看片用得上，顺手放这儿'],
  ['阅读',    '/css/ads/ad-read.svg?t=20260808-2',    '/adss.html',                  '闲着的时候翻两页'],
  ['购物',    '/css/ads/ad-shop.svg?t=20260808-2',    '/adss.html',                  '买过觉得还行的东西'],
  ['健康',    '/css/ads/ad-health.svg?t=20260808-2',  '/adss.html',                  '久坐写代码的人都懂，注意身体'],
  ['效率',    '/css/ads/ad-product.svg?t=20260808-2', '/adss.html',                  '让我少干点重复活的几个方法'],
  ['社交',    '/css/ads/ad-social.svg?t=20260808-2',  '/adss.html',                  '想找我的话，这几个地方都能找到'],
  ['娱乐',    '/css/ads/ad-fun.svg?t=20260808-2',     '/adss.html',                  '摸鱼时间的好去处'],
  ['域名',    '/css/ads/ad-tname.svg?t=20260808-2',   'https://tname.net?sid=11078', '我的域名就在这注册的，.top 一年不到 30 块'],
  ['游戏',    '/css/ads/ad-weishan.svg?t=20260808-2', '/WeiShan/',                   '微山这地方，挺适合去走走']
];
