/* unit.js —— 单位换算 + dB 换算
 * 电阻/电容/电感多单位互查；功率比/电压比 ↔ dB
 */
(function () {
  'use strict';
  var App = window.App;

  // 各类别单位（factor 为换算到基本单位的倍率）
  var UNITS = {
    R: [{ name: 'Ω', f: 1 }, { name: 'kΩ', f: 1e3 }, { name: 'MΩ', f: 1e6 }],
    C: [{ name: 'pF', f: 1e-12 }, { name: 'nF', f: 1e-9 }, { name: 'μF', f: 1e-6 }, { name: 'F', f: 1 }],
    L: [{ name: 'μH', f: 1e-6 }, { name: 'mH', f: 1e-3 }, { name: 'H', f: 1 }]
  };

  function fillUnits() {
    var cat = document.getElementById('unitCategory').value;
    var sel = document.getElementById('unitFrom');
    sel.innerHTML = UNITS[cat].map(function (u) { return '<option>' + u.name + '</option>'; }).join('');
  }

  function calc() {
    var cat = document.getElementById('unitCategory').value;
    var val = parseFloat(document.getElementById('unitValue').value);
    var fromName = document.getElementById('unitFrom').value;
    if (isNaN(val)) { document.getElementById('unitResult').textContent = '请输入有效数值'; return; }
    var fromU = UNITS[cat].filter(function (u) { return u.name === fromName; })[0];
    var base = val * fromU.f; // 转为基本单位
    // 列出所有单位的换算结果
    var lines = UNITS[cat].map(function (u) {
      var v = base / u.f;
      var str = v.toExponential(4).replace(/\.?0+e/, 'e'); // 保留有效位
      if (Math.abs(v) >= 0.001 && Math.abs(v) < 1e6) str = parseFloat(v.toPrecision(6)).toString();
      return u.name + ' = ' + str;
    });
    document.getElementById('unitResult').textContent = val + ' ' + fromName + ' 等价于：\n' + lines.join('\n');
  }

  function dbCalc() {
    var type = document.getElementById('dbType').value;
    var v = parseFloat(document.getElementById('dbValue').value);
    if (isNaN(v)) { document.getElementById('dbResult').textContent = '请输入有效数值'; return; }
    var result;
    switch (type) {
      case 'power': result = (10 * Math.log10(v)).toFixed(3) + ' dB'; break;
      case 'voltage': result = (20 * Math.log10(v)).toFixed(3) + ' dB'; break;
      case 'db2power': result = '功率比 = ' + Math.pow(10, v / 10).toExponential(4); break;
      case 'db2voltage': result = '电压比 = ' + Math.pow(10, v / 20).toExponential(4); break;
    }
    document.getElementById('dbResult').textContent = result;
  }

  function init() {
    fillUnits();
    document.getElementById('unitCategory').addEventListener('change', fillUnits);
    document.getElementById('btnUnitCalc').addEventListener('click', calc);
    document.getElementById('btnDbCalc').addEventListener('click', dbCalc);
  }

  window.App.unit = { init: init };
})();
