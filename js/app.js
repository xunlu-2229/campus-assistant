/* app.js —— 主应用入口
 * 负责：路由切换、移动端菜单、子标签切换、首页卡片跳转、统一初始化各业务模块
 */
(function () {
  'use strict';

  /* ===== 主路由切换 ===== */
  function route(name) {
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('active', p.dataset.page === name);
    });
    document.querySelectorAll('.nav-item').forEach(function (a) {
      a.classList.toggle('active', a.dataset.route === name);
    });
    // 底部导航同步高亮
    document.querySelectorAll('.bottom-nav__item').forEach(function (a) {
      a.classList.toggle('active', a.dataset.route === name);
    });
    document.getElementById('mainNav').classList.remove('open');
    window.scrollTo(0, 0);
  }

  /* ===== 子标签切换（作用域限定在所在 page 内，避免多页面同名冲突） ===== */
  function subRoute(tabEl) {
    var scope = tabEl.closest('.page') || document;
    var subName = tabEl.dataset.sub;
    scope.querySelectorAll('.sub-page').forEach(function (p) {
      p.classList.toggle('active', p.dataset.subPage === subName);
    });
    scope.querySelectorAll('.sub-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.sub === subName);
    });
  }

  /* ===== 模块直达：切页面 + 自动选中子标签（首页常用工具快捷入口） ===== */
  function jumpTo(page, sub) {
    route(page);
    if (sub) {
      var scope = document.querySelector('.page[data-page="' + page + '"]');
      var tab = scope && scope.querySelector('.sub-tab[data-sub="' + sub + '"]');
      if (tab) subRoute(tab);
    }
  }

  /* ===== PWA 安装引导（"添加到桌面"按钮） ===== */
  var deferredPrompt = null;
  function setupInstall() {
    var btn = document.getElementById('btnInstallApp');
    if (!btn) return;
    // 已以独立应用方式打开（已安装）时隐藏按钮
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator && window.navigator.standalone === true) {
      btn.style.display = 'none';
      return;
    }
    // Android Chrome/Edge：捕获安装提示，点击直接调系统安装
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
    });
    btn.addEventListener('click', function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (res) {
          if (res.outcome === 'accepted') { alert('已添加到桌面，下次可从桌面图标直接打开！'); }
          deferredPrompt = null;
        }).catch(function () {});
        return;
      }
      var ua = navigator.userAgent;
      if (/MicroMessenger/i.test(ua)) {
        alert('微信内置浏览器不支持添加到桌面。\n请点右上角「···」→「在浏览器中打开」，再用浏览器菜单添加到桌面。');
      } else if (/QQ\//i.test(ua)) {
        alert('QQ 内置浏览器不支持添加到桌面。\n请点右上角「···」→「用浏览器打开」。');
      } else if (/iPad|iPhone|iPod/i.test(ua)) {
        alert('iPhone/iPad 添加方法：\n1) 点击浏览器底部「分享」按钮；\n2) 选择「添加到主屏幕」。');
      } else {
        alert('添加方法：\n1) 打开浏览器菜单（地址栏右侧 ⋮ / ≡）；\n2) 选择「安装应用」或「添加到主屏幕」。');
      }
    });
  }

  /* ===== 初始化 ===== */
  function init() {
    setupInstall();
    // 顶部导航
    document.querySelectorAll('.nav-item').forEach(function (a) {
      a.addEventListener('click', function () { route(a.dataset.route); });
    });
    // 移动端菜单展开
    document.getElementById('navToggle').addEventListener('click', function () {
      document.getElementById('mainNav').classList.toggle('open');
    });
    // 首页卡片跳转
    document.querySelectorAll('.card[data-jump]').forEach(function (card) {
      card.addEventListener('click', function () { route(card.dataset.jump); });
    });
    // 首页常用工具快捷直达（跳页面 + 自动选中子页）
    document.querySelectorAll('.quick-chip[data-jump]').forEach(function (chip) {
      chip.addEventListener('click', function () { jumpTo(chip.dataset.jump, chip.dataset.sub); });
    });
    // 底部移动导航
    document.querySelectorAll('.bottom-nav__item').forEach(function (a) {
      a.addEventListener('click', function () { route(a.dataset.route); });
    });
    // 所有子标签（工具箱/校园生活/学习工具共用一套逻辑，作用域隔离）
    document.querySelectorAll('.sub-tab').forEach(function (t) {
      t.addEventListener('click', function () { subRoute(t); });
    });

    // 依次初始化各业务模块（脚本已按依赖顺序加载）
    var App = window.App;
    var mods = ['theme', 'schedule', 'campus', 'tools', 'labdata', 'unit', 'resistor', 'rcrl', 'resonance', 'signal', 'code', 'components', 'quick'];
    mods.forEach(function (name) {
      if (App[name] && typeof App[name].init === 'function') {
        try { App[name].init(); } catch (e) { console.error('[' + name + '] 初始化失败', e); }
      }
    });
  }

  // 路由能力暴露给其他模块（首页快捷区跳转等）
  window.App = window.App || {};
  window.App.nav = { route: route, jumpTo: jumpTo };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
