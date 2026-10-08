// cwbi.js — CialloWebBlogInformation 核心解析器
// 职责：解析 .cwb 文件（类 JSON 自定义格式）+ 加载 cwb-manifest.json
// 使用方：blog/index.html（双源合并渲染，CWBI 优先、articlesData 兜底）
// 依赖：无
(function () {
    'use strict';

    // ========== .cwb 解析 ==========

    // 去掉 // 注释（跳过引号内的 //，避免误伤正文里的 URL）
    function stripComments(text) {
        var out = [];
        var inStr = false;
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            var next = text[i + 1];
            if (ch === '"' && text[i - 1] !== '\\') inStr = !inStr;
            if (!inStr && ch === '/' && next === '/') {
                // 跳到行尾（保留换行符，行边界不能丢）
                while (i < text.length && text[i] !== '\n') i++;
                out.push('\n');
                continue;
            }
            out.push(ch);
        }
        return out.join('');
    }

    // 解析单个值：True/False → boolean，纯数字 → number，"a","b" → 数组，"x" → 字符串
    function parseValue(raw) {
        var v = raw.trim();
        if (!v) return '';
        if (/^true$/i.test(v)) return true;
        if (/^false$/i.test(v)) return false;
        // 数值（可带负号/小数）
        if (/^-?\d+(\.\d+)?$/.test(v)) return parseFloat(v);
        // 引号字符串（单个或逗号分隔多个 → 数组）
        if (v.charAt(0) === '"') {
            var parts = [];
            // 逐段扫描，支持 \" 转义
            var re = /"((?:[^"\\]|\\.)*)"/g;
            var m;
            while ((m = re.exec(v)) !== null) {
                parts.push(m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
            }
            if (parts.length === 0) return '';
            if (parts.length === 1) return parts[0];
            return parts; // "tag1","tag2" → 数组
        }
        // 裸值（无引号），原样返回
        return v;
    }

    // 解析整个 .cwb 文本 → { index:{...}, flags:{...}, html:{...} }
    // 块头格式："index:" / "is?:" / "html:"，键值行格式："key"=value
    function parseCwb(text) {
        var result = { index: {}, flags: {}, html: {} };
        var current = null;
        var blockMap = {
            'index': result.index,
            'is?': result.flags,
            'is': result.flags,          // 容错：is 也算 flags
            'html': result.html
        };
        var lines = stripComments(text).split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line || line === '[' || line === ']' || line === '{' || line === '}') continue;
            // 块头：word: 结尾（如 index: / is?: / html:）
            var header = line.match(/^([A-Za-z_$][\w$]*\??)\s*:$/);
            if (header) {
                current = blockMap[header[1]] || null;
                continue;
            }
            // 键值行："key"=value
            var kv = line.match(/^"([^"]+)"\s*=\s*(.+)$/);
            if (kv && current) {
                current[kv[1]] = parseValue(kv[2]);
            }
        }
        return result;
    }

    // ========== .cwb → articlesData 兼容对象 ==========

    // html.path 形如 "blog/心理学/23" → { category:"心理学", fileName:"心理学/23/" }
    function splitPath(path) {
        var p = (path || '').replace(/^\/+|\/+$/g, '');
        var seg = p.split('/');
        // 去掉开头的 blog/
        if (seg[0] === 'blog') seg.shift();
        var id = seg.pop();
        return { category: seg.join('/'), fileName: seg.join('/') + '/' + id + '/', id: id };
    }

    function toArticle(cwb, fallbackId) {
        var idx = cwb.index || {};
        var pathInfo = splitPath((cwb.html && cwb.html.path) || '');
        var tags = idx.tag;
        if (typeof tags === 'string') tags = tags ? [tags] : [];
        if (!tags || !tags.length) tags = [];
        return {
            id: parseInt(pathInfo.id || fallbackId, 10) || parseInt(fallbackId, 10) || 0,
            category: pathInfo.category || '未分类',
            fileName: pathInfo.fileName,
            title: idx.title || '（无标题）',
            excerpt: idx.excerpt || '',
            date: idx.date || '',
            author: idx.author || '',
            tags: tags,
            readTime: (typeof idx.readTime === 'number') ? idx.readTime : (parseInt(idx.readTime, 10) || 0),
            featured: idx.featured === true,
            // CWBI 专属字段
            flags: cwb.flags || {},
            cwb: true
        };
    }

    // ========== 清单加载 ==========

    var manifestCache = null;

    // loadManifest(baseUrl) — baseUrl 默认相对当前页面向上一层（blog/index.html → 站点根）
    function loadManifest(baseUrl) {
        var base = baseUrl || '../';
        if (manifestCache) return Promise.resolve(manifestCache);
        return fetch(base + 'cwb-manifest.json', { cache: 'no-cache' })
            .then(function (r) {
                if (!r.ok) throw new Error('manifest HTTP ' + r.status);
                return r.json();
            })
            .then(function (j) {
                manifestCache = j;
                return j;
            });
    }

    // 限流并发拉取：每批 8 个，失败重试一次（本地 http.server 并发太大会拒连）
    function fetchText(url) {
        return fetch(url, { cache: 'no-cache' })
            .then(function (r) { return r.ok ? r.text() : null; })
            .catch(function () { return null; });
    }
    function fetchTextRetry(url) {
        return fetchText(url).then(function (t) {
            return (t === null) ? new Promise(function (res) { setTimeout(function () { res(fetchText(url)); }, 150); }) : t;
        });
    }
    function loadInBatches(entries, mapper, batchSize) {
        batchSize = batchSize || 8;
        var results = [];
        function run(from) {
            if (from >= entries.length) return Promise.resolve(results);
            var batch = entries.slice(from, from + batchSize);
            return Promise.all(batch.map(mapper)).then(function (rs) {
                results = results.concat(rs);
                return run(from + batchSize);
            });
        }
        return run(0);
    }

    // loadAll(options) → Promise<article[]>
    // options: { baseUrl, manifest } — manifest 可直接传入跳过 fetch
    function loadAll(options) {
        options = options || {};
        var base = options.baseUrl || '../';
        var ready = options.manifest ? Promise.resolve(options.manifest) : loadManifest(base);
        return ready.then(function (manifest) {
            var entries = (manifest && manifest.articles) || [];
            return loadInBatches(entries, function (e) {
                var cwbPath = e.cwbPath || ('blog/' + e.category + '/' + e.id + '/' + e.id + '.cwb');
                return fetchTextRetry(base + cwbPath).then(function (text) {
                    if (!text) return null;
                    var cwb = parseCwb(text);
                    // istest=true 的文章不进列表
                    if (cwb.flags && cwb.flags.istest === true) return null;
                    return toArticle(cwb, e.id);
                });
            }).then(function (list) {
                return list.filter(function (a) { return a; });
            });
        });
    }

    // 双源合并：cwb 优先（同 id 覆盖），articlesData 兜底，按日期倒序 + id 倒序
    function mergeArticles(cwbList, legacyList) {
        var byId = {};
        cwbList.forEach(function (a) { byId[a.id] = a; });
        var merged = legacyList.filter(function (a) { return !byId[a.id]; }).concat(cwbList);
        merged.sort(function (a, b) {
            var d = new Date(b.date) - new Date(a.date);
            if (d !== 0) return d;
            return b.id - a.id;
        });
        return merged;
    }

    // ========== 导出 ==========
    window.CWBI = {
        VERSION: '0.1.0',
        parseCwb: parseCwb,
        toArticle: toArticle,
        loadManifest: loadManifest,
        loadAll: loadAll,
        mergeArticles: mergeArticles
    };
})();
