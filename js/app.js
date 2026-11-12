/* -------------------------------------------------------------------------- */
/* 应用外壳：hash 路由、tabbar、启动流程                                          */
/* -------------------------------------------------------------------------- */
(function () {
  'use strict';
  window.FFM = window.FFM || {};

  var BIZ = window.FFM.biz;
  var C = window.FFM.constants;
  var UI = window.FFM.ui;
  var PAGES = window.FFM.pages;
  var icon = UI.icon;

  var view = null, tabbar = null;

  // ---------------------------------------------------------------- 路由
  function parse(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (!h) h = '/index';
    var qi = h.indexOf('?');
    var route = qi >= 0 ? h.slice(0, qi) : h;
    var query = qi >= 0 ? h.slice(qi + 1) : '';
    var params = {};
    query.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = i >= 0 ? kv.slice(0, i) : kv;
      var v = i >= 0 ? kv.slice(i + 1) : '';
      try { params[decodeURIComponent(k)] = decodeURIComponent(v); }
      catch (e) { params[k] = v; }
    });
    return { route: '#' + route, params: params };
  }

  function currentHash() {
    return window.location.hash || '#/index';
  }

  // ---------------------------------------------------------------- tabbar
  var TABS = [
    { key: 'index', name: '首页', hash: '#/index', icon: 'home' },
    { key: 'category', name: '食材', hash: '#/category', icon: 'grid' },
    { key: 'recipe', name: '食谱', hash: '#/recipe', icon: 'book' },
    { key: 'shopping', name: '清单', hash: '#/shopping', icon: 'bag' },
    { key: 'stats', name: '统计', hash: '#/stats', icon: 'chart' }
  ];

  function renderTabbar(activeKey) {
    tabbar.innerHTML = TABS.map(function (t) {
      var on = t.key === activeKey;
      return '<button class="tabbar-item ' + (on ? 'is-active' : '') + '" data-hash="' + t.hash + '">' +
        icon(t.icon, on ? 'brand' : 'gray', 'icon-lg') +
        '<span>' + t.name + '</span>' +
      '</button>';
    }).join('');
    tabbar.querySelectorAll('[data-hash]').forEach(function (b) {
      b.onclick = function () { App.go(b.getAttribute('data-hash')); };
    });
  }

  // ---------------------------------------------------------------- 挂载
  var mounting = false;

  async function mount(hash) {
    var r = parse(hash);
    var p = PAGES.routes[r.route] || PAGES.routes['#/index'];
    if (!PAGES.routes[r.route]) {
      // 未知路由 → 回到首页
      window.location.replace('#/index');
      return;
    }

    // 顶部导航
    var right = '';
    if (r.route === '#/index') {
      right = '<button class="nav-back" data-nav="stats">' + icon('user', 'dark', 'icon-md') + '</button>';
    } else if (r.route === '#/recipe') {
      right = '<button class="nav-back" data-nav="records">' + icon('doc', 'dark', 'icon-md') + '</button>';
    } else if (r.route === '#/category') {
      right = '<button class="nav-back" data-nav="records">' + icon('doc', 'dark', 'icon-md') + '</button>';
    }
    UI.setNav({ title: p.title, back: !!p.back, right: right || undefined });

    var nav = document.getElementById('nav');
    nav.querySelectorAll('[data-nav]').forEach(function (b) {
      var to = b.getAttribute('data-nav');
      b.onclick = function () { App.go('#/' + to); };
    });
    var backBtn = nav.querySelector('[data-nav-back]');
    if (backBtn) backBtn.onclick = function () { window.history.back(); };

    // tabbar
    renderTabbar(p.tab);

    // 页面内容
    view.scrollTop = 0;
    view.classList.remove('no-pad');
    try {
      mounting = true;
      await p.render(view, r.params);
    } catch (e) {
      console.error('[render]', e);
      view.classList.remove('no-pad');
      view.innerHTML = UI.emptyBox({
        icon: 'alert', text: '页面渲染出错',
        sub: String((e && (e.message || e.errMsg)) || e),
        actionText: '重试'
      });
      var a = view.querySelector('[data-empty-action]');
      if (a) a.onclick = function () { App.rerender(); };
    } finally {
      mounting = false;
    }
  }

  // ---------------------------------------------------------------- 隐私授权门控
  var PRIVACY_SUMMARY = [
    '我们会在您登录时获取微信 OpenID 以识别身份并同步数据；',
    '您录入的菜价、食谱、采购清单、每日消费均存储于本地或您的云空间；',
    '我们不会向第三方出售您的个人信息；',
    '您随时可查看、修改或删除自己的数据。',
  ];

  function ensurePrivacy() {
    return new Promise(function (resolve) {
      var P = window.FFM.privacy;
      if (!P || P.isAgreed()) return resolve();

      var mask = document.createElement('div');
      mask.className = 'pg-mask';
      mask.innerHTML =
        '<div class="pg-card">' +
        '  <div class="pg-title">隐私政策</div>' +
        '  <div class="pg-body">' +
        PRIVACY_SUMMARY.map(function (t) { return '<div class="pg-li">' + t + '</div>'; }).join('') +
        '  </div>' +
        '  <div class="pg-actions">' +
        '    <div class="pg-link" data-act="full">查看完整政策</div>' +
        '    <button class="pg-ok" data-act="ok">同意并继续</button>' +
        '  </div>' +
        '</div>';

      document.body.appendChild(mask);

      mask.querySelector('[data-act="full"]').onclick = function () {
        window.location.hash = '#/privacy';
      };
      mask.querySelector('[data-act="ok"]').onclick = function () {
        P.setAgreed();
        if (mask.parentNode) mask.parentNode.removeChild(mask);
        resolve();
      };
    });
  }

  // ---------------------------------------------------------------- App
  var App = {
    go: function (hash) {
      if (!hash) return;
      if (currentHash() === hash) { App.rerender(); return; }
      window.location.hash = hash;
    },
    rerender: function () {
      if (mounting) return;
      return mount(currentHash());
    },
    reload: function () { return App.rerender(); },
    /** 保留接口：Web 版每次渲染都重新取数，无需脏标记 */
    markDirty: function () {},
    mount: mount
  };
  window.App = App;

  // ---------------------------------------------------------------- 启动
  async function boot() {
    view = document.getElementById('view');
    tabbar = document.getElementById('tabbar');

    var bootText = document.getElementById('boot-text');

    // 先挂上 tabbar，避免首屏闪一下空白
    renderTabbar('index');

    // 隐私合规：采集个人信息（微信登录拿 openid / 本地记账）前必须先取得明示同意
    await ensurePrivacy();
    if (window.FFM.privacy && window.FFM.privacy.isAgreed && !window.FFM.privacy.isAgreed()) {
      // 用户关闭弹层未同意 —— 已在上层阻止，这里仅兜底
    }

    try {
      if (bootText) bootText.textContent = '正在初始化纸坊物价库…';
      var ctx = await BIZ.init();
      if (bootText) bootText.textContent = '正在加载…';
      console.log('[FFM] 启动完成，模式 =', ctx.mode, '｜ openid =', ctx.openid);
    } catch (e) {
      console.error('[FFM] 初始化失败', e);
      view.innerHTML = UI.emptyBox({
        icon: 'alert', text: '初始化失败',
        sub: '请检查浏览器是否禁用了本地存储（隐私模式会导致此问题）\n' + String(e && e.message || e)
      });
      return;
    }

    await mount(currentHash());
    startSyncPolling();
  }

  // ---------------------------------------------------------------- 多设备同步轮询
  // 每 15 秒回源一次，发现别的设备改过就自动重渲染。
  // 只在「共享云」模式下跑；标签页隐藏时跳过，避免无谓请求。
  var _syncPolling = false;
  function startSyncPolling() {
    if (_syncPolling) return;
    if (!window.FFM.db || !window.FFM.db.syncEnabled || !window.FFM.db.syncEnabled()) return;
    _syncPolling = true;
    console.log('[FFM] 多设备同步已开启，启动 15s 轮询');
    setInterval(function () {
      if (document.hidden) return;
      if (mounting) return;
      window.FFM.db.pullLatest().then(function (r) {
        if (r && r.changed) {
          console.log('[FFM] 检测到其他设备改动，自动刷新');
          App.rerender();
        }
      }).catch(function () { /* 网络抖动时静默，下次轮询再试 */ });
    }, 15000);
  }

  window.addEventListener('hashchange', function () { mount(currentHash()); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
