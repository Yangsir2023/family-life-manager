/* -------------------------------------------------------------------------- */
/* UI 辅助层：图标、金额、底部面板、空状态、导航栏                                 */
/* -------------------------------------------------------------------------- */
(function () {
  'use strict';
  window.FFM = window.FFM || {};

  // ---------------------------------------------------------------- 基础
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** 金额：¥12.30 */
  function money(n) {
    var v = Number(n) || 0;
    return '¥' + v.toFixed(2);
  }
  /** 金额（不带符号） */
  function num2(n) {
    return (Number(n) || 0).toFixed(2);
  }
  /** 数量：1.5 / 2（去掉多余小数） */
  function qtyText(n) {
    var v = Number(n) || 0;
    return (Math.round(v * 100) / 100).toString();
  }

  // ---------------------------------------------------------------- 图标
  // 回退链：请求色 → dark → gray → brand → muted → white → 隐藏
  var FALLBACK = ['dark', 'gray', 'brand', 'muted', 'white'];

  function icon(name, color, cls) {
    var c = color || 'dark';
    return '<img class="icon ' + (cls || 'icon-md') + '" alt="" ' +
      'src="assets/icons/' + esc(name) + '-' + esc(c) + '.png" ' +
      'data-fb="' + esc(name) + '|' + esc(c) + '" ' +
      'onerror="FFM.ui.iconError(this)">';
  }

  /** <img onerror> 处理器：逐级回退，最后隐藏，保证不出现破图 */
  function iconError(img) {
    var parts = String(img.getAttribute('data-fb') || '').split('|');
    var name = parts[0] || '';
    var tried = parts[1] ? parts[1].split(',') : [];
    var next = null;
    for (var i = 0; i < FALLBACK.length; i++) {
      if (tried.indexOf(FALLBACK[i]) === -1) { next = FALLBACK[i]; break; }
    }
    if (!name || !next) { img.style.visibility = 'hidden'; return; }
    tried.push(next);
    img.setAttribute('data-fb', name + '|' + tried.join(','));
    img.src = 'assets/icons/' + name + '-' + next + '.png';
  }

  /** 带底色方块的图标 */
  function iconTile(name, color, bg, cls) {
    return '<span class="icon-fill" style="background:' + esc(bg) + '">' +
      icon(name, color, cls || 'icon-md') + '</span>';
  }

  // ---------------------------------------------------------------- 空状态
  function emptyBox(opt) {
    var o = opt || {};
    var btn = o.actionText
      ? '<button class="btn btn-ghost btn-sm" data-empty-action="1">' + esc(o.actionText) + '</button>'
      : '';
    return '<div class="empty">' +
      icon(o.icon || 'folder', 'muted', 'icon-xl') +
      '<div class="empty-t">' + esc(o.text || '暂无数据') + '</div>' +
      (o.sub ? '<div class="empty-s">' + esc(o.sub) + '</div>' : '') +
      btn + '</div>';
  }

  function loadingBox(text) {
    return '<div class="loading"><div class="spinner"></div><div>' + esc(text || '加载中…') + '</div></div>';
  }

  // ---------------------------------------------------------------- 底部面板
  var sheetEl = null;

  /**
   * 打开底部面板
   * @param {object} o { title, body, footer, tall, onMount(root, close) }
   * @returns {function} close
   */
  function sheet(o) {
    closeSheet();
    var opt = o || {};
    var maskEl = document.createElement('div');
    maskEl.className = 'sheet-mask';
    maskEl.innerHTML =
      '<div class="sheet-panel"' + (opt.tall ? ' style="max-height:92vh"' : '') + '>' +
        '<div class="sheet-hd">' +
          '<div class="sheet-title">' + esc(opt.title || '') + '</div>' +
          '<button class="btn btn-sm" data-sheet-close="1">' + icon('close', 'gray', 'icon-sm') + '</button>' +
        '</div>' +
        '<div class="sheet-body">' + (opt.body || '') + '</div>' +
        (opt.footer ? '<div class="sheet-ft">' + opt.footer + '</div>' : '') +
      '</div>';

    document.getElementById('sheet-root').appendChild(maskEl);
    sheetEl = maskEl;

    function close() { closeSheet(); }

    maskEl.addEventListener('click', function (e) {
      if (e.target === maskEl || e.target.closest('[data-sheet-close]')) close();
    });

    requestAnimationFrame(function () { maskEl.classList.add('is-open'); });

    if (typeof opt.onMount === 'function') {
      opt.onMount(maskEl, close);
    }
    return close;
  }

  function closeSheet() {
    if (!sheetEl) return;
    var el = sheetEl;
    sheetEl = null;
    el.classList.remove('is-open');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
  }

  // ---------------------------------------------------------------- 导航栏
  function setNav(opt) {
    var o = opt || {};
    var nav = document.getElementById('nav');
    var back = o.back
      ? '<button class="nav-back" data-nav-back="1">' + icon('chev-left', 'dark', 'icon-md') + '</button>'
      : '<span class="nav-spacer"></span>';
    var right = o.right || '<span class="nav-spacer"></span>';
    nav.innerHTML = back + '<div class="nav-title">' + esc(o.title || '家庭生活管家') + '</div>' +
      '<div class="nav-right">' + right + '</div>';
  }

  // ---------------------------------------------------------------- 进度条
  function bar(percent, cls) {
    var p = Math.max(0, Math.min(100, Number(percent) || 0));
    return '<div class="bar"><div class="bar-fill ' + (cls || '') + '" style="width:' + p + '%"></div></div>';
  }

  // ---------------------------------------------------------------- 简易柱状图
  /**
   * @param {Array} cols [{ label, value, isToday }]
   * @param {number} max  纵轴最大值
   * @param {string} unit 金额单位前缀
   */
  function bars(cols, max, prefix) {
    var list = cols || [];
    var m = Number(max) || 1;
    var html = '<div class="bars">';
    list.forEach(function (c) {
      var v = Number(c.value) || 0;
      var h = v > 0 ? Math.max(4, Math.round(v / m * 100)) : 0;
      var cls = v <= 0 ? 'is-empty' : (c.isToday ? 'is-today' : '');
      html += '<div class="bar-col' + (c.isToday ? ' is-today' : '') + '">' +
        '<div class="bar-track">' +
          '<div class="bar-c ' + cls + '" style="height:' + (h || 3) + '%">' +
            (v > 0 ? '<span class="bar-c-v">' + esc(prefix || '') + (Math.round(v * 10) / 10) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="bar-c-l">' + esc(c.label) + '</div>' +
      '</div>';
    });
    return html + '</div>';
  }

  // ---------------------------------------------------------------- 数值着色
  /** 涨跌方向 → 类名与文案（涨红跌绿） */
  function delta(deltaVal, rate) {
    var d = Number(deltaVal) || 0;
    var r = Number(rate) || 0;
    if (d > 0.001) return { cls: 'up', text: '↑' + (r > 0 ? '+' : '') + r + '%' };
    if (d < -0.001) return { cls: 'down', text: '↓' + r + '%' };
    return { cls: 'flat', text: '持平' };
  }

  // ---------------------------------------------------------------- 分类色
  var CAT_COLOR = { vegetable: 'veg', meat: 'meat', aquatic: 'aquatic', fruit: 'fruit' };
  function catCls(key) { return 'tag-' + (CAT_COLOR[key] || 'veg'); }

  FFM.ui = {
    esc: esc,
    money: money,
    num2: num2,
    qtyText: qtyText,
    icon: icon,
    iconError: iconError,
    iconTile: iconTile,
    emptyBox: emptyBox,
    loadingBox: loadingBox,
    sheet: sheet,
    closeSheet: closeSheet,
    setNav: setNav,
    bar: bar,
    bars: bars,
    delta: delta,
    catCls: catCls
  };
})();
