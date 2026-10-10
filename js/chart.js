/* chart.js —— Chart.js 实例统一管理
 * 课表、信号波形、实验曲线共用同一套封装，避免重复创建实例导致内存泄漏
 */
(function () {
  'use strict';

  var instances = {}; // 记录已创建的图表实例，按 canvasId 索引

  /** 读取 CSS 变量（深色/主题切换后图表网格自动适配） */
  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  /** 销毁指定图表，防止重绘时叠加 */
  function destroy(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  /**
   * 绘制折线图（波形/曲线通用）
   * @param {string} canvasId canvas 元素 id
   * @param {number[]} labels x 轴标签
   * @param {Array<{label:string,data:number[],color:string}>} datasets 数据集
   * @param {object} options 额外配置（覆盖默认）
   */
  function line(canvasId, labels, datasets, options) {
    destroy(canvasId);
    var canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return null;

    // 把简化数据集转为 Chart.js 标准格式
    var ds = datasets.map(function (d) {
      return {
        label: d.label || '',
        data: d.data,
        borderColor: d.color || '#2563eb',
        backgroundColor: d.fillColor || (d.color || '#2563eb') + '22',
        borderWidth: d.borderWidth || 2,
        fill: d.fill !== undefined ? d.fill : false,
        pointRadius: d.pointRadius || 0,
        tension: d.tension || 0
      };
    });

    var cfg = {
      type: 'line',
      data: { labels: labels, datasets: ds },
      options: Object.assign({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: ds.length > 1, position: 'top' } },
        scales: {
          x: { grid: { color: cssVar('--chart-grid', '#f0f0f0') }, ticks: { maxTicksLimit: 10, font: { size: 11 } } },
          y: { grid: { color: cssVar('--chart-grid', '#f0f0f0') } }
        }
      }, options || {})
    };
    instances[canvasId] = new Chart(canvas, cfg);
    return instances[canvasId];
  }

  /**
   * 绘制散点图（实验数据用，可在同一坐标系叠加拟合直线等 line 数据集）
   * @param {string} canvasId canvas 元素 id
   * @param {Array<{label:string,data:Array<{x,y}>,type?:'scatter'|'line',showLine?:boolean,color:string}>} datasets
   * @param {object} options 额外配置
   */
  function scatter(canvasId, datasets, options) {
    destroy(canvasId);
    var canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return null;
    var ds = datasets.map(function (d) {
      return {
        type: d.type || 'scatter',
        label: d.label || '',
        data: d.data, // [{x, y}] 格式
        borderColor: d.color || '#2563eb',
        backgroundColor: d.fillColor || (d.color || '#2563eb') + 'cc',
        showLine: !!d.showLine,
        borderWidth: d.borderWidth || 2,
        pointRadius: d.pointRadius !== undefined ? d.pointRadius : 4,
        pointStyle: d.pointStyle || 'circle', // 支持 crossRot 等标记剔除点
        pointRotation: d.pointRotation || 0,
        tension: 0,
        fill: false
      };
    });
    var cfg = {
      type: 'scatter',
      data: { datasets: ds },
      options: Object.assign({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: ds.length > 1, position: 'top' } },
        scales: {
          x: { type: 'linear', grid: { color: cssVar('--chart-grid', '#f0f0f0') } },
          y: { grid: { color: cssVar('--chart-grid', '#f0f0f0') } }
        }
      }, options || {})
    };
    instances[canvasId] = new Chart(canvas, cfg);
    return instances[canvasId];
  }

  window.App = window.App || {};
  window.App.Chart = { line: line, scatter: scatter, destroy: destroy, instances: instances, cssVar: cssVar };
})();
