/* ============================================================
   site.js — 主题切换 + 导航高亮同步 + 代码高亮（全局共享）
   依赖 bunny-ui (htmx / bny) + highlight.js (hljs)
   ============================================================ */
(function () {
    'use strict';

    var STORAGE_KEY = 'tphp-theme';
    var MODES = ['auto', 'light', 'dark'];   // 点击循环顺序
    var MODE_LABEL = { auto: '跟随系统', light: '亮色', dark: '暗色' };

    /* ---------- 主题切换（auto / light / dark 三态） ---------- */
    function getStoredMode() {
        var v;
        try { v = localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
        return (v === 'light' || v === 'dark' || v === 'auto') ? v : null;
    }

    function setStoredMode(val) {
        try { localStorage.setItem(STORAGE_KEY, val); } catch (e) { /* ignore */ }
    }

    function systemPrefersDark() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    // 把模式解析为实际要应用的主题
    function resolveTheme(mode) {
        if (mode === 'light' || mode === 'dark') return mode;
        return systemPrefersDark() ? 'dark' : 'light';   // auto
    }

    function applyTheme(mode) {
        var root = document.documentElement;
        if (resolveTheme(mode) === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
        updateModeBtn(mode);
    }

    function currentResolvedTheme() {
        return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }

    // 三态循环：auto → light → dark → auto
    function cycleMode() {
        var cur = getStoredMode() || 'auto';
        var idx = MODES.indexOf(cur);
        var next = MODES[(idx + 1) % MODES.length];
        setStoredMode(next);
        applyTheme(next);
    }

    // 更新按钮 title，让用户知道当前模式
    function updateModeBtn(mode) {
        var btn = document.getElementById('mode-btn');
        if (!btn) return;
        var m = mode || getStoredMode() || 'auto';
        var resolved = (m === 'auto') ? '（当前：' + MODE_LABEL[currentResolvedTheme()] + '）' : '';
        btn.setAttribute('title', MODE_LABEL[m] + resolved + ' — 点击切换');
    }

    /* ---------- 代码高亮 ---------- */
    function highlightCode() {
        if (window.hljs) {
            try { hljs.highlightAll(); } catch (e) { /* ignore */ }
        }
    }

    /* ---------- 导航高亮同步 ---------- */
    function activeFileName() {
        var path = location.pathname.split('/').pop();
        if (!path) return 'index.html';
        return path;
    }

    function syncNavActive() {
        var current = activeFileName();
        var nav = document.querySelector('.site-header [hx-ext~="bny-nav"]');
        if (!nav) return;
        var triggers = nav.querySelectorAll('.menu a.trigger[href]');
        triggers.forEach(function (a) {
            var href = (a.getAttribute('href') || '').split('/').pop();
            // 跳过 javascript:void(0) 与外链
            if (!href || href.indexOf('javascript') === 0 || a.hasAttribute('bny-spa-skip')) {
                a.classList.remove('active');
                return;
            }
            if (href === current) a.classList.add('active');
            else a.classList.remove('active');
        });
    }

    /* ---------- 初始化主题按钮 ---------- */
    function initModeBtn() {
        var btn = document.getElementById('mode-btn');
        if (!btn || btn._tphpMode) return;
        btn._tphpMode = true;
        updateModeBtn();   // 首次设置 title
        btn.addEventListener('click', function (e) {
            e.stopPropagation();      // 阻止冒泡到 bny-nav（避免被标记 active）
            cycleMode();
        });
    }

    /* ---------- 移动端导航：点击链接后自动收起 ---------- */
    function initMobileNavAutoCollapse() {
        var nav = document.querySelector('.site-header [hx-ext~="bny-nav"]');
        if (!nav || nav._tphpAutoCollapse) return;
        nav._tphpAutoCollapse = true;
        nav.addEventListener('click', function (e) {
            var link = e.target.closest('.menu a.trigger[href]');
            if (!link) return;
            // 仅在移动端展开态下收起
            if (nav.hasAttribute('collapsed')) {
                // 延迟收起，让跳转/SPA 先触发
                setTimeout(function () { nav.removeAttribute('collapsed'); }, 150);
            }
        });
    }

    /* ---------- 文档页左侧菜单高亮（基于 hash 判断当前片段） ---------- */
    function syncDocsSidebarActive() {
        var menu = document.querySelector('.docs-menu');
        if (!menu) return;
        // 框架页模式下 pathname 始终是 docs.html，从 hash 提取实际片段路径
        var currentPath = 'docs/quickstart.html';  // 默认
        if (location.hash && location.hash.length > 1 && location.hash.charAt(1) === '/') {
            currentPath = location.hash.substring(1).replace(/^\//, '');  // 如 docs/syntax.html
        }
        menu.querySelectorAll('a[href]').forEach(function (a) {
            var href = (a.getAttribute('href') || '').replace(/^\//, '');
            if (href === currentPath) a.classList.add('active');
            else a.classList.remove('active');
        });
    }

    /* ---------- 页面（含 SPA 切换后）初始化 ---------- */
    function onPageReady() {
        syncNavActive();
        syncDocsSidebarActive();
        initModeBtn();
        initMobileNavAutoCollapse();
        triggerSpaFadeIn();
        highlightCode();
    }

    /* ---------- SPA 切换淡入动画（优先子视口） ---------- */
    function triggerSpaFadeIn() {
        var view = document.querySelector('#docs-view') || document.querySelector('[bny-view]');
        if (!view) return;
        view.classList.remove('spa-enter');
        void view.offsetWidth;  // 强制重排，使 animation 重新触发
        view.classList.add('spa-enter');
    }

    // DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onPageReady);
    } else {
        onPageReady();
    }

    // SPA 内容交换完成（绑在 document 上，视口交换后不丢失）
    function bindSpaLoaded() {
        if (document._tphpSpaBound) return;
        document._tphpSpaBound = true;
        document.addEventListener('bny:spa:loaded', onPageReady);
    }
    bindSpaLoaded();
    // 兜底：若 bny-view 晚于本脚本就绪
    document.addEventListener('DOMContentLoaded', bindSpaLoaded);

    // 监听系统主题变化（仅在 auto 模式下实时跟随）
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
            var mode = getStoredMode() || 'auto';
            if (mode === 'auto') applyTheme('auto');
        });
    }
})();
