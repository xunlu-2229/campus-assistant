/* schedule.js —— 课表模块
 * 功能：手动录入、周视图渲染、Excel/iCal 导入、iCal/JSON 导出、清空
 * 数据结构：{id, name, day(1-7), start(节), end(节), place, teacher}
 */
(function () {
  'use strict';
  var App = window.App;

  // 默认每节起止时间（用于 iCal 时间↔节次 换算，可按本校作息调整）
  var PERIOD_TIMES = [
    null,
    { s: '08:00', e: '08:45' }, { s: '08:50', e: '09:35' },
    { s: '09:50', e: '10:35' }, { s: '10:40', e: '11:25' },
    { s: '11:30', e: '12:15' }, { s: '14:00', e: '14:45' },
    { s: '14:50', e: '15:35' }, { s: '15:50', e: '16:35' },
    { s: '16:40', e: '17:25' }, { s: '18:30', e: '19:15' },
    { s: '19:20', e: '20:05' }, { s: '20:10', e: '20:55' }
  ];
  var TOTAL_PERIODS = 12;
  var DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  var editingId = null; // 当前编辑课程 id（null 表示新增）

  /* ===== 工具函数 ===== */
  function timeToMin(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // 时间(分钟)映射到节次区间
  function timeToPeriods(startMin, endMin) {
    var s = null, e = null;
    for (var i = 1; i <= TOTAL_PERIODS; i++) {
      var ps = timeToMin(PERIOD_TIMES[i].s), pe = timeToMin(PERIOD_TIMES[i].e);
      if (s === null && startMin < pe && startMin >= ps - 5) s = i;
      if (endMin > ps && endMin <= pe + 5) e = i;
    }
    if (s && !e) e = s;
    return (s && e) ? { start: s, end: e } : null;
  }

  /* ===== 渲染周视图 ===== */
  function render() {
    var courses = App.Storage.getCourses();
    var table = document.getElementById('scheduleTable');
    var html = '<thead><tr><th class="time-col">节次</th>';
    for (var d = 1; d <= 7; d++) html += '<th>' + DAY_NAMES[d % 7] + '</th>'; // d=7→周日(下标0)
    html += '</tr></thead><tbody>';
    for (var p = 1; p <= TOTAL_PERIODS; p++) {
      html += '<tr><td class="time-col">第' + p + '节<br>' + PERIOD_TIMES[p].s + '</td>';
      for (var dd = 1; dd <= 7; dd++) {
        var cell = courses.filter(function (c) { return c.day === dd && c.start <= p && c.end >= p; });
        html += '<td>';
        cell.forEach(function (c) {
          if (c.start === p) {
            html += '<div class="course-block">' +
              '<span class="del" data-del="' + c.id + '" title="删除">×</span>' +
              '<div class="name">' + escapeHtml(c.name) + '</div>' +
              '<div class="meta">' + escapeHtml(c.place || '') + (c.teacher ? ' · ' + escapeHtml(c.teacher) : '') + '</div>' +
              '</div>';
          } else {
            html += '<div class="course-block" style="opacity:.55"><div class="meta">↑</div></div>';
          }
        });
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody>';
    table.innerHTML = html;
    // 绑定删除按钮
    var dels = table.querySelectorAll('[data-del]');
    Array.prototype.forEach.call(dels, function (el) {
      el.addEventListener('click', function () {
        if (confirm('删除该课程？')) {
          App.Storage.removeCourse(el.getAttribute('data-del'));
          render();
        }
      });
    });
  }

  /* ===== 添加/编辑弹窗 ===== */
  function openModal(id) {
    editingId = id || null;
    document.getElementById('courseModalTitle').textContent = id ? '编辑课程' : '添加课程';
    if (id) {
      var c = App.Storage.getCourses().filter(function (x) { return x.id === id; })[0];
      if (c) {
        document.getElementById('cName').value = c.name || '';
        document.getElementById('cDay').value = c.day || 1;
        document.getElementById('cStart').value = c.start || 1;
        document.getElementById('cEnd').value = c.end || 1;
        document.getElementById('cPlace').value = c.place || '';
        document.getElementById('cTeacher').value = c.teacher || '';
      }
    } else {
      document.getElementById('cName').value = '';
      document.getElementById('cPlace').value = '';
      document.getElementById('cTeacher').value = '';
      document.getElementById('cDay').value = 1;
      document.getElementById('cStart').value = 1;
      document.getElementById('cEnd').value = 2;
    }
    document.getElementById('courseModal').classList.add('active');
  }
  function closeModal() { document.getElementById('courseModal').classList.remove('active'); }

  function saveCourse() {
    var c = {
      name: document.getElementById('cName').value.trim(),
      day: parseInt(document.getElementById('cDay').value, 10),
      start: parseInt(document.getElementById('cStart').value, 10),
      end: parseInt(document.getElementById('cEnd').value, 10),
      place: document.getElementById('cPlace').value.trim(),
      teacher: document.getElementById('cTeacher').value.trim()
    };
    if (!c.name) { alert('请输入课程名'); return; }
    if (c.start > c.end) { alert('开始节不能晚于结束节'); return; }
    if (editingId) {
      var list = App.Storage.getCourses();
      var idx = list.findIndex(function (x) { return x.id === editingId; });
      if (idx >= 0) { c.id = editingId; list[idx] = c; App.Storage.setCourses(list); }
    } else {
      App.Storage.addCourse(c);
    }
    closeModal();
    render();
  }

  /* ===== 下载文件（导出通用） ===== */
  function download(content, filename, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ===== 导出 iCal（生成一学期16周重复事件） ===== */
  function exportIcal() {
    var courses = App.Storage.getCourses();
    if (!courses.length) { alert('课表为空'); return; }
    var now = new Date();
    var monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // 本周一
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GCSA//Schedule//CN', 'CALSCALE:GREGORIAN'];
    courses.forEach(function (c) {
      for (var w = 0; w < 16; w++) {
        var day = new Date(monday);
        day.setDate(monday.getDate() + (c.day - 1) + w * 7);
        var ps = timeToMin(PERIOD_TIMES[c.start].s);
        var pe = timeToMin(PERIOD_TIMES[c.end].e);
        var dtStart = new Date(day); dtStart.setHours(Math.floor(ps / 60), ps % 60, 0);
        var dtEnd = new Date(day); dtEnd.setHours(Math.floor(pe / 60), pe % 60, 0);
        lines.push('BEGIN:VEVENT');
        lines.push('UID:' + c.id + '-' + w + '@gcsa');
        lines.push('SUMMARY:' + c.name);
        lines.push('DTSTAMP:' + fmtIcalDate(now));
        lines.push('DTSTART:' + fmtIcalDate(dtStart));
        lines.push('DTEND:' + fmtIcalDate(dtEnd));
        if (c.place) lines.push('LOCATION:' + c.place);
        if (c.teacher) lines.push('DESCRIPTION:教师:' + c.teacher);
        lines.push('END:VEVENT');
      }
    });
    lines.push('END:VCALENDAR');
    download(lines.join('\r\n'), '课表.ics', 'text/calendar');
  }
  function fmtIcalDate(d) {
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
      pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  }

  /* ===== 导出 JSON ===== */
  function exportJson() {
    download(JSON.stringify(App.Storage.getCourses(), null, 2), '课表.json', 'application/json');
  }

  /* ===== 导入 iCal（简易解析） ===== */
  function parseIcalDate(s) {
    var m = s.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/);
    if (!m) return null;
    if (m[7] === 'Z') return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }
  function importIcal(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var text = e.target.result;
      var events = [], ev = null;
      text.split(/\r?\n/).forEach(function (line) {
        line = line.trim();
        if (line === 'BEGIN:VEVENT') ev = {};
        else if (line === 'END:VEVENT') { if (ev) events.push(ev); ev = null; }
        else if (ev) {
          var m = line.match(/^(SUMMARY|DTSTART|DTEND|LOCATION|DESCRIPTION):(.*)$/i);
          if (m) ev[m[1].toUpperCase()] = m[2];
        }
      });
      var added = 0, seen = {};
      events.forEach(function (ev) {
        if (!ev.SUMMARY || !ev.DTSTART) return;
        var dt = parseIcalDate(ev.DTSTART);
        var dtEnd = ev.DTEND ? parseIcalDate(ev.DTEND) : null;
        if (!dt) return;
        var day = dt.getDay(); if (day === 0) day = 7;
        var sMin = dt.getHours() * 60 + dt.getMinutes();
        var eMin = dtEnd ? dtEnd.getHours() * 60 + dtEnd.getMinutes() : sMin + 45;
        var per = timeToPeriods(sMin, eMin);
        if (!per) return;
        var key = ev.SUMMARY + '_' + day + '_' + per.start;
        if (seen[key]) return; seen[key] = 1;
        App.Storage.addCourse({
          name: ev.SUMMARY, day: day, start: per.start, end: per.end,
          place: ev.LOCATION || '', teacher: (ev.DESCRIPTION || '').replace(/^教师:/, '')
        });
        added++;
      });
      render();
      alert('导入完成，共 ' + added + ' 门课程');
    };
    reader.readAsText(file);
  }

  /* ===== Excel 导入：自动识别两种格式 =====
   * 格式A 教务网格课表（如教务系统导出的 xskb.xls）：表头行含"星期一~日"，
   *        每行一节次，单元格含"编号\n课程名\n教师【周次】\n教室\n班级\n学分"
   * 格式B 行式清单：表头 课程名|星期|开始节|结束节|地点|教师
   */
  function importExcel(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(e.target.result, { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!rows.length) { alert('Excel 内容为空'); return; }

        // 合并单元格填充：把左上值扩展到整个合并区域（兼容合并型教务模板）
        fillMerges(rows, ws);

        var headerRow = findHeaderRow(rows, 15);
        var added, mode;
        if (headerRow >= 0) {
          added = importGridSchedule(rows, headerRow);
          mode = '教务课表（网格）';
        } else {
          added = importRowSchedule(rows);
          mode = '清单（行式）';
        }
        render();
        if (added) {
          alert('导入完成（' + mode + '），共 ' + added + ' 条课程记录\n' +
            '提示：如导入前已有课程，可能与旧数据叠加，建议先清空');
        } else {
          alert('未识别到有效数据。\n支持：教务导出的网格课表，或表头为 课程名|星期|开始节|结束节|地点|教师 的清单');
        }
      } catch (err) {
        alert('Excel 解析失败：' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /** 合并单元格填充：值仅存在于左上角，扩展到合并区域每一格 */
  function fillMerges(rows, ws) {
    var merges = ws && ws['!merges'];
    if (!merges || !merges.length) return;
    merges.forEach(function (m) {
      var val = (rows[m.s.r] || [])[m.s.c];
      if (val === undefined || val === '') return;
      for (var r = m.s.r; r <= m.e.r; r++) {
        if (!rows[r]) rows[r] = [];
        for (var c = m.s.c; c <= m.e.c; c++) rows[r][c] = val;
      }
    });
  }

  /** 检测表头行：前若干行内含"星期x"的行号，无则返回 -1 */
  function findHeaderRow(rows, maxScan) {
    for (var r = 0; r < Math.min(rows.length, maxScan); r++) {
      var cells = (rows[r] || []).map(function (x) { return String(x == null ? '' : x); });
      for (var c = 0; c < cells.length; c++) {
        if (/星期[一二三四五六日]/.test(cells[c])) return r;
      }
    }
    return -1;
  }

  /** 教务单元格解析：编号\n课程名\n教师【周次】\n教室\n班级\n学分 */
  function parseGridCell(text) {
    var lines = String(text).split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) return null;
    var name = '', teacher = '', place = '', weeks = '';
    lines.forEach(function (line, i) {
      if (i === 0 && /^[A-Za-z]\d{3,}/.test(line)) return; // 课程编号行
      if (!name) {
        if (/学分|学时/.test(line)) return;
        name = line; return;
      }
      var mw = line.match(/^(.*?)【(\d+(?:-\d+)?)\s*周(?:单|双)?】?$/);
      if (mw) { if (!teacher) teacher = mw[1]; weeks = mw[2]; return; }
      if (/学分|学时/.test(line)) return;
      if (/\d{3,}/.test(line) && /楼|室|馆|区|栋|舍/.test(line)) { if (!place) place = line; return; }
      if (line.indexOf('-') >= 0) return; // 班级行
      if (!teacher && line.length <= 12) { teacher = line; return; } // 无周次标注的教师
    });
    if (!name) return null;
    return { name: name, teacher: teacher, place: place, weeks: weeks };
  }

  /** 格式A：网格课表导入（返回导入条数） */
  function importGridSchedule(rows, headerRow) {
    // 1) 表头行建立 列→星期 映射
    var dayCols = {};
    var header = rows[headerRow] || [];
    for (var c = 0; c < header.length; c++) {
      var t = String(header[c] || '');
      var m = t.match(/星期([一二三四五六日])/);
      if (m) dayCols[c] = '一二三四五六日'.indexOf(m[1]) + 1;
    }
    if (!Object.keys(dayCols).length) return 0;

    // 2) 逐行扫描：节次号 = 该行第一个纯数字单元格
    var tuples = [];
    for (var r = headerRow + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row) continue;
      var period = null;
      for (var k = 0; k < row.length; k++) {
        var v = String(row[k] == null ? '' : row[k]).trim();
        if (/^\d+(\.\d+)?$/.test(v)) { period = parseInt(v, 10); break; }
      }
      if (!period) continue; // 备注行/空行/时间行自动跳过
      for (var col in dayCols) {
        var cellText = String(row[col] == null ? '' : row[col]).trim();
        if (!cellText) continue;
        var parsed = parseGridCell(cellText);
        if (!parsed || !parsed.name) continue;
        tuples.push({ day: dayCols[col], period: period, info: parsed });
      }
    }

    // 3) 同一天同名课程合并连续节次（跨天同课自动拆分为多条）
    var map = {};
    tuples.forEach(function (t) {
      var id = t.day + '|' + t.info.name;
      var cur = map[id];
      if (!cur) {
        map[id] = { day: t.day, name: t.info.name, place: t.info.place, teacher: t.info.teacher,
                    weeks: t.info.weeks, start: t.period, end: t.period };
      } else {
        cur.start = Math.min(cur.start, t.period);
        cur.end = Math.max(cur.end, t.period);
      }
    });

    // 4) 写入本地存储
    var count = 0;
    Object.keys(map).forEach(function (k) {
      var c = map[k];
      // 周次并入教师备注展示（如"秦宏伟(4-13周)"）
      var teacher = c.teacher || '';
      if (c.weeks) teacher = teacher ? teacher + '(' + c.weeks + '周)' : c.weeks + '周';
      App.Storage.addCourse({
        name: c.name, day: c.day, start: c.start, end: c.end,
        place: c.place, teacher: teacher
      });
      count++;
    });
    return count;
  }

  /** 格式B：行式清单导入（原约定格式，返回导入条数） */
  function importRowSchedule(rows) {
    var added = 0;
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r || !r[0]) continue;
      var day = parseInt(r[1], 10), start = parseInt(r[2], 10), end = parseInt(r[3], 10);
      if (!day || !start || !end) continue;
      App.Storage.addCourse({
        name: String(r[0]), day: day, start: start, end: end,
        place: r[4] ? String(r[4]) : '', teacher: r[5] ? String(r[5]) : ''
      });
      added++;
    }
    return added;
  }

  /* ===== 初始化 ===== */
  function init() {
    render();
    document.getElementById('btnAddCourse').addEventListener('click', function () { openModal(null); });
    document.getElementById('btnSaveCourse').addEventListener('click', saveCourse);
    document.getElementById('btnCloseModal').addEventListener('click', closeModal);
    document.getElementById('btnExportIcal').addEventListener('click', exportIcal);
    document.getElementById('btnExportJson').addEventListener('click', exportJson);
    document.getElementById('btnClearSchedule').addEventListener('click', function () {
      if (confirm('确定清空所有课程？此操作不可撤销。')) {
        App.Storage.setCourses([]); render();
      }
    });
    document.getElementById('fileExcel').addEventListener('change', function (e) {
      if (e.target.files[0]) importExcel(e.target.files[0]); e.target.value = '';
    });
    document.getElementById('fileIcal').addEventListener('change', function (e) {
      if (e.target.files[0]) importIcal(e.target.files[0]); e.target.value = '';
    });
    document.getElementById('courseModal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }

  window.App.schedule = { init: init, render: render };
})();
