/* components.js —— 元器件素材库
 * 功能：入库（名称/规格/分类/数量/预警阈值/单价/备注）、搜索、分类筛选、
 *      快捷 +/- 出入库、编辑、删除、库存低于阈值自动预警、统计卡片、
 *      Excel 批量导入（同名同规格去重）/ 导出 / 模板下载
 * 数据：{id, name, spec, category, qty, min, price, note, ts}
 */
(function () {
  'use strict';
  var App = window.App;
  var KEY = 'gcsa_components';

  var CATS = {
    resistor: '电阻', capacitor: '电容', inductor: '电感',
    diode: '二极管/LED', transistor: '三极管/MOS', ic: '芯片IC',
    module: '模块', tool: '工具耗材', other: '其他'
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function get() { return App.Storage.get(KEY, []); }
  function set(v) { return App.Storage.set(KEY, v); }

  var editingId = null; // 编辑中的元件 id
  var selSet = {}; // 多选删除：勾选的元件 id → true

  /* ===== 筛选条件 ===== */
  function filtered() {
    var kw = document.getElementById('compSearch').value.trim().toLowerCase();
    var cat = document.getElementById('compFilter').value;
    return get().filter(function (c) {
      if (cat !== 'all' && c.category !== cat) return false;
      if (kw) {
        var blob = (c.name + ' ' + (c.spec || '') + ' ' + (c.note || '')).toLowerCase();
        if (blob.indexOf(kw) < 0) return false;
      }
      return true;
    });
  }

  /* ===== 渲染统计 + 列表 ===== */
  function render() {
    renderStats();
    renderList();
  }

  function renderStats() {
    var all = get();
    var total = all.length;
    var kinds = {};
    all.forEach(function (c) { kinds[c.category] = (kinds[c.category] || 0) + 1; });
    var lowCount = all.filter(function (c) { return c.qty <= (c.min || 0); }).length;
    var value = all.reduce(function (s, c) {
      return s + (c.price ? c.price * c.qty : 0);
    }, 0);

    var html = '<div class="comp-stat">种类<b>' + total + '</b></div>' +
      '<div class="comp-stat">总条目<b>' + total + '</b></div>' +
      '<div class="comp-stat' + (lowCount ? ' warn' : '') + '">库存预警<b>' + lowCount + '</b></div>' +
      '<div class="comp-stat">总价值<b>' + (value ? '¥' + value.toFixed(2) : '-') + '</b></div>';
    document.getElementById('compStats').innerHTML = html;
  }

  function renderList() {
    var list = filtered();
    var box = document.getElementById('compList');
    if (!list.length) {
      box.innerHTML = '<div class="home-widget__empty">' +
        (get().length ? '当前筛选条件下无结果' : '库存为空，点击"+ 入库元件"开始记录') + '</div>';
      updateBatchBtn();
      return;
    }
    // 全选框状态：当前可见行是否全部勾选
    var allChecked = list.every(function (c) { return !!selSet[c.id]; });
    var html = '<div style="overflow-x:auto"><table class="comp-table"><thead><tr>' +
      '<th style="width:36px"><input type="checkbox" class="comp-check-all"' + (allChecked ? ' checked' : '') + ' title="全选当前列表"></th>' +
      '<th>名称</th><th>规格/型号</th><th>分类</th><th>数量</th><th>预警值</th><th>单价</th><th>备注</th><th>操作</th>' +
      '</tr></thead><tbody>';
    list.forEach(function (c) {
      var low = c.qty <= (c.min || 0);
      html += '<tr>' +
        '<td><input type="checkbox" class="comp-check" data-id="' + c.id + '"' + (selSet[c.id] ? ' checked' : '') + '></td>' +
        '<td class="c-name">' + esc(c.name) + '</td>' +
        '<td class="c-spec">' + esc(c.spec || '-') + '</td>' +
        '<td><span class="comp-cat-badge">' + (CATS[c.category] || '其他') + '</span></td>' +
        '<td><span class="comp-qty' + (low ? ' low' : '') + '">' + c.qty + (low ? ' ⚠' : '') + '</span></td>' +
        '<td>' + (c.min || '-') + '</td>' +
        '<td>' + (c.price ? '¥' + c.price : '-') + '</td>' +
        '<td class="c-note">' + esc(c.note || '-') + '</td>' +
        '<td class="comp-act">' +
        '<button data-minus="' + c.id + '" title="出库1个">−1</button>' +
        '<button data-plus="' + c.id + '" title="入库1个">+1</button>' +
        '<button data-edit="' + c.id + '">编辑</button>' +
        '<button class="danger" data-del="' + c.id + '">删</button>' +
        '</td></tr>';
    });
    html += '</tbody></table></div>';
    box.innerHTML = html;

    // 事件绑定：快捷出入库 / 编辑 / 删除
    Array.prototype.forEach.call(box.querySelectorAll('[data-minus]'), function (b) {
      b.addEventListener('click', function () {
        changeQty(b.getAttribute('data-minus'), -1);
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-plus]'), function (b) {
      b.addEventListener('click', function () {
        changeQty(b.getAttribute('data-plus'), 1);
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-edit]'), function (b) {
      b.addEventListener('click', function () { openModal(b.getAttribute('data-edit')); });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-del]'), function (b) {
      b.addEventListener('click', function () {
        var c = get().filter(function (x) { return x.id === b.getAttribute('data-del'); })[0];
        if (c && confirm('删除「' + c.name + '」？')) {
          delete selSet[c.id]; // 若该行已被勾选则同步清理
          set(get().filter(function (x) { return x.id !== c.id; }));
          render();
        }
      });
    });

    // 多选：行勾选（事件委托到表格容器，避免重复渲染丢失状态）
    var table = box.querySelector('table');
    if (table) {
      table.onchange = function (e) {
        var t = e.target;
        if (t.classList && t.classList.contains('comp-check')) {
          if (t.checked) selSet[t.getAttribute('data-id')] = true;
          else delete selSet[t.getAttribute('data-id')];
          updateBatchBtn();
        } else if (t.classList && t.classList.contains('comp-check-all')) {
          toggleSelectAll(t.checked);
        }
      };
    }
    updateBatchBtn();
  }

  /** 全选/取消全选当前可见行 */
  function toggleSelectAll(check) {
    filtered().forEach(function (c) {
      if (check) selSet[c.id] = true;
      else delete selSet[c.id];
    });
    renderList();
  }

  /** 刷新批量删除按钮（选中数量） */
  function updateBatchBtn() {
    var btn = document.getElementById('btnBatchDelComp');
    if (!btn) return;
    var n = Object.keys(selSet).length;
    btn.style.display = n ? '' : 'none';
    btn.textContent = '批量删除 (' + n + ')';
  }

  /** 批量删除勾选元件 */
  function batchDelete() {
    var ids = Object.keys(selSet);
    if (!ids.length) return;
    if (!confirm('确定删除选中的 ' + ids.length + ' 条元件？')) return;
    set(get().filter(function (x) { return !selSet[x.id]; }));
    selSet = {};
    render();
  }

  /* ===== 快捷出入库（±1，出库到 0 为止） ===== */
  function changeQty(id, delta) {
    var list = get();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list[i].qty = Math.max(0, (list[i].qty || 0) + delta);
        break;
      }
    }
    set(list);
    render();
  }

  /* ===== 弹窗 ===== */
  function openModal(id) {
    editingId = id || null;
    document.getElementById('compModalTitle').textContent = id ? '编辑元件' : '入库元件';
    var c = null;
    if (id) c = get().filter(function (x) { return x.id === id; })[0];
    document.getElementById('compName').value = c ? c.name : '';
    document.getElementById('compSpec').value = c ? (c.spec || '') : '';
    document.getElementById('compCategory').value = c ? c.category : 'resistor';
    document.getElementById('compQty').value = c ? c.qty : 10;
    document.getElementById('compMin').value = c ? (c.min || 3) : 3;
    document.getElementById('compPrice').value = c && c.price ? c.price : '';
    document.getElementById('compNote').value = c ? (c.note || '') : '';
    document.getElementById('compModal').classList.add('active');
  }
  function closeModal() { document.getElementById('compModal').classList.remove('active'); }

  function saveComp() {
    var name = document.getElementById('compName').value.trim();
    var qty = parseInt(document.getElementById('compQty').value, 10);
    if (!name) { alert('请输入元件名称'); return; }
    if (isNaN(qty) || qty < 0) { alert('请输入有效数量'); return; }
    var c = {
      name: name,
      spec: document.getElementById('compSpec').value.trim(),
      category: document.getElementById('compCategory').value,
      qty: qty,
      min: parseInt(document.getElementById('compMin').value, 10) || 0,
      price: parseFloat(document.getElementById('compPrice').value) || 0,
      note: document.getElementById('compNote').value.trim()
    };
    var list = get();
    if (editingId) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === editingId) { c.id = editingId; c.ts = list[i].ts; list[i] = c; break; }
      }
    } else {
      c.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      c.ts = Date.now();
      list.push(c);
    }
    set(list);
    closeModal();
    render();
  }

  /* ===== Excel 导入/导出（三件套：导入 + 导出 + 模板） ===== */
  // 中文分类名 → 分类 key 的宽松映射（Excel 里分类列填中文即可，也可填英文 key）
  function mapCategory(s) {
    s = String(s || '').trim().toLowerCase();
    if (!s) return 'other';
    if (CATS[s]) return s; // 直接填了英文 key（resistor 等）
    if (s.indexOf('电阻') >= 0) return 'resistor';
    if (s.indexOf('电容') >= 0) return 'capacitor';
    if (s.indexOf('电感') >= 0 || s.indexOf('线圈') >= 0) return 'inductor';
    if (s.indexOf('二极管') >= 0 || s.indexOf('发光') >= 0 || s.indexOf('led') >= 0) return 'diode';
    if (s.indexOf('三极管') >= 0 || s.indexOf('晶体管') >= 0 || s.indexOf('mos') >= 0) return 'transistor';
    if (s.indexOf('芯片') >= 0 || s.indexOf('单片机') >= 0 || s === 'ic' || s.indexOf('mcu') >= 0 ||
        /stm32|esp32|arduino/.test(s)) return 'ic';
    if (s.indexOf('模块') >= 0) return 'module';
    if (s.indexOf('工具') >= 0 || s.indexOf('耗材') >= 0) return 'tool';
    return 'other';
  }

  // 数字容错："100个" → 100，"¥0.1" → 0.1，空/非法 → 默认值
  function num(v, def) {
    if (v === null || v === undefined || v === '') return def;
    var n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
    return isNaN(n) ? def : n;
  }

  // 表头别名（匹配方式：单元格文字包含别名即命中，如"规格/型号"含"规格"）
  var COMP_HEAD_ALIASES = {
    name: ['名称', '元件名', '物料', '品名'],
    spec: ['规格', '型号', '参数'],
    category: ['分类', '类别', '类型'],
    qty: ['数量', '库存'],
    min: ['预警', '阈值'],
    price: ['单价', '价格'],
    note: ['备注', '说明']
  };
  // 未识别到表头时的固定列序（与模板一致）
  var COMP_FIX_ORDER = ['name', 'spec', 'category', 'qty', 'min', 'price', 'note'];

  /** 解析二维表 → 元件数组（纯函数，便于单测）
   * 自动在前 8 行内找表头（含"名称/元件名/物料/品名"的行），
   * 没有表头则按模板列序解析；名称为空的行跳过
   * @return {valid: [元件], skipped: 跳过行数}
   */
  function parseCompRows(rows) {
    var colMap = null, startRow = 0;
    // 1. 找表头行
    for (var i = 0; i < Math.min(8, (rows || []).length); i++) {
      var cells = (rows[i] || []).map(function (c) { return String(c || '').trim(); });
      if (cells.some(function (c) { return c && (c.indexOf('名称') >= 0 || c.indexOf('元件名') >= 0 || c.indexOf('物料') >= 0 || c.indexOf('品名') >= 0); })) {
        colMap = {};
        cells.forEach(function (c, idx) {
          if (!c) return;
          Object.keys(COMP_HEAD_ALIASES).forEach(function (f) {
            if (colMap[f] === undefined && COMP_HEAD_ALIASES[f].some(function (a) { return c.indexOf(a) >= 0; })) colMap[f] = idx;
          });
        });
        startRow = i + 1;
        break;
      }
    }
    // 2. 无表头：按模板固定列序
    if (!colMap) {
      colMap = {};
      COMP_FIX_ORDER.forEach(function (f, idx) { colMap[f] = idx; });
      startRow = 0;
    }
    // 3. 逐行解析
    var valid = [], skipped = 0, ts = Date.now();
    for (var r = startRow; r < (rows || []).length; r++) {
      var row = rows[r] || [];
      var pick = function (f) { return colMap[f] !== undefined ? row[colMap[f]] : ''; };
      var name = String(pick('name') || '').trim();
      if (!name) { skipped++; continue; } // 空行/名称缺失
      if (r === startRow && Object.keys(COMP_HEAD_ALIASES).some(function (f) { return name.indexOf('名称') >= 0; })) { skipped++; continue; } // 无表头模式下跳过残留表头
      valid.push({
        id: ts.toString(36) + Math.random().toString(36).slice(2, 6) + r,
        ts: ts,
        name: name,
        spec: String(pick('spec') || '').trim(),
        category: mapCategory(pick('category')),
        qty: Math.max(0, Math.round(num(pick('qty'), 0))),
        min: Math.max(0, Math.round(num(pick('min'), 0))),
        price: Math.max(0, num(pick('price'), 0)),
        note: String(pick('note') || '').trim()
      });
    }
    return { valid: valid, skipped: skipped };
  }

  /** 与现有库存合并：同名同规格去重跳过（纯函数，不改原数组）
   * @return {added, skipped, list}
   */
  function mergeCompList(list, incoming) {
    var result = (list || []).slice();
    var seen = {};
    result.forEach(function (c) { seen[(c.name || '') + '|' + (c.spec || '')] = true; });
    var added = 0, skipped = 0;
    (incoming || []).forEach(function (c) {
      var key = (c.name || '') + '|' + (c.spec || '');
      if (seen[key]) { skipped++; return; }
      seen[key] = true;
      result.push(c);
      added++;
    });
    return { added: added, skipped: skipped, list: result };
  }

  /** 导入 Excel/CSV 文件 → 解析 → confirm 追加 */
  function importCompFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var wb;
      try { wb = XLSX.read(e.target.result, { type: 'array' }); }
      catch (err) { alert('文件解析失败：' + err.message + '\n支持 .xlsx / .xls / .csv'); return; }
      var ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { alert('文件里没有工作表'); return; }
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      var parsed = parseCompRows(rows);
      if (!parsed.valid.length) {
        alert('未识别到有效数据（跳过 ' + parsed.skipped + ' 行）。\n请点"下载模板"查看标准格式：名称 | 规格/型号 | 分类 | 数量 | 预警值 | 单价 | 备注');
        return;
      }
      var r = mergeCompList(get(), parsed.valid);
      if (!r.added) { alert('导入的 ' + parsed.valid.length + ' 条与现有库存全部重复（同名同规格），未做修改'); return; }
      if (!confirm('识别到 ' + parsed.valid.length + ' 条元件：可新增 ' + r.added + ' 条，重复跳过 ' + (parsed.valid.length - r.added) + ' 条。\n确认追加到库存？')) return;
      set(r.list);
      render();
      alert('导入完成：新增 ' + r.added + ' 条元件');
    };
    reader.readAsArrayBuffer(file);
  }

  /** 导出全部库存为 Excel */
  function exportCompXlsx() {
    var all = get();
    if (!all.length) { alert('库存为空，无可导出内容'); return; }
    var rows = [['名称', '规格/型号', '分类', '数量', '预警值', '单价', '备注']];
    all.forEach(function (c) {
      rows.push([c.name, c.spec || '', CATS[c.category] || '其他', c.qty, c.min || 0, c.price || 0, c.note || '']);
    });
    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 7 }, { wch: 7 }, { wch: 8 }, { wch: 26 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '元器件库存');
    XLSX.writeFile(wb, '元器件库存.xlsx');
  }

  /** 下载导入模板（含示例行，照着填即可） */
  function downloadCompTpl() {
    var rows = [
      ['名称', '规格/型号', '分类', '数量', '预警值', '单价', '备注'],
      ['色环电阻', '1kΩ ±1%', '电阻', 100, 20, 0.1, '常用阻值'],
      ['瓷片电容', '104 (0.1μF)', '电容', 50, 10, 0.05, ''],
      ['发光二极管', '红 5mm', '二极管LED', 30, 10, 0.15, '指示灯用'],
      ['STM32F103C8T6', 'LQFP48', '芯片IC', 5, 2, 15, '最小系统板'],
      ['杜邦线', '40P 母对母 20cm', '工具耗材', 2, 1, 3, '排线']
    ];
    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 7 }, { wch: 7 }, { wch: 8 }, { wch: 26 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '导入模板');
    XLSX.writeFile(wb, '元器件导入模板.xlsx');
  }

  /* ===== 初始化 ===== */
  function init() {
    render();
    document.getElementById('btnAddComp').addEventListener('click', function () { openModal(null); });
    document.getElementById('btnSaveComp').addEventListener('click', saveComp);
    document.getElementById('btnCloseCompModal').addEventListener('click', closeModal);
    document.getElementById('compModal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
    // 搜索/筛选实时联动
    document.getElementById('compSearch').addEventListener('input', renderList);
    document.getElementById('compFilter').addEventListener('change', renderList);
    // Excel 导入/导出/模板
    document.getElementById('btnImportComp').addEventListener('click', function () {
      document.getElementById('compImportFile').click(); // 触发隐藏的文件选择框
    });
    document.getElementById('compImportFile').addEventListener('change', function (e) {
      if (e.target.files[0]) importCompFile(e.target.files[0]);
      e.target.value = ''; // 清空以便重复导入同一文件
    });
    document.getElementById('btnExportComp').addEventListener('click', exportCompXlsx);
    document.getElementById('btnCompTpl').addEventListener('click', downloadCompTpl);
    // 多选批量删除
    document.getElementById('btnBatchDelComp').addEventListener('click', batchDelete);
  }

  window.App.components = { init: init, render: render, parseCompRows: parseCompRows, mergeCompList: mergeCompList, mapCategory: mapCategory, importCompFile: importCompFile };
})();
