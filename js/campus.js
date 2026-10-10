/* campus.js —— 校园生活模块
 * 1. 生活点位：内置示例 + 自定义增删，localStorage 持久化
 *    数据结构：{id, category, name, time, place, x?, y?, desc?}
 * 2. 校园地图：上传底图 + 点击标点；标点与生活点位共享同一数据源（双向同步）
 *    - 地图上添加标点 → 自动出现在"生活点位"列表
 *    - 生活点位点"📍标记" → 点击地图把坐标写入该点位 → 地图同步显示
 * 3. 软件教程：可自定义链接收藏（官网/文档/视频/公众号搜索等多种来源）
 *    - 默认列表写死在下方 DEFAULT_TUT 数组里：改代码即可让上线后所有访问者看到
 *    - 已存过 localStorage 的浏览器不会自动读取新默认列表，点"恢复默认"即可同步
 * 4. 教程列表导出/导入 JSON（办法B）：备份与跨设备迁移，导入按链接去重合并
 */
(function () {
  'use strict';
  var App = window.App;
  var KEY = 'gcsa_spots';
  var KEY_MAPIMG = 'gcsa_map_image';
  var KEY_MAPPINS = 'gcsa_map_pins'; // 旧版独立标点（迁移用）

  // 分类定义（key → 显示名 + 地图图标）
  var CATS = {
    canteen: { label: '🍚 食堂', icon: '🍚' },
    bath: { label: '🚿 澡堂', icon: '🚿' },
    laundry: { label: '👕 洗衣房', icon: '👕' },
    express: { label: '📦 快递点', icon: '📦' },
    other: { label: '📌 其他', icon: '📌' }
  };

  // 默认示例数据（首次打开时写入，可恢复）
  var DEFAULTS = [
    { id: 'd1', category: 'canteen', name: '一食堂', time: '06:30-19:30', place: '生活区A栋旁' },
    { id: 'd2', category: 'canteen', name: '二食堂（清真）', time: '06:30-20:00', place: '生活区B栋1楼' },
    { id: 'd3', category: 'bath', name: '东区澡堂', time: '15:00-22:30', place: '东区宿舍楼下' },
    { id: 'd4', category: 'laundry', name: '洗衣房', time: '08:00-22:00', place: '每栋宿舍1层' },
    { id: 'd5', category: 'express', name: '菜鸟驿站', time: '09:00-21:00', place: '西门快递中心' },
    { id: 'd6', category: 'other', name: '自助打印店', time: '07:00-23:00', place: '图书馆负1层' }
  ];

  function get() { return App.Storage.get(KEY, null); }
  function save(list) { return App.Storage.set(KEY, list); }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /** 旧版独立标点数据迁移 → spots（一次性） */
  function migrateOldPins() {
    var old = App.Storage.get(KEY_MAPPINS, []);
    if (old && old.length) {
      var list = get() || [];
      old.forEach(function (p) {
        if (!p || !p.x) return;
        list.push({
          id: p.id || uid(), category: 'other', name: p.name || '未命名标点',
          time: '', place: '', desc: p.desc || '',
          x: p.x, y: p.y
        });
      });
      save(list);
      App.Storage.set(KEY_MAPPINS, []);
    }
  }

  /* ================= 生活点位列表 ================= */
  var markingSpotId = null; // 正在等待点击地图定位的点位 id

  function render() {
    migrateOldPins(); // 首次渲染时迁移旧数据
    var list = get();
    if (!list) { list = DEFAULTS.slice(); save(list); } // 首次初始化
    var box = document.getElementById('spotList');
    var html = '';
    Object.keys(CATS).forEach(function (cat) {
      var items = list.filter(function (s) { return s.category === cat; });
      if (!items.length) return;
      html += '<div class="spot-category"><h4>' + CATS[cat].label + '</h4><div class="spot-grid">';
      items.forEach(function (s) {
        var hasCoord = typeof s.x === 'number';
        html += '<div class="spot-card">' +
          '<span class="del" data-del="' + s.id + '" title="删除">×</span>' +
          '<h5>' + esc(s.name) + '</h5>' +
          '<div class="time">🕐 ' + esc(s.time || '时间未填') + '</div>' +
          '<div class="place">📍 ' + esc(s.place || '位置未填') + '</div>' +
          '<button class="spot-locate' + (hasCoord ? ' located' : '') + '" data-locate="' + s.id + '">' +
          (hasCoord ? '✅ 已在地图' : '🗺️ 标记到地图') + '</button>' +
          '</div>';
      });
      html += '</div></div>';
    });
    if (!html) html = '<div class="placeholder"><div class="placeholder__icon">📭</div><p>暂无点位，点击上方"添加点位"</p></div>';
    box.innerHTML = html;
    // 绑定删除
    Array.prototype.forEach.call(box.querySelectorAll('[data-del]'), function (el) {
      el.addEventListener('click', function () {
        if (!confirm('删除该点位（地图上的标点也会一并移除）？')) return;
        save(get().filter(function (s) { return s.id !== el.getAttribute('data-del'); }));
        render(); renderMap();
      });
    });
    // 绑定"标记到地图"
    Array.prototype.forEach.call(box.querySelectorAll('[data-locate]'), function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-locate');
        var s = get().filter(function (x) { return x.id === id; })[0];
        if (!s) return;
        if (typeof s.x === 'number') {
          // 已定位：点击跳到地图查看
          document.querySelector('[data-route="campus"]').click();
          var tab = document.querySelector('#campusTabs [data-sub="map"]');
          if (tab) tab.click();
          return;
        }
        startMarking(s);
      });
    });
  }

  /** 进入标记模式：提示用户去地图上点位置 */
  function startMarking(spot) {
    markingSpotId = spot.id;
    // 切到地图子标签
    document.querySelector('[data-route="campus"]').click();
    var tab = document.querySelector('#campusTabs [data-sub="map"]');
    if (tab) tab.click();
    var tip = document.getElementById('mapModeTip');
    if (tip) {
      tip.style.display = '';
      tip.innerHTML = '🎯 正在为「<b>' + esc(spot.name) + '</b>」定位：请在地图上点击它所在的位置 <button class="btn btn--ghost btn--sm" id="btnCancelMarking">取消</button>';
      tip.className = 'map-mode-tip active';
      var cancel = document.getElementById('btnCancelMarking');
      if (cancel) cancel.addEventListener('click', function (e) {
        e.stopPropagation();
        stopMarking();
      });
    }
  }
  function stopMarking() {
    markingSpotId = null;
    var tip = document.getElementById('mapModeTip');
    if (tip) { tip.style.display = 'none'; tip.className = 'map-mode-tip'; }
  }

  /* ================= 校园地图 ================= */
  function getMapImg() { return App.Storage.get(KEY_MAPIMG, null); }
  function setMapImg(v) { return App.Storage.set(KEY_MAPIMG, v); }

  /** 地图上的标点 = 所有带坐标的 spots */
  function pinsOnMap() {
    return (get() || []).filter(function (s) { return typeof s.x === 'number'; });
  }

  function renderMap() {
    var img = getMapImg();
    var elImg = document.getElementById('mapImg');
    var elPh = document.getElementById('mapPlaceholder');
    var elPins = document.getElementById('mapPins');
    var elCont = document.getElementById('mapContainer');

    if (img) {
      elImg.src = img;
      elImg.style.display = '';
      elPh.style.display = 'none';
      elCont.classList.add('map-loaded');
    } else {
      elImg.style.display = 'none';
      elImg.removeAttribute('src');
      elPh.style.display = '';
      elCont.classList.remove('map-loaded');
    }

    var pins = pinsOnMap();
    var html = pins.map(function (p, i) {
      var cat = CATS[p.category] || CATS.other;
      return '<div class="map-pin" style="left:' + p.x + '%;top:' + p.y + '%">' +
        '<div class="map-pin__del" data-pindel="' + p.id + '" title="' +
        (p.time || p.place ? '移除地图标记（保留点位）' : '删除该点位') + '">×</div>' +
        '<div class="map-pin__dot">' + cat.icon + '</div>' +
        '<div class="map-pin__label">' + esc(p.name) +
        (p.desc ? ' · ' + esc(p.desc) : '') +
        (p.time ? '<br>🕐 ' + esc(p.time) : '') +
        (p.place ? '<br>📍 ' + esc(p.place) : '') +
        '</div>' +
        '</div>';
    }).join('');
    elPins.innerHTML = html;

    // 绑定删除：若点位有营业时间/位置信息则仅清除坐标，否则整条删除
    Array.prototype.forEach.call(elPins.querySelectorAll('[data-pindel]'), function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = el.getAttribute('data-pindel');
        var s = get().filter(function (x) { return x.id === id; })[0];
        if (!s) return;
        if (s.time || s.place) {
          if (confirm('仅把「' + s.name + '」移出地图（生活点位列表保留）？')) {
            delete s.x; delete s.y;
            save(get().map(function (x) { return x.id === id ? s : x; }));
          }
        } else {
          if (confirm('删除「' + s.name + '」（含生活点位列表条目）？')) {
            save(get().filter(function (x) { return x.id !== id; }));
          }
        }
        renderMap(); render();
      });
    });
  }

  // 上传地图图片：canvas 压缩到 max 1200px 宽，JPEG 0.82
  function handleMapUpload(file) {
    if (!file || !file.type.startsWith('image/')) { alert('请选择图片文件'); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      var origImg = new Image();
      origImg.onload = function () {
        var maxW = 1200;
        var w = origImg.width, h = origImg.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(origImg, 0, 0, w, h);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (dataUrl.length > 3.5 * 1024 * 1024) {
          alert('图片过大（' + Math.round(dataUrl.length / 1024) + 'KB），可能导致存储失败。建议用更小的图片。');
        }
        setMapImg(dataUrl);
        renderMap();
      };
      origImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // 点击地图：定位待标记点位，或新增标点（同步进生活点位列表）
  function onMapClick(e) {
    if (!getMapImg()) return;
    var rect = document.getElementById('mapImg').getBoundingClientRect();
    var x = ((e.clientX - rect.left) / rect.width) * 100;
    var y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    x = Math.round(x * 10) / 10; y = Math.round(y * 10) / 10;

    // 标记模式：把坐标写入待标记点位
    if (markingSpotId) {
      var list = get();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === markingSpotId) { list[i].x = x; list[i].y = y; break; }
      }
      save(list);
      stopMarking();
      renderMap(); render();
      return;
    }

    // 普通模式：新增标点（名称取面板输入）
    var name = document.getElementById('mapPinName').value.trim();
    var desc = document.getElementById('mapPinDesc').value.trim();
    var category = document.getElementById('mapPinCat').value;
    if (!name) {
      alert('请先在上方输入标点名称（如"第三食堂"），再点击地图');
      document.getElementById('mapPinName').focus();
      return;
    }
    list = get() || [];
    list.push({
      id: uid(), category: category, name: name,
      time: '', place: '', desc: desc, x: x, y: y
    });
    save(list);
    // 清空输入便于连续添加
    document.getElementById('mapPinName').value = '';
    document.getElementById('mapPinDesc').value = '';
    renderMap(); render(); // 地图 + 生活点位列表同步刷新
  }

  /* ================= 软件教程链接 ================= */
  var KEY_TUT = 'gcsa_tutorials';
  /* 默认教程：来源多样化（官方文档/知名教程站/B站视频搜索/公众号文章搜索）
   * 微信公众号文章没有稳定直链，提供搜狗微信搜索入口（在微信内搜"软件管家"等公众号也可找到同类教程）
   */
  var DEFAULT_TUT = [
    { id: 't1', icon: '🔧', title: 'Keil MDK 官方下载页', source: '官网', url: 'https://www.keil.com/download/' },
    { id: 't2', icon: '📺', title: 'Keil MDK 入门视频教程（B站搜索）', source: '视频', url: 'https://search.bilibili.com/all?keyword=Keil%20MDK%20%E5%85%A5%E9%97%A8%E6%95%99%E7%A8%8B' },
    { id: 't3', icon: '💬', title: 'Keil 安装教程（微信公众号文章搜索）', source: '公众号', url: 'https://weixin.sogou.com/weixin?type=2&query=Keil%20MDK%20%E5%AE%89%E8%A3%85%E6%95%99%E7%A8%8B' },
    { id: 't4', icon: '📊', title: 'MATLAB 官方安装与激活指南', source: '官网', url: 'https://ww2.mathworks.cn/support/install/' },
    { id: 't5', icon: '📺', title: 'MATLAB 入门到精通视频（B站搜索）', source: '视频', url: 'https://search.bilibili.com/all?keyword=MATLAB%20%E5%85%A5%E9%97%A8%E6%95%99%E7%A8%8B' },
    { id: 't6', icon: '💬', title: 'MATLAB 安装教程（微信公众号文章搜索）', source: '公众号', url: 'https://weixin.sogou.com/weixin?type=2&query=MATLAB%20%E5%AE%89%E8%A3%85%E6%95%99%E7%A8%8B' },
    { id: 't7', icon: '🔌', title: '立创EDA 官方中文文档', source: '文档', url: 'https://docs.lceda.cn/cn/' },
    { id: 't8', icon: '📺', title: '立创EDA 视频教程（B站搜索）', source: '视频', url: 'https://search.bilibili.com/all?keyword=%E7%AB%8B%E5%88%9BEDA%20%E6%95%99%E7%A8%8B' },
    { id: 't9', icon: '💻', title: 'VS Code C/C++ 环境配置（官方文档）', source: '文档', url: 'https://code.visualstudio.com/docs/cpp' },
    { id: 't10', icon: '🐢', title: 'Git 教程 - 廖雪峰官方网站', source: '教程站', url: 'https://www.liaoxuefeng.com/wiki/896043489029600' },
    { id: 't11', icon: '🐍', title: 'Python 官方下载', source: '官网', url: 'https://www.python.org/downloads/' },
    { id: 't12', icon: '🚀', title: 'STM32 入门教程（B站搜索）', source: '视频', url: 'https://search.bilibili.com/all?keyword=STM32%20%E5%85%A5%E9%97%A8%E6%95%99%E7%A8%8B' },
    { id: 't13', icon: '💡', title: 'Altium Designer 教程（B站搜索）', source: '视频', url: 'https://search.bilibili.com/all?keyword=Altium%20Designer%20%E6%95%99%E7%A8%8B' },
    { id: 't14', icon: '💬', title: 'Arduino 入门教程（公众号文章搜索）', source: '公众号', url: 'https://weixin.sogou.com/weixin?type=2&query=Arduino%20%E5%85%A5%E9%97%A8%E6%95%99%E7%A8%8B' },
    /* 软件安装管家目录（公众号）系列：15大类软件安装教程资源，专辑页浏览器可直接打开、永久有效 */
    { id: 't15', icon: '📚', title: '《软件目录》Windows版总目录·软件安装管家目录（15大类装机/安装教程）', source: '公众号', url: 'https://weixin.sogou.com/weixin?type=2&query=%E8%BD%AF%E4%BB%B6%E5%AE%89%E8%A3%85%E7%AE%A1%E5%AE%B6%E7%9B%AE%E5%BD%95%20%E8%BD%AF%E4%BB%B6%E7%9B%AE%E5%BD%95%20Windows%E7%B3%BB%E7%BB%9F%E7%89%88' },
    { id: 't16', icon: '📦', title: 'Office 全版本安装教程专辑（2003~2024 含激活工具）', source: '公众号', url: 'https://mp.weixin.qq.com/mp/appmsgalbum?__biz=MzkyNTIzMzY5OQ==&action=getalbum&album_id=3850215955901759488#wechat_redirect' },
    { id: 't17', icon: '📐', title: 'AutoCAD 全版本安装教程专辑（2018~2027）', source: '公众号', url: 'https://mp.weixin.qq.com/mp/appmsgalbum?__biz=MzkyNTIzMzY5OQ==&action=getalbum&album_id=3850024425945612289#wechat_redirect' },
    { id: 't18', icon: '⚙️', title: 'SolidWorks 安装教程专辑（机械课程设计常用）', source: '公众号', url: 'https://mp.weixin.qq.com/mp/appmsgalbum?__biz=MzkyNTIzMzY5OQ==&action=getalbum&album_id=3851704740565008384#wechat_redirect' },
    { id: 't19', icon: '🎨', title: 'Photoshop(PS) 安装教程专辑', source: '公众号', url: 'https://mp.weixin.qq.com/mp/appmsgalbum?__biz=MzkyNTIzMzY5OQ==&action=getalbum&album_id=2377756795819147266#wechat_redirect' },
    { id: 't20', icon: '💾', title: 'Windows 系统重装·PE 工具箱（U盘启动盘制作教程）', source: '公众号', url: 'https://mp.weixin.qq.com/s?__biz=MzkyNTIzMzY5OQ==&mid=2247509472&idx=1&sn=1da428164aa6dffc188f8a399efa9842&chksm=c1cb42acf6bccbba7c44c9333578e7a47b42bdb1bc96998bd0753a0c6f5088baf137dd60fb58&scene=21#wechat_redirect' },
    { id: 't21', icon: '🧩', title: 'VC++ 运行库合集安装教程（多数工科软件的前置依赖）', source: '公众号', url: 'https://mp.weixin.qq.com/s?__biz=MzkyNTIzMzY5OQ==&mid=2247529244&idx=1&sn=03b8ff7260cc16afdf97c12d9d3d0967&scene=21#wechat_redirect' }
  ];

  function getTut() { return App.Storage.get(KEY_TUT, null); }
  function setTut(v) { return App.Storage.set(KEY_TUT, v); }

  function renderTut() {
    var list = getTut();
    if (!list) { list = DEFAULT_TUT.slice(); setTut(list); }
    var box = document.getElementById('tutorialList');
    if (!list.length) {
      box.innerHTML = '<div class="home-widget__empty">暂无教程，点击上方"添加教程"</div>';
      return;
    }
    box.innerHTML = list.map(function (t) {
      return '<div class="tutorial-item">' +
        '<span class="tutorial-item__icon">' + (t.icon || '📄') + '</span>' +
        '<div class="tutorial-item__body">' +
        '<a class="tutorial-item__title" href="' + esc(t.url) + '" target="_blank" rel="noopener">' + esc(t.title) + '</a>' +
        '<div class="tutorial-item__meta"><span class="tut-source">' + esc(t.source || '链接') + '</span>' + esc(t.url) + '</div>' +
        '</div>' +
        '<span class="tutorial-item__del" data-tutdel="' + t.id + '" title="删除">×</span>' +
        '</div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('[data-tutdel]'), function (el) {
      el.addEventListener('click', function () {
        setTut(getTut().filter(function (t) { return t.id !== el.getAttribute('data-tutdel'); }));
        renderTut();
      });
    });
  }

  function addTutorial() {
    var title = prompt('教程标题：', '');
    if (!title) return;
    var url = prompt('文章链接（公众号文章/博客/视频等）：', 'https://');
    if (!url || url === 'https://') { alert('请输入有效链接'); return; }
    var source = prompt('来源标签（如 公众号/视频/文档/官网，回车默认"链接"）：', '') || '链接';
    var icon = prompt('图标 emoji（可选，直接回车用默认）：', '📄') || '📄';
    var list = getTut() || [];
    list.push({
      id: uid(), title: title.trim(), url: url.trim(),
      source: source.trim(), icon: icon.trim()
    });
    setTut(list);
    renderTut();
  }

  /* ===== 导出/导入教程列表（办法B：备份 + 跨设备迁移） ===== */
  function downloadTut(content, filename, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportTut() {
    var list = getTut() || [];
    if (!list.length) { alert('教程列表为空，无可导出内容'); return; }
    downloadTut(JSON.stringify(list, null, 2), '教程备份.json', 'application/json');
  }

  /** 合并导入条目到现有列表（纯函数，便于单测）：按 url 去重，补默认字段
   * @return {added, skipped, list} 新增条数、跳过条数、合并后的新数组（不改原数组）
   */
  function mergeTutList(list, data) {
    var result = (list || []).slice(); // 不改动原数组
    var seen = {};
    result.forEach(function (t) { if (t && t.url) seen[t.url] = true; });
    var added = 0, skipped = 0;
    (data || []).forEach(function (t) {
      if (!t || !t.url || !t.title) { skipped++; return; } // 无效条目跳过
      if (seen[t.url]) { skipped++; return; } // 链接重复跳过
      seen[t.url] = true;
      result.push({
        id: t.id || uid(),
        icon: (t.icon ? String(t.icon) : '📄').slice(0, 4),
        title: String(t.title),
        url: String(t.url),
        source: t.source ? String(t.source) : '链接'
      });
      added++;
    });
    return { added: added, skipped: skipped, list: result };
  }

  /** 导入 JSON 备份文件：解析 → 校验 → 与现有列表去重合并 */
  function importTut(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var data;
      try { data = JSON.parse(e.target.result); }
      catch (err) { alert('JSON 解析失败：' + err.message + '\n请确认是本页"导出 JSON"生成的备份文件'); return; }
      if (!Array.isArray(data)) { alert('格式不对：文件内容应为教程数组（由本页"导出 JSON"生成）'); return; }
      var r = mergeTutList(getTut() || [], data);
      if (!r.added && r.skipped) {
        alert('导入的 ' + r.skipped + ' 条全部无效或重复，未做任何修改');
        return;
      }
      setTut(r.list);
      renderTut();
      alert('导入完成：新增 ' + r.added + ' 条，跳过重复/无效 ' + r.skipped + ' 条');
    };
    reader.readAsText(file, 'utf-8');
  }

  /* ================= 生活服务快捷（支付宝扫码/付款码唤起 + 网页版 + App 指引） ================= */
  var KEY_LIFE = 'gcsa_life';
  /* 默认快捷：alipays:// 与 weixin:// 为 App 唤起 scheme（手机已装对应 App 时点击直接打开） */
  var DEFAULT_LIFE = [
    { id: 'l1', icon: '🧮', title: '支付宝 · 扫一扫', desc: '唤起 App 扫码（洗衣/饮水/浴室通用）', url: 'alipays://platformapi/startapp?appId=20000056' },
    { id: 'l2', icon: '💳', title: '支付宝 · 付款码', desc: '唤起 App 出示付款码', url: 'alipays://platformapi/startapp?appId=20000067' },
    { id: 'l3', icon: '🔍', title: '支付宝 · 网页版', desc: '免 App 网页入口', url: 'https://www.alipay.com/' },
    { id: 'l4', icon: '💬', title: '微信', desc: '唤起微信', url: 'weixin://' },
    { id: 'l5', icon: '🛒', title: '淘宝', desc: '网页版购物', url: 'https://www.taobao.com/' },
    { id: 'l6', icon: '🐶', title: '京东', desc: '网页版购物', url: 'https://www.jd.com/' },
    { id: 'l7', icon: '🍜', title: '美团外卖', desc: '网页版点餐', url: 'https://waimai.meituan.com/' },
    { id: 'l8', icon: '🛵', title: '饿了么', desc: '网页版点餐', url: 'https://www.ele.me/' },
    { id: 'l9', icon: '🧺', title: 'U净·校园洗衣', desc: '美的校园洗衣 App（未安装则跳下载页）', url: 'https://sj.qq.com/appdetail/com.midea.vm.washer' },
    { id: 'l10', icon: '🚿', title: '云达人', desc: '校园生活 App：浴室/开水/洗衣（下载指引页）', url: 'https://www.tvmao.com/hmsoft/491191.html' }
  ];

  function getLife() { return App.Storage.get(KEY_LIFE, null); }
  function setLife(v) { return App.Storage.set(KEY_LIFE, v); }

  function renderLife() {
    var list = getLife();
    if (!list) { list = DEFAULT_LIFE.slice(); setLife(list); }
    var box = document.getElementById('lifeList');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<div class="home-widget__empty">暂无快捷，点击"+ 添加快捷"</div>';
      return;
    }
    box.innerHTML = list.map(function (t) {
      return '<div class="link-card-wrap">' +
        '<a class="link-card" href="' + esc(t.url) + '" target="_blank" rel="noopener">' +
        '<div class="link-card__icon">' + (t.icon || '🔗') + '</div>' +
        '<div>' + esc(t.title) + '</div><small>' + esc(t.desc || t.url) + '</small>' +
        '</a>' +
        '<span class="tutorial-item__del" data-lifedel="' + t.id + '" title="删除">×</span>' +
        '</div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('[data-lifedel]'), function (el) {
      el.addEventListener('click', function () {
        setLife(getLife().filter(function (t) { return t.id !== el.getAttribute('data-lifedel'); }));
        renderLife();
      });
    });
  }

  function addLife() {
    var title = prompt('名称（如 支付宝·扫一扫）：', '');
    if (!title) return;
    var url = prompt('链接（App唤起 scheme 或网页地址）：', 'https://');
    if (!url || url === 'https://') { alert('请输入有效链接'); return; }
    var desc = prompt('说明（可选，回车跳过）：', '') || '';
    var icon = prompt('图标 emoji（可选，回车默认 🔗）：', '🔗') || '🔗';
    var list = getLife() || [];
    list.push({ id: uid(), title: title.trim(), url: url.trim(), desc: desc.trim(), icon: icon.trim() });
    setLife(list);
    renderLife();
  }

  /* ================= 弹窗（添加点位） ================= */
  function openModal() {
    document.getElementById('spotName').value = '';
    document.getElementById('spotTime').value = '';
    document.getElementById('spotPlace').value = '';
    document.getElementById('spotCategory').value = 'canteen';
    document.getElementById('spotModal').classList.add('active');
  }
  function closeModal() { document.getElementById('spotModal').classList.remove('active'); }

  function saveSpot() {
    var name = document.getElementById('spotName').value.trim();
    if (!name) { alert('请输入名称'); return; }
    var s = {
      id: uid(),
      name: name,
      category: document.getElementById('spotCategory').value,
      time: document.getElementById('spotTime').value.trim(),
      place: document.getElementById('spotPlace').value.trim()
    };
    var list = get() || [];
    list.push(s);
    save(list);
    closeModal();
    render();
  }

  /* ================= 初始化 ================= */
  function init() {
    render();
    document.getElementById('btnAddSpot').addEventListener('click', openModal);
    document.getElementById('btnSaveSpot').addEventListener('click', saveSpot);
    document.getElementById('btnCloseSpotModal').addEventListener('click', closeModal);
    document.getElementById('spotModal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
    document.getElementById('btnResetSpots').addEventListener('click', function () {
      if (confirm('恢复到默认点位？自定义条目（含地图标点）将被清除。')) {
        save(DEFAULTS.slice());
        render(); renderMap();
      }
    });

    // 地图
    renderMap();
    document.getElementById('mapImageFile').addEventListener('change', function (e) {
      if (e.target.files[0]) handleMapUpload(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('mapContainer').addEventListener('click', onMapClick);
    document.getElementById('btnClearMap').addEventListener('click', function () {
      if (confirm('清除地图底图？所有标点坐标将一并移除（生活点位基本信息保留）。')) {
        var list = get() || [];
        list.forEach(function (s) { delete s.x; delete s.y; });
        save(list);
        setMapImg(null);
        renderMap(); render();
      }
    });

    // 教程
    renderTut();
    document.getElementById('btnAddTutorial').addEventListener('click', addTutorial);
    // 恢复默认列表：改过 DEFAULT_TUT 代码后，老浏览器点这里即可看到新内置列表
    document.getElementById('btnResetTut').addEventListener('click', function () {
      if (confirm('恢复到默认教程列表？你自定义添加的条目将被清除。')) {
        setTut(DEFAULT_TUT.slice());
        renderTut();
      }
    });
    // 导出/导入 JSON 备份
    document.getElementById('btnExportTut').addEventListener('click', exportTut);
    document.getElementById('btnImportTut').addEventListener('click', function () {
      document.getElementById('tutImportFile').click(); // 触发隐藏的文件选择框
    });
    document.getElementById('tutImportFile').addEventListener('change', function (e) {
      if (e.target.files[0]) importTut(e.target.files[0]);
      e.target.value = ''; // 清空以便重复导入同一文件
    });

    // 生活服务快捷
    renderLife();
    document.getElementById('btnAddLife').addEventListener('click', addLife);
    document.getElementById('btnResetLife').addEventListener('click', function () {
      if (confirm('恢复到默认生活快捷列表？你自定义添加的条目将被清除。')) {
        setLife(DEFAULT_LIFE.slice());
        renderLife();
      }
    });
  }

  window.App.campus = { init: init, render: render, renderMap: renderMap, renderTut: renderTut, mergeTutList: mergeTutList };
})();
