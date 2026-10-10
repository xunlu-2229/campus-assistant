/* quick.js —— 首页"常用工具"快捷区（可自定义 + 拖拽排序）
 * 功能池 QUICK_DEFS 定义全部可选项；用户启用的 id 顺序存 localStorage（gcsa_quick_tools）
 * 管理面板：显示/隐藏切换 + HTML5 拖拽排序（无外部依赖），桌面端拖动、触屏可用开关按钮
 */
(function () {
  'use strict';
  var App = window.App;
  var KEY = 'gcsa_quick_tools';

  /* 全部可选功能（id 唯一；page 为主路由，sub 为目标子标签，可空） */
  var QUICK_DEFS = [
    { id: 'resistor', name: '色环电阻', icon: '🔄', page: 'toolbox', sub: 'resistor' },
    { id: 'unit', name: '单位换算', icon: '📏', page: 'toolbox', sub: 'unit' },
    { id: 'rcrl', name: 'RC/RL 电路', icon: '🔗', page: 'toolbox', sub: 'rcrl' },
    { id: 'resonance', name: 'LC 谐振', icon: '〰️', page: 'toolbox', sub: 'resonance' },
    { id: 'signal', name: '正弦信号', icon: '🌊', page: 'toolbox', sub: 'signal' },
    { id: 'code', name: '代码速查', icon: '💻', page: 'toolbox', sub: 'code' },
    { id: 'components', name: '元器件库', icon: '📦', page: 'toolbox', sub: 'components' },
    { id: 'labdata', name: '实验数据', icon: '📊', page: 'labdata', sub: null },
    { id: 'gpa', name: 'GPA 计算', icon: '🎓', page: 'studytools', sub: 'gpa' },
    { id: 'countdown', name: '考试倒计时', icon: '⏰', page: 'studytools', sub: 'countdown' },
    { id: 'memo', name: '备忘录', icon: '📝', page: 'studytools', sub: 'memo' },
    { id: 'spots', name: '生活点位', icon: '🏠', page: 'campus', sub: 'spots' },
    { id: 'map', name: '校园地图', icon: '🗺️', page: 'campus', sub: 'map' },
    { id: 'study', name: '学习跳转', icon: '📚', page: 'campus', sub: 'study' },
    { id: 'tutorial', name: '软件教程', icon: '🧭', page: 'campus', sub: 'tutorial' },
    { id: 'schedule', name: '课表管理', icon: '📅', page: 'schedule', sub: null }
  ];
  var DEF_MAP = {};
  QUICK_DEFS.forEach(function (d) { DEF_MAP[d.id] = d; });

  /* 默认启用项（首屏展示） */
  var DEFAULT_ORDER = ['resistor', 'unit', 'rcrl', 'resonance', 'signal', 'code', 'labdata', 'gpa', 'countdown', 'components'];

  /* ===== 顺序存取（过滤已失效 id） ===== */
  function getOrder() {
    var saved = App.Storage.get(KEY, null);
    if (!saved || !saved.length) return DEFAULT_ORDER.slice();
    var ok = saved.filter(function (id) { return DEF_MAP[id]; });
    return ok.length ? ok : DEFAULT_ORDER.slice();
  }
  function saveOrder(ids) { App.Storage.set(KEY, ids); }

  /* ===== 渲染首页快捷区 ===== */
  function render() {
    var box = document.getElementById('quickGrid');
    if (!box) return;
    var order = getOrder();
    box.innerHTML = order.map(function (id) {
      var d = DEF_MAP[id];
      if (!d) return '';
      return '<button class="quick-chip" data-jump="' + d.page + '"' +
        (d.sub ? ' data-sub="' + d.sub + '"' : '') + '>' + d.icon + ' ' + d.name + '</button>';
    }).join('');
    if (!order.length) box.innerHTML = '<span class="quick-tools__empty">暂无快捷项，点右上角 ⚙️ 管理添加</span>';
  }

  /* ===== 管理面板 ===== */
  function openManage() { renderManage(); document.getElementById('quickModal').classList.add('active'); }
  function closeManage() { document.getElementById('quickModal').classList.remove('active'); }

  /** 从管理列表 DOM 提取"可见项"顺序（供拖拽后持久化，独立纯函数便于测试） */
  function readOrderFromDom(listEl) {
    var ids = [];
    Array.prototype.forEach.call(listEl.querySelectorAll('.quick-manage-item[data-hidden="0"]'), function (el) {
      ids.push(el.getAttribute('data-id'));
    });
    return ids;
  }

  function renderManage() {
    var listEl = document.getElementById('quickManageList');
    var order = getOrder();
    var visible = order.map(function (id) { return DEF_MAP[id]; }).filter(Boolean);
    var hidden = QUICK_DEFS.filter(function (d) { return order.indexOf(d.id) < 0; });
    listEl.innerHTML = visible.map(function (d) {
      return '<div class="quick-manage-item" data-id="' + d.id + '" data-hidden="0" draggable="true">' +
        '<span class="quick-manage-drag" title="按住拖动排序">≡</span>' +
        '<span class="quick-manage-icon">' + d.icon + '</span>' +
        '<span class="quick-manage-name">' + d.name + '</span>' +
        '<button class="quick-manage-toggle" data-toggle="hide" title="从首页隐藏">隐藏</button></div>';
    }).join('') + hidden.map(function (d) {
      return '<div class="quick-manage-item" data-id="' + d.id + '" data-hidden="1">' +
        '<span class="quick-manage-drag">≡</span>' +
        '<span class="quick-manage-icon">' + d.icon + '</span>' +
        '<span class="quick-manage-name">' + d.name + '</span>' +
        '<button class="quick-manage-toggle" data-toggle="show" title="显示到首页">显示</button></div>';
    }).join('');
    // 事件：显示/隐藏
    listEl.onclick = function (e) {
      var btn = e.target.closest('[data-toggle]');
      if (!btn) return;
      var id = btn.closest('.quick-manage-item').getAttribute('data-id');
      var order2 = getOrder();
      if (btn.getAttribute('data-toggle') === 'hide') order2 = order2.filter(function (x) { return x !== id; });
      else order2.push(id);
      saveOrder(order2);
      renderManage();
      render();
    };
    initDnD(listEl);
  }

  /** 拖拽排序（原生 HTML5 DnD：仅可见项之间） */
  function initDnD(listEl) {
    var dragEl = null;
    listEl.ondragstart = function (e) {
      var item = e.target.closest('.quick-manage-item');
      if (!item || item.getAttribute('data-hidden') === '1') { e.preventDefault(); return; }
      dragEl = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      // Firefox 需要显式数据
      try { e.dataTransfer.setData('text/plain', item.getAttribute('data-id')); } catch (err) {}
    };
    listEl.ondragover = function (e) {
      if (!dragEl) return;
      e.preventDefault();
      var after = getDragAfter(listEl, e.clientY);
      if (after == null) listEl.appendChild(dragEl);
      else if (after !== dragEl) listEl.insertBefore(dragEl, after);
    };
    listEl.ondrop = function (e) { if (dragEl) e.preventDefault(); };
    listEl.ondragend = function () {
      if (!dragEl) return;
      dragEl.classList.remove('dragging');
      dragEl = null;
      saveOrder(readOrderFromDom(listEl)); // 拖完立即持久化
      render();
    };
  }

  /** 在列表中找到插入点之后的元素（经典算法，仅比较可见项） */
  function getDragAfter(listEl, y) {
    var els = Array.prototype.filter.call(listEl.querySelectorAll('.quick-manage-item[data-hidden="0"]'), function (el) {
      return !el.classList.contains('dragging');
    });
    var closest = null, closestOffset = -Infinity;
    els.forEach(function (el) {
      var box = el.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) { closestOffset = offset; closest = el; }
    });
    return closest;
  }

  /* ===== 初始化 ===== */
  function init() {
    render();
    document.getElementById('btnQuickManage').addEventListener('click', openManage);
    document.getElementById('btnQuickDone').addEventListener('click', closeManage);
    document.getElementById('btnQuickReset').addEventListener('click', function () {
      if (confirm('恢复默认的常用工具列表？')) {
        saveOrder(DEFAULT_ORDER.slice());
        renderManage();
        render();
      }
    });
    document.getElementById('quickModal').addEventListener('click', function (e) {
      if (e.target === this) closeManage();
    });
    // 快捷区点击直达（事件委托，兼容动态渲染）
    document.getElementById('quickGrid').addEventListener('click', function (e) {
      var chip = e.target.closest('.quick-chip');
      if (chip && App.nav && App.nav.jumpTo) App.nav.jumpTo(chip.getAttribute('data-jump'), chip.getAttribute('data-sub'));
    });
  }

  window.App.quick = { init: init, render: render, getOrder: getOrder, readOrderFromDom: readOrderFromDom, DEF_MAP: DEF_MAP };
})();