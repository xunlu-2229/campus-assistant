/* rcrl.js —— RC / RL 一阶电路计算
 * 时间常数 τ、阻抗模 |Z|、相位角 φ
 */
(function () {
  'use strict';
  var App = window.App;

  function onTypeChange() {
    var type = document.getElementById('rcrlType').value;
    // RC 显示 R、C；RL 显示 R、L
    document.getElementById('rcrlRow2').style.display = type === 'rc' ? '' : 'none';
    document.getElementById('rcrlRow3').style.display = type === 'rl' ? '' : 'none';
  }

  function calc() {
    var type = document.getElementById('rcrlType').value;
    var R = parseFloat(document.getElementById('rcrlR').value) * unitVal('rcrlRUnit');
    var omega = parseFloat(document.getElementById('rcrlOmega').value);
    if (isNaN(R) || R <= 0) { setResult('请输入有效电阻 R'); return; }
    if (isNaN(omega) || omega < 0) { setResult('请输入有效角频率 ω'); return; }

    var tau, Z, phi, info;
    if (type === 'rc') {
      var C = parseFloat(document.getElementById('rcrlC').value) * unitVal('rcrlCUnit');
      if (isNaN(C) || C <= 0) { setResult('请输入有效电容 C'); return; }
      tau = R * C;                          // 时间常数 s
      var Xc = 1 / (omega * C);             // 容抗 Ω
      Z = Math.sqrt(R * R + Xc * Xc);        // 阻抗模
      phi = -Math.atan(Xc / R) * 180 / Math.PI; // 相位（容性滞后为负）
      info = '容抗 Xc = 1/(ωC) = ' + fmt(Xc) + ' Ω';
    } else {
      var L = parseFloat(document.getElementById('rcrlL').value) * unitVal('rcrlLUnit');
      if (isNaN(L) || L <= 0) { setResult('请输入有效电感 L'); return; }
      tau = L / R;                          // 时间常数 s
      var Xl = omega * L;                   // 感抗 Ω
      Z = Math.sqrt(R * R + Xl * Xl);        // 阻抗模
      phi = Math.atan(Xl / R) * 180 / Math.PI; // 相位（感性超前为正）
      info = '感抗 XL = ωL = ' + fmt(Xl) + ' Ω';
    }

    var lines = [
      type === 'rc' ? '【RC 电路】' : '【RL 电路】',
      '时间常数 τ = ' + fmt(tau) + ' s',
      info,
      '阻抗模 |Z| = ' + fmt(Z) + ' Ω',
      '相位角 φ = ' + phi.toFixed(2) + '°  (' + (phi >= 0 ? '感性' : '容性') + ')',
      '截止频率 fc = 1/(2πτ) = ' + fmt(1 / (2 * Math.PI * tau)) + ' Hz'
    ];
    document.getElementById('rcrlResult').textContent = lines.join('\n');
  }
  function setResult(msg) { document.getElementById('rcrlResult').textContent = msg; }
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
    onTypeChange();
    document.getElementById('rcrlType').addEventListener('change', onTypeChange);
    document.getElementById('btnRcrlCalc').addEventListener('click', calc);
  }

  window.App.rcrl = { init: init };
})();
