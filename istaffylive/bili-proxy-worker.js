/**
 * 塔菲开播状态 · 自建中转（Cloudflare Worker）
 * -------------------------------------------------------------
 * 为什么需要它：
 *   纯静态页面里的 fetch 属于「跨域请求」，浏览器会强制加上 Origin 头，
 *   而 B 站 WAF 只要看到 Origin 就直接 403（api.bilibili.com / api.live.bilibili.com 都是）。
 *   地址栏直接打开能出来，是因为「导航请求」不发 Origin。
 *   服务端（这里）发请求不带 Origin，所以能正常 200，再把结果转交给页面。
 *
 * 部署（不用动 DNS，用自带的 workers.dev 子域）：
 *   1. 打开 https://dash.cloudflare.com/ → 左侧 Workers & Pages → Create → Worker
 *   2. 起个名字，例如 bili-proxy，把本文件内容整个粘贴进去覆盖默认代码
 *   3. Deploy，得到形如 https://bili-proxy.你的名字.workers.dev/ 的地址
 *   4. 打开 js/js/istaffylive.js，把 SELF_RELAY 改成那个地址（结尾带 /）
 *
 * 用法：
 *   /?u=<encoded 完整目标URL>   通用转发（只允许下面 ALLOW_HOSTS 里的域名）
 *   /?room=22603245             便捷写法，等价于 get_info 接口
 *
 * 安全性：只放行 B 站的三个域名，不会被别人当免费代理刷。
 */

const ALLOW_HOSTS = [
  'api.live.bilibili.com',
  'api.bilibili.com',
  'live.bilibili.com'
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400'
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({}, CORS, { 'content-type': 'application/json; charset=utf-8' })
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'GET') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    const self = new URL(request.url);
    let target = self.searchParams.get('u');
    if (!target) {
      const room = self.searchParams.get('room') || '22603245';
      target = 'https://api.live.bilibili.com/room/v1/Room/get_info?room_id=' + encodeURIComponent(room);
    }

    let t;
    try { t = new URL(target); } catch (e) { return json({ error: 'bad_url' }, 400); }
    if (t.protocol !== 'https:' || ALLOW_HOSTS.indexOf(t.hostname) === -1) {
      return json({ error: 'host_not_allowed', host: t.hostname }, 403);
    }

    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, 12000);
    try {
      const res = await fetch(t.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Referer': 'https://live.bilibili.com/',
          'Accept': 'application/json, text/html;q=0.9, */*;q=0.8'
        },
        signal: ctl.signal,
        cf: { cacheTtl: 10 }
      });
      const body = await res.arrayBuffer();
      const type = res.headers.get('content-type') || 'application/json; charset=utf-8';
      return new Response(body, {
        status: res.status,
        headers: Object.assign({}, CORS, { 'content-type': type, 'x-proxy': 'cb-bili' })
      });
    } catch (e) {
      return json({ error: 'upstream_failed', message: String(e) }, 502);
    } finally {
      clearTimeout(timer);
    }
  }
};
