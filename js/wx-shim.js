/* -------------------------------------------------------------------------- */
/* wx 适配层：把小程序 API 映射到浏览器标准 API                                  */
/*                                                                           */
/* 关键点：刻意不提供 wx.cloud —— miniprogram/utils/db.js 检测到              */
/* `!wx.cloud` 会自动降级到 localDriver（localStorage），业务逻辑零改动即可跑。 */
/* -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var NS = 'ffm_ls_';

  // ---- 存储 API：小程序 wx.getStorageSync 返回原值，这里用 JSON 编解码对齐 ----
  function getStorageSync(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (raw === null || raw === undefined) return '';
      return JSON.parse(raw);
    } catch (e) {
      return '';
    }
  }

  function setStorageSync(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // 配额超限（多见于 Safari 隐私模式）
      console.warn('[wx-shim] setStorageSync 失败：', e && e.message);
      return false;
    }
  }

  function removeStorageSync(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function clearStorageSync() {
    try {
      Object.keys(window.localStorage)
        .filter(function (k) { return k.indexOf(NS) === 0; })
        .forEach(function (k) { window.localStorage.removeItem(k); });
    } catch (e) { /* ignore */ }
  }

  // ---- 交互反馈：用轻量自绘 toast 取代 wx.showToast ----
  var toastTimer = null;
  function showToast(opt) {
    var o = typeof opt === 'string' ? { title: opt } : (opt || {});
    var el = document.getElementById('ffm-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ffm-toast';
      el.className = 'ffm-toast';
      document.body.appendChild(el);
    }
    el.textContent = o.title || '';
    el.classList.add('is-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-show');
    }, o.duration || 1800);
  }

  function showLoading(title) {
    showToast({ title: title || '处理中…', duration: 1200 });
  }

  function hideLoading() { /* no-op，toast 自动消失 */ }

  // ---- 对话框：Promise 化的 confirm / alert ----
  function confirmDialog(title, content, confirmText) {
    return new Promise(function (resolve) {
      var mask = document.createElement('div');
      mask.className = 'ffm-mask is-open';
      mask.innerHTML =
        '<div class="ffm-dialog">' +
          '<div class="ffm-dialog-title"></div>' +
          '<div class="ffm-dialog-body"></div>' +
          '<div class="ffm-dialog-actions">' +
            '<button class="ffm-dialog-btn" data-act="cancel">取消</button>' +
            '<button class="ffm-dialog-btn is-primary" data-act="ok"></button>' +
          '</div>' +
        '</div>';
      mask.querySelector('.ffm-dialog-title').textContent = title || '提示';
      mask.querySelector('.ffm-dialog-body').textContent = content || '';
      mask.querySelector('[data-act="ok"]').textContent = confirmText || '确定';

      function close(v) {
        if (mask.parentNode) mask.parentNode.removeChild(mask);
        resolve(v);
      }
      mask.querySelector('[data-act="cancel"]').onclick = function () { close(false); };
      mask.querySelector('[data-act="ok"]').onclick = function () { close(true); };
      mask.onclick = function (e) { if (e.target === mask) close(false); };
      document.body.appendChild(mask);
    });
  }

  function showModal(opt) {
    var o = opt || {};
    return confirmDialog(o.title, o.content, o.confirmText).then(function (ok) {
      return { confirm: ok, cancel: !ok };
    });
  }

  function showActionSheet(opt) {
    var items = (opt && opt.itemList) || [];
    return new Promise(function (resolve, reject) {
      var mask = document.createElement('div');
      mask.className = 'ffm-mask is-open';
      var btns = items.map(function (t, i) {
        return '<button class="ffm-sheet-item" data-i="' + i + '">' + t + '</button>';
      }).join('');
      mask.innerHTML =
        '<div class="ffm-actionsheet">' + btns +
          '<button class="ffm-sheet-item is-cancel" data-i="-1">取消</button>' +
        '</div>';
      mask.querySelectorAll('.ffm-sheet-item').forEach(function (b) {
        b.onclick = function () {
          var i = parseInt(b.getAttribute('data-i'), 10);
          if (mask.parentNode) mask.parentNode.removeChild(mask);
          if (i < 0) reject({ errMsg: 'showActionSheet:fail cancel' });
          else resolve({ tapIndex: i });
        };
      });
      mask.onclick = function (e) {
        if (e.target === mask) {
          if (mask.parentNode) mask.parentNode.removeChild(mask);
          reject({ errMsg: 'showActionSheet:fail cancel' });
        }
      };
      document.body.appendChild(mask);
    });
  }

  // ---- 图片选择：映射到 <input type="file"> ----
  function chooseImage(opt) {
    var o = opt || {};
    return new Promise(function (resolve, reject) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.onchange = function () {
        var file = input.files && input.files[0];
        if (!file) { reject({ errMsg: 'chooseImage:fail cancel' }); return; }
        var reader = new FileReader();
        reader.onload = function () {
          resolve({ tempFilePaths: [reader.result], tempFiles: [{ path: reader.result, size: file.size }] });
        };
        reader.onerror = function () { reject({ errMsg: 'chooseImage:fail read error' }); };
        reader.readAsDataURL(file);
      };
      document.body.appendChild(input);
      input.click();
      setTimeout(function () { if (input.parentNode) input.parentNode.removeChild(input); }, 60000);
    });
  }

  function setClipboardData(opt) {
    var text = (opt && opt.data) || '';
    return new Promise(function (resolve, reject) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          resolve({ errMsg: 'setClipboardData:ok' });
        }).catch(function () { fallback(); });
      } else {
        fallback();
      }
      function fallback() {
        try {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          resolve({ errMsg: 'setClipboardData:ok' });
        } catch (e) {
          reject(e);
        }
      }
    });
  }

  function previewImage(opt) {
    var urls = (opt && opt.urls) || [];
    var cur = (opt && opt.current) || urls[0];
    if (!cur) return;
    var mask = document.createElement('div');
    mask.className = 'ffm-mask is-open ffm-preview';
    mask.innerHTML = '<img src="' + cur + '" alt="预览">';
    mask.onclick = function () {
      if (mask.parentNode) mask.parentNode.removeChild(mask);
    };
    document.body.appendChild(mask);
  }

  window.wx = {
    // 存储
    getStorageSync: getStorageSync,
    setStorageSync: setStorageSync,
    removeStorageSync: removeStorageSync,
    clearStorageSync: clearStorageSync,
    // 交互
    showToast: showToast,
    showLoading: showLoading,
    hideLoading: hideLoading,
    showModal: showModal,
    showActionSheet: showActionSheet,
    // 媒体
    chooseImage: chooseImage,
    previewImage: previewImage,
    setClipboardData: setClipboardData,
    // cli
    getSystemInfoSync: function () {
      return { platform: 'web', windowWidth: window.innerWidth, windowHeight: window.innerHeight };
    },
    // 注意：无 wx.cloud → db.js 自动走 localDriver（localStorage）
    cloud: undefined
  };
})();
