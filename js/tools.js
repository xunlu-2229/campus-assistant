/* tools.js —— 学习工具：GPA 计算器 / 考试倒计时 / 备忘录
 * 全部数据 localStorage 持久化
 */
(function () {
  'use strict';
  var App = window.App;
  var KEY_GPA = 'gcsa_gpa';
  var KEY_EXAM = 'gcsa_exams';
  var KEY_MEMO = 'gcsa_memos';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ================= GPA 计算器 ================= */
  // 百分制 → 绩点（4.0 制常见标准）
  function scoreToGp(score) {
    if (score >= 90) return 4.0;
    if (score >= 85) return 3.7;
    if (score >= 82) return 3.3;
    if (score >= 78) return 3.0;
    if (score >= 75) return 2.7;
    if (score >= 72) return 2.3;
    if (score >= 68) return 2.0;
    if (score >= 64) return 1.5;
    if (score >= 60) return 1.0;
    return 0;
  }

  function renderGpaRows() {
    var rows = App.Storage.get(KEY_GPA, null);
    if (!rows) {
      rows = [
        { name: '', score: '', credit: '' },
        { name: '', score: '', credit: '' },
        { name: '', score: '', credit: '' }
      ];
    }
    var html = '';
    rows.forEach(function (r, i) {
      html += '<tr>' +
        '<td><input data-f="name" data-i="' + i + '" value="' + esc(r.name) + '" placeholder="课程名" /></td>' +
        '<td><input data-f="score" data-i="' + i + '" type="number" min="0" max="100" value="' + esc(r.score) + '" placeholder="0-100" /></td>' +
        '<td><input data-f="credit" data-i="' + i + '" type="number" min="0" step="0.5" value="' + esc(r.credit) + '" placeholder="如 3" /></td>' +
        '<td><span class="row-del" data-delrow="' + i + '">×</span></td>' +
        '</tr>';
    });
    document.getElementById('gpaBody').innerHTML = html;
    // 绑定行删除与输入实时保存（暂存到内存，点保存才写 localStorage）
    Array.prototype.forEach.call(document.querySelectorAll('#gpaBody [data-delrow]'), function (el) {
      el.addEventListener('click', function () {
        var idx = +el.getAttribute('data-delrow');
        var rows2 = collectGpaRows();
        rows2.splice(idx, 1);
        gpaCache = rows2;
        renderGpaRowsFrom(rows2);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('#gpaBody input'), function (inp) {
      inp.addEventListener('input', markGpaDirty);
    });
  }
  var gpaCache = null; // 内存暂存，避免每次输入都写 localStorage

  function renderGpaRowsFrom(rows) {
    gpaCache = rows;
    var html = '';
    rows.forEach(function (r, i) {
      html += '<tr>' +
        '<td><input data-f="name" data-i="' + i + '" value="' + esc(r.name) + '" placeholder="课程名" /></td>' +
        '<td><input data-f="score" data-i="' + i + '" type="number" min="0" max="100" value="' + esc(r.score) + '" placeholder="0-100" /></td>' +
        '<td><input data-f="credit" data-i="' + i + '" type="number" min="0" step="0.5" value="' + esc(r.credit) + '" placeholder="如 3" /></td>' +
        '<td><span class="row-del" data-delrow="' + i + '">×</span></td>' +
        '</tr>';
    });
    document.getElementById('gpaBody').innerHTML = html;
    Array.prototype.forEach.call(document.querySelectorAll('#gpaBody [data-delrow]'), function (el) {
      el.addEventListener('click', function () {
        var idx = +el.getAttribute('data-delrow');
        var rows2 = collectGpaRows();
        rows2.splice(idx, 1);
        renderGpaRowsFrom(rows2);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('#gpaBody input'), function (inp) {
      inp.addEventListener('input', markGpaDirty);
    });
  }
  function markGpaDirty() { gpaCache = null; } // 输入变更后标记缓存失效

  // 从 DOM 收集当前表格数据
  function collectGpaRows() {
    var rows = [];
    Array.prototype.forEach.call(document.querySelectorAll('#gpaBody tr'), function (tr) {
      var name = tr.querySelector('[data-f="name"]');
      var score = tr.querySelector('[data-f="score"]');
      var credit = tr.querySelector('[data-f="credit"]');
      rows.push({
        name: name ? name.value : '',
        score: score ? score.value : '',
        credit: credit ? credit.value : ''
      });
    });
    return rows;
  }

  function calcGpa() {
    var rows = collectGpaRows();
    var totalCredit = 0, weightSum = 0, gpSum = 0;
    var validCount = 0;
    rows.forEach(function (r) {
      var score = parseFloat(r.score);
      var credit = parseFloat(r.credit);
      if (isNaN(score) || isNaN(credit) || credit <= 0) return;
      validCount++;
      totalCredit += credit;
      weightSum += score * credit;
      gpSum += scoreToGp(score) * credit;
    });
    if (!validCount || totalCredit === 0) {
      document.getElementById('gpaResult').textContent = '请至少填写一行有效的成绩和学分';
      return;
    }
    var avg = weightSum / totalCredit;
    var gpa = gpSum / totalCredit;
    document.getElementById('gpaResult').textContent =
      '有效课程：' + validCount + ' 门，总学分：' + totalCredit + '\n' +
      '学分加权平均分 = ' + avg.toFixed(2) + ' 分\n' +
      'GPA（4.0 制）= ' + gpa.toFixed(2);
  }

  function saveGpa() {
    App.Storage.set(KEY_GPA, collectGpaRows());
    document.getElementById('gpaResult').textContent = '已保存到本地（共 ' + collectGpaRows().length + ' 行）';
  }

  /* ================= 考试倒计时 ================= */
  function renderExams() {
    var list = App.Storage.get(KEY_EXAM, []);
    list.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var html = '';
    list.forEach(function (e) {
      var d = new Date(e.date + 'T00:00:00');
      var days = Math.round((d - today) / 86400000);
      var badge;
      if (days > 0) {
        badge = '<span class="badge-days' + (days <= 7 ? ' urgent' : '') + '">还剩 ' + days + ' 天</span>';
      } else if (days === 0) {
        badge = '<span class="badge-days urgent">今天！</span>';
      } else {
        badge = '<span class="badge-days" style="background:#f3f4f6;color:#9ca3af">已结束</span>';
      }
      html += '<div class="list-item">' +
        '<div class="item-main">' + esc(e.name) + '<span class="item-sub">' + e.date + '</span></div>' +
        badge +
        '<span class="item-del" data-del="' + e.id + '">×</span>' +
        '</div>';
    });
    if (!html) html = '<div class="hint" style="margin-top:10px">暂无考试，添加一个倒计时吧</div>';
    document.getElementById('examList').innerHTML = html;
    Array.prototype.forEach.call(document.querySelectorAll('#examList [data-del]'), function (el) {
      el.addEventListener('click', function () {
        App.Storage.set(KEY_EXAM, App.Storage.get(KEY_EXAM, []).filter(function (e) {
          return e.id !== el.getAttribute('data-del');
        }));
        renderExams();
      });
    });
  }

  function addExam() {
    var name = document.getElementById('examName').value.trim();
    var date = document.getElementById('examDate').value;
    if (!name) { alert('请输入科目名'); return; }
    if (!date) { alert('请选择考试日期'); return; }
    var list = App.Storage.get(KEY_EXAM, []);
    list.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name, date: date
    });
    App.Storage.set(KEY_EXAM, list);
    document.getElementById('examName').value = '';
    renderExams();
  }

  /* ================= 备忘录 ================= */
  function renderMemos() {
    var list = App.Storage.get(KEY_MEMO, []);
    var html = '';
    list.forEach(function (m) {
      html += '<div class="list-item">' +
        '<div class="item-main">' + esc(m.text) +
        '<span class="item-sub">' + new Date(m.ts).toLocaleString() + '</span></div>' +
        '<span class="item-del" data-del="' + m.id + '">×</span>' +
        '</div>';
    });
    if (!html) html = '<div class="hint" style="margin-top:10px">暂无备忘</div>';
    document.getElementById('memoList').innerHTML = html;
    Array.prototype.forEach.call(document.querySelectorAll('#memoList [data-del]'), function (el) {
      el.addEventListener('click', function () {
        App.Storage.set(KEY_MEMO, App.Storage.get(KEY_MEMO, []).filter(function (m) {
          return m.id !== el.getAttribute('data-del');
        }));
        renderMemos();
      });
    });
  }

  function addMemo() {
    var text = document.getElementById('memoInput').value.trim();
    if (!text) { alert('请输入内容'); return; }
    var list = App.Storage.get(KEY_MEMO, []);
    list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: text, ts: Date.now() });
    App.Storage.set(KEY_MEMO, list);
    document.getElementById('memoInput').value = '';
    renderMemos();
  }

  /* ================= 首页紧凑组件渲染 ================= */
  function renderHomeCountdown() {
    var box = document.getElementById('homeCountdownList');
    if (!box) return;
    var list = App.Storage.get(KEY_EXAM, []);
    list.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var upcoming = list.filter(function (e) {
      var d = new Date(e.date + 'T00:00:00');
      return (d - today) >= -86400000; // 包含今天及之后
    }).slice(0, 4);
    if (!upcoming.length) {
      box.innerHTML = '<div class="home-widget__empty">暂无考试安排</div>';
      return;
    }
    box.innerHTML = upcoming.map(function (e) {
      var d = new Date(e.date + 'T00:00:00');
      var days = Math.round((d - today) / 86400000);
      var badge;
      if (days > 0) badge = '<span class="badge-days' + (days <= 7 ? ' urgent' : '') + '">' + days + '天</span>';
      else if (days === 0) badge = '<span class="badge-days urgent">今天!</span>';
      else badge = '<span class="badge-days" style="background:#f3f4f6;color:#9ca3af">已过</span>';
      return '<div class="home-widget__item"><span class="hw-name">' + esc(e.name) + '</span>' +
        '<span class="home-widget__sub">' + e.date + '</span>' + badge + '</div>';
    }).join('');
  }

  function renderHomeMemo() {
    var box = document.getElementById('homeMemoList');
    if (!box) return;
    var list = App.Storage.get(KEY_MEMO, []);
    var recent = list.slice(0, 5);
    if (!recent.length) {
      box.innerHTML = '<div class="home-widget__empty">暂无备忘</div>';
      return;
    }
    box.innerHTML = recent.map(function (m) {
      return '<div class="home-widget__item"><span class="hw-name">' + esc(m.text) + '</span>' +
        '<span class="home-widget__sub">' + new Date(m.ts).toLocaleDateString() + '</span></div>';
    }).join('');
  }

  /** 首页组件刷新（增删倒计时/备忘录后调） */
  function refreshHomeWidgets() {
    renderHomeCountdown();
    renderHomeMemo();
  }

  /* ================= 初始化 ================= */
  function init() {
    renderGpaRows();
    document.getElementById('btnAddGpaRow').addEventListener('click', function () {
      var rows = collectGpaRows();
      rows.push({ name: '', score: '', credit: '' });
      renderGpaRowsFrom(rows);
    });
    document.getElementById('btnGpaCalc').addEventListener('click', calcGpa);
    document.getElementById('btnGpaSave').addEventListener('click', saveGpa);

    renderExams();
    document.getElementById('btnAddExam').addEventListener('click', function () {
      addExam();
      refreshHomeWidgets(); // 同步首页
    });
    // 常见大考预设：点击填入名称和日期（用户确认后点"添加"提交）
    Array.prototype.forEach.call(document.querySelectorAll('.exam-preset'), function (btn) {
      btn.addEventListener('click', function () {
        var parts = btn.getAttribute('data-exam').split('|');
        document.getElementById('examName').value = parts[0];
        document.getElementById('examDate').value = parts[1];
        document.getElementById('examName').focus();
      });
    });

    renderMemos();
    document.getElementById('btnAddMemo').addEventListener('click', function () {
      addMemo();
      refreshHomeWidgets();
    });
    document.getElementById('memoInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { addMemo(); refreshHomeWidgets(); }
    });
  }

  window.App.tools = { init: init, refreshHomeWidgets: refreshHomeWidgets, renderHomeCountdown: renderHomeCountdown, renderHomeMemo: renderHomeMemo };
})();
