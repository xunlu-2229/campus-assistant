/* resonance.js —— LC 谐振计算
 * 谐振频率 f0、品质因数 Q、通频带 BW
 * 串联：Q = ω0L/R = 1/(ω0CR)；并联：Q = R/(ω0L) = ω0CR
 */
(function () {
  'use strict';
  var App = window.App;

  function calc() {
    var type = document.getElementById('resType').value;
    var L = parseFloat(document.getElementById('resL').value) * unitVal('resLUnit');
    var C = parseFloat(document.getElementById('resC').value) * unitVal('resCUnit');
    var R = parseFloat(document.getElementById('resR').value) * unitVal('resRUnit');
    if (isNaN(L) || L <= 0) { setResult('请输入有效电感 L'); return; }
    if (isNaN(C) || C <= 0) { setResult('请输入有效电容 C'); return; }
    if (isNaN(R) || R <= 0) { setResult('请输入有效电阻 R'); return; }

    var f0 = 1 / (2 * Math.PI * Math.sqrt(L * C)); // 谐振频率
    var omega0 = 2 * Math.PI * f0;
    var Q, Z0, bw;
    if (type === 'series') {
      Q = omega0 * L / R;            // 串联品质因数
      Z0 = R;                        // 串联谐振阻抗最小 = R
      bw = f0 / Q;
    } else {
      Q = R / (omega0 * L);          // 并联品质因数
      Z0 = Infinity;                 // 理想并联谐振阻抗最大
      bw = f0 / Q;
    }

    var lines = [
      type === 'series' ? '【LC 串联谐振】' : '【LC 并联谐振】',
      '谐振频率 f0 = 1/(2π√(LC)) = ' + fmt(f0) + ' Hz' +
      (f0 >= 1e3 ? '  (' + fmt(f0 / 1e3) + ' kHz)' : ''),
      '角频率 ω0 = ' + fmt(omega0) + ' rad/s',
      '品质因数 Q = ' + Q.toFixed(3),
      '通频带 BW = f0/Q = ' + fmt(bw) + ' Hz',
      '谐振阻抗 Z0 = ' + (type === 'series' ? fmt(Z0) + ' Ω (最小)' : '∞ (理想最大，实际受并联损耗限制)')
    ];
    document.getElementById('resResult').textContent = lines.join('\n');
  }
  function setResult(msg) { document.getElementById('resResult').textContent = msg; }
  /** 读取单位下拉的倍率值 */
  function unitVal(selId) {
    var sel = document.getElementById(selId);
    return sel ? (parseFloat(sel.value) || 1) : 1;
  }
  function fmt(v) {
    if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-3 && v !== 0)) return v.toExponential(4);
    return parseFloat(v.toPrecision(6)).toString();
  }

  function init() {
    document.getElementById('btnResCalc').addEventListener('click', calc);
  }

  window.App.resonance = { init: init };
})();
