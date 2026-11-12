/* 隐私合规网关（网页版）
 *
 * 与小程序端同源：必须在 BIZ.init()（取 openid / 采集本地记账数据）之前取得用户明示同意。
 * 网页版无微信隐私接口，用 localStorage 标记作为事实源，首次启动弹出同意层。
 */
(function () {
  'use strict';
  window.FFM = window.FFM || {};

  var KEY = 'ffm_privacy_agreed';
  var waiters = [];

  function isAgreed() {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setAgreed() {
    try {
      localStorage.setItem(KEY, '1');
    } catch (e) {}
    var ws = waiters;
    waiters = [];
    ws.forEach(function (r) {
      try { r(); } catch (e) {}
    });
  }

  function whenAgreed() {
    if (isAgreed()) return Promise.resolve();
    return new Promise(function (resolve) {
      waiters.push(resolve);
    });
  }

  async function ensureAgreed() {
    if (isAgreed()) return;
    await whenAgreed();
  }

  window.FFM.privacy = {
    KEY: KEY,
    isAgreed: isAgreed,
    setAgreed: setAgreed,
    whenAgreed: whenAgreed,
    ensureAgreed: ensureAgreed,
  };
})();
