/* theme.js —— 外观设置中心
 * 主题模式（浅色/深色/跟随系统）、主题色（6种）、字体大小、界面密度、
 * 首页自定义背景图（上传→压缩→localStorage），偏好全站实时生效
 * 同时负责 PWA Service Worker 注册（离线缓存）
 */
(function () {
  'use strict';
  var App = window.App;
  var KEY = 'gcsa_appearance';
  var KEY_BG = 'gcsa_home_bg';

  // 默认配置
  var DEFAULTS = { mode: 'auto', theme: 'blue', fontsize: 'm', density: 'normal', homewidget: 'none' };
  // 各主题的主色（用于 meta theme-color）
  var THEME_COLORS = {
    blue: '#2563eb', purple: '#7c3aed', cyan: '#0891b2',
    green: '#059669', orange: '#ea580c', rose: '#e11d48'
  };

  /** 读取配置（合并默认值） */
  function get() {
    var saved = App.Storage.get(KEY, {}) || {};
    var cfg = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      cfg[k] = saved[k] !== undefined ? saved[k] : DEFAULTS[k];
    });
    return cfg;
  }
  function save(cfg) { App.Storage.set(KEY, cfg); }

  /** 系统当前是否深色 */
  function systemDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /** 首页背景图：全屏挂在 body 上（配合 CSS :has() 仅主页显示），dataURL 存 localStorage */
  function applyHomeBg() {
    var bg = App.Storage.get(KEY_BG, null);
    if (bg) {
      document.body.classList.add('home-bg');
      document.body.style.setProperty('--home-bg', 'url("' + bg + '")');
    } else {
      document.body.classList.remove('home-bg');
      document.body.style.removeProperty('--home-bg');
    }
  }

  /** 上传首页背景图：canvas 压缩到 max 1200px 宽，JPEG 0.82（与校园地图同规格） */
  function handleBgUpload(file) {
    if (!file || !file.type.startsWith('image/')) { alert('请选择图片文件（jpg/png/webp）'); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var maxW = 1200;
        var w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (dataUrl.length > 3.5 * 1024 * 1024) {
          alert('图片压缩后仍较大（' + Math.round(dataUrl.length / 1024) + 'KB），可能影响保存，建议换更小的图片');
        }
        App.Storage.set(KEY_BG, dataUrl);
        applyHomeBg();
        alert('首页背景已更新，回到首页即可看到效果');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /** 应用配置到 DOM + meta + 抽屉按钮态 */
  function apply() {
    var cfg = get();
    var html = document.documentElement;
    var dark = cfg.mode === 'dark' || (cfg.mode === 'auto' && systemDark());

    // 首页背景（不依赖外观配置，独立 key）
    applyHomeBg();

    // 平滑过渡动画（切换瞬间加上，0.4s 后移除）
    html.classList.add('theme-anim');
    clearTimeout(apply._t);
    apply._t = setTimeout(function () { html.classList.remove('theme-anim'); }, 400);

    html.setAttribute('data-mode', dark ? 'dark' : 'light');
    html.setAttribute('data-theme', cfg.theme);
    html.setAttribute('data-fontsize', cfg.fontsize);
    html.setAttribute('data-density', cfg.density);

    // 首页组件显示控制
    var hw = cfg.homewidget || 'none';
    var hwBox = document.getElementById('homeWidgets');
    var hwCd = document.getElementById('homeCountdown');
    var hwMemo = document.getElementById('homeMemo');
    if (hwBox) {
      var showAny = (hw === 'countdown' || hw === 'memo' || hw === 'both');
      hwBox.style.display = showAny ? '' : 'none';
      if (hwCd) hwCd.style.display = (hw === 'countdown' || hw === 'both') ? '' : 'none';
      if (hwMemo) hwMemo.style.display = (hw === 'memo' || hw === 'both') ? '' : 'none';
      // 刷新数据
      if (showAny && window.App.tools) {
        window.App.tools.renderHomeCountdown();
        window.App.tools.renderHomeMemo();
      }
    }

    // 顶栏 meta theme-color 跟随
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0f172a' : (THEME_COLORS[cfg.theme] || '#2563eb'));

    // 抽屉按钮激活态
    setRowActive('#modeRow .opt-btn', 'mode', cfg.mode);
    setRowActive('#colorRow .color-dot', 'theme', cfg.theme);
    setRowActive('#fontRow .opt-btn', 'fs', cfg.fontsize);
    setRowActive('#densityRow .opt-btn', 'density', cfg.density);
    setRowActive('#homeWidgetRow .opt-btn', 'hw', cfg.homewidget || 'none');
  }

  /** 通用：给某组按钮按 data 属性设置 active */
  function setRowActive(selector, attr, val) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (el) {
      el.classList.toggle('active', el.getAttribute('data-' + attr) === val);
    });
  }

  /** 抽屉开关 */
  function openDrawer() { document.getElementById('settingsDrawer').classList.add('open'); }
  function closeDrawer() { document.getElementById('settingsDrawer').classList.remove('open'); }

  /** 切换某项设置 */
  function setOpt(attr, val) {
    var cfg = get();
    cfg[attr] = val;
    save(cfg);
    apply();
  }

  function init() {
    apply();

    // auto 模式下跟随系统深浅变化
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { if (get().mode === 'auto') apply(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange); // 旧浏览器
    }

    // 抽屉开关
    document.getElementById('settingsBtn').addEventListener('click', openDrawer);
    document.getElementById('btnCloseSettings').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

    // 主题模式
    Array.prototype.forEach.call(document.querySelectorAll('#modeRow .opt-btn'), function (btn) {
      btn.addEventListener('click', function () { setOpt('mode', btn.getAttribute('data-mode')); });
    });
    // 主题色
    Array.prototype.forEach.call(document.querySelectorAll('#colorRow .color-dot'), function (dot) {
      dot.addEventListener('click', function () { setOpt('theme', dot.getAttribute('data-theme')); });
    });
    // 字体大小
    Array.prototype.forEach.call(document.querySelectorAll('#fontRow .opt-btn'), function (btn) {
      btn.addEventListener('click', function () { setOpt('fontsize', btn.getAttribute('data-fs')); });
    });
    // 界面密度
    Array.prototype.forEach.call(document.querySelectorAll('#densityRow .opt-btn'), function (btn) {
      btn.addEventListener('click', function () { setOpt('density', btn.getAttribute('data-density')); });
    });
    // 首页组件
    Array.prototype.forEach.call(document.querySelectorAll('#homeWidgetRow .opt-btn'), function (btn) {
      btn.addEventListener('click', function () { setOpt('homewidget', btn.getAttribute('data-hw')); });
    });

    // 首页背景 上传/移除
    document.getElementById('btnBgPick').addEventListener('click', function () {
      document.getElementById('bgFileInput').click();
    });
    document.getElementById('bgFileInput').addEventListener('change', function (e) {
      if (e.target.files[0]) handleBgUpload(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('btnBgClear').addEventListener('click', function () {
      if (confirm('移除首页背景图？')) {
        App.Storage.set(KEY_BG, null);
        applyHomeBg();
      }
    });

    // PWA Service Worker 注册（file:// 下会失败，属正常；http:// 或线上生效）
    var swOk = 'serviceWorker' in navigator &&
      (location.protocol === 'http:' || location.protocol === 'https:');
    if (swOk) {
      navigator.serviceWorker.register('./service-worker.js')
        .then(function (reg) { console.log('[PWA] Service Worker 注册成功，离线缓存已启用'); })
        .catch(function (e) { console.warn('[PWA] Service Worker 注册失败：', e); });
    }
  }

  window.App.theme = { init: init, apply: apply, get: get };
})();
