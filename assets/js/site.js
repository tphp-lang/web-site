/* ============================================================
   site.js — 主题切换 + 导航高亮同步 + 代码高亮（全局共享）
   依赖 bunny-ui (htmx / bny) + highlight.js (hljs)
   ============================================================ */
(function () {
    'use strict';

    var STORAGE_KEY = 'tphp-theme';
    var MODE_LABEL = { auto: '跟随系统', light: '亮色', dark: '暗色' };

    /* ---------- 主题切换（二态直接切换） ---------- */
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

    // 二态切换：切到当前显示效果的反面
    function cycleMode() {
        var cur = currentResolvedTheme();
        var next = cur === 'dark' ? 'light' : 'dark';
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
    function activeFileName(evt) {
        // 优先：SPA 导航事件中的实际 URL（pushState 前触发，location 还是旧值）
        if (evt && evt.detail && evt.detail.url) {
            try {
                var u = new URL(evt.detail.url, location.origin);
                var p = u.pathname.split('/').pop();
                if (p) {
                    // docs 子页面（如 syntax.html）归到 docs.html，保持顶部"文档"高亮
                    if (u.pathname.indexOf('/docs/') === 0 && p !== 'docs.html') return 'docs.html';
                    return p;
                }
            } catch (e) { /* ignore */ }
        }
        var path = location.pathname.split('/').pop();
        if (!path) return 'index.html';
        return path;
    }

    function syncNavActive(evt) {
        var current = activeFileName(evt);
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
        if (!btn) return;
        updateModeBtn();   // 设置 title
        if (btn._tphpMode) return;
        btn._tphpMode = true;
        // 事件委托：在 document 捕获阶段拦截，确保最先执行
        document.addEventListener('click', function (e) {
            var target = e.target.closest('#mode-btn');
            if (!target) return;
            e.stopPropagation();
            e.stopImmediatePropagation();
            cycleMode();
        }, true);
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

    /* ---------- 文档页左侧菜单高亮 ---------- */
    // SPA 导航时事件在 pushState 前触发，hash 还是旧值，需从 evt.detail.url 取实际 URL
    function syncDocsSidebarActive(evt) {
        var menu = document.querySelector('.docs-menu');
        if (!menu) return;

        var currentPath = '';
        // 优先：SPA 导航事件中的实际 URL
        if (evt && evt.detail && evt.detail.url) {
            try {
                var u = new URL(evt.detail.url, location.origin);
                currentPath = u.pathname.replace(/^\//, '');
            } catch (e) { currentPath = ''; }
        }
        // 回退：首次加载/刷新时从 hash 提取
        if (!currentPath) {
            currentPath = 'docs/quickstart.html';
            if (location.hash && location.hash.length > 1 && location.hash.charAt(1) === '/') {
                currentPath = location.hash.substring(1).replace(/^\//, '');
            }
        }

        menu.querySelectorAll('a[href]').forEach(function (a) {
            var href = (a.getAttribute('href') || '').replace(/^\//, '');
            // 用 endsWith 匹配，兼容子路径部署
            if (href && currentPath.indexOf(href) === currentPath.length - href.length) a.classList.add('active');
            else a.classList.remove('active');
        });
    }

    /* ---------- 文档子视口自动导航 ---------- */
    // hash 模式下，根据地址栏 hash 自动加载对应文档子页面
    // 场景：
    //   1. 直接访问 docs.html（无 hash）→ 加载默认 quickstart.html
    //   2. 刷新 docs.html#/docs/syntax.html → 加载 syntax.html
    //   3. 从其他页面刷新 xxx.html#/docs/syntax.html → 先导航到 docs.html 框架，再加载 syntax.html
    //   4. 用户在 docs 页面点击其他导航（如首页）→ 不应触发自动导航
    var _pendingDocsHash = '';  // 跨页面导航时暂存目标 hash

    function initDocsAutoNav(evt) {
        var docsView = document.getElementById('docs-view');

        // SPA 导航事件（用户点击或自动导航触发的交换）
        // 注意：此时 location.hash 还是旧值（pushState 在 swapContent 之后执行），
        // 必须用 evt.detail.url 判断实际导航目标，否则会误判
        if (evt && evt.detail && evt.detail.url) {
            var u = new URL(evt.detail.url, location.origin);
            var fileName = u.pathname.split('/').pop();
            // 只有导航到 docs.html 框架时，才需要自动加载子页面
            if (fileName !== 'docs.html') return;
            if (!docsView) return;
            if (docsView.children.length > 0) return;
            if (docsView.getAttribute('data-auto-nav')) return;

            // 确定目标子页面：优先用 _pendingDocsHash，最后默认 quickstart
            var targetHref = _pendingDocsHash || 'docs/quickstart.html';
            _pendingDocsHash = '';

            var link = document.querySelector('.docs-menu a[href="' + targetHref + '"]');
            if (!link) return;

            docsView.setAttribute('data-auto-nav', '1');
            if (bny.spaReplaceNext) bny.spaReplaceNext();
            link.click();
            return;
        }

        // 首次加载（DOMReady，无 evt）→ 用 location.hash 判断
        var hash = location.hash;
        var hashPath = '';
        if (hash && hash.length > 1 && hash.charAt(1) === '/') {
            hashPath = hash.substring(1).replace(/^\//, ''); // 如 docs/syntax.html
        }
        var isDocsSubPage = hashPath.indexOf('docs/') === 0 && hashPath !== 'docs.html';

        // 场景 3：hash 指向 docs 子页面，但当前不在 docs 框架 → 先导航到 docs.html
        if (isDocsSubPage && !docsView) {
            // popstate 期间跳过，避免与浏览器后退冲突
            if (bny.spaIsPopstate && bny.spaIsPopstate()) return;
            var docsLink = document.querySelector('.site-header .menu a[href="docs.html"]');
            if (!docsLink) return;
            _pendingDocsHash = hashPath;  // 暂存目标，导航到 docs.html 后使用
            if (bny.spaReplaceNext) bny.spaReplaceNext();
            docsLink.click();
            return;
        }

        // 场景 1/2：在 docs 框架，加载子页面
        if (!docsView) return;
        if (docsView.children.length > 0) return;
        if (docsView.getAttribute('data-auto-nav')) return;

        var targetHref2 = 'docs/quickstart.html';
        if (isDocsSubPage) {
            targetHref2 = hashPath;
        }

        var link2 = document.querySelector('.docs-menu a[href="' + targetHref2 + '"]');
        if (!link2) return;

        docsView.setAttribute('data-auto-nav', '1');
        if (bny.spaReplaceNext) bny.spaReplaceNext();
        link2.click();
    }

    /* ---------- 页面（含 SPA 切换后）初始化 ---------- */
    function onPageReady(evt) {
        // 清除自动导航标记（导航已完成，允许下次自动导航）
        var docsView = document.getElementById('docs-view');
        if (docsView) docsView.removeAttribute('data-auto-nav');

        syncNavActive(evt);
        syncDocsSidebarActive(evt);
        initModeBtn();
        initMobileNavAutoCollapse();
        triggerSpaFadeIn();
        highlightCode();
        // 文档子视口自动导航（根据 hash 恢复子页面）
        initDocsAutoNav(evt);
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
