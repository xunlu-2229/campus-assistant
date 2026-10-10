/* resistor.js —— 色环电阻识别
 * 支持 4 色环 / 5 色环，正向(色环→阻值)与反向(阻值→色环)
 * 颜色编码：黑0 棕1 红2 橙3 黄4 绿5 蓝6 紫7 灰8 白9
 * 倍率环：10^n（n=0..9），金=10^-1，银=10^-2
 * 误差环：金±5% 银±10% 棕±1% 红±2% 绿±0.5% 蓝±0.25% 紫±0.1%
 */
(function () {
  'use strict';
  var App = window.App;

  // 数字环/倍率环颜色
  var DIGIT = [
    { name: '黑', color: '#1a1a1a', val: 0 }, { name: '棕', color: '#8B4513', val: 1 },
    { name: '红', color: '#e53935', val: 2 }, { name: '橙', color: '#fb8c00', val: 3 },
    { name: '黄', color: '#fdd835', val: 4 }, { name: '绿', color: '#43a047', val: 5 },
    { name: '蓝', color: '#1e88e5', val: 6 }, { name: '紫', color: '#8e24aa', val: 7 },
    { name: '灰', color: '#9e9e9e', val: 8 }, { name: '白', color: '#eeeeee', val: 9 }
  ];
  // 倍率额外：金、银
  var MULT_EXTRA = [
    { name: '金', color: '#d4af37', val: -1 }, { name: '银', color: '#bdbdbd', val: -2 }
  ];
  // 误差环
  var TOL = [
    { name: '金', color: '#d4af37', tol: 5 }, { name: '银', color: '#bdbdbd', tol: 10 },
    { name: '棕', color: '#8B4513', tol: 1 }, { name: '红', color: '#e53935', tol: 2 },
    { name: '绿', color: '#43a047', tol: 0.5 }, { name: '蓝', color: '#1e88e5', tol: 0.25 },
    { name: '紫', color: '#8e24aa', tol: 0.1 }
  ];

  var is5 = false; // 是否5色环模式

  // 下拉选项生成
  function optList(arr, valKey) {
    return arr.map(function (c, i) {
      return '<option value="' + i + '" style="background:' + c.color + ';color:' + (c.color === '#eeeeee' || c.color === '#fdd835' ? '#000' : '#fff') + '">' + c.name + '</option>';
    }).join('');
  }

  // 倍率环选项（数字环 + 金银）
  function multOptions() {
    return DIGIT.map(function (c, i) { return '<option value="' + i + '">' + c.name + '(' + (c.val >= 0 ? '×10^' + c.val : c.val === -1 ? '×0.1' : '×0.01') + ')</option>'; }).join('') +
      MULT_EXTRA.map(function (c, i) { return '<option value="' + (i + 10) + '">' + c.name + '(' + (c.val === -1 ? '×0.1' : '×0.01') + ')</option>'; }).join('');
  }

  function setupSelects() {
    var d = optList(DIGIT);
    document.getElementById('band1').innerHTML = d;
    document.getElementById('band2').innerHTML = d;
    if (is5) document.getElementById('band3').innerHTML = d;
    document.getElementById(is5 ? 'band4' : 'band3').innerHTML = multOptions();
    document.getElementById(is5 ? 'band5' : 'band4').innerHTML = optList(TOL);
    document.getElementById('band5').classList.toggle('optional', !is5);
  }

  // 取倍率值
  function getMult(idx) {
    idx = +idx;
    if (idx < 10) return DIGIT[idx].val;
    return MULT_EXTRA[idx - 10].val;
  }

  // 阻值格式化
  function fmtOhm(v) {
    if (v >= 1e6) return (v / 1e6).toPrecision(4).replace(/\.?0+$/, '') + ' MΩ';
    if (v >= 1e3) return (v / 1e3).toPrecision(4).replace(/\.?0+$/, '') + ' kΩ';
    return v.toPrecision(4).replace(/\.?0+$/, '') + ' Ω';
  }

  // 色环 → 阻值（实时计算）
  function bandsToValue() {
    var b1 = +document.getElementById('band1').value;
    var b2 = +document.getElementById('band2').value;
    var b3, bMult, bTol;
    if (is5) {
      b3 = +document.getElementById('band3').value;
      bMult = +document.getElementById('band4').value;
      bTol = +document.getElementById('band5').value;
    } else {
      bMult = +document.getElementById('band3').value;
      bTol = +document.getElementById('band4').value;
    }
    var sig, mult, tol;
    if (is5) {
      sig = DIGIT[b1].val * 100 + DIGIT[b2].val * 10 + DIGIT[b3].val;
    } else {
      sig = DIGIT[b1].val * 10 + DIGIT[b2].val;
    }
    mult = getMult(bMult);
    tol = TOL[bTol].tol;
    var value = sig * Math.pow(10, mult);
    // 渲染色环预览
    renderPreview(is5
      ? [DIGIT[b1], DIGIT[b2], DIGIT[b3], getMultColor(bMult), TOL[bTol]]
      : [DIGIT[b1], DIGIT[b2], getMultColor(bMult), TOL[bTol]]);
    document.getElementById('resistorResult').textContent =
      '阻值 = ' + fmtOhm(value) + '  (±' + tol + '%)\n' +
      '范围：' + fmtOhm(value * (1 - tol / 100)) + ' ~ ' + fmtOhm(value * (1 + tol / 100));
  }
  function getMultColor(idx) {
    idx = +idx;
    return idx < 10 ? DIGIT[idx] : MULT_EXTRA[idx - 10];
  }
  function renderPreview(bands) {
    var box = document.getElementById('resistorPreview');
    box.innerHTML = bands.map(function (b) {
      return '<div class="band" style="background:' + b.color + '"></div>';
    }).join('');
  }

  // 阻值 → 色环（支持 Ω/kΩ/MΩ 单位选择）
  function valueToBands() {
    var v = parseFloat(document.getElementById('ohmInput').value);
    var unit = parseFloat(document.getElementById('ohmUnit').value) || 1;
    var tol = parseFloat(document.getElementById('ohmTolerance').value);
    if (isNaN(v) || v <= 0) { document.getElementById('ohmResult').textContent = '请输入正数阻值'; return; }
    v = v * unit; // 归一化到 Ω
    // 标准化科学计数：4色环取2位有效，5色环取3位
    var digits = is5 ? 3 : 2;
    var expStr = v.toExponential(digits - 1); // "4.70e+3"
    var parts = expStr.split('e');
    var mantissa = parts[0].replace('.', '');
    var exp = parseInt(parts[1], 10);
    var n = exp - (digits - 1); // 倍率指数
    var ds = mantissa.split('').map(function (d) { return parseInt(d, 10); });
    // 找误差环索引
    var tolIdx = TOL.findIndex(function (c) { return c.tol === tol; });
    if (tolIdx < 0) tolIdx = 0;

    var colors;
    if (is5) {
      colors = [DIGIT[ds[0]], DIGIT[ds[1]], DIGIT[ds[2]], multColorByVal(n), TOL[tolIdx]];
    } else {
      colors = [DIGIT[ds[0]], DIGIT[ds[1]], multColorByVal(n), TOL[tolIdx]];
    }
    renderPreview(colors);
    var desc = colors.map(function (c) { return c.name; }).join(' → ');
    document.getElementById('ohmResult').textContent =
      fmtOhm(v) + ' 对应色环：\n' + desc + '\n倍率环：×10^' + n;
  }
  function multColorByVal(n) {
    if (n >= 0 && n <= 9) return DIGIT[n];
    if (n === -1) return MULT_EXTRA[0];
    if (n === -2) return MULT_EXTRA[1];
    return DIGIT[0];
  }

  function onModeChange() {
    is5 = document.getElementById('useBand5').checked;
    setupSelects();
    bandsToValue();
  }

  function init() {
    setupSelects();
    document.getElementById('useBand5').addEventListener('change', onModeChange);
    ['band1', 'band2', 'band3', 'band4', 'band5'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', bandsToValue);
    });
    document.getElementById('btnOhmToBands').addEventListener('click', valueToBands);
    bandsToValue(); // 初始计算
  }

  window.App.resistor = { init: init };
})();
