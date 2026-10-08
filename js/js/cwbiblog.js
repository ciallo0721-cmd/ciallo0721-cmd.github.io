// cwbiblog.js — CWBI 文章页侧脚本
// 职责：文章页（blog/分类/id/index.html）内读取同目录 {id}.cwb，暴露元数据
// 用法：<script src="../../../js/js/cwbiblog.js"></script>
// 暴露：window.CWBIBlog = { id, data, flags, ready }
//       ready 是 Promise，resolve 后 data 为解析结果（失败时 data=null，不报错中断页面）
(function () {
    'use strict';

    // 从 URL 推断文章 id：/blog/分类/23/ 或 /blog/分类/23/index.html
    function detectId() {
        var m = location.pathname.match(/\/blog\/[^/]+\/(\d+)\/?(?:index\.html?)?$/i);
        return m ? m[1] : null;
    }

    var id = detectId();
    var api = {
        id: id ? parseInt(id, 10) : null,
        data: null,   // { index:{...}, flags:{...}, html:{...} }
        flags: null,
        ready: Promise.resolve(null)
    };

    if (!id) {
        // 非 blog 文章页路径（例如本地 file:// 打开方式不同），静默跳过
        window.CWBIBlog = api;
        return;
    }

    // cwbi.js 是解析器依赖；文章页按规格只加本脚本，故按需动态加载
    function ensureCwbi() {
        if (window.CWBI) return Promise.resolve();
        return new Promise(function (resolve) {
            var s = document.createElement('script');
            s.src = '../../../js/js/cwbi.js';
            s.onload = resolve;
            s.onerror = resolve; // 加载失败也继续，data 保持 null
            document.head.appendChild(s);
        });
    }

    api.ready = ensureCwbi().then(function () {
        return fetch('./' + id + '.cwb', { cache: 'no-cache' })
            .then(function (r) { return r.ok ? r.text() : null; })
            .then(function (text) {
                if (!text || !window.CWBI) return null;
                var parsed = window.CWBI.parseCwb(text);
                api.data = parsed;
                api.flags = parsed.flags || {};
                fillMeta(parsed);
                return parsed;
            });
    }).catch(function () { return null; });

    // 页面里若有 #cwbi-meta 容器，自动填充作者/日期/标签
    function fillMeta(parsed) {
        var box = document.getElementById('cwbi-meta');
        if (!box) return;
        var idx = parsed.index || {};
        var html = '';
        if (idx.author) html += '<span class="cwbi-author">' + esc(idx.author) + '</span>';
        if (idx.date) html += '<span class="cwbi-date">' + esc(idx.date) + '</span>';
        var tags = idx.tag;
        if (typeof tags === 'string') tags = [tags];
        if (Array.isArray(tags) && tags.length) {
            html += tags.map(function (t) {
                return '<span class="cwbi-tag">' + esc(t) + '</span>';
            }).join('');
        }
        if (html) box.innerHTML = html;
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    window.CWBIBlog = api;
})();
