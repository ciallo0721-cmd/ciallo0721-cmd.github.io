/**
 * ============================================================
 *  status-data.js — 网站状态历史记录
 * ============================================================
 *
 * 【自动工作流 GitHub Actions】
 *   `.github/workflows/status-update.yml` 会在每次 push main 时自动追加一条
 *   green 状态记录（从 commit message 提取标题）。
 *   如需指定 yellow/red 状态，请到 GitHub Actions → status-update → Run workflow
 *   手动触发，填入状态、标题和描述。
 *
 * 【手动维护】
 *   也可以直接编辑此文件，在 statusHistory 数组最前面新增记录。
 *
 * 【状态颜色说明】
 *   red    🔴 严重问题 — 无法正常访问、界面错位、白屏、500等
 *   yellow 🟡 小问题   — 错别字、引用文件错误、样式小瑕疵等
 *   green  🟢 一切正常 — 更新顺利，无任何问题
 *   gray   ⚪ 无记录   — 没有该日期的状态数据
 *
 * 【记录格式】
 *   {
 *     date: "2026年6月2日",
 *     status: "green" | "yellow" | "red",
 *     title: "简短描述",
 *     desc: "详细说明（可选）"
 *   }
 *
 * ============================================================
 */

window.statusHistory = [
    {
        date: "2026年9月12日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年9月10日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年9月8日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年9月5日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年9月4日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年9月3日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年9月2日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年9月1日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年8月31日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年8月30日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年8月29日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年8月28日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年8月27日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年8月26日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年8月20日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年8月19日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年8月9日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年8月8日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年8月2日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年8月1日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月29日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月28日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月27日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月24日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月22日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月21日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月20日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月19日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月17日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月16日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月15日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月14日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月13日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月10日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月7日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月6日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月5日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月4日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月3日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年7月1日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月30日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月29日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月28日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月26日",
        status: "red",
        title: "自研视频播放器停用 · 替换为原生浏览器播放器",
        desc: "自研视频播放器（video-player.js/nice-video.js/MediaViewer视频播放功能）已于2026/6/16后因兼容性问题彻底失效。已将其从4篇有视频的文章中移除，替换为标准HTML5 `<video controls>` 原生播放器，并清理3篇无视频文章中残留的脚本引用的说喵～"
    },
    {
        date: "2026年6月25日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月24日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月23日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月22日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月21日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月20日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月19日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月18日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月17日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月16日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月15日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月14日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月13日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月11日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月9日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月8日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月7日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月6日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
    {
        date: "2026年6月5日",
        status: "green",
        title: "一切正常喵～",
        desc: ""
    },
        {
        date: "2026年6月4日",
        status: "red",
        title: "Api Key泄露 · 紧急修复",
        desc: "在mooore.html和ai.html(一个在1月份上线的ai对话页面,2026/3/28日删除ai.html,忘记删除mooore.html中的相关代码)中不小心硬编码了DeepSeek API Key，导致泄露。已紧急修复，重新生成并更新了API Key，一切正常喵～"
    },
    {
        date: "2026年6月3日",
        status: "green",
        title: "Add reference VTuber UI and refactor quiz logic",
        desc: ""
    },
    {
        date: "2026年6月2日",
        status: "green",
        title: "2026年6月2日",
        desc: "一切正常喵～"
    },
    {
        date: "2026年6月1日",
        status: "green",
        title: "2026年6月1日",
        desc: "一切正常喵～"
    },
    {
        date: "2026年5月23日",
        status: "yellow",
        title: "修复Python在线编辑器多个bug",
        desc: "修复ID不匹配、SyntaxError等问题。期间发现 dynamic-data.js 数字换行导致 SyntaxError，属于小问题已修复喵～"
    },
    {
        date: "2026年5月22日",
        status: "green",
        title: "2026年5月22日",
        desc: "一切正常喵～"
    },
    {
        date: "2026年5月18日",
        status: "green",
        title: "2026年5月18日",
        desc: "一切正常喵～"
    },
    {
        date: "2026年5月16日",
        status: "green",
        title: "2026年5月16日",
        desc: "一切正常喵～"
    },
    {
        date: "2026年5月10日",
        status: "yellow",
        title: "修复返回顶部按钮 + 升级音乐播放器UI",
        desc: "修复按钮箭头不居中bug（小问题），升级播放器UI，整体正常喵～"
    },
    {
        date: "2026年5月7日",
        status: "green",
        title: "2026年5月7日",
        desc: "一切正常喵～"
    },
    {
        date: "2026年4月5日",
        status: "red",
        title: "安全加固 · 移除SEO · 新增状态页面",
        desc: "全面安全审计期间发现硬编码密码、CSP过松等严重安全问题，修复后恢复正常喵～"
    },
    {
        date: "2026年4月3日",
        status: "green",
        title: "2026年4月3日",
        desc: "一切正常喵～"
    },
    {
        date: "2026年4月2日",
        status: "green",
        title: "2026年4月2日",
        desc: "一切正常喵～"
    },
    {
        date: "2026年4月1日",
        status: "green",
        title: "2026年4月1日",
        desc: "一切正常喵～"
    },
    {
        date: "2026年3月31日",
        status: "yellow",
        title: "添加后台 · 修复已知问题 · 修复SEO爬虫误判",
        desc: "上线后台管理系统，修复多个Bug。SEO爬虫检测逻辑有小问题，已修复喵～"
    },
];

// 渲染状态历史记录
function renderStatusHistory() {
    var container = document.getElementById('statusHistoryList');
    if (!container || !window.statusHistory) return;

    var statusLabels = {
        green:  { text: '正常',   dotClass: 'sh-dot-ok',    tagClass: 'sh-tag-ok' },
        yellow: { text: '小问题', dotClass: 'sh-dot-warn',  tagClass: 'sh-tag-warn' },
        red:    { text: '严重',   dotClass: 'sh-dot-error', tagClass: 'sh-tag-error' },
        gray:   { text: '无记录', dotClass: 'sh-dot-gray',  tagClass: 'sh-tag-gray' },
    };

    var html = '';
    window.statusHistory.forEach(function(item, i) {
        var s = item.status || 'gray';
        var label = statusLabels[s] || statusLabels.gray;
        var safeDate  = escapeHtml(item.date  || '');
        var safeTitle = escapeHtml(item.title || '');
        var safeDesc  = item.desc ? escapeHtml(item.desc) : '';

        html += '<div class="sh-item" style="animation-delay:' + (i * 0.06) + 's">';
        html += '  <div class="sh-dot ' + label.dotClass + '"></div>';
        html += '  <div class="sh-line"></div>';
        html += '  <div class="sh-card">';
        html += '    <div class="sh-card-head">';
        html += '      <span class="sh-date">' + safeDate + '</span>';
        html += '      <span class="sh-tag ' + label.tagClass + '">' + label.text + '</span>';
        html += '    </div>';
        html += '    <div class="sh-card-title">' + safeTitle + '</div>';
        if (safeDesc) {
            html += '    <div class="sh-card-desc">' + safeDesc + '</div>';
        }
        html += '  </div>';
        html += '</div>';
    });
    container.innerHTML = html;
}

function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', renderStatusHistory);
