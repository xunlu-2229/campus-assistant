/* labdata.js —— 实验数据助手
 * 功能：粘贴/Excel 导入 → Chart.js 绘图 → 统计（均值/标准差）
 *      → 最小二乘线性拟合 → 伏安特性(R=1/b) / 谐振特性(f0/BW/Q) 附加分析
 *      → 误差计算器 → CSV 导出
 */
(function () {
  'use strict';
  var App = window.App;

  var lastData = null; // {xs, ys} 最近一次成功解析的数据，导出时用

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(v) {
    if (!isFinite(v)) return '-';
    if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(4);
    return parseFloat(v.toPrecision(6)).toString();
  }

  /* ===== 数据解析：每行 x y（空格/逗号/Tab/中文逗号分隔） ===== */
  function parse(text) {
    var xs = [], ys = [];
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === '#') return; // 空行与 # 注释行跳过
      var parts = line.split(/[\s,，\t;；]+/);
      var x = parseFloat(parts[0]), y = parseFloat(parts[1]);
      if (!isNaN(x) && !isNaN(y)) { xs.push(x); ys.push(y); }
    });
    return { xs: xs, ys: ys };
  }

  /* ===== 统计量（增强版：均值/标准差/中位数/极差/CV） ===== */
  function stats(arr) {
    var n = arr.length;
    if (!n) return { n: 0, mean: NaN, std: NaN, median: NaN, range: NaN, cv: NaN };
    var sum = 0;
    arr.forEach(function (v) { sum += v; });
    var mean = sum / n;
    var sorted = arr.slice().sort(function (a, b) { return a - b; });
    var median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    var range = sorted[n - 1] - sorted[0];
    if (n < 2) return { n: n, mean: mean, std: 0, median: median, range: range, cv: 0 };
    var sq = 0;
    arr.forEach(function (v) { sq += (v - mean) * (v - mean); });
    var std = Math.sqrt(sq / (n - 1)); // 样本标准差
    return { n: n, mean: mean, std: std, median: median, range: range, cv: mean !== 0 ? std / Math.abs(mean) * 100 : NaN };
  }

  /* ===== A 类不确定度（贝塞尔公式） =====
   * uA = s / √n，置信因子取 t≈1（简化）
   */
  function uA(arr) {
    var st = stats(arr);
    if (st.n < 2) return NaN;
    return st.std / Math.sqrt(st.n);
  }

  /* ===== 格拉布斯准则剔除粗大误差 =====
   * G = |xi - mean| / s，与临界值表比较（显著水平 0.05）
   */
  var GRUBBS_T = { 3: 1.153, 4: 1.463, 5: 1.672, 6: 1.822, 7: 1.938, 8: 2.032, 9: 2.110, 10: 2.176,
    11: 2.234, 12: 2.285, 13: 2.331, 14: 2.371, 15: 2.409, 16: 2.443, 17: 2.475, 18: 2.504,
    19: 2.532, 20: 2.557, 21: 2.580, 22: 2.603, 23: 2.624, 24: 2.645, 25: 2.665, 30: 2.745, 40: 2.866, 50: 2.956 };
  function grubbsOutliers(arr) {
    var st = stats(arr);
    if (st.n < 3 || !st.std) return [];
    var t = GRUBBS_T[st.n] || (st.n > 50 ? 3.0 : 2.7);
    var out = [];
    arr.forEach(function (v, i) {
      var G = Math.abs(v - st.mean) / st.std;
      if (G > t) out.push({ index: i, value: v, G: G });
    });
    return out;
  }

  /* ===== 二次多项式拟合 y = a2x² + a1x + a0（正规方程高斯消元） ===== */
  function fitQuadratic(xs, ys) {
    var n = xs.length;
    if (n < 3) return null;
    // 矩阵 S·c = T，S 是 3x3 对称
    var S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], T = [0, 0, 0];
    for (var i = 0; i < n; i++) {
      var x = xs[i], y = ys[i];
      var pw = [1, x, x * x];
      for (var r = 0; r < 3; r++) {
        T[r] += pw[r] * y;
        for (var c = 0; c < 3; c++) S[r][c] += pw[r] * pw[c];
      }
    }
    // 高斯消元解线性方程组
    var M = [S[0].concat(T[0]), S[1].concat(T[1]), S[2].concat(T[2])];
    for (var k = 0; k < 3; k++) {
      var piv = k;
      for (var r2 = k + 1; r2 < 3; r2++) if (Math.abs(M[r2][k]) > Math.abs(M[piv][k])) piv = r2;
      if (Math.abs(M[piv][k]) < 1e-12) return null;
      var tmp = M[k]; M[k] = M[piv]; M[piv] = tmp;
      for (var r3 = k + 1; r3 < 3; r3++) {
        var f = M[r3][k] / M[k][k];
        for (var c2 = k; c2 <= 3; c2++) M[r3][c2] -= f * M[k][c2];
      }
    }
    var coef = [0, 0, 0];
    for (var k2 = 2; k2 >= 0; k2--) {
      var s = M[k2][3];
      for (var j = k2 + 1; j < 3; j++) s -= M[k2][j] * coef[j];
      coef[k2] = s / M[k2][k2];
    }
    // R²
    var my = T[0] / n, ssTot = 0, ssRes = 0;
    for (i = 0; i < n; i++) {
      var fit = coef[0] + coef[1] * xs[i] + coef[2] * xs[i] * xs[i];
      ssRes += (ys[i] - fit) * (ys[i] - fit);
      ssTot += (ys[i] - my) * (ys[i] - my);
    }
    return { a0: coef[0], a1: coef[1], a2: coef[2], r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
  }

  /* ===== 最小二乘线性拟合 y = a + bx，返回 {a, b, r2} ===== */
  function fitLinear(xs, ys) {
    var n = xs.length;
    if (n < 2) return null;
    var sx = 0, sy = 0;
    for (var i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
    var mx = sx / n, my = sy / n;
    var sxy = 0, sxx = 0, syy = 0;
    for (i = 0; i < n; i++) {
      var dx = xs[i] - mx, dy = ys[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    if (sxx === 0) return null; // x 全相同无法拟合
    var b = sxy / sxx;
    var a = my - b * mx;
    var r2 = (syy === 0) ? 1 : (sxy * sxy) / (sxx * syy);
    return { a: a, b: b, r2: r2 };
  }

  /* ===== 谐振特性：f0 / 半功率带宽 BW / 品质因数 Q ===== */
  function resonanceAnalyze(xs, ys) {
    var n = ys.length;
    if (n < 3) return null;
    var ymax = -Infinity, imax = 0;
    for (var i = 0; i < n; i++) if (ys[i] > ymax) { ymax = ys[i]; imax = i; }
    var half = ymax / Math.SQRT2; // 3dB 半功率点
    var xmin = Infinity, xmax = -Infinity;
    for (i = 0; i < n; i++) {
      if (ys[i] >= half) {
        if (xs[i] < xmin) xmin = xs[i];
        if (xs[i] > xmax) xmax = xs[i];
      }
    }
    var f0 = xs[imax];
    var bw = (xmin !== Infinity && xmax !== -Infinity) ? (xmax - xmin) : NaN;
    var q = (bw > 0) ? f0 / bw : NaN;
    return { f0: f0, ymax: ymax, bw: bw, q: q };
  }

  /* ===== 主流程：绘图 + 分析（增强版） ===== */
  function analyze() {
    var text = document.getElementById('labData').value;
    var data = parse(text);
    if (data.xs.length < 2) {
      document.getElementById('labResult').textContent = '有效数据不足 2 组，请检查格式（每行两个数）';
      return;
    }
    lastData = data;
    var xs = data.xs, ys = data.ys;
    var xName = document.getElementById('labXName').value.trim() || 'x';
    var yName = document.getElementById('labYName').value.trim() || 'y';
    var type = document.getElementById('labType').value;
    var showFit = document.getElementById('labShowFit').checked;
    var lineMode = document.getElementById('labLineMode').checked;
    var useQuad = document.getElementById('labQuadratic') && document.getElementById('labQuadratic').checked;
    var useGrubbs = document.getElementById('labGrubbs') && document.getElementById('labGrubbs').checked;
    var useUnc = document.getElementById('labUncertainty') && document.getElementById('labUncertainty').checked;
    var useResid = document.getElementById('labResidual') && document.getElementById('labResidual').checked;

    /* --- ① 格拉布斯剔除（对 y 值） --- */
    var outliers = [];
    if (useGrubbs) outliers = grubbsOutliers(ys);
    var outIdx = {};
    outliers.forEach(function (o) { outIdx[o.index] = true; });
    var exs = xs.filter(function (_, i) { return !outIdx[i]; });
    var eys = ys.filter(function (_, i) { return !outIdx[i]; });

    /* --- ② 绘图 --- */
    // 主数据集排除离群点（剔除点单独用红×标注，避免被蓝点覆盖）
    var points = xs.map(function (x, i) { return { x: x, y: ys[i] }; })
      .filter(function (_, i) { return !outIdx[i]; });
    var datasets = [{
      label: '实验数据',
      data: points,
      type: 'scatter',
      color: '#2563eb',
      showLine: lineMode,
      pointRadius: 4
    }];
    // 剔除点用红叉单独标注
    if (outliers.length) {
      datasets.push({
        label: '剔除点(格拉布斯)',
        data: outliers.map(function (o) { return { x: xs[o.index], y: o.value }; }),
        type: 'scatter',
        color: '#ef4444',
        pointRadius: 7,
        pointStyle: 'crossRot'
      });
    }
    var fit = fitLinear(exs, eys); // 拟合用剔除后的数据
    var quad = useQuad ? fitQuadratic(exs, eys) : null;
    if (showFit && fit) {
      var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
      datasets.push({
        label: '拟合直线',
        data: [{ x: xmin, y: fit.a + fit.b * xmin }, { x: xmax, y: fit.a + fit.b * xmax }],
        type: 'line',
        color: '#ef4444',
        showLine: true,
        pointRadius: 0
      });
    }
    if (quad) {
      var xq = Math.min.apply(null, xs), xqmax = Math.max.apply(null, xs);
      var curve = [];
      for (var cx = xq; cx <= xqmax; cx += (xqmax - xq) / 50) {
        curve.push({ x: cx, y: quad.a0 + quad.a1 * cx + quad.a2 * cx * cx });
      }
      datasets.push({
        label: '二次拟合',
        data: curve,
        type: 'line',
        color: '#059669',
        showLine: true,
        pointRadius: 0
      });
    }
    App.Chart.scatter('labChart', datasets, {
      plugins: { legend: { display: true } },
      scales: {
        x: { type: 'linear', title: { display: true, text: xName }, grid: { color: App.Chart.cssVar('--chart-grid', '#f0f0f0') } },
        y: { title: { display: true, text: yName }, grid: { color: App.Chart.cssVar('--chart-grid', '#f0f0f0') } }
      }
    });

    /* --- ③ 统计分析结果 --- */
    var st = stats(eys), stx = stats(exs);
    var lines = [
      '数据组数 n = ' + st.n + (outliers.length ? '（原始 ' + xs.length + '，剔除 ' + outliers.length + ' 个粗大误差）' : '')
    ];
    if (outliers.length) {
      outliers.forEach(function (o) {
        lines.push('  ✕ 剔除 (x=' + fmt(xs[o.index]) + ', y=' + fmt(o.value) + ')，G=' + o.G.toFixed(3) + ' > 临界值');
      });
    }
    lines.push(
      'x：均值 = ' + fmt(stx.mean) + '，标准差 s = ' + fmt(stx.std) + '，极差 = ' + fmt(stx.range),
      'y：均值 = ' + fmt(st.mean) + '，标准差 s = ' + fmt(st.std),
      'y：中位数 = ' + fmt(st.median) + '，极差 R = ' + fmt(st.range) + '，变异系数 CV = ' + (isFinite(st.cv) ? st.cv.toFixed(2) + '%' : '-')
    );
    if (useUnc) {
      var uy = uA(eys);
      lines.push('A类不确定度 uA(y) = s/√n = ' + fmt(uy) + '  (k=1)');
    }
    if (fit) {
      lines.push('最小二乘拟合：y = ' + fmt(fit.a) + ' + ' + fmt(fit.b) + 'x   (R² = ' + fit.r2.toFixed(4) + ')');
      if (type === 'vam') {
        if (fit.b !== 0) {
          lines.push('伏安特性：R = 1/斜率 = 1/' + fmt(fit.b) + ' = ' + fmt(1 / fit.b) + ' (' + xName.split('(')[0].trim() + '/' + yName.split('(')[0].trim() + ')');
        } else {
          lines.push('伏安特性：斜率为 0，无法计算 R');
        }
      }
    }
    if (quad) {
      lines.push('二次拟合：y = ' + fmt(quad.a0) + ' + ' + fmt(quad.a1) + 'x + ' + fmt(quad.a2) + 'x²   (R² = ' + quad.r2.toFixed(4) + ')');
      if (fit) lines.push('拟合优度对比：直线 R²=' + fit.r2.toFixed(4) + ' vs 二次 R²=' + quad.r2.toFixed(4) +
        (quad.r2 > fit.r2 + 0.01 ? ' → 二次更优（存在非线性）' : ' → 直线已足够')); 
    }
    if (useResid && fit) {
      // 残差 ei = yi - (a + b·xi)
      var res = eys.map(function (y, i) { return y - (fit.a + fit.b * exs[i]); });
      var rst = stats(res);
      var maxAbs = 0, maxI = 0;
      res.forEach(function (r, i) { if (Math.abs(r) > maxAbs) { maxAbs = Math.abs(r); maxI = i; } });
      lines.push('残差分析：均值 = ' + fmt(rst.mean) + '，标准差 = ' + fmt(rst.std) + '，|最大残差| = ' + fmt(maxAbs) + ' (第' + (maxI + 1) + '点)');
    }
    if (type === 'resonance') {
      var ra = resonanceAnalyze(exs, eys);
      if (ra) {
        lines.push('谐振特性：f0 = ' + fmt(ra.f0) + '（峰值 ' + fmt(ra.ymax) + '）');
        lines.push('通频带 BW（半功率点法）= ' + fmt(ra.bw));
        lines.push('品质因数 Q = f0/BW = ' + fmt(ra.q));
      }
    }
    document.getElementById('labResult').textContent = lines.join('\n');
  }

  /* ===== Excel/CSV 导入（第1列=x，第2列=y） ===== */
  function importFile(file) {
    var isCsv = /\.csv$/i.test(file.name);
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb;
        if (isCsv) {
          var text = new TextDecoder('gbk').decode(e.target.result); // 兼容中文 CSV（GBK）
          wb = XLSX.read(text, { type: 'string' });
        } else {
          wb = XLSX.read(e.target.result, { type: 'array' });
        }
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        var lines = [];
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i];
          if (r && r.length >= 2 && !isNaN(parseFloat(r[0])) && !isNaN(parseFloat(r[1]))) {
            lines.push(r[0] + ' ' + r[1]);
          }
        }
        if (!lines.length) { alert('未解析到有效数据（需两列数字）'); return; }
        document.getElementById('labData').value = lines.join('\n');
        analyze();
      } catch (err) {
        alert('文件解析失败：' + err.message);
      }
    };
    if (isCsv) reader.readAsArrayBuffer(file);
    else reader.readAsArrayBuffer(file);
  }

  /* ===== 误差计算器 ===== */
  function calcError() {
    var m = parseFloat(document.getElementById('errMeasured').value);
    var t = parseFloat(document.getElementById('errTheory').value);
    if (isNaN(m) || isNaN(t)) { document.getElementById('errResult').textContent = '请输入测量值和理论值'; return; }
    if (t === 0) { document.getElementById('errResult').textContent = '理论值为 0，无法计算相对误差'; return; }
    var abs = m - t;
    var rel = Math.abs(abs / t) * 100;
    document.getElementById('errResult').textContent =
      '绝对误差 Δ = 测量值 - 理论值 = ' + fmt(abs) + '\n' +
      '相对误差 E = |Δ/理论值| × 100% = ' + rel.toFixed(3) + ' %';
  }

  /* ===== 导出 PDF 报告（生成专用打印页 → window.print 由浏览器输出 PDF） ===== */
  function exportPdf() {
    if (!lastData) { alert('请先"生成图表与分析"再导出报告'); return; }
    var xName = document.getElementById('labXName').value.trim() || 'x';
    var yName = document.getElementById('labYName').value.trim() || 'y';
    var typeText = document.getElementById('labType').selectedOptions[0].textContent;
    var result = document.getElementById('labResult').textContent;

    // 图表截图（取 Chart.js 底层 canvas，若已有 HiDPI 缓存用缓存）
    var chartImg = '';
    try {
      var c = document.getElementById('labChart');
      chartImg = c ? c.toDataURL('image/png') : '';
    } catch (e) { chartImg = ''; }

    // 数据表行
    var rowsHtml = '';
    for (var i = 0; i < lastData.xs.length; i++) {
      rowsHtml += '<tr><td>' + (i + 1) + '</td><td>' + fmt(lastData.xs[i]) + '</td><td>' + fmt(lastData.ys[i]) + '</td></tr>';
    }

    // 分析结果按行渲染
    var resultHtml = result.split('\n').map(function (line) {
      return '<div class="rl">' + esc(line) + '</div>';
    }).join('');

    var now = new Date();
    var stamp = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>实验数据报告</title><style>' +
      '* { margin:0; padding:0; box-sizing:border-box; }' +
      'body { font-family:"Times New Roman","SimSun",serif; color:#000; padding:28px 34px; }' +
      'h1 { text-align:center; font-size:20px; letter-spacing:2px; margin-bottom:6px; }' +
      '.meta { text-align:center; font-size:12px; color:#555; margin-bottom:16px; }' +
      '.meta span { margin:0 10px; }' +
      'h2 { font-size:15px; margin:16px 0 8px; padding-left:8px; border-left:4px solid #1a56a0; }' +
      'table { width:100%; border-collapse:collapse; font-size:12px; }' +
      'th,td { border:1px solid #666; padding:5px 8px; text-align:center; }' +
      'th { background:#eef3fa; font-weight:700; }' +
      'tbody tr:nth-child(even) { background:#fafbfc; }' +
      '.chart { text-align:center; margin:10px 0; page-break-inside:avoid; }' +
      '.chart img { max-width:100%; max-height:300px; }' +
      '.rl { font-size:13px; line-height:1.9; font-family:Consolas,monospace; }' +
      '.foot { margin-top:24px; text-align:center; font-size:11px; color:#888; border-top:1px solid #ccc; padding-top:8px; }' +
      '@page { size:A4; margin:12mm; }' +
      '@media print { body { padding:0; } }' +
      '</style></head><body>' +
      '<h1>实验数据报告</h1>' +
      '<div class="meta"><span>实验类型：' + esc(typeText) + '</span><span>日期：' + stamp + '</span><span>数据组数：' + lastData.xs.length + '</span></div>' +
      '<h2>一、原始数据</h2>' +
      '<table><thead><tr><th style="width:16%">序号</th><th>x（' + esc(xName) + '）</th><th>y（' + esc(yName) + '）</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
      '<h2>二、数据曲线</h2>' +
      (chartImg ? '<div class="chart"><img src="' + chartImg + '" /></div>' : '<div class="chart">(未生成图表)</div>') +
      '<h2>三、统计分析结果</h2>' + resultHtml +
      '<div class="foot">本报告由「校园综合助手」本地生成 · 数据不出浏览器</div>' +
      '</body></html>';

    // 打开打印窗口（同步写入保证样式与图片加载）
    var w = window.open('', '_blank');
    if (!w) { alert('弹窗被浏览器拦截，请允许弹出窗口后重试'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    // 等图表图片就绪后触发打印
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 600);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* ===== 导出 CSV（带 BOM，Excel 打开中文不乱码） ===== */
  function exportCsv() {
    if (!lastData) { alert('请先"生成图表与分析"再导出'); return; }
    var result = document.getElementById('labResult').textContent;
    var rows = ['x,y'];
    for (var i = 0; i < lastData.xs.length; i++) {
      rows.push(lastData.xs[i] + ',' + lastData.ys[i]);
    }
    rows.push('');
    rows.push('分析结果:');
    result.split('\n').forEach(function (l) { rows.push('"' + l.replace(/"/g, '""') + '"'); });
    var csv = '\ufeff' + rows.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = '实验数据.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ===== 初始化 ===== */
  function init() {
    document.getElementById('btnLabPlot').addEventListener('click', analyze);
    document.getElementById('btnErrCalc').addEventListener('click', calcError);
    document.getElementById('btnLabExport').addEventListener('click', exportCsv);
    var btnPdf = document.getElementById('btnLabPdf');
    if (btnPdf) btnPdf.addEventListener('click', exportPdf);
    document.getElementById('labFile').addEventListener('change', function (e) {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = '';
    });
  }

  window.App.labdata = { init: init };
})();
