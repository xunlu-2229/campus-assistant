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

  /* ===== PWA 安装引导（"添加到桌面"按钮：能弹系统框直接弹，不能弹给图文步骤） ===== */
  var deferredPrompt = null;
  var installGuideShown = false;

  /* 识别当前浏览器，返回 {name, mode, steps[]}；mode: chromium(可系统安装)/ios/menu(菜单添加)/embedded(内置) */
  function browserInfo() {
    var ua = navigator.userAgent;
    if (/MicroMessenger/i.test(ua)) return { name: '微信内置浏览器', mode: 'embedded', steps: ['点右上角「···」', '选择「在浏览器中打开」', '再用浏览器菜单添加到桌面'] };
    if (/QQ\//i.test(ua)) return { name: 'QQ内置浏览器', mode: 'embedded', steps: ['点右上角「···」', '选择「用浏览器打开」', '再用浏览器菜单添加到桌面'] };
    if (/iPad|iPhone|iPod/i.test(ua)) return { name: 'iPhone / iPad', mode: 'ios', steps: ['点底部「分享」按钮（方框加箭头图标）', '在菜单里选「添加到主屏幕」', '点右上角「添加」确认'] };
    if (/Edg\//i.test(ua)) return { name: 'Edge 浏览器', mode: 'chromium', steps: [] };
    if (/Chrome\//i.test(ua) && !/UCBrowser|MiuiBrowser|HuaweiBrowser|quark|OPR|VivoBrowser/i.test(ua)) return { name: 'Chrome 浏览器', mode: 'chromium', steps: [] };
    if (/MiuiBrowser/i.test(ua)) return { name: '小米浏览器', mode: 'menu', steps: ['点底部「≡」菜单（或右上角 ⋮）', '选择「添加到桌面」', '确认添加，桌面出现图标'] };
    if (/HuaweiBrowser/i.test(ua)) return { name: '华为浏览器', mode: 'menu', steps: ['点底部/右上角「⋮」菜单', '选择「添加到主屏幕」', '确认后桌面出现图标'] };
    if (/quark/i.test(ua)) return { name: '夸克浏览器', mode: 'menu', steps: ['点底部「☰ / 更多」菜单', '选择「添加到桌面 / 主屏幕」', '确认添加'] };
    if (/UCBrowser/i.test(ua)) return { name: 'UC 浏览器', mode: 'menu', steps: ['点底部「☰」菜单', '选择「添加到主屏幕」', '确认添加'] };
    if (/OPR|Opera/i.test(ua)) return { name: 'OPPO / 一加浏览器', mode: 'menu', steps: ['点底部「≡ / ☰」菜单', '选择「添加到主屏幕」', '确认添加'] };
    if (/VivoBrowser/i.test(ua)) return { name: 'vivo 浏览器', mode: 'menu', steps: ['点底部「≡」菜单', '选择「添加到主屏幕」', '确认添加'] };
    if (/Chrome|Safari/i.test(ua)) return { name: '手机浏览器', mode: 'menu', steps: ['点浏览器菜单按钮（⋯ / ≡）', '选择「添加到主屏幕 / 桌面」', '确认添加'] };
    return { name: '当前浏览器', mode: 'menu', steps: ['点浏览器菜单按钮（⋯ / ≡）', '选择「添加到主屏幕 / 桌面」', '确认添加'] };
  }

  /* 打开图文安装引导弹窗 */
  function openInstallGuide() {
    if (installGuideShown) return;
    installGuideShown = true;
    var info = browserInfo();
    var steps = info.steps.map(function (s, i) {
      return '<div style="display:flex;gap:12px;align-items:flex-start;margin:10px 0">' +
        '<span style="width:28px;height:28px;flex-shrink:0;background:var(--primary,#2563eb);color:#fff;border-radius:50%;' +
        'display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700">' + (i + 1) + '</span>' +
        '<span style="font-size:16px;line-height:1.6">' + s + '</span></div>';
    }).join('');
    var tipHtml = '';
    if (info.mode === 'chromium') {
      tipHtml = '<p style="font-size:15px;color:#6b7280;margin:6px 0 2px">当前浏览器支持一键安装，请点下方按钮，浏览器会弹出系统安装确认框：</p>';
    } else if (info.mode === 'ios') {
      tipHtml = '<p style="font-size:15px;color:#6b7280;margin:6px 0 2px">iPhone 需要手动添加到主屏幕（网页无法代操作）：</p>';
    } else if (info.mode === 'embedded') {
      tipHtml = '<p style="font-size:15px;color:#d97706;margin:6px 0 2px">当前在聊天软件里打开，无法安装，请先换成系统浏览器：</p>';
    } else {
      tipHtml = '<p style="font-size:15px;color:#6b7280;margin:6px 0 2px">当前浏览器不支持一键弹窗，按下面步骤手动添加（菜单按钮一般在地址栏旁）：</p>';
    }
    var m = document.createElement('div');
    m.className = 'modal';
    m.id = 'installGuideModal';
    m.style.cssText = 'z-index:100000';
    m.innerHTML = '<div class="modal__box" style="max-width:340px">' +
      '<h3 style="margin-bottom:10px">📲 安装「校园综合助手」</h3>' +
      '<p style="font-size:14px;color:#9ca3af;margin-bottom:8px">当前浏览器：' + info.name + '</p>' +
      tipHtml +
      '<div style="background:#f3f4f6;border-radius:10px;padding:10px 14px;margin:10px 0">' + steps + '</div>' +
      '<p style="font-size:14px;color:#6b7280;margin:8px 0 4px">安装后可从桌面图标直接打开，离线也能用。</p>' +
      '<div style="display:flex;gap:10px;margin-top:14px">' +
      (info.mode === 'chromium' ? '<button class="btn" style="flex:1" id="btnGuideInstall">立即安装</button>' : '') +
      '<button class="btn btn--ghost" style="flex:1" id="btnGuideClose">我知道了</button>' +
      '</div></div>';
    document.body.appendChild(m);
    m.classList.add('active');
    m.addEventListener('click', function (e) { if (e.target === m) closeGuide(); });
    document.getElementById('btnGuideClose').addEventListener('click', closeGuide);
    var b = document.getElementById('btnGuideInstall');
    if (b) b.addEventListener('click', function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (res) {
          if (res.outcome === 'accepted') { closeGuide(); alert('已添加到桌面！'); }
          deferredPrompt = null;
        }).catch(function () {});
} else {
        closeGuide(); openInstallGuide(); // 没有系统框时重新展示步骤引导
      }
    });
    function closeGuide() {
      installGuideShown = false;
      if (m.parentNode) m.parentNode.removeChild(m);
    }
  }

  function setupInstall() {
    var btn = document.getElementById('btnInstallApp');
    if (!btn) return;
    // 已以独立应用方式打开（已安装）时隐藏按钮
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator && window.navigator.standalone === true) {
      btn.style.display = 'none';
      return;
    }
    // Android Chrome/Edge：捕获系统安装提示（保留给用户点击时弹，不自动消费）
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      // 首次访问自动打开引导层（含"立即安装"按钮，点击时才调系统弹窗，避免丢失安装能力）
      try {
        if (!window.localStorage.getItem('gcsa_install_guided')) {
          window.localStorage.setItem('gcsa_install_guided', '1');
          setTimeout(function () { openInstallGuide(); }, 1500);
        }
      } catch (e2) { /* localStorage 不可用时忽略 */ }
    });
    btn.addEventListener('click', function () {
      if (deferredPrompt) {
        var dp = deferredPrompt;
        deferredPrompt = null;
        dp.prompt();
        dp.userChoice.then(function (res) {
          if (res.outcome === 'accepted') { alert('已添加到桌面，下次可从桌面图标直接打开！'); }
        }).catch(function () {});
        return;
      }
      openInstallGuide(); // 无法弹系统框 → 图文步骤引导
    });
  }

  /* ===== 内置浏览器检测：微信/QQ 内打开会拦截 App 唤起与安装，给醒目提示 ===== */
  function setupEmbeddedTip() {
    var ua = navigator.userAgent;
    var isWeixin = /MicroMessenger/i.test(ua);
    var isQQ = /QQ\//i.test(ua);
    if (!isWeixin && !isQQ) return;
    var name = isWeixin ? '微信' : 'QQ';
    var tip = document.createElement('div');
    tip.id = 'embeddedBrowserTip';
    tip.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#f59e0b;color:#fff;' +
      'padding:10px 14px;font-size:14px;text-align:center;line-height:1.5;box-shadow:0 2px 8px rgba(0,0,0,.2)';
    tip.innerHTML = '⚠️ 当前为' + name + '内置浏览器，支付宝扫码 / App 唤起 / 安装应用均不可用。<br>' +
      '请点右上角「···」→「在浏览器中打开」后使用完整功能';
    document.body.appendChild(tip);
    // 给固定顶部栏让位，避免被提示条遮挡
    var header = document.querySelector('header');
    if (header) header.style.marginTop = '66px';
  }

  /* ===== 初始化 ===== */
  function init() {
    setupEmbeddedTip();
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
