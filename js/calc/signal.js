/* signal.js —— 正弦序列生成与波形预览
 * x(t) = A·sin(2πf·t + φ)，按总时长内 N 点采样，Chart.js 绘制
 */
(function () {
  'use strict';
  var App = window.App;

  function gen() {
    var A = parseFloat(document.getElementById('sigAmp').value);
    var f = parseFloat(document.getElementById('sigFreq').value);
    var phi = parseFloat(document.getElementById('sigPhase').value);
    var N = parseInt(document.getElementById('sigN').value, 10);
    var dur = parseFloat(document.getElementById('sigDur').value);
    if (isNaN(A) || isNaN(f) || f <= 0) { setResult('请输入有效幅度和频率'); return; }
    if (isNaN(N) || N <= 0 || N > 5000) { setResult('采样点数 N 取 1~5000'); return; }
    if (isNaN(dur) || dur <= 0) { setResult('请输入有效总时长'); return; }

    var phiRad = phi * Math.PI / 180; // 相位转弧度
    var Ts = dur / N;                 // 采样间隔
    var fs = 1 / Ts;                   // 采样率
    var labels = [], data = [];
    for (var n = 0; n < N; n++) {
      var t = n * Ts;
      labels.push(t.toFixed(5));
      data.push(A * Math.sin(2 * Math.PI * f * t + phiRad));
    }

    // 共用 chart.js 封装绘制波形
    App.Chart.line('signalChart', labels, [{
      label: 'x(t) = ' + A + '·sin(2π·' + f + '·t' + (phi >= 0 ? '+' : '') + phi + '°)',
      data: data,
      color: '#2563eb',
      fillColor: 'rgba(37,99,235,0.12)',
      fill: true,
      pointRadius: 0,
      tension: 0
    }], {
      plugins: { legend: { display: true } },
      scales: {
        x: { title: { display: true, text: '时间 t / s' }, ticks: { maxTicksLimit: 8 } },
        y: { title: { display: true, text: '幅度' } }
      }
    });

    var info = [
      '信号参数：A=' + A + '，f=' + f + ' Hz，φ=' + phi + '°',
      '周期 T = ' + (1 / f).toExponential(4) + ' s',
      '角频率 ω = ' + (2 * Math.PI * f).toFixed(3) + ' rad/s',
      '采样率 fs = ' + fs.toFixed(2) + ' Hz（采样间隔 Ts=' + Ts.toExponential(3) + ' s）',
      '采样点数 N = ' + N
    ];
    if (fs < 2 * f) info.push('⚠️ 提示：fs < 2f，不满足奈奎斯特采样定理，可能发生混叠');
    document.getElementById('sigResult').textContent = info.join('\n');
  }
  function setResult(msg) { document.getElementById('sigResult').textContent = msg; }

  function init() {
    document.getElementById('btnSigGen').addEventListener('click', gen);
    gen(); // 初始绘制一次
  }

  window.App.signal = { init: init };
})();
