/* -------------------------------------------------------------------------- */
/* 页面层：7 个页面。全部复用 FFM.biz 的业务方法，不直接触碰存储细节。             */
/* -------------------------------------------------------------------------- */
(function () {
  'use strict';
  window.FFM = window.FFM || {};

  var BIZ = window.FFM.biz;
  var DB = window.FFM.db;
  var F = window.FFM.format;
  var C = window.FFM.constants;
  var UI = window.FFM.ui;
  var esc = UI.esc, money = UI.money, icon = UI.icon;

  var page = null;   // 当前挂载的 #view 元素

  // 跨页保留的界面状态
  var S = {
    cat: 'vegetable',
    catKeyword: '',
    catOrder: 'name',
    week: null,          // 当前查看的周（周一）
    recipeView: 'week',  // week | day
    day: null,
    recordTab: 'purchase',
    openRecordId: ''
  };

  function ws() { return S.week || F.weekStart(F.today()); }

  // ---------------------------------------------------------------- 工具
  function catOf(key) {
    for (var i = 0; i < C.CATEGORIES.length; i++) if (C.CATEGORIES[i].key === key) return C.CATEGORIES[i];
    return C.CATEGORIES[0];
  }
  function mealName(type) {
    for (var i = 0; i < C.MEALS.length; i++) if (C.MEALS[i].key === type) return C.MEALS[i].name;
    return '正餐';
  }
  function mealIcon(type) {
    return type === 'breakfast' ? 'clock' : (type === 'lunch' ? 'book' : 'shop');
  }
  function findDay(recipe, date) {
    var ds = (recipe && recipe.days) || [];
    for (var i = 0; i < ds.length; i++) if (ds[i].date === date) return ds[i];
    return null;
  }
  /** 七天的日期数组 */
  function weekDates() { return F.weekDays(ws()); }

  function chipRow(items, activeKey, attr) {
    return '<div class="chip-row">' + items.map(function (it) {
      return '<button class="chip ' + (it.key === activeKey ? 'is-active' : '') + '" ' +
        attr + '="' + esc(it.key) + '">' +
        (it.icon ? icon(it.icon, it.key === activeKey ? 'white' : 'gray', 'icon-sm') : '') +
        esc(it.name) + '</button>';
    }).join('') + '</div>';
  }

  // ==========================================================================
  // 1. 首页
  // ==========================================================================
  var index = {
    title: '家庭生活管家',
    tab: 'index',
    render: async function (el) {
      var ov;
      try {
        ov = await BIZ.overview();
      } catch (e) {
        el.innerHTML = UI.emptyBox({ icon: 'alert', text: '数据加载失败', sub: String(e && e.message || e), actionText: '重试' });
        el.querySelector('[data-empty-action]').onclick = function () { App.reload(); };
        return;
      }
      var w = ov.week, m = ov.market, t = ov.today;
      var over = w.weekActual > w.budget;

      var html = '';

      // ---- hero
      html += '<section class="hero">' +
        '<div class="hero-top">' +
          '<div>' +
            '<div class="hero-loc">' + icon('location', 'white', 'icon-sm') + esc(m.region) + '</div>' +
            '<div class="hero-title">' + esc(m.name) + ' · 饮食成本</div>' +
          '</div>' +
          '<div class="hero-mode">' + icon('refresh', 'white', 'icon-sm') + esc(ov.ctx.mode === 'cloud' ? '云端同步' : '本机存储') + '</div>' +
        '</div>' +
        '<div class="hero-main">' +
          '<div>' +
            '<div class="hero-label">本周已支出</div>' +
            '<div class="hero-amount"><small>¥</small>' + UI.num2(w.weekActual) + '</div>' +
            '<div class="hero-sub">预算 ' + money(w.budget) + ' · ' +
              (over ? '已超支 ' + money(w.weekActual - w.budget)
                    : '还可花 ' + money(w.weekRemaining)) + '</div>' +
          '</div>' +
          '<div style="text-align:right">' +
            '<div class="hero-label">本周计划成本</div>' +
            '<div class="hero-amount" style="font-size:22px"><small>¥</small>' + UI.num2(w.weekPlan) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="hero-bar">' +
          UI.bar(w.weekPercent, over ? 'is-over' : '') +
          '<div class="hero-bar-txt"><span>预算已用 ' + w.weekPercent + '%</span><span>' +
            esc(w.weekRangeText) + '</span></div>' +
        '</div>' +
      '</section>';

      // ---- 快捷入口
      html += '<div class="px mt"><div class="quick-grid">' +
        quickBtn('plus', 'brand', 'brand-l', '录入物价', 'add-price') +
        quickBtn('leaf', 'veg', 'veg-bg', '食材库', 'go-category') +
        quickBtn('bag', 'aquatic', 'aquatic-bg', '采购清单', 'go-shopping') +
        quickBtn('chart', 'fruit', 'fruit-bg', '成本统计', 'go-stats') +
      '</div></div>';

      // ---- 本周每日成本
      html += '<div class="px mt-l"><div class="card-hd">' +
        '<div class="card-hd-t">' + icon('calendar', 'brand', 'icon-md') + '本周每日成本</div>' +
        '<button class="card-hd-a" data-go="#/recipe">看食谱' + icon('chev-right', 'brand', 'icon-sm') + '</button>' +
      '</div></div>';
      html += '<div class="hscroll">' + w.byDay.map(function (d) {
        var v = d.actual > 0 ? d.actual : d.plan;
        var label = d.actual > 0 ? '已花' : '计划';
        return '<button class="kpi ' + (d.isToday ? 'is-today is-active' : '') + '" data-day="' + esc(d.date) + '" style="width:78px">' +
          '<div class="kpi-day">' + esc(d.label) + '</div>' +
          '<div class="kpi-val" style="font-size:13px">' + (v > 0 ? '¥' + UI.num2(v) : '—') + '</div>' +
          '<div class="kpi-day" style="font-size:10px">' + label + '</div>' +
        '</button>';
      }).join('') + '</div>';

      // ---- 今日菜单
      html += '<div class="px mt-l">' +
        '<div class="card-hd"><div class="card-hd-t">' + icon('book', 'brand', 'icon-md') + '今日菜单</div>' +
        '<button class="card-hd-a" data-go="#/recipe?view=day">去编排' + icon('chev-right', 'brand', 'icon-sm') + '</button></div>' +
        (t.meals.length
          ? t.meals.map(function (ml) {
              var sum = (ml.items || []).reduce(function (s, i) { return s + (i.amount || 0); }, 0);
              return '<div class="meal">' +
                '<div class="meal-hd">' +
                  '<div class="meal-type">' + icon(mealIcon(ml.type), 'brand', 'icon-md') + esc(ml.name || mealName(ml.type)) + '</div>' +
                  '<div class="meal-amt">' + money(sum) + '</div>' +
                '</div>' +
                '<div class="meal-items">' + (ml.items || []).map(function (i) {
                  return '<div class="item-row"><span class="item-dot"></span>' +
                    '<span class="item-name">' + esc(i.name) + '</span>' +
                    '<span class="item-qty">' + UI.qtyText(i.qty) + esc(i.unit) + '</span>' +
                    '<span class="item-amt">' + money(i.amount) + '</span></div>';
                }).join('') + '</div>' +
              '</div>';
            }).join('')
          : '<div class="card">' + UI.emptyBox({ icon: 'book', text: '今天还没排菜', sub: '去食谱页勾选食材，成本会自动算出来' }) + '</div>') +
      '</div>';

      // ---- 纸坊物价总览
      html += '<div class="px mt-l">' +
        '<div class="card-hd"><div class="card-hd-t">' + icon('shop', 'brand', 'icon-md') + '纸坊物价总览 · ' + m.ingredientCount + ' 种</div>' +
        '<button class="card-hd-a" data-go="#/category">全部' + icon('chev-right', 'brand', 'icon-sm') + '</button></div>' +
        '<div class="stat-grid">' + m.categories.map(function (c) {
          return '<button class="stat-box" data-cat="' + esc(c.key) + '" style="text-align:left">' +
            '<div class="row-between">' +
              '<div class="stat-box-l">' + icon(c.icon, c.key === 'vegetable' ? 'veg' : c.key === 'meat' ? 'meat' : c.key === 'aquatic' ? 'blue' : 'orange', 'icon-sm') + esc(c.name) + '</div>' +
              '<span class="tag ' + UI.catCls(c.key) + '">' + c.count + ' 种</span>' +
            '</div>' +
            '<div class="stat-box-v" style="font-size:18px;color:var(--price)">¥' + UI.num2(c.avgPrice) + '</div>' +
            '<div class="stat-box-s">平均价 / ' + (c.spent > 0 ? '本周已花 ¥' + UI.num2(c.spent) : '本周未采购') + '</div>' +
          '</button>';
        }).join('') + '</div>' +
      '</div>';

      // ---- 价格涨跌榜
      if (ov.movers.length) {
        html += '<div class="px mt-l">' +
          '<div class="card-hd"><div class="card-hd-t">' + icon('trend-up', 'brand', 'icon-md') + '价格涨跌榜</div>' +
          '<span class="t-xs muted">近两次记录对比</span></div>' +
          '<div class="card" style="padding:4px 14px">' + ov.movers.map(function (mv) {
            var d = UI.delta(mv.delta, mv.rate);
            return '<button class="list-item" style="padding-left:0;padding-right:0;width:100%;text-align:left;background:none" data-ing="' + esc(mv.ingredientId) + '">' +
              '<span class="tag ' + UI.catCls(mv.category) + '">' + esc(catOf(mv.category).name) + '</span>' +
              '<span class="flex-1 ing-name ellipsis" style="text-align:left">' + esc(mv.name) + '</span>' +
              '<span class="num ' + d.cls + '" style="font-size:13px;margin-right:8px">' + d.text + '</span>' +
              '<span class="num" style="color:var(--price);font-size:15px">¥' + UI.num2(mv.price) + '</span>' +
            '</button>';
          }).join('') + '</div>' +
        '</div>';
      }

      html += '<div class="px mt-l t-xs faint" style="text-align:center">数据更新于 ' + esc(m.updatedAt) +
        ' · 物价可在食材页随时手动更新</div>';

      el.innerHTML = html;
      el.classList.add('no-pad');

      // ---- 事件
      el.querySelectorAll('[data-go]').forEach(function (b) {
        b.onclick = function () { App.go(b.getAttribute('data-go')); };
      });
      el.querySelectorAll('[data-day]').forEach(function (b) {
        b.onclick = function () {
          S.recipeView = 'day';
          S.day = b.getAttribute('data-day');
          App.go('#/recipe?view=day&day=' + S.day);
        };
      });
      el.querySelectorAll('[data-cat]').forEach(function (b) {
        b.onclick = function () {
          S.cat = b.getAttribute('data-cat');
          App.go('#/category');
        };
      });
      el.querySelectorAll('[data-ing]').forEach(function (b) {
        b.onclick = function () { App.go('#/ingredient?id=' + encodeURIComponent(b.getAttribute('data-ing'))); };
      });
      el.querySelector('[data-act="add-price"]').onclick = function () { openQuickPrice(); };
    }
  };

  function quickBtn(ic, color, bg, label, act) {
    return '<button class="quick" data-act="' + act + '">' + UI.iconTile(ic, color, 'var(--' + bg + ')') +
      '<span class="quick-t">' + esc(label) + '</span></button>';
  }

  /** 快捷录入物价 */
  function openQuickPrice() {
    var list = [];
    UI.sheet({
      title: '快捷录入物价',
      body: '<div class="px" style="padding:0 14px"><div class="search-box mb">' +
              icon('search', 'muted', 'icon-sm') + '<input id="qp-kw" placeholder="搜索食材，如：五花肉">' +
            '</div></div><div id="qp-list"></div>',
      onMount: async function (root, close) {
        var r = await BIZ.listIngredients({});
        list = r.items;
        var kwEl = root.querySelector('#qp-kw');
        var listEl = root.querySelector('#qp-list');

        function draw() {
          var kw = (kwEl.value || '').trim();
          var arr = kw ? list.filter(function (i) { return i.name.indexOf(kw) >= 0; }) : list;
          if (!arr.length) { listEl.innerHTML = UI.emptyBox({ icon: 'search', text: '没找到这个食材', sub: '可以到食材页新增' }); return; }
          listEl.innerHTML = arr.slice(0, 60).map(function (i) {
            return '<div class="ing-row" data-id="' + esc(i._id) + '">' +
              '<span class="tag ' + UI.catCls(i.category) + '">' + esc(catOf(i.category).name) + '</span>' +
              '<div class="flex-1"><div class="ing-name ellipsis">' + esc(i.name) + '</div>' +
              '<div class="ing-meta">' + esc(i.shop || '') + (i.spec ? ' · ' + esc(i.spec) : '') + '</div></div>' +
              '<div class="ing-price"><div class="ing-price-v">¥' + UI.num2(i.price) + '</div>' +
              '<div class="ing-price-u">/ ' + esc(i.unit) + '</div></div>' +
            '</div>';
          }).join('');
          listEl.querySelectorAll('[data-id]').forEach(function (row) {
            row.onclick = function () { close(); openPriceForm(row.getAttribute('data-id')); };
          });
        }
        kwEl.oninput = draw;
        draw();
      }
    });
  }

  /** 改价表单 */
  function openPriceForm(id) {
    BIZ.getIngredient(id).then(function (ing) {
      if (!ing) { wx.showToast('食材不存在'); return; }
      UI.sheet({
        title: '更新售价 · ' + ing.name,
        body:
          '<div class="field"><div class="field-l">当前售价</div>' +
            '<div class="row"><span class="amount-lg">¥' + UI.num2(ing.price) + '</span>' +
            '<span class="muted ml">/ ' + esc(ing.unit) + '</span></div></div>' +
          '<div class="field"><div class="field-l">新的售价 <span class="req">*</span></div>' +
            '<input class="input input-num" id="pf-price" type="number" step="0.01" min="0" placeholder="0.00" value="' + UI.num2(ing.price) + '"></div>' +
          '<div class="field"><div class="field-l">购买地点</div>' +
            '<select class="input" id="pf-shop">' + C.SHOPS.map(function (s) {
              return '<option' + (s === ing.shop ? ' selected' : '') + '>' + esc(s) + '</option>';
            }).join('') + '</select></div>' +
          '<div class="field"><div class="field-l">备注（可选）</div>' +
            '<input class="input" id="pf-note" placeholder="如：今天涨价了"></div>' +
          '<div class="px" style="padding:12px 14px" class="t-xs muted">' +
            '<div class="row gap-s">' + icon('info', 'muted', 'icon-sm') +
            '<span>每次改价都会写一条历史记录，用于价格走势图；食谱成本会按新价自动重算。</span></div></div>',
        footer: '<button class="btn btn-primary btn-block" data-act="save">' + icon('check', 'white', 'icon-sm') + '保存并记入历史</button>',
        onMount: function (root, close) {
          root.querySelector('#pf-price').focus();
          root.querySelector('[data-act="save"]').onclick = async function () {
            var v = parseFloat(root.querySelector('#pf-price').value);
            if (!(v >= 0)) { wx.showToast('请填写正确价格'); return; }
            await BIZ.updatePrice(id, v, root.querySelector('#pf-shop').value, root.querySelector('#pf-note').value);
            App.markDirty('ingredients');
            close();
            wx.showToast('已更新售价');
            App.reload();
          };
        }
      });
    });
  }

  // ==========================================================================
  // 2. 食材分类页
  // ==========================================================================
  var category = {
    title: '食材库',
    tab: 'category',
    render: async function (el) {
      var r = await BIZ.listIngredients({ category: S.cat, keyword: S.catKeyword, orderBy: S.catOrder });
      var items = r.items;
      var cat = catOf(S.cat);

      var html = '';
      html += '<div class="px" style="padding-top:12px">' +
        '<div class="seg seg-warm">' + C.CATEGORIES.map(function (c) {
          return '<button class="seg-item ' + (c.key === S.cat ? 'is-active' : '') + '" data-segcat="' + esc(c.key) + '">' +
            esc(c.name) + '</button>';
        }).join('') + '</div></div>';

      html += '<div class="px mt">' +
        '<div class="search-box">' + icon('search', 'muted', 'icon-sm') +
        '<input id="cat-kw" placeholder="搜索食材" value="' + esc(S.catKeyword) + '"></div></div>';

      html += '<div class="mt-s">' + chipRow([
        { key: 'name', name: '按名称' },
        { key: 'price', name: '价格低→高' },
        { key: 'priceDesc', name: '价格高→低' }
      ], S.catOrder, 'data-order') + '</div>';

      html += '<div class="group-hd"><div class="group-hd-l">' + icon(cat.icon, 'gray', 'icon-sm') +
        esc(cat.name) + '</div><span>' + items.length + ' 种</span></div>';

      if (!items.length) {
        html += '<div class="px">' + UI.emptyBox({
          icon: 'folder', text: S.catKeyword ? '没有匹配的食材' : '这个分类还没有食材',
          sub: S.catKeyword ? '换个关键词试试' : '点击右下角 + 新增',
          actionText: S.catKeyword ? '清空搜索' : '新增食材'
        }) + '</div>';
      } else {
        html += '<div class="px"><div class="card" style="padding:0;overflow:hidden">' + items.map(function (i) {
          var thumb = i.image
            ? '<img class="ing-thumb" src="' + esc(i.image) + '" alt="">'
            : '<span class="ing-thumb" style="background:var(--' + (S.cat === 'meat' ? 'meat-bg' : S.cat === 'aquatic' ? 'aquatic-bg' : S.cat === 'fruit' ? 'fruit-bg' : 'veg-bg') + ')">' +
              icon(cat.icon, S.cat === 'meat' ? 'meat' : S.cat === 'aquatic' ? 'blue' : S.cat === 'fruit' ? 'orange' : 'veg', 'icon-md') + '</span>';
          return '<div class="ing-row" data-id="' + esc(i._id) + '">' + thumb +
            '<div class="flex-1"><div class="ing-name ellipsis">' + esc(i.name) + '</div>' +
            '<div class="ing-meta"><span class="ellipsis">' + esc(i.shop || C.MARKET_NAME) + '</span>' +
            (i.spec ? '<span>·</span><span class="ellipsis">' + esc(i.spec) + '</span>' : '') + '</div></div>' +
            '<div class="ing-price"><div class="ing-price-v">¥' + UI.num2(i.price) + '</div>' +
            '<div class="ing-price-u">/ ' + esc(i.unit) + '</div></div>' +
            '<button class="btn btn-xs" data-edit="' + esc(i._id) + '">' + icon('edit', 'gray', 'icon-sm') + '</button>' +
          '</div>';
        }).join('') + '</div></div>';
      }

      html += '<div class="px mt-l"><button class="btn btn-primary btn-block" data-act="new">' +
        icon('plus', 'white', 'icon-sm') + '新增食材</button></div>';

      el.innerHTML = html;
      el.classList.remove('no-pad');

      el.querySelectorAll('[data-segcat]').forEach(function (b) {
        b.onclick = function () { S.cat = b.getAttribute('data-segcat'); S.catKeyword = ''; App.rerender(); };
      });
      el.querySelectorAll('[data-order]').forEach(function (b) {
        b.onclick = function () { S.catOrder = b.getAttribute('data-order'); App.rerender(); };
      });
      var kw = el.querySelector('#cat-kw');
      kw.oninput = function () { S.catKeyword = kw.value; clearTimeout(kw._t); kw._t = setTimeout(App.rerender, 260); };

      el.querySelectorAll('[data-id]').forEach(function (row) {
        row.onclick = function () { App.go('#/ingredient?id=' + encodeURIComponent(row.getAttribute('data-id'))); };
      });
      el.querySelectorAll('[data-edit]').forEach(function (b) {
        b.onclick = function (e) { e.stopPropagation(); openIngForm(b.getAttribute('data-edit')); };
      });
      el.querySelector('[data-act="new"]').onclick = function () { openIngForm(''); };
      var ea = el.querySelector('[data-empty-action]');
      if (ea) ea.onclick = function () { S.catKeyword = ''; openIngForm(''); };
    }
  };

  /** 新增 / 编辑食材 */
  function openIngForm(id) {
    var isNew = !id;
    var draft = { name: '', category: S.cat, price: '', unit: '斤', shop: C.SHOPS[0], spec: '', image: '' };

    function body() {
      return '<div class="field"><div class="field-l">食材名称 <span class="req">*</span></div>' +
          '<input class="input" id="if-name" placeholder="如：五花肉" value="' + esc(draft.name) + '"></div>' +
        '<div class="field"><div class="field-l">分类 <span class="req">*</span></div>' +
          '<div class="seg" id="if-cat">' + C.CATEGORIES.map(function (c) {
            return '<button class="seg-item ' + (c.key === draft.category ? 'is-active' : '') + '" data-v="' + esc(c.key) + '">' + esc(c.name) + '</button>';
          }).join('') + '</div></div>' +
        '<div class="field"><div class="field-l">单价（元）<span class="req">*</span></div>' +
          '<input class="input input-num" id="if-price" type="number" step="0.01" min="0" placeholder="0.00" value="' + esc(draft.price) + '"></div>' +
        '<div class="field"><div class="field-l">单位 <span class="req">*</span></div>' +
          '<div class="seg" id="if-unit">' + C.UNITS.map(function (u) {
            return '<button class="seg-item ' + (u.name === draft.unit ? 'is-active' : '') + '" data-v="' + esc(u.name) + '">' + esc(u.name) + '</button>';
          }).join('') + '</div></div>' +
        '<div class="field"><div class="field-l">购买地点</div>' +
          '<select class="input" id="if-shop">' + C.SHOPS.map(function (s) {
            return '<option' + (s === draft.shop ? ' selected' : '') + '>' + esc(s) + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><div class="field-l">规格备注</div>' +
          '<input class="input" id="if-spec" placeholder="如：肥瘦相间 / 本地时令" value="' + esc(draft.spec) + '"></div>' +
        '<div class="field"><div class="field-l">食材图片</div>' +
          '<div class="row gap">' +
            '<span id="if-thumb" style="width:56px;height:56px;border-radius:10px;background:var(--line-2);display:flex;align-items:center;justify-content:center;overflow:hidden">' +
              (draft.image ? '<img src="' + esc(draft.image) + '" style="width:100%;height:100%;object-fit:cover">' : icon('camera', 'muted', 'icon-lg')) + '</span>' +
            '<button class="btn btn-sm" id="if-pick">' + icon('image', 'gray', 'icon-sm') + '选择图片</button>' +
            (draft.image ? '<button class="btn btn-sm btn-danger" id="if-clear">移除</button>' : '') +
          '</div></div>';
    }

    function bindDyn(root, close) {
      root.querySelectorAll('#if-cat [data-v]').forEach(function (b) {
        b.onclick = function () {
          draft.category = b.getAttribute('data-v');
          root.querySelectorAll('#if-cat [data-v]').forEach(function (x) { x.classList.remove('is-active'); });
          b.classList.add('is-active');
        };
      });
      root.querySelectorAll('#if-unit [data-v]').forEach(function (b) {
        b.onclick = function () {
          draft.unit = b.getAttribute('data-v');
          root.querySelectorAll('#if-unit [data-v]').forEach(function (x) { x.classList.remove('is-active'); });
          b.classList.add('is-active');
        };
      });
      var pick = root.querySelector('#if-pick');
      if (pick) pick.onclick = function () {
        wx.chooseImage({ count: 1 }).then(function (res) {
          draft.image = (res.tempFilePaths && res.tempFilePaths[0]) || '';
          repaint(root, close);
        }).catch(function () {});
      };
      var clr = root.querySelector('#if-clear');
      if (clr) clr.onclick = function () { draft.image = ''; repaint(root, close); };
    }

    function repaint(root, close) {
      draft.name = (root.querySelector('#if-name') || {}).value || draft.name;
      draft.price = (root.querySelector('#if-price') || {}).value || draft.price;
      draft.spec = (root.querySelector('#if-spec') || {}).value || draft.spec;
      draft.shop = (root.querySelector('#if-shop') || {}).value || draft.shop;
      var b = root.querySelector('.sheet-body');
      b.innerHTML = body();
      bindDyn(root, close);
    }

    function open() {
      UI.sheet({
        title: isNew ? '新增食材' : '编辑食材',
        tall: true,
        body: body(),
        footer: '<button class="btn btn-primary btn-block" data-act="save">' + icon('check', 'white', 'icon-sm') + '保存</button>' +
                (isNew ? '' : '<button class="btn btn-danger" data-act="del" style="flex:none;width:46px;padding:0">' + icon('trash', 'danger', 'icon-md') + '</button>'),
        onMount: function (root, close) {
          bindDyn(root, close);
          root.querySelector('[data-act="save"]').onclick = async function () {
            draft.name = root.querySelector('#if-name').value.trim();
            draft.price = parseFloat(root.querySelector('#if-price').value);
            draft.spec = root.querySelector('#if-spec').value.trim();
            draft.shop = root.querySelector('#if-shop').value;
            if (!draft.name) { wx.showToast('请填写食材名称'); return; }
            if (!(draft.price >= 0)) { wx.showToast('请填写正确单价'); return; }
            var payload = {
              name: draft.name, category: draft.category, price: draft.price,
              unit: draft.unit, shop: draft.shop, spec: draft.spec, image: draft.image
            };
            await BIZ.saveIngredient(payload, id || null);
            App.markDirty('ingredients');
            close();
            wx.showToast(isNew ? '已新增食材' : '已保存');
            App.rerender();
          };
          var del = root.querySelector('[data-act="del"]');
          if (del) del.onclick = async function () {
            if (!(await wx.showModal({ title: '删除食材', content: '删除后该食材的价格历史也会一并清理，确定吗？' })).confirm) return;
            await BIZ.removeIngredient(id);
            App.markDirty('ingredients');
            close();
            wx.showToast('已删除');
            App.rerender();
          };
        }
      });
    }

    if (isNew) { open(); return; }
    BIZ.getIngredient(id).then(function (ing) {
      if (!ing) { wx.showToast('食材不存在'); return; }
      draft = {
        name: ing.name, category: ing.category, price: String(ing.price),
        unit: ing.unit, shop: ing.shop || C.SHOPS[0], spec: ing.spec || '', image: ing.image || ''
      };
      open();
    });
  }

  // ==========================================================================
  // 3. 食材详情页
  // ==========================================================================
  var ingredient = {
    title: '食材详情',
    tab: 'category',
    render: async function (el, params) {
      var id = params.id;
      var ing = await BIZ.getIngredient(id);
      if (!ing) {
        el.innerHTML = UI.emptyBox({ icon: 'alert', text: '食材不存在或已删除', sub: '可能已被移除', actionText: '返回食材库' });
        el.querySelector('[data-empty-action]').onclick = function () { App.go('#/category'); };
        return;
      }
      var logs = await BIZ.listPriceLogs(id);
      var recipe = await BIZ.getWeekRecipe(ws());
      var used = [];
      (recipe.days || []).forEach(function (d) {
        (d.meals || []).forEach(function (m) {
          (m.items || []).forEach(function (it) { if (it.ingredientId === id) used.push(it); });
        });
      });
      var usedQty = used.reduce(function (s, i) { return s + (i.qty || 0); }, 0);
      var usedAmt = used.reduce(function (s, i) { return s + (i.amount || 0); }, 0);
      var cat = catOf(ing.category);

      // 价格走势（按时间正序，最多 12 条）
      var asc = logs.slice(0, 12).reverse();
      var cols = asc.map(function (l) {
        return { label: (l.recordedAt || '').slice(5), value: l.price, isToday: false };
      });
      var maxV = Math.max.apply(null, cols.map(function (c) { return c.value; }).concat([1]));

      var last = logs[0];
      var prev = logs[1];
      var deltaHtml = '';
      if (last && prev) {
        var d = UI.delta(F.round2(last.price - prev.price), Math.round((last.price - prev.price) / prev.price * 1000) / 10);
        deltaHtml = '<span class="num ' + d.cls + '" style="font-size:13px">' + d.text + '</span>';
      }

      var html = '';
      // 基础信息
      html += '<div class="px" style="padding-top:12px"><div class="card">' +
        '<div class="row gap">' +
          (ing.image
            ? '<img src="' + esc(ing.image) + '" style="width:64px;height:64px;border-radius:12px;object-fit:cover;flex:none">'
            : '<span class="icon-fill" style="width:64px;height:64px;border-radius:12px;background:var(--' + (ing.category === 'meat' ? 'meat-bg' : ing.category === 'aquatic' ? 'aquatic-bg' : ing.category === 'fruit' ? 'fruit-bg' : 'veg-bg') + ')">' + icon(cat.icon, ing.category === 'meat' ? 'meat' : ing.category === 'aquatic' ? 'blue' : ing.category === 'fruit' ? 'orange' : 'veg', 'icon-xl') + '</span>') +
          '<div class="flex-1">' +
            '<div class="row gap-s"><span class="t-lg ellipsis">' + esc(ing.name) + '</span>' +
            '<span class="tag ' + UI.catCls(ing.category) + '">' + esc(cat.name) + '</span></div>' +
            '<div class="ing-meta mt-s">' + icon('shop', 'gray', 'icon-sm') + esc(ing.shop || C.MARKET_NAME) +
            (ing.spec ? '<span>·</span>' + esc(ing.spec) : '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="row-between mt" style="align-items:flex-end">' +
          '<div><div class="t-xs muted">当前售价</div>' +
            '<div class="row gap-s" style="align-items:baseline">' +
              '<span class="amount-lg">¥' + UI.num2(ing.price) + '</span>' +
              '<span class="muted t-sm">/ ' + esc(ing.unit) + '</span>' + deltaHtml +
            '</div></div>' +
          '<div class="t-xs muted" style="text-align:right">共 ' + logs.length + ' 条<br>价格记录</div>' +
        '</div>' +
      '</div></div>';

      // 操作
      html += '<div class="px mt"><div class="row gap">' +
        '<button class="btn btn-primary flex-1" data-act="price">' + icon('refresh', 'white', 'icon-sm') + '更新售价</button>' +
        '<button class="btn btn-ghost flex-1" data-act="add">' + icon('plus', 'brand', 'icon-sm') + '加入食谱</button>' +
      '</div></div>';

      // 本周用量
      html += '<div class="px mt-l"><div class="card-hd"><div class="card-hd-t">' + icon('list', 'brand', 'icon-md') + '本周用量</div>' +
        '<span class="t-xs muted">' + esc(F.weekRangeText(ws())) + '</span></div>' +
        '<div class="card">' +
          (used.length
            ? '<div class="row-between"><div>' +
                '<div class="t-xl num">' + UI.qtyText(usedQty) + '<span class="t-sm muted" style="font-weight:400"> ' + esc(ing.unit) + '</span></div>' +
                '<div class="t-xs muted mt-s">出现在 ' + used.length + ' 道菜里</div></div>' +
              '<div style="text-align:right"><div class="amount-md">' + money(usedAmt) + '</div>' +
              '<div class="t-xs muted">已计入本周成本</div></div></div>'
            : UI.emptyBox({ icon: 'book', text: '本周还没用到', sub: '点「加入食谱」把它排进菜单' })) +
        '</div>' +
      '</div>';

      // 价格走势
      html += '<div class="px mt-l"><div class="card-hd"><div class="card-hd-t">' + icon('chart', 'brand', 'icon-md') + '价格波动</div>' +
        '<span class="t-xs muted">近 ' + cols.length + ' 次记录</span></div>' +
        '<div class="card chart-wrap">' +
          (cols.length > 1 ? UI.bars(cols, maxV, '') : UI.emptyBox({ icon: 'chart', text: '暂无价格波动', sub: '多更新几次售价就能看到走势' })) +
        '</div></div>';

      // 价格明细
      if (logs.length) {
        html += '<div class="px mt-l"><div class="card-hd"><div class="card-hd-t">' + icon('clock', 'brand', 'icon-md') + '价格记录</div></div>' +
          '<div class="card" style="padding:4px 14px">' + logs.slice(0, 20).map(function (l, i) {
            var nx = logs[i + 1];
            var chg = nx === undefined ? '' : (function () {
              var dv = F.round2(l.price - (nx ? nx.price : l.price));
              var d = UI.delta(dv, nx && nx.price ? Math.round(dv / nx.price * 1000) / 10 : 0);
              return '<span class="num ' + d.cls + '" style="font-size:11px;margin-left:6px">' + d.text + '</span>';
            })();
            return '<div class="detail-row">' +
              '<div><div class="t-sm">' + esc((l.recordedAt || '').slice(0, 10)) + chg + '</div>' +
              (l.note ? '<div class="t-xs muted">' + esc(l.note) + '</div>' : '') + '</div>' +
              '<div style="text-align:right"><span class="num" style="color:var(--price);font-size:15px">¥' + UI.num2(l.price) + '</span>' +
              '<div class="t-xs muted">/ ' + esc(l.unit || ing.unit) + '</div></div>' +
            '</div>';
          }).join('') + '</div></div>';
      }

      html += '<div class="px mt-l"><button class="btn btn-block" data-act="edit">' + icon('edit', 'gray', 'icon-sm') + '编辑食材信息</button></div>';
      html += '<div class="px mt-l" style="height:16px"></div>';

      el.innerHTML = html;
      el.classList.remove('no-pad');

      el.querySelector('[data-act="price"]').onclick = function () { openPriceForm(id); };
      el.querySelector('[data-act="edit"]').onclick = function () { openIngForm(id); };
      el.querySelector('[data-act="add"]').onclick = function () { openAddToRecipe(ing); };
      var ea = el.querySelector('[data-empty-action]');
      if (ea) ea.onclick = function () { openAddToRecipe(ing); };
    }
  };

  /** 把食材加进食谱：选日期 + 餐次 + 用量 */
  function openAddToRecipe(ing) {
    var dates = weekDates();
    var draft = { date: F.today(), meal: 'dinner', qty: 1 };

    function body() {
      return '<div class="field"><div class="field-l">食材</div>' +
          '<div class="row gap-s"><span class="tag ' + UI.catCls(ing.category) + '">' + esc(catOf(ing.category).name) + '</span>' +
          '<span class="strong">' + esc(ing.name) + '</span>' +
          '<span class="muted t-sm">¥' + UI.num2(ing.price) + ' / ' + esc(ing.unit) + '</span></div></div>' +
        '<div class="field"><div class="field-l">哪一天 <span class="req">*</span></div>' +
          '<div class="seg" id="ar-date" style="flex-wrap:wrap">' + dates.map(function (d) {
            return '<button class="seg-item ' + (d === draft.date ? 'is-active' : '') + '" data-v="' + esc(d) + '">' + esc(F.weekLabel(d)) + '</button>';
          }).join('') + '</div></div>' +
        '<div class="field"><div class="field-l">哪一餐 <span class="req">*</span></div>' +
          '<div class="seg" id="ar-meal">' + C.MEALS.map(function (m) {
            return '<button class="seg-item ' + (m.key === draft.meal ? 'is-active' : '') + '" data-v="' + esc(m.key) + '">' + esc(m.name) + '</button>';
          }).join('') + '</div></div>' +
        '<div class="field"><div class="field-l">用量（' + esc(ing.unit) + '）<span class="req">*</span></div>' +
          '<div class="row-between">' +
            '<div class="stepper">' +
              '<button class="stepper-btn" data-q="-1">−</button>' +
              '<span class="stepper-val" id="ar-qty">' + UI.qtyText(draft.qty) + '</span>' +
              '<button class="stepper-btn" data-q="1">+</button>' +
            '</div>' +
            '<span class="amount-md" id="ar-amt">' + money(F.amount(draft.qty, ing.price)) + '</span>' +
          '</div></div>' +
        '<div class="px" style="padding:12px 14px"><div class="row gap-s t-xs muted">' + icon('info', 'muted', 'icon-sm') +
          '<span>成本会随市场价自动重算，这里只是记录用量。</span></div></div>';
    }

    function paint(root) {
      root.querySelector('#ar-qty').textContent = UI.qtyText(draft.qty);
      root.querySelector('#ar-amt').textContent = money(F.amount(draft.qty, ing.price));
    }

    UI.sheet({
      title: '加入食谱',
      body: body(),
      footer: '<button class="btn btn-primary btn-block" data-act="ok">' + icon('check', 'white', 'icon-sm') + '加入' + esc(F.weekLabel(draft.date)) + ' ' + esc(mealName(draft.meal)) + '</button>',
      onMount: function (root, close) {
        root.querySelectorAll('#ar-date [data-v]').forEach(function (b) {
          b.onclick = function () {
            draft.date = b.getAttribute('data-v');
            root.querySelectorAll('#ar-date [data-v]').forEach(function (x) { x.classList.remove('is-active'); });
            b.classList.add('is-active');
            root.querySelector('[data-act="ok"]').innerHTML = icon('check', 'white', 'icon-sm') +
              '加入' + esc(F.weekLabel(draft.date)) + ' ' + esc(mealName(draft.meal));
          };
        });
        root.querySelectorAll('#ar-meal [data-v]').forEach(function (b) {
          b.onclick = function () {
            draft.meal = b.getAttribute('data-v');
            root.querySelectorAll('#ar-meal [data-v]').forEach(function (x) { x.classList.remove('is-active'); });
            b.classList.add('is-active');
            root.querySelector('[data-act="ok"]').innerHTML = icon('check', 'white', 'icon-sm') +
              '加入' + esc(F.weekLabel(draft.date)) + ' ' + esc(mealName(draft.meal));
          };
        });
        root.querySelectorAll('[data-q]').forEach(function (b) {
          b.onclick = function () {
            var step = parseFloat(b.getAttribute('data-q'));
            draft.qty = Math.max(0.5, Math.round((draft.qty + step * 0.5) * 10) / 10);
            paint(root);
          };
        });
        root.querySelector('[data-act="ok"]').onclick = async function () {
          await BIZ.addItemToRecipe(ws(), draft.date, draft.meal, mealName(draft.meal), { ingredientId: ing._id, qty: draft.qty });
          App.markDirty('recipes');
          close();
          wx.showToast('已加入食谱');
          App.reload();
        };
      }
    });
  }

  // ==========================================================================
  // 4. 食谱规划页
  // ==========================================================================
  var recipe = {
    title: '食谱规划',
    tab: 'recipe',
    render: async function (el) {
      var w = ws();
      var r = await BIZ.getWeekRecipe(w);
      var spends = await BIZ.listWeekSpends(w);
      var dates = F.weekDays(w);
      if (!S.day || dates.indexOf(S.day) < 0) S.day = dates.indexOf(F.today()) >= 0 ? F.today() : dates[0];

      // 按天聚合自定义消费
      var spendByDay = {};
      var weekSpendTotal = 0;
      spends.forEach(function (s) {
        if (!spendByDay[s.date]) spendByDay[s.date] = { count: 0, amount: 0, list: [] };
        spendByDay[s.date].count += 1;
        spendByDay[s.date].amount = F.round2(spendByDay[s.date].amount + s.amount);
        spendByDay[s.date].list.push(s);
        weekSpendTotal = F.round2(weekSpendTotal + s.amount);
      });

      var html = '';
      // 周导航
      html += '<div class="toolbar">' +
        '<button class="btn btn-sm" data-act="prev">' + icon('chev-left', 'dark', 'icon-sm') + '</button>' +
        '<div style="text-align:center;flex:1">' +
          '<div class="t-md">' + esc(F.weekRangeText(w)) + '</div>' +
          '<div class="t-xs muted">' + esc(F.weekLabel(dates[0])) + ' · 计划成本 ' + money(r.totalAmount) +
            (weekSpendTotal > 0 ? ' · 含自定义消费 ' + money(weekSpendTotal) : '') + '</div>' +
        '</div>' +
        '<button class="btn btn-sm" data-act="next">' + icon('chev-right', 'dark', 'icon-sm') + '</button>' +
      '</div>';

      // 视图切换
      html += '<div class="px" style="padding-top:10px"><div class="seg seg-warm">' +
        '<button class="seg-item ' + (S.recipeView === 'week' ? 'is-active' : '') + '" data-view="week">整周视图</button>' +
        '<button class="seg-item ' + (S.recipeView === 'day' ? 'is-active' : '') + '" data-view="day">单日视图</button>' +
      '</div></div>';

      var showDates = S.recipeView === 'day' ? [S.day] : dates;

      if (S.recipeView === 'day') {
        html += '<div class="mt-s">' + chipRow(dates.map(function (d) {
          return { key: d, name: F.weekLabel(d) };
        }), S.day, 'data-day') + '</div>';
      }

      html += '<div class="px mt">';

      if (S.recipeView === 'week') {
        html += '<div class="card-hd"><div class="card-hd-t">' + icon('calendar', 'brand', 'icon-md') + '本周菜单</div>' +
          '<span class="t-xs muted">食材 ' + money(r.totalAmount) +
            (weekSpendTotal > 0 ? ' + 消费 ' + money(weekSpendTotal) + ' = ' + money(F.round2(r.totalAmount + weekSpendTotal)) : '') +
          '</span></div>';
      }

      showDates.forEach(function (date) {
        var day = findDay(r, date);
        var isToday = date === F.today();
        var meals = (day && day.meals) || [];
        var sp = spendByDay[date];
        // 当天合计口径 = 食谱成本 + 当天自定义消费（与单日视图、小程序保持一致）
        var dayAmt = F.round2(meals.reduce(function (s, m) { return s + (m.amount || 0); }, 0) + (sp ? (sp.amount || 0) : 0));

        html += '<div class="day-card">' +
          '<div class="day-hd ' + (isToday ? 'is-today' : '') + '">' +
            '<div class="day-name">' + icon('calendar', isToday ? 'brand' : 'gray', 'icon-md') +
              esc(F.weekLabel(date)) + (isToday ? '<span class="tag tag-brand">今天</span>' : '') +
              '<span class="t-xs muted">' + esc(F.shortDate(date)) + '</span>' +
              (sp ? '<span class="tag tag-price">消费 ' + sp.count + ' 笔</span>' : '') + '</div>' +
            '<div class="row gap-s">' +
              '<span class="num" style="color:var(--price);font-size:14px">' + money(dayAmt) + '</span>' +
              '<button class="btn btn-xs" data-spend="' + esc(date) + '">' + icon('money', 'gray', 'icon-sm') + '记消费</button>' +
              '<button class="btn btn-xs" data-add="' + esc(date) + '">' + icon('plus', 'gray', 'icon-sm') + '加菜</button>' +
              (meals.length ? '<button class="btn btn-xs" data-clear-day="' + esc(date) + '">' + icon('trash', 'gray', 'icon-sm') + '</button>' : '') +
            '</div>' +
          '</div>' +
          '<div class="day-body">';

        if (!meals.length) {
          html += '<div class="t-xs muted" style="text-align:center;padding:14px 0">还没有安排 · 点「加菜」开始</div>';
        } else {
          meals.forEach(function (m) {
            html += '<div class="meal">' +
              '<div class="meal-hd">' +
                '<div class="meal-type">' + icon(mealIcon(m.type), 'brand', 'icon-md') + esc(m.name || mealName(m.type)) + '</div>' +
                '<div class="row gap-s">' +
                  '<span class="meal-amt">' + money(m.amount) + '</span>' +
                  '<button class="btn btn-xs" data-add-meal="' + esc(date) + '|' + esc(m.type) + '">' + icon('plus', 'gray', 'icon-sm') + '</button>' +
                  '<button class="btn btn-xs" data-del-meal="' + esc(date) + '|' + esc(m.id) + '">' + icon('trash', 'gray', 'icon-sm') + '</button>' +
                '</div>' +
              '</div>' +
              '<div class="meal-items">' +
                (m.items || []).map(function (it) {
                  var chg = Math.abs((it.price || 0) - (it.priceSnapshot || 0)) > 0.005;
                  var nameEl = it.custom
                    ? '<span class="item-custom-tag">自定义</span><span class="item-name ellipsis" style="text-align:left;color:var(--text-3)">' + esc(it.name) + '</span>'
                    : '<button class="item-name ellipsis" style="text-align:left;background:none" data-ing="' + esc(it.ingredientId) + '">' + esc(it.name) + '</button>';
                  return '<div class="item-row">' +
                    '<span class="item-dot"></span>' +
                    nameEl +
                    '<button class="item-qty" data-qty="' + esc(date) + '|' + esc(m.id) + '|' + esc(it.id) + '|' + esc(it.qty) + '|' + esc(it.unit) + '">' +
                      UI.qtyText(it.qty) + esc(it.unit) + '</button>' +
                    '<span class="item-amt">' + money(it.amount) + '</span>' +
                    '<button class="btn btn-xs" data-del-item="' + esc(date) + '|' + esc(m.id) + '|' + esc(it.id) + '">' + icon('close', 'gray', 'icon-sm') + '</button>' +
                  '</div>';
                }).join('') +
              '</div>' +
            '</div>';
          });
        }

        // ---- 当天自定义消费（自己填物品 + 金额，与「记一笔」同口径）----
        // 整周视图只在该天确有消费时才展开，避免 7 天铺满太长；单日视图始终展示
        if (S.recipeView === 'day' || sp) {
          html += '<div class="day-spend">' +
            '<div class="day-spend-hd">' +
              '<div class="meal-type">' + icon('money', 'brand', 'icon-md') + '自定义消费</div>' +
              '<span class="meal-amt">' + money(sp ? sp.amount : 0) + '</span>' +
            '</div>';
          if (sp && sp.list.length) {
            html += sp.list.map(function (s) {
              return '<div class="item-row">' +
                '<span class="item-dot"></span>' +
                '<span class="item-name ellipsis" style="text-align:left">' + esc(s.name) + '</span>' +
                '<span class="item-qty">' + (s.note ? esc(s.note) : '自定义') + '</span>' +
                '<span class="item-amt">' + money(s.amount) + '</span>' +
                '<button class="btn btn-xs" data-del-spend="' + esc(s._id) + '">' + icon('close', 'gray', 'icon-sm') + '</button>' +
              '</div>';
            }).join('');
          } else {
            html += '<div class="t-xs muted" style="padding:6px 0 8px">买菜、外卖、水果……不在食材库里的支出，直接记金额</div>';
          }
          html += '<button class="btn btn-xs btn-block" data-spend="' + esc(date) + '">' +
            icon('plus', 'gray', 'icon-sm') + '记一笔</button></div>';
        }

        html += '</div></div>';
      });

      html += '</div>';

      // 底部操作
      html += '<div class="px mt-l"><div class="row gap">' +
        '<button class="btn flex-1" data-act="copy">' + icon('download', 'gray', 'icon-sm') + '复制上周</button>' +
        '<button class="btn flex-1" data-act="cart">' + icon('bag', 'gray', 'icon-sm') + '生成清单</button>' +
      '</div></div>';
      html += '<div class="px mt-l" style="height:10px"></div>';

      el.innerHTML = html;
      el.classList.remove('no-pad');

      // ---- 事件
      el.querySelector('[data-act="prev"]').onclick = function () { S.week = F.addDays(w, -7); App.rerender(); };
      el.querySelector('[data-act="next"]').onclick = function () { S.week = F.addDays(w, 7); App.rerender(); };
      el.querySelectorAll('[data-view]').forEach(function (b) {
        b.onclick = function () { S.recipeView = b.getAttribute('data-view'); App.rerender(); };
      });
      el.querySelectorAll('[data-day]').forEach(function (b) {
        b.onclick = function () { S.day = b.getAttribute('data-day'); App.rerender(); };
      });
      el.querySelectorAll('[data-add]').forEach(function (b) {
        b.onclick = function () { openDishPicker(b.getAttribute('data-add'), 'dinner', mealName('dinner')); };
      });
      el.querySelectorAll('[data-spend]').forEach(function (b) {
        b.onclick = function () { openSpendPicker(b.getAttribute('data-spend')); };
      });
      el.querySelectorAll('[data-del-spend]').forEach(function (b) {
        b.onclick = async function () {
          await BIZ.removeRecord(b.getAttribute('data-del-spend'));
          App.markDirty('records');
          App.rerender();
          wx.showToast('已删除这笔消费');
        };
      });
      el.querySelectorAll('[data-add-meal]').forEach(function (b) {
        b.onclick = function () {
          var p = b.getAttribute('data-add-meal').split('|');
          openDishPicker(p[0], p[1], mealName(p[1]));
        };
      });
      el.querySelectorAll('[data-del-meal]').forEach(function (b) {
        b.onclick = async function () {
          var p = b.getAttribute('data-del-meal').split('|');
          await BIZ.removeMeal(w, p[0], p[1]);
          App.markDirty('recipes');
          App.rerender();
          wx.showToast('已删除该餐');
        };
      });
      el.querySelectorAll('[data-clear-day]').forEach(function (b) {
        b.onclick = async function () {
          var date = b.getAttribute('data-clear-day');
          if (!(await wx.showModal({ title: '清空' + F.weekLabel(date), content: '会清掉这一天全部菜品，确定吗？' })).confirm) return;
          await BIZ.clearDayRecipe(w, date);
          App.markDirty('recipes');
          App.rerender();
          wx.showToast('已清空');
        };
      });
      el.querySelectorAll('[data-del-item]').forEach(function (b) {
        b.onclick = async function () {
          var p = b.getAttribute('data-del-item').split('|');
          await BIZ.removeRecipeItem(w, p[0], p[1], p[2]);
          App.markDirty('recipes');
          App.rerender();
        };
      });
      el.querySelectorAll('[data-qty]').forEach(function (b) {
        b.onclick = function () { openQtyEditor(b.getAttribute('data-qty')); };
      });
      el.querySelectorAll('[data-ing]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-ing');
          if (id) App.go('#/ingredient?id=' + encodeURIComponent(id));
        };
      });
      el.querySelector('[data-act="copy"]').onclick = async function () {
        var prevWeek = F.addDays(w, -7);
        var prev = await BIZ.getWeekRecipe(prevWeek);
        var count = 0;
        (prev.days || []).forEach(function (d) { (d.meals || []).forEach(function (m) { count += (m.items || []).length; }); });
        if (!count) { wx.showToast('上周没有菜单可复制'); return; }
        if (!(await wx.showModal({ title: '复制上周菜单', content: '会把上周的 ' + count + ' 条食材安排复制到本周，本周原有内容将被覆盖。' })).confirm) return;
        await BIZ.copyRecipeToWeek(prevWeek, w);
        App.markDirty('recipes');
        App.rerender();
        wx.showToast('已复制');
      };
      el.querySelector('[data-act="cart"]').onclick = function () { App.go('#/shopping'); };
    }
  };

  /** 记一笔自定义消费：自己填物品 + 金额，归属某一天（与「记一笔」同口径） */
  function openSpendPicker(date) {
    var weekDays = F.weekDays(ws());
    var draft = { date: date, name: '', amount: '', note: '' };
    var dateChips = weekDays.map(function (d) {
      return '<button class="chip ' + (d === draft.date ? 'is-active' : '') + '" data-sd="' + esc(d) + '">' +
        esc(F.weekLabel(d)) + '</button>';
    }).join('');

    UI.sheet({
      title: '记一笔 · ' + F.weekLabel(date),
      tall: true,
      body:
        '<div class="sp-lb">记到哪一天</div>' +
        '<div class="chip-wrap">' + dateChips + '</div>' +
        '<div class="sp-lb">物品 / 项目</div>' +
        '<input class="sp-in" id="sp-name" placeholder="例如：排骨、水果、外卖、奶茶" maxlength="16">' +
        '<div class="sp-lb">金额（元）</div>' +
        '<input class="sp-in" id="sp-amt" type="number" step="0.01" min="0" placeholder="0.00">' +
        '<div class="sp-lb">备注（可选）</div>' +
        '<input class="sp-in" id="sp-note" placeholder="例如：菜市场现金买的" maxlength="30">',
      footer: '<button class="btn btn-block btn-primary" data-act="ok">保存这笔消费</button>',
      onMount: function (root, close) {
        root.querySelectorAll('[data-sd]').forEach(function (b) {
          b.onclick = function () {
            draft.date = b.getAttribute('data-sd');
            root.querySelectorAll('[data-sd]').forEach(function (x) {
              x.classList.toggle('is-active', x === b);
            });
          };
        });
        root.querySelector('#sp-name').oninput = function (e) { draft.name = e.target.value; };
        root.querySelector('#sp-amt').oninput = function (e) { draft.amount = e.target.value; };
        root.querySelector('#sp-note').oninput = function (e) { draft.note = e.target.value; };

        root.querySelector('[data-act="ok"]').onclick = async function () {
          var name = (draft.name || '').trim();
          var amount = F.round2(parseFloat(draft.amount) || 0);
          if (!name) { wx.showToast('请填写物品名称'); return; }
          if (!(amount > 0)) { wx.showToast('请填写金额'); return; }
          try {
            await BIZ.addSpendRecord({
              date: draft.date,
              category: name,
              amount: amount,
              note: (draft.note || '').trim()
            });
            App.markDirty('records');
            close();
            wx.showToast('已记 ' + name + ' ¥' + F.money(amount));
            App.rerender();
          } catch (err) {
            wx.showToast((err && err.message) || '保存失败');
          }
        };
      }
    });
  }

  /** 选菜品（食材）加入某天某餐 */
  function openDishPicker(date, mealType, mName) {
    BIZ.listIngredients({}).then(function (r) {
      var list = r.items;
      var unitChips = ['斤','个','份','把','包','袋'].map(function (u) {
        return '<button class="chip ' + (u === '斤' ? 'is-active' : '') + '" data-cu="' + esc(u) + '">' + esc(u) + '</button>';
      }).join('');
      UI.sheet({
        title: '加菜 · ' + F.weekLabel(date) + ' ' + mName,
        tall: true,
        body:
          '<div id="dp-pick">' +
            '<div class="px" style="padding:0 14px">' +
              '<div class="custom-add-row" id="dp-custom-btn">' +
                icon('plus', 'brand', 'icon-sm') +
                '<span class="custom-add-text">自定义添加（不在食材库）</span>' +
                icon('chev-right', 'muted', 'icon-sm') +
              '</div>' +
            '</div>' +
            '<div class="px" style="padding:8px 14px 0"><div class="search-box mb">' +
              icon('search', 'muted', 'icon-sm') + '<input id="dp-kw" placeholder="搜索食材，点一下加入">' +
            '</div></div>' +
            '<div id="dp-list"></div>' +
          '</div>' +
          '<div id="dp-custom" style="display:none">' +
            '<div class="field"><div class="field-l">菜品名称</div>' +
              '<input class="input" id="cu-name" placeholder="例如：酸辣土豆丝、卤味拼盘" maxlength="16"></div>' +
            '<div class="field"><div class="field-l">单价（元）</div>' +
              '<input class="input input-num" id="cu-price" type="number" step="0.01" min="0" placeholder="0.00"></div>' +
            '<div class="field"><div class="field-l">单位</div>' +
              '<div class="chip-wrap" id="cu-units">' + unitChips + '</div></div>' +
            '<div class="field"><div class="field-l">用量</div>' +
              '<div class="row-between"><div class="stepper">' +
                '<button class="stepper-btn" data-cq="-1">−</button>' +
                '<span class="stepper-val" id="cu-q">1</span>' +
                '<button class="stepper-btn" data-cq="1">+</button>' +
              '</div><span class="amount-md" id="cu-amt">¥0.00</span></div></div>' +
          '</div>',
        footer: '<button class="btn btn-block btn-primary" data-act="dp-save">保存到' + esc(mName) + '</button>',
        onMount: function (root, close) {
          var pickPane = root.querySelector('#dp-pick');
          var customPane = root.querySelector('#dp-custom');
          var saveBtn = root.querySelector('[data-act="dp-save"]');
          var cdraft = { name: '', price: '', qty: 1, unit: '斤', mode: 'pick' };

          function showPick() {
            cdraft.mode = 'pick';
            pickPane.style.display = '';
            customPane.style.display = 'none';
            saveBtn.textContent = '保存到' + mName;
            saveBtn.onclick = function () { /* 食材库模式：点食材才走 pick，保存按钮仅在自定义模式生效 */ };
            saveBtn.style.opacity = '0.4';
            saveBtn.style.pointerEvents = 'none';
          }
          function showCustom() {
            cdraft.mode = 'custom';
            pickPane.style.display = 'none';
            customPane.style.display = '';
            saveBtn.textContent = '加入 ' + mName;
            saveBtn.style.opacity = '';
            saveBtn.style.pointerEvents = '';
            var nameIn = root.querySelector('#cu-name'); if (nameIn && document.activeElement !== nameIn) nameIn.focus();
          }
          showPick();

          // ---- 食材库列表 ----
          var kwEl = root.querySelector('#dp-kw'), listEl = root.querySelector('#dp-list');
          function draw() {
            var kw = (kwEl.value || '').trim();
            var arr = kw ? list.filter(function (i) { return i.name.indexOf(kw) >= 0; }) : list;
            if (!arr.length) { listEl.innerHTML = UI.emptyBox({ icon: 'search', text: '没找到', sub: '到食材页新增这个食材' }); return; }
            listEl.innerHTML = arr.slice(0, 80).map(function (i) {
              return '<div class="ing-row" data-id="' + esc(i._id) + '">' +
                '<span class="tag ' + UI.catCls(i.category) + '">' + esc(catOf(i.category).name) + '</span>' +
                '<div class="flex-1"><div class="ing-name ellipsis">' + esc(i.name) + '</div></div>' +
                '<div class="ing-price"><div class="ing-price-v">¥' + UI.num2(i.price) + '</div>' +
                '<div class="ing-price-u">/ ' + esc(i.unit) + '</div></div>' +
                '<button class="btn btn-xs btn-primary">' + icon('plus', 'white', 'icon-sm') + '</button>' +
              '</div>';
            }).join('');
            listEl.querySelectorAll('[data-id]').forEach(function (row, idx) {
              row.onclick = function () { pick(arr[idx]); };
            });
          }
          function pick(i) {
            close();
            var draft = { qty: 1 };
            UI.sheet({
              title: i.name + ' · 用量',
              body: '<div class="field"><div class="field-l">用量（' + esc(i.unit) + '）</div>' +
                '<div class="row-between"><div class="stepper">' +
                  '<button class="stepper-btn" data-q="-1">−</button>' +
                  '<span class="stepper-val" id="dq">1</span>' +
                  '<button class="stepper-btn" data-q="1">+</button>' +
                '</div><span class="amount-md" id="da">' + money(i.price) + '</span></div></div>' +
                '<div class="field"><div class="field-l">或者手动输入</div>' +
                '<input class="input input-num" id="dq-in" type="number" step="0.5" min="0.5" value="1"></div>' +
                '<div class="px" style="padding:12px 14px" class="t-xs muted">¥' + UI.num2(i.price) + ' / ' + esc(i.unit) + ' · 成本按当前市价实时计算</div>',
              footer: '<button class="btn btn-primary btn-block" data-act="ok">' + icon('check', 'white', 'icon-sm') + '加入 ' + esc(mName) + '</button>',
              onMount: function (r2, close2) {
                var inEl = r2.querySelector('#dq-in');
                function sync(v) {
                  draft.qty = Math.max(0.1, v);
                  r2.querySelector('#dq').textContent = UI.qtyText(draft.qty);
                  r2.querySelector('#da').textContent = money(F.amount(draft.qty, i.price));
                  inEl.value = UI.qtyText(draft.qty);
                }
                r2.querySelectorAll('[data-q]').forEach(function (b) {
                  b.onclick = function () {
                    sync(Math.round((draft.qty + parseFloat(b.getAttribute('data-q')) * 0.5) * 10) / 10);
                  };
                });
                inEl.oninput = function () { sync(parseFloat(inEl.value) || 0.1); };
                r2.querySelector('[data-act="ok"]').onclick = async function () {
                  await BIZ.addItemToRecipe(ws(), date, mealType, mName, { ingredientId: i._id, qty: draft.qty });
                  App.markDirty('recipes');
                  close2();
                  wx.showToast('已加入 ' + i.name);
                  App.rerender();
                };
              }
            });
          }
          kwEl.oninput = draw;
          draw();

          // ---- 切换到自定义 ----
          root.querySelector('#dp-custom-btn').onclick = function () { showCustom(); };

          // ---- 自定义表单 ----
          function syncCustom() {
            var p = parseFloat(cdraft.price) || 0;
            root.querySelector('#cu-q').textContent = UI.qtyText(cdraft.qty);
            root.querySelector('#cu-amt').textContent = money(F.amount(cdraft.qty, p));
          }
          root.querySelector('#cu-name').oninput = function (e) { cdraft.name = e.target.value; };
          root.querySelector('#cu-price').oninput = function (e) { cdraft.price = e.target.value; syncCustom(); };
          root.querySelectorAll('[data-cu]').forEach(function (b) {
            b.onclick = function () {
              cdraft.unit = b.getAttribute('data-cu');
              root.querySelectorAll('[data-cu]').forEach(function (x) {
                x.classList.toggle('is-active', x === b);
              });
            };
          });
          root.querySelectorAll('[data-cq]').forEach(function (b) {
            b.onclick = function () {
              cdraft.qty = Math.max(0.1, Math.round((cdraft.qty + parseFloat(b.getAttribute('data-cq')) * 0.5) * 10) / 10);
              syncCustom();
            };
          });

          // ---- 保存按钮：按当前模式分流 ----
          saveBtn.onclick = async function () {
            if (cdraft.mode === 'custom') {
              var name = (cdraft.name || '').trim();
              var price = F.round2(parseFloat(cdraft.price) || 0);
              if (!name) { wx.showToast('请填写菜品名称'); return; }
              if (!(price > 0)) { wx.showToast('请填写单价'); return; }
              try {
                await BIZ.addItemToRecipe(ws(), date, mealType, mName, {
                  ingredientId: '', name: name, unit: cdraft.unit, price: price, qty: cdraft.qty, custom: true
                });
                App.markDirty('recipes');
                close();
                wx.showToast('已加入 ' + name);
                App.rerender();
              } catch (err) {
                wx.showToast((err && err.message) || '加入失败');
              }
            }
          };

          // 点击自定义区域的输入框时也确保切到自定义
          ['cu-name','cu-price'].forEach(function (id) {
            var el = root.querySelector('#' + id);
            if (el) el.onfocus = function () {
              if (cdraft.mode !== 'custom') showCustom();
            };
          });
        }
      });
    });
  }

  /** 修改用量 */
  function openQtyEditor(payload) {
    var p = payload.split('|');
    var date = p[0], mealId = p[1], itemId = p[2], unit = p[4] || '';
    var draft = { qty: parseFloat(p[3]) || 1 };
    UI.sheet({
      title: '修改用量',
      body: '<div class="field"><div class="field-l">用量（' + esc(unit) + '）</div>' +
        '<div class="row-between"><div class="stepper">' +
          '<button class="stepper-btn" data-q="-1">−</button>' +
          '<span class="stepper-val" id="qq">' + UI.qtyText(draft.qty) + '</span>' +
          '<button class="stepper-btn" data-q="1">+</button>' +
        '</div><input class="input input-num" id="qi" type="number" step="0.5" min="0.1" style="width:90px;text-align:center" value="' + UI.qtyText(draft.qty) + '"></div></div>',
      footer: '<button class="btn btn-primary btn-block" data-act="ok">' + icon('check', 'white', 'icon-sm') + '保存用量</button>',
      onMount: function (root, close) {
        var qi = root.querySelector('#qi');
        function sync(v) {
          draft.qty = Math.max(0.1, v);
          root.querySelector('#qq').textContent = UI.qtyText(draft.qty);
          qi.value = UI.qtyText(draft.qty);
        }
        root.querySelectorAll('[data-q]').forEach(function (b) {
          b.onclick = function () { sync(Math.round((draft.qty + parseFloat(b.getAttribute('data-q')) * 0.5) * 10) / 10); };
        });
        qi.oninput = function () { sync(parseFloat(qi.value) || 0.1); };
        root.querySelector('[data-act="ok"]').onclick = async function () {
          await BIZ.updateRecipeItemQty(ws(), date, mealId, itemId, draft.qty);
          App.markDirty('recipes');
          close();
          App.rerender();
        };
      }
    });
  }

  // ==========================================================================
  // 5. 采购清单页
  // ==========================================================================
  var shopping = {
    title: '采购清单',
    tab: 'shopping',
    render: async function (el) {
      var w = ws();
      var cart = await BIZ.getCart(w);
      var items = cart.items;

      var html = '';
      // 汇总卡
      html += '<div class="px" style="padding-top:12px"><div class="card">' +
        '<div class="row-between">' +
          '<div><div class="t-xs muted">本周采购合计</div>' +
            '<div class="amount-lg">' + money(cart.total) + '</div>' +
            '<div class="t-xs muted mt-s">' + items.length + ' 项食材 · 未购 ' + money(cart.uncheckedTotal) + '</div></div>' +
          '<div style="text-align:right">' +
            '<div class="t-xs muted">' + esc(F.weekRangeText(w)) + '</div>' +
            '<button class="btn btn-sm mt" data-act="export">' + icon('export', 'gray', 'icon-sm') + '导出清单</button>' +
          '</div>' +
        '</div>' +
      '</div></div>';

      // 清单
      if (!items.length) {
        html += '<div class="px mt">' + UI.emptyBox({
          icon: 'bag', text: '清单还是空的',
          sub: '清单会从本周食谱自动汇总。先去食谱页把菜排好，这里就会自动出现。',
          actionText: '去排食谱'
        }) + '</div>';
      } else {
        // 按分类分组
        var groups = {};
        items.forEach(function (it) {
          var k = it.category || 'vegetable';
          (groups[k] = groups[k] || []).push(it);
        });
        C.CATEGORIES.forEach(function (cat) {
          var arr = groups[cat.key];
          if (!arr || !arr.length) return;
          var sub = arr.reduce(function (s, i) { return s + (i.amount || 0); }, 0);
          html += '<div class="group-hd"><div class="group-hd-l">' + icon(cat.icon, 'gray', 'icon-sm') +
            esc(cat.name) + '</div><span>' + arr.length + ' 项 · ' + money(sub) + '</span></div>';
          html += '<div class="px"><div class="card" style="padding:0;overflow:hidden">' + arr.map(function (it) {
            return '<div class="cart-row ' + (it.checked ? 'is-checked' : '') + '" data-key="' + esc(it.key) + '">' +
              '<span class="cart-check">' + (it.checked ? icon('check', 'white', 'icon-sm') : '') + '</span>' +
              '<div class="flex-1"><div class="cart-name ing-name ellipsis">' + esc(it.name) + '</div>' +
              '<div class="ing-meta"><span class="num">' + UI.qtyText(it.qty) + esc(it.unit) + '</span><span>×</span>' +
              '<span class="num">¥' + UI.num2(it.price) + '</span>' +
              (it.manual ? '<span class="tag tag-brand">手动</span>' : '') + '</div></div>' +
              '<span class="cart-amt item-amt">' + money(it.amount) + '</span>' +
              (it.manual ? '<button class="btn btn-xs" data-del-manual="' + esc(it.key) + '">' + icon('close', 'gray', 'icon-sm') + '</button>' : '') +
            '</div>';
          }).join('') + '</div></div>';
        });
      }

      // 操作
      html += '<div class="px mt-l"><div class="row gap">' +
        '<button class="btn flex-1" data-act="manual">' + icon('plus', 'gray', 'icon-sm') + '手动加一项</button>' +
        '<button class="btn flex-1" data-act="clear">' + icon('trash', 'gray', 'icon-sm') + '清空勾选</button>' +
      '</div></div>';
      html += '<div class="px mt"><button class="btn btn-primary btn-block" data-act="checkout">' +
        icon('check', 'white', 'icon-sm') + '完成采购 · 记一笔账</button></div>';
      html += '<div class="px mt-l t-xs faint" style="text-align:center">清单从本周食谱自动汇总，同一食材的用量会自动合并</div>';
      html += '<div class="px mt-l" style="height:12px"></div>';

      el.innerHTML = html;
      el.classList.remove('no-pad');

      el.querySelectorAll('.cart-row').forEach(function (row) {
        row.onclick = async function (e) {
          if (e.target.closest('[data-del-manual]')) return;
          await BIZ.toggleCartItem(w, row.getAttribute('data-key'));
          App.rerender();
        };
      });
      el.querySelectorAll('[data-del-manual]').forEach(function (b) {
        b.onclick = async function (e) {
          e.stopPropagation();
          await BIZ.removeManualCartItem(w, b.getAttribute('data-del-manual'));
          App.rerender();
        };
      });
      el.querySelector('[data-act="manual"]').onclick = function () { openManualItem(w); };
      el.querySelector('[data-act="clear"]').onclick = async function () {
        await BIZ.clearCart(w);
        App.rerender();
        wx.showToast('已清空勾选与手动项');
      };
      el.querySelector('[data-act="export"]').onclick = async function () {
        var text = await BIZ.exportCartText(w);
        try {
          await wx.setClipboardData({ data: text });
          wx.showToast('清单已复制到剪贴板');
        } catch (e) { wx.showToast('复制失败，请手动选择'); }
      };
      el.querySelector('[data-act="checkout"]').onclick = async function () {
        var c2 = await BIZ.getCart(w);
        var pending = c2.items.filter(function (i) { return !i.checked; });
        if (!pending.length) { wx.showToast('没有待采购的食材'); return; }
        var total = pending.reduce(function (s, i) { return s + i.amount; }, 0);
        if (!(await wx.showModal({
          title: '完成采购',
          content: '将为 ' + pending.length + ' 项食材记一笔 ' + money(total) + ' 的支出，并清空清单。',
          confirmText: '确认记账'
        })).confirm) return;
        await BIZ.checkoutCart(w, '');
        App.markDirty('records');
        App.rerender();
        wx.showToast('已记账 ' + money(total));
      };
      var ea = el.querySelector('[data-empty-action]');
      if (ea) ea.onclick = function () { App.go('#/recipe'); };
    }
  };

  /** 手动加清单项 */
  function openManualItem(w) {
    var draft = { name: '', qty: 1, price: '', unit: '斤', category: 'vegetable' };
    UI.sheet({
      title: '手动添加采购项',
      body:
        '<div class="field"><div class="field-l">名称 <span class="req">*</span></div>' +
          '<input class="input" id="mi-name" placeholder="如：姜蒜"></div>' +
        '<div class="field"><div class="field-l">分类</div>' +
          '<div class="seg" id="mi-cat">' + C.CATEGORIES.map(function (c) {
            return '<button class="seg-item ' + (c.key === draft.category ? 'is-active' : '') + '" data-v="' + esc(c.key) + '">' + esc(c.name) + '</button>';
          }).join('') + '</div></div>' +
        '<div class="field"><div class="field-l">单价（元）<span class="req">*</span></div>' +
          '<input class="input input-num" id="mi-price" type="number" step="0.01" min="0" placeholder="0.00"></div>' +
        '<div class="field"><div class="field-l">数量</div>' +
          '<div class="row gap-s">' +
            '<input class="input input-num" id="mi-qty" type="number" step="0.5" min="0.1" value="1" style="flex:1">' +
            '<select class="input" id="mi-unit" style="width:84px">' + C.UNITS.map(function (u) {
              return '<option>' + esc(u.name) + '</option>';
            }).join('') + '</select>' +
          '</div></div>',
      footer: '<button class="btn btn-primary btn-block" data-act="ok">' + icon('check', 'white', 'icon-sm') + '加入清单</button>',
      onMount: function (root, close) {
        root.querySelectorAll('#mi-cat [data-v]').forEach(function (b) {
          b.onclick = function () {
            draft.category = b.getAttribute('data-v');
            root.querySelectorAll('#mi-cat [data-v]').forEach(function (x) { x.classList.remove('is-active'); });
            b.classList.add('is-active');
          };
        });
        root.querySelector('[data-act="ok"]').onclick = async function () {
          var name = root.querySelector('#mi-name').value.trim();
          var price = parseFloat(root.querySelector('#mi-price').value);
          var qty = parseFloat(root.querySelector('#mi-qty').value) || 1;
          if (!name) { wx.showToast('请填写名称'); return; }
          if (!(price >= 0)) { wx.showToast('请填写单价'); return; }
          await BIZ.addManualCartItem(w, {
            name: name, qty: qty, price: price,
            unit: root.querySelector('#mi-unit').value,
            category: draft.category, manual: true
          });
          close();
          App.rerender();
          wx.showToast('已加入清单');
        };
      }
    });
  }

  // ==========================================================================
  // 6. 成本统计页（含「我的」）
  // ==========================================================================
  var stats = {
    title: '成本统计',
    tab: 'stats',
    render: async function (el) {
      var w = ws();
      var s = await BIZ.summary(w, F.today());
      var over = s.weekActual > s.budget;

      var html = '';

      // 预算对比
      html += '<div class="px" style="padding-top:12px"><div class="card">' +
        '<div class="card-hd"><div class="card-hd-t">' + icon('wallet', 'brand', 'icon-md') + '本周预算</div>' +
          '<button class="card-hd-a" data-act="budget">' + icon('edit', 'brand', 'icon-sm') + '调整</button></div>' +
        '<div class="row-between" style="align-items:flex-end">' +
          '<div><div class="t-xs muted">实际支出</div>' +
            '<div class="amount-lg' + (over ? ' up' : '') + '"' + (over ? ' style="color:var(--up)"' : '') + '>' + money(s.weekActual) + '</div></div>' +
          '<div style="text-align:right"><div class="t-xs muted">预算</div>' +
            '<div class="num" style="font-size:19px">' + money(s.budget) + '</div></div>' +
        '</div>' +
        '<div class="mt">' + UI.bar(s.weekPercent, over ? 'is-over' : (s.weekPercent > 80 ? 'is-warn' : '')) + '</div>' +
        '<div class="row-between mt-s"><span class="t-xs muted">已用 ' + s.weekPercent + '%</span>' +
          '<span class="t-xs ' + (over ? 'up' : 'muted') + '">' +
            (over ? '超支 ' + money(s.weekActual - s.budget) : '剩余 ' + money(s.weekRemaining)) + '</span></div>' +
      '</div></div>';

      // 关键数字
      html += '<div class="px mt"><div class="stat-grid">' +
        statBox('plan', '本周计划成本', money(s.weekPlan), '按当前市价核算') +
        statBox('calendar', '今日支出', money(s.todayActual), s.todayLabel + ' · 计划 ' + money(s.todayPlan)) +
        statBox('list', '本周记账', s.recordCount + ' 笔', s.weekRangeText) +
        statBox('folder', '食材档案', s.ingredientCount + ' 种', C.REGION) +
      '</div></div>';

      // 按天柱状图
      html += '<div class="px mt-l"><div class="card-hd"><div class="card-hd-t">' + icon('chart', 'brand', 'icon-md') + '每日支出</div>' +
        '<span class="t-xs muted">深色 = 今天</span></div>' +
        '<div class="card">' + UI.bars(s.byDay.map(function (d) {
          return { label: d.label.replace('周', ''), value: d.actual, isToday: d.isToday };
        }), Math.max(s.maxDayValue, 1), '') +
        (s.weekActual <= 0 ? '<div class="t-xs muted" style="text-align:center;padding-top:8px">还没有记账 · 采购清单结算后会显示在这里</div>' : '') +
        '</div></div>';

      // 计划 vs 实际
      html += '<div class="px mt-l"><div class="card-hd"><div class="card-hd-t">' + icon('trend-up', 'brand', 'icon-md') + '每日计划成本</div></div>' +
        '<div class="card">' + UI.bars(s.byDay.map(function (d) {
          return { label: d.label.replace('周', ''), value: d.plan, isToday: d.isToday };
        }), Math.max(s.maxDayValue, 1), '') + '</div></div>';

      // 分类占比
      html += '<div class="px mt-l"><div class="card-hd"><div class="card-hd-t">' + icon('pie', 'brand', 'icon-md') + '分类情况</div></div>' +
        '<div class="card">' + s.catStats.map(function (c) {
          var pct = s.ingredientCount ? Math.round(c.count / s.ingredientCount * 100) : 0;
          return '<div class="share-row">' +
            '<span class="share-name">' + esc(c.name) + '</span>' +
            '<span class="share-track"><span class="share-fill" style="width:' + pct + '%;background:' + esc(c.color) + '"></span></span>' +
            '<span class="share-val"><span class="num">' + c.count + '</span><span class="muted t-xs"> 种</span></span>' +
          '</div>';
        }).join('') +
        (s.catStats.some(function (c) { return c.spent > 0; })
          ? '<div class="mt" style="border-top:1px dashed var(--line);padding-top:8px">' + s.catStats.map(function (c) {
              return '<div class="detail-row"><span>' + esc(c.name) + '</span>' +
                '<span class="num" style="color:var(--price)">' + money(c.spent) + '</span></div>';
            }).join('') + '</div>'
          : '') +
        '</div></div>';

      // 近 6 周趋势
      html += '<div class="px mt-l"><div class="card-hd"><div class="card-hd-t">' + icon('trend-up', 'brand', 'icon-md') + '近 6 周趋势</div></div>' +
        '<div class="card">' + UI.bars(s.trend.map(function (t) {
          return { label: t.label, value: t.amount, isToday: t.isCurrent };
        }), Math.max(s.maxTrend, 1), '') + '</div></div>';

      // 消费明细
      html += '<div class="px mt-l"><div class="card-hd"><div class="card-hd-t">' + icon('doc', 'brand', 'icon-md') + '本周消费明细</div>' +
        '<button class="card-hd-a" data-go="#/records">全部记录' + icon('chev-right', 'brand', 'icon-sm') + '</button></div>' +
        '<div class="card">' +
          (s.detail.length
            ? s.detail.slice(0, 20).map(function (d) {
                return '<div class="detail-row">' +
                  '<div class="flex-1"><div class="t-sm ellipsis">' + esc(d.name) + '</div>' +
                  '<div class="t-xs muted">' + esc(d.dateText || '') + ' · ' + UI.qtyText(d.qty) + esc(d.unit) + ' × ¥' + UI.num2(d.price) + '</div></div>' +
                  '<span class="num" style="color:var(--price)">' + money(d.amount) + '</span>' +
                '</div>';
              }).join('')
            : UI.emptyBox({ icon: 'doc', text: '本周还没有消费记录', sub: '在采购清单页点「完成采购」就会生成记录' })) +
        '</div></div>';

      // ---- 我的
      var ctx = BIZ.getCtx();
      html += '<div class="px mt-l"><div class="card-hd"><div class="card-hd-t">' + icon('user', 'brand', 'icon-md') + '我的</div></div>' +
        '<div class="card">' +
          '<div class="row gap">' +
            '<span class="icon-fill" style="width:46px;height:46px;border-radius:50%;background:var(--brand-l)">' + icon('user', 'brand', 'icon-lg') + '</span>' +
            '<div class="flex-1"><div class="t-md">纸坊用户</div>' +
              '<div class="t-xs muted">' + esc(C.REGION) + ' · ' +
                (ctx.mode === 'shared' ? '家庭码云端同步' : (ctx.mode === 'cloud' ? '云端同步' : '本机存储（演示模式）')) + '</div></div>' +
          '</div>' +
          '<div class="detail-row mt"><span>' + icon('wallet', 'gray', 'icon-sm') + ' 每周预算</span>' +
            '<button class="btn btn-xs" data-act="budget">' + money(s.budget) + ' ' + icon('chev-right', 'gray', 'icon-sm') + '</button></div>' +
          '<div class="detail-row"><span>' + icon('shop', 'gray', 'icon-sm') + ' 目标市场</span><span class="muted t-sm">' + esc(C.MARKET_NAME) + '</span></div>' +
          '<div class="detail-row"><span>' + icon('folder', 'gray', 'icon-sm') + ' 食材档案</span><span class="muted t-sm">' + s.ingredientCount + ' 种</span></div>' +
        '</div>' +

        // ---- 多设备同步（家庭码房间）----
        (function () {
          var syncOn = DB.syncEnabled();
          var fam = DB.familyCode();
          var st = DB.syncStatus();
          if (!syncOn) {
            return '<div class="card mt">' +
              '<div class="card-hd-t mb">' + icon('share', 'brand', 'icon-md') + '多设备同步</div>' +
              '<div class="t-xs muted">未开启。配置云端数据库后，同一家庭码下的手机 / 电脑 / 平板即可共享同一份账本，一端改动另一端可见。</div>' +
              '<div class="t-xs faint mt-s">配置步骤见项目 docs/supabase-setup.md</div>' +
              '</div>';
          }
          return '<div class="card mt">' +
            '<div class="card-hd-t mb">' + icon('share', 'brand', 'icon-md') + '多设备同步</div>' +
            '<div class="t-xs muted">手机、电脑、平板填入同一个家庭码，账本即实时互通。</div>' +
            '<div class="sync-code-box mt">' +
              '<div class="t-xs muted">本机家庭码</div>' +
              '<div class="row gap-s mt-s">' +
                '<span class="sync-code">' + esc(fam) + '</span>' +
                '<button class="btn btn-xs" data-act="copy-fam">复制</button>' +
              '</div>' +
            '</div>' +
            '<div class="row gap-s mt">' +
              '<input class="input flex-1" id="fam-in" placeholder="输入家人的家庭码" maxlength="12">' +
              '<button class="btn btn-sm btn-primary" data-act="join-fam">加入</button>' +
            '</div>' +
            '<div class="row gap-s mt-s">' +
              '<button class="btn btn-sm flex-1" data-act="sync-now">' + icon('refresh', 'gray', 'icon-sm') + '立即同步</button>' +
              '<button class="btn btn-sm flex-1" data-act="new-fam">' + icon('plus', 'gray', 'icon-sm') + '新建家庭码</button>' +
            '</div>' +
            '<div class="t-xs faint mt-s" id="sync-tip">' +
              (st.lastServerUpdatedAt ? '云端最新改动：' + esc(st.lastServerUpdatedAt.replace('T', ' ').slice(0, 19)) : '尚未同步，点「立即同步」开始') +
            '</div>' +
            '</div>';
        })() +

        '<div class="card mt">' +
          '<div class="card-hd-t mb">' + icon('settings', 'gray', 'icon-md') + '数据管理</div>' +
          '<button class="btn btn-block btn-sm" data-act="sample">' + icon('star', 'gray', 'icon-sm') + '载入示例数据（看效果）</button>' +
          '<button class="btn btn-block btn-sm mt-s" data-act="reset-price">' + icon('refresh', 'gray', 'icon-sm') + '重置为纸坊参考价</button>' +
          '<button class="btn btn-block btn-sm mt-s btn-danger" data-act="reset-all">' + icon('trash', 'danger', 'icon-sm') + '清空全部数据（重新演示）</button>' +
        '</div>' +
      '</div>';

      html += '<div class="px mt-l" style="text-align:center">' +
        '<div class="t-xs faint">' + esc(C.APP_NAME) + ' · ' + esc(C.REGION) + '</div>' +
        '<div class="t-xs faint mt-s">' +
          (DB.syncEnabled()
            ? '家庭码同步已开启 · 同一家庭码设备数据互通'
            : '本机存储模式 · 换设备不会同步') +
        '</div></div>';
      html += '<div class="px mt-l" style="height:14px"></div>';

      el.innerHTML = html;
      el.classList.remove('no-pad');

      el.querySelectorAll('[data-act="budget"]').forEach(function (b) { b.onclick = openBudget; });
      el.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { App.go(b.getAttribute('data-go')); }; });
      el.querySelector('[data-act="sample"]').onclick = async function () {
        if (!(await wx.showModal({
          title: '载入示例数据',
          content: '会为本周排入一套示例菜单（蔬菜 + 肉禽蛋 + 水产），并生成 2 条示例采购记录，方便你快速看到完整效果。随时可以在下方「清空全部数据」还原。'
        })).confirm) return;
        wx.showLoading('正在生成…');
        var res = await loadSampleData();
        App.rerender();
        wx.showToast('已生成 ' + res.dishes + ' 道菜、' + res.records + ' 条记录');
      };
      el.querySelector('[data-act="reset-price"]').onclick = async function () {
        if (!(await wx.showModal({ title: '重置为纸坊参考价', content: '会把所有食材价格改回初始参考价，并记录一条价格变动。' })).confirm) return;
        var n = await BIZ.resetToSeedPrices();
        App.markDirty('ingredients');
        App.rerender();
        wx.showToast(n ? '已重置，' + n + ' 项价格变动' : '价格本来就是参考价');
      };
      el.querySelector('[data-act="reset-all"]').onclick = async function () {
        if (!(await wx.showModal({ title: '清空全部数据', content: '食材、食谱、清单、消费记录都会删除，并重新灌入纸坊参考价。此操作不可撤销。', confirmText: '确认清空' })).confirm) return;
        await DB.resetLocalAll();
        await BIZ.init(true);
        App.rerender();
        wx.showToast('已重置为初始演示数据');
      };

      // ---- 多设备同步 ----
      var copyFam = el.querySelector('[data-act="copy-fam"]');
      if (copyFam) copyFam.onclick = function () {
        var code = DB.familyCode();
        var done = function () { wx.showToast('家庭码已复制'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(done, function () { fallbackCopy(code, done); });
        } else fallbackCopy(code, done);
      };
      var joinFam = el.querySelector('[data-act="join-fam"]');
      if (joinFam) joinFam.onclick = async function () {
        var inp = el.querySelector('#fam-in');
        var code = DB.joinFamily((inp && inp.value) || '');
        if (!code) { wx.showToast('家庭码格式不对，应为 6 位字母数字'); return; }
        if (inp) inp.value = '';
        wx.showLoading('正在切换家庭码…');
        try {
          await DB.pullLatest();
          await BIZ.init(true);
          App.markDirty('recipes');
          App.markDirty('ingredients');
          App.markDirty('records');
          App.rerender();
          wx.showToast('已加入 ' + code);
        } catch (e) {
          wx.showToast((e && e.message) || '切换失败');
        }
      };
      var newFam = el.querySelector('[data-act="new-fam"]');
      if (newFam) newFam.onclick = async function () {
        if (!(await wx.showModal({
          title: '新建家庭码',
          content: '会生成一个新家庭码并切换到新房间。当前房间的数据仍留在云端，用原家庭码随时可以切回来。'
        })).confirm) return;
        var code = DB.newFamily();
        await DB.pullLatest();
        await BIZ.init(true);
        App.rerender();
        wx.showToast('新家庭码 ' + code);
      };
      var syncNow = el.querySelector('[data-act="sync-now"]');
      if (syncNow) syncNow.onclick = async function () {
        wx.showLoading('同步中…');
        try {
          var r = await DB.pullLatest();
          App.rerender();
          wx.showToast(r.changed ? '已同步，有新改动' : '已是最新');
        } catch (e) {
          wx.showToast((e && e.message) || '同步失败');
        }
      };
    }
  };

  /** 复制兜底：剪贴板 API 不可用时用临时 textarea + execCommand */
  function fallbackCopy(text, done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) { /* ignore */ }
    if (done) done();
  }

  /**
   * 载入示例数据：为本周已过去的日子排一套菜单，并补两条采购记录。
   * 仅在用户主动点击时执行，不会自动创建任何数据。
   */
  async function loadSampleData() {
    var r = await BIZ.listIngredients({});
    var by = { vegetable: [], meat: [], aquatic: [], fruit: [] };
    r.items.forEach(function (i) { if (by[i.category]) by[i.category].push(i); });
    function g(cat, n) {
      var a = by[cat] || [];
      return a.length ? a[n % a.length] : null;
    }

    var today = F.today();
    var w = F.weekStart(today);
    var days = F.weekDays(w).filter(function (d) { return d <= today; });
    if (!days.length) days = [today];

    // 三套菜单模板轮换，保证四大分类都有覆盖
    var templates = [
      { lunch: [[g('vegetable', 0), 1.5], [g('vegetable', 4), 1], [g('meat', 0), 0.8]],
        dinner: [[g('vegetable', 2), 1], [g('aquatic', 0), 1.2], [g('meat', 3), 0.5]] },
      { lunch: [[g('vegetable', 5), 1], [g('meat', 1), 0.6], [g('vegetable', 7), 1.2]],
        dinner: [[g('vegetable', 9), 1.5], [g('aquatic', 2), 1], [g('meat', 4), 0.7]] },
      { lunch: [[g('vegetable', 3), 1.2], [g('vegetable', 6), 1], [g('aquatic', 1), 0.9]],
        dinner: [[g('vegetable', 8), 1], [g('meat', 2), 0.8], [g('vegetable', 10), 1]] }
    ];

    var dishes = 0;
    for (var i = 0; i < days.length; i++) {
      var t = templates[i % templates.length];
      var meals = [['lunch', '午餐', t.lunch], ['dinner', '晚餐', t.dinner]];
      for (var m = 0; m < meals.length; m++) {
        var arr = meals[m][2];
        for (var k = 0; k < arr.length; k++) {
          if (!arr[k] || !arr[k][0]) continue;
          await BIZ.addItemToRecipe(w, days[i], meals[m][0], meals[m][1],
            { ingredientId: arr[k][0]._id, qty: arr[k][1] });
          dishes++;
        }
      }
    }

    // 为最早的两天补采购记录（金额按当前市价算）
    var recCount = 0;
    for (var j = 0; j < Math.min(2, days.length); j++) {
      var t2 = templates[j % templates.length];
      var items = [];
      t2.lunch.concat(t2.dinner).forEach(function (pair) {
        if (!pair || !pair[0]) return;
        items.push({ name: pair[0].name, unit: pair[0].unit, price: pair[0].price, qty: pair[1], category: pair[0].category });
      });
      if (!items.length) continue;
      await BIZ.addManualRecord({
        title: F.cnDate(days[j]) + ' 采购',
        date: days[j], weekStart: w, items: items, note: '示例数据'
      });
      recCount++;
    }
    return { dishes: dishes, records: recCount };
  }

  function statBox(ic, label, value, sub) {
    return '<div class="stat-box">' +
      '<div class="stat-box-l">' + icon(ic, 'gray', 'icon-sm') + esc(label) + '</div>' +
      '<div class="stat-box-v">' + esc(value) + '</div>' +
      '<div class="stat-box-s ellipsis">' + esc(sub) + '</div>' +
    '</div>';
  }

  function openBudget() {
    var cur = BIZ.budget();
    UI.sheet({
      title: '设置每周预算',
      body: '<div class="field"><div class="field-l">每周饮食预算（元）</div>' +
          '<input class="input input-num" id="bg" type="number" step="10" min="0" value="' + cur + '"></div>' +
        '<div class="field"><div class="field-l">快速选择</div>' +
          '<div class="row wrap gap-s">' + [200, 300, 400, 500, 600, 800].map(function (v) {
            return '<button class="chip" data-v="' + v + '" style="height:32px">¥' + v + '</button>';
          }).join('') + '</div></div>',
      footer: '<button class="btn btn-primary btn-block" data-act="ok">' + icon('check', 'white', 'icon-sm') + '保存预算</button>',
      onMount: function (root, close) {
        root.querySelectorAll('[data-v]').forEach(function (b) {
          b.onclick = function () { root.querySelector('#bg').value = b.getAttribute('data-v'); };
        });
        root.querySelector('[data-act="ok"]').onclick = async function () {
          var v = parseFloat(root.querySelector('#bg').value);
          if (!(v >= 0)) { wx.showToast('请填写正确金额'); return; }
          await BIZ.setBudget(v);
          close();
          App.rerender();
          wx.showToast('预算已更新');
        };
      }
    });
  }

  // ==========================================================================
  // 7. 消费记录页
  // ==========================================================================
  var records = {
    title: '消费记录',
    tab: 'stats',
    back: true,
    render: async function (el) {
      var html = '<div class="tabs">' +
        '<button class="tabs-item ' + (S.recordTab === 'purchase' ? 'is-active' : '') + '" data-tab="purchase">采购记录</button>' +
        '<button class="tabs-item ' + (S.recordTab === 'recipe' ? 'is-active' : '') + '" data-tab="recipe">历史食谱成本</button>' +
      '</div>';

      if (S.recordTab === 'purchase') {
        html += '<div class="px mt"><button class="btn btn-block btn-primary" data-act="spend">' +
          icon('plus', 'white', 'icon-sm') + '记一笔（填金额 + 选种类）</button></div>';
        var list = await BIZ.listRecords(60);
        var total = list.reduce(function (s, r) { return s + (r.totalAmount || 0); }, 0);
        html += '<div class="px mt"><div class="stat-grid">' +
          statBox('doc', '记录条数', list.length + ' 条', '按日期倒序') +
          statBox('wallet', '累计支出', money(total), '全部采购记录') +
        '</div></div>';

        if (!list.length) {
          html += '<div class="px mt">' + UI.emptyBox({
            icon: 'doc', text: '还没有消费记录',
            sub: '点上方「记一笔」直接记，或在采购清单页完成采购自动生成',
            actionText: '去采购清单'
          }) + '</div>';
        } else {
          html += '<div class="px mt">' + list.map(function (r) {
            var open = S.openRecordId === r._id;
            var isDaily = r.type === 'daily';
            return '<div class="card" style="margin-bottom:9px">' +
              '<div class="row-between" data-toggle="' + esc(r._id) + '">' +
                '<div class="flex-1"><div class="t-md ellipsis">' + esc(r.title || '采购') + '</div>' +
                  '<div class="t-xs muted mt-s">' + esc(r.dateText || r.date || '') +
                  (isDaily ? ' · 每日消费' : ' · ' + (r.itemCount || 0) + ' 项') +
                  (r.note ? ' · ' + esc(r.note) : '') + '</div></div>' +
                '<div style="text-align:right"><div class="amount-md">' + money(r.totalAmount) + '</div>' +
                  '<div class="t-xs muted">' + (open ? '收起' : '展开') + '</div></div>' +
              '</div>' +
              (open
                ? '<div class="mt" style="border-top:1px dashed var(--line);padding-top:6px">' +
                    (r.items || []).map(function (it) {
                      // 直接金额条目（每日消费）没有数量与单价，只显示种类
                      var direct = !(Number(it.qty) > 0);
                      return '<div class="detail-row"><span class="ellipsis">' + esc(it.name) + '</span>' +
                        '<span><span class="muted t-xs">' +
                        (direct ? esc(it.category || '消费')
                                : UI.qtyText(it.qty) + esc(it.unit) + ' × ¥' + UI.num2(it.price)) +
                        '</span> ' +
                        '<span class="num" style="color:var(--price)">' + money(it.amount) + '</span></span></div>';
                    }).join('') +
                    '<button class="btn btn-sm btn-danger mt" data-del-rec="' + esc(r._id) + '">' +
                      icon('trash', 'danger', 'icon-sm') + '删除这条记录</button>' +
                  '</div>'
                : '') +
            '</div>';
          }).join('') + '</div>';
        }
      } else {
        var recs = await BIZ.listRecipes(30);
        var have = recs.filter(function (r) { return (r.totalAmount || 0) > 0; });
        html += '<div class="px mt"><div class="stat-grid">' +
          statBox('book', '食谱周数', have.length + ' 周', '含菜品成本的周') +
          statBox('wallet', '累计计划成本', money(have.reduce(function (s, r) { return s + (r.totalAmount || 0); }, 0)), '按当前市价重算') +
        '</div></div>';

        if (!have.length) {
          html += '<div class="px mt">' + UI.emptyBox({
            icon: 'book', text: '还没有食谱记录', sub: '去食谱页排一周菜单，这里会留下成本归档',
            actionText: '去食谱页'
          }) + '</div>';
        } else {
          html += '<div class="px mt"><div class="card" style="padding:4px 14px">' + have.map(function (r) {
            return '<div class="detail-row" data-week="' + esc(r.weekStart) + '">' +
              '<div><div class="t-sm">' + esc(F.weekRangeText(r.weekStart)) + '</div>' +
              '<div class="t-xs muted">' + (r.itemCount || 0) + ' 条食材安排</div></div>' +
              '<div style="text-align:right"><div class="num" style="color:var(--price);font-size:15px">' + money(r.totalAmount) + '</div>' +
              '<div class="t-xs muted">计划成本</div></div>' +
            '</div>';
          }).join('') + '</div></div>';
        }
      }

      html += '<div class="px mt-l" style="height:12px"></div>';
      el.innerHTML = html;
      el.classList.remove('no-pad');

      el.querySelectorAll('[data-tab]').forEach(function (b) {
        b.onclick = function () { S.recordTab = b.getAttribute('data-tab'); App.rerender(); };
      });
      el.querySelectorAll('[data-toggle]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-toggle');
          S.openRecordId = S.openRecordId === id ? '' : id;
          App.rerender();
        };
      });
      el.querySelectorAll('[data-del-rec]').forEach(function (b) {
        b.onclick = async function (e) {
          e.stopPropagation();
          if (!(await wx.showModal({ title: '删除记录', content: '删除后统计里的支出也会同步减少。' })).confirm) return;
          await BIZ.removeRecord(b.getAttribute('data-del-rec'));
          App.markDirty('records');
          App.rerender();
          wx.showToast('已删除');
        };
      });
      el.querySelectorAll('[data-week]').forEach(function (b) {
        b.onclick = function () {
          S.week = b.getAttribute('data-week');
          S.recipeView = 'week';
          App.go('#/recipe');
        };
      });
      var ea = el.querySelector('[data-empty-action]');
      if (ea) ea.onclick = function () { App.go(S.recordTab === 'purchase' ? '#/shopping' : '#/recipe'); };
      var sb = el.querySelector('[data-act="spend"]');
      if (sb) sb.onclick = openSpend;
    }
  };

  // ------------------------------------------------------------------
  // 记一笔（每日消费）：金额 + 种类 + 归属日期 + 可选备注
  // ------------------------------------------------------------------
  function openSpend() {
    var today = F.today();
    var picked = { category: '餐饮' };

    var quickDates = [
      { v: today, label: '今天' },
      { v: F.addDays(today, -1), label: '昨天' },
      { v: F.addDays(today, -2), label: '前天' }
    ];

    var catChips = C.SPEND_CATEGORIES.map(function (c) {
      return '<button class="chip' + (c.key === picked.category ? ' is-active' : '') +
        '" data-cat="' + esc(c.key) + '">' + icon(c.icon, c.iconColor, 'icon-sm') + esc(c.name) + '</button>';
    }).join('');

    var dateChips = quickDates.map(function (d) {
      return '<button class="chip' + (d.v === today ? ' is-active' : '') +
        '" data-date="' + d.v + '">' + d.label + '</button>';
    }).join('');

    UI.sheet({
      title: '记一笔',
      tall: true,
      body:
        '<div class="sp-amt">' +
          '<span class="sp-amt-sym">¥</span>' +
          '<input class="sp-amt-in" type="text" inputmode="decimal" placeholder="0.00" data-f="amount" />' +
        '</div>' +
        '<div class="sp-lb">种类</div>' +
        '<div class="chip-wrap">' + catChips + '</div>' +
        '<input class="sp-in" data-f="custom" placeholder="也可以自己输一个种类，比如「宠物」" />' +
        '<div class="sp-lb">日期</div>' +
        '<div class="chip-row">' + dateChips + '</div>' +
        '<input class="sp-in" type="date" value="' + today + '" max="' + today + '" data-f="date" />' +
        '<div class="sp-hint" data-hint>这笔消费会记到 ' + today + '</div>' +
        '<div class="sp-lb">备注（可选）</div>' +
        '<input class="sp-in" data-f="note" placeholder="比如：和同事聚餐" />',
      footer: '<button class="btn btn-block btn-primary" data-act="save">保存这笔消费</button>',
      onMount: function (root, close) {
        var q = function (s) { return root.querySelector(s); };
        var amountIn = q('[data-f="amount"]');
        var customIn = q('[data-f="custom"]');
        var dateIn = q('[data-f="date"]');
        var noteIn = q('[data-f="note"]');
        var hint = q('[data-hint]');

        setTimeout(function () { if (amountIn) amountIn.focus(); }, 150);

        // 预设种类
        root.querySelectorAll('[data-cat]').forEach(function (b) {
          b.onclick = function () {
            picked.category = b.getAttribute('data-cat');
            if (customIn) customIn.value = '';
            root.querySelectorAll('[data-cat]').forEach(function (x) { x.classList.remove('is-active'); });
            b.classList.add('is-active');
          };
        });

        // 自定义种类：一旦输入，预设高亮让位
        if (customIn) {
          customIn.oninput = function () {
            root.querySelectorAll('[data-cat]').forEach(function (x) {
              x.classList.toggle('is-active', !customIn.value && x.getAttribute('data-cat') === picked.category);
            });
          };
        }

        // 快捷日期
        root.querySelectorAll('[data-date]').forEach(function (b) {
          b.onclick = function () {
            var v = b.getAttribute('data-date');
            if (dateIn) dateIn.value = v;
            if (hint) hint.textContent = '这笔消费会记到 ' + v;
            root.querySelectorAll('[data-date]').forEach(function (x) { x.classList.remove('is-active'); });
            b.classList.add('is-active');
          };
        });

        // 手动选日期
        if (dateIn) {
          dateIn.onchange = function () {
            if (hint) hint.textContent = '这笔消费会记到 ' + dateIn.value;
            root.querySelectorAll('[data-date]').forEach(function (x) {
              x.classList.toggle('is-active', x.getAttribute('data-date') === dateIn.value);
            });
          };
        }

        // 保存
        var saveBtn = q('[data-act="save"]');
        if (saveBtn) {
          saveBtn.onclick = async function () {
            var amount = Number(amountIn ? amountIn.value : 0);
            if (!(amount > 0)) {
              wx.showToast('请输入金额');
              if (amountIn) amountIn.focus();
              return;
            }
            var category = (customIn && customIn.value.trim()) || picked.category;
            try {
              await BIZ.addSpendRecord({
                date: (dateIn && dateIn.value) || today,
                category: category,
                amount: amount,
                note: (noteIn && noteIn.value) || ''
              });
              close();
              App.markDirty('records');
              App.rerender();
              wx.showToast('已记 ' + category + ' ¥' + F.money(amount));
            } catch (err) {
              wx.showToast((err && err.message) || '保存失败');
            }
          };
        }
      }
    });
  }

  // ==========================================================================
  // 隐私政策页（#/privacy）
  // ==========================================================================
  var privacyPage = {
    title: '隐私政策',
    back: true,
    render: function (el) {
      var T = window.FFM.privacyText || { title: '隐私政策', sections: [] };
      el.innerHTML =
        '<div class="pp">' +
        '<div class="pp-title">' + esc(T.title) + '</div>' +
        '<div class="pp-update">最近更新：2026-10-15</div>' +
        T.sections.map(function (sec) {
          return '<div class="pp-h">' + esc(sec.h) + '</div>' +
            sec.p.map(function (para) { return '<div class="pp-p">' + esc(para) + '</div>'; }).join('');
        }).join('') +
        '<div class="pp-foot">如对本政策有疑问，可通过应用内反馈联系我们。</div>' +
        '</div>';
    }
  };

  // ==========================================================================
  FFM.pages = {
    routes: {
      '#/index': index,
      '#/category': category,
      '#/ingredient': ingredient,
      '#/recipe': recipe,
      '#/shopping': shopping,
      '#/stats': stats,
      '#/records': records,
      '#/privacy': privacyPage
    },
    state: S,
    catOf: catOf,
    loadSampleData: loadSampleData
  };
})();
