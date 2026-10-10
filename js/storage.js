/* storage.js —— 本地存储统一封装
 * 所有数据保存在浏览器 localStorage，不上传服务器
 * 提供通用 get/set，以及课表数据的 CRUD
 */
(function () {
  'use strict';

  var KEY_SCHEDULE = 'gcsa_courses'; // 课表数据键名

  /** 读取并 JSON 解析，失败返回默认值 */
  function get(key, defaultVal) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : (defaultVal === undefined ? null : defaultVal);
    } catch (e) {
      console.warn('[Storage] 读取失败', key, e);
      return defaultVal;
    }
  }

  /** 序列化后写入 */
  function set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.warn('[Storage] 写入失败', key, e);
      alert('本地存储已满或不可用，请清理浏览器空间');
      return false;
    }
  }

  function remove(key) { localStorage.removeItem(key); }

  /* ===== 课表数据 CRUD ===== */
  function getCourses() { return get(KEY_SCHEDULE, []); }

  function setCourses(arr) { return set(KEY_SCHEDULE, arr); }

  function addCourse(c) {
    var list = getCourses();
    // 生成唯一 id
    c.id = c.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    list.push(c);
    setCourses(list);
    return c;
  }

  function removeCourse(id) {
    var list = getCourses().filter(function (c) { return c.id !== id; });
    return setCourses(list);
  }

  // 暴露到全局命名空间
  window.App = window.App || {};
  window.App.Storage = {
    get: get, set: set, remove: remove,
    getCourses: getCourses, setCourses: setCourses,
    addCourse: addCourse, removeCourse: removeCourse
  };
})();
