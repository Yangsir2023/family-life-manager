/* -------------------------------------------------------------------------- */
/* 由 tools/build-web.js 从小程序源码自动生成，请勿直接编辑。                    */
/* 源文件：miniprogram/utils/biz.js                                        */
/* -------------------------------------------------------------------------- */
(function () {
"use strict";
window.FFM = window.FFM || {};

/**
 * 业务服务层：食材档案、历史价格、食谱、采购清单、消费记录、成本统计
 * 页面只与本文件交互，不直接碰数据库细节。
 */
const db = window.FFM.db;
const F = window.FFM.format;
const C = window.FFM.constants;
const SEED_DATA = window.FFM.seedData;

const COL = C.COLLECTIONS;

// 模块级缓存上下文
const ctx = {
  mode: 'local',
  openid: '',
  user: null,
  seeded: false,
  ready: false,
  error: ''
};

// ============================================================================
// 启动
// ============================================================================
async function init(force) {
  if (ctx.ready && !force) return ctx;
  const r = await db.init(force);
  ctx.mode = r.mode;
  ctx.openid = r.openid;
  ctx.error = r.error || '';

  if (ctx.mode === 'cloud') {
    ctx.user = r.user || null;
    if (!ctx.user) ctx.user = await ensureUserCloud();
  } else {
    ctx.user = await ensureUserLocal();
  }
  ctx.seeded = (await db.count(COL.ingredients, { _openid: ctx.openid })) > 0;
  if (!ctx.seeded) {
    await seedIngredients();
    ctx.seeded = true;
  }
  ctx.ready = true;
  return ctx;
}

function getCtx() {
  return ctx;
}

function budget() {
  const b = ctx.user && Number(ctx.user.weeklyBudget);
  return b > 0 ? b : C.DEFAULT_BUDGET;
}

// ---------------------------------------------------------------- 用户
async function ensureUserCloud() {
  const found = await db.listAll(COL.users, { where: { _openid: ctx.openid }, limit: 1 });
  if (found.length) return found[0];
  const doc = {
    nickname: '纸坊掌勺人',
    avatar: '',
    weeklyBudget: C.DEFAULT_BUDGET,
    region: C.REGION,
    createdAt: new Date().toISOString()
  };
  const id = await db.add(COL.users, doc);
  return Object.assign({ _id: id, _openid: ctx.openid }, doc);
}

async function ensureUserLocal() {
  const found = await db.listAll(COL.users, { where: { _openid: ctx.openid }, limit: 1 });
  if (found.length) return found[0];
  const doc = {
    nickname: '纸坊掌勺人',
    avatar: '',
    weeklyBudget: C.DEFAULT_BUDGET,
    region: C.REGION
  };
  const id = await db.add(COL.users, doc);
  return Object.assign({ _id: id, _openid: ctx.openid }, doc);
}

async function saveProfile(patch) {
  const u = ctx.user || {};
  if (u._id) {
    await db.update(COL.users, u._id, patch);
    ctx.user = Object.assign({}, u, patch);
  } else {
    const id = await db.add(COL.users, Object.assign({ nickname: '', avatar: '' }, patch));
    ctx.user = Object.assign({ _id: id }, patch);
  }
  return ctx.user;
}

async function setBudget(amount) {
  const v = Math.max(0, F.round2(amount));
  return saveProfile({ weeklyBudget: v });
}

// ============================================================================
// 种子数据：初始化纸坊菜市场物价库
// ============================================================================
function buildSeedDocs() {
  const today = F.today();
  const list = [];
  const logs = [];
  SEED_DATA.forEach(function (s, i) {
    const id = 'ing_' + (1000 + i);
    list.push({
      _id: id,
      _openid: ctx.openid,
      name: s.name,
      category: s.category,
      unit: s.unit,
      price: s.price,
      shop: s.shop || C.MARKET_NAME,
      spec: s.spec || '',
      image: '',
      note: '',
      isSeed: true,
      createdAt: new Date().toISOString()
    });
    // 生成近 4 周的价格历史，让「历史价格波动」有真实曲线
    for (let k = 3; k >= 0; k--) {
      const d = F.addDays(today, -k * 7);
      const wave = [1.0, 1.06, 0.94, 1.03][(i + k) % 4];
      const price = k === 0 ? s.price : F.round2(s.price * wave);
      logs.push({
        _id: 'log_' + (1000 + i) + '_' + k,
        _openid: ctx.openid,
        ingredientId: id,
        name: s.name,
        category: s.category,
        unit: s.unit,
        price: price,
        shop: s.shop || C.MARKET_NAME,
        recordedAt: d,
        source: 'seed'
      });
    }
  });
  return { list: list, logs: logs };
}

async function seedIngredients() {
  const built = buildSeedDocs();
  if (ctx.mode === 'cloud') {
    const res = await wx.cloud.callFunction({ name: 'seed', data: {} });
    const r = (res && res.result) || {};
    if (!r.ok) throw new Error(r.message || '云端初始化物价库失败');
    return true;
  }
  await db.bulkAdd(COL.ingredients, built.list);
  await db.bulkAdd(COL.priceLogs, built.logs);
  return true;
}

/** 手动重置为纸坊菜市场参考价（覆盖当前价格并写入历史） */
async function resetToSeedPrices() {
  const built = buildSeedDocs();
  const today = F.today();
  const existing = await db.listAll(COL.ingredients, { where: { _openid: ctx.openid } });
  const logs = [];
  for (let i = 0; i < built.list.length; i++) {
    const s = built.list[i];
    const hit = existing.filter(function (e) { return e.name === s.name; })[0];
    if (hit) {
      if (F.round2(hit.price) !== F.round2(s.price)) {
        logs.push({
          _openid: ctx.openid,
          ingredientId: hit._id,
          name: hit.name,
          category: hit.category,
          unit: hit.unit,
          price: s.price,
          shop: s.shop,
          recordedAt: today,
          source: 'reset'
        });
      }
      await db.update(COL.ingredients, hit._id, { price: s.price, shop: s.shop, spec: s.spec });
    } else {
      await db.add(COL.ingredients, s);
    }
  }
  if (logs.length) await db.bulkAdd(COL.priceLogs, logs);
  ctx.seeded = true;
  return logs.length;
}

// ============================================================================
// 食材档案
// ============================================================================
async function listIngredients(opts) {
  const o = opts || {};
  const where = { _openid: ctx.openid };
  if (o.category) where.category = o.category;
  let arr = await db.listAll(COL.ingredients, { where: where, max: 1000 });
  if (o.keyword) {
    const kw = String(o.keyword).trim();
    if (kw) arr = arr.filter(function (d) { return d.name.indexOf(kw) >= 0; });
  }
  const byId = {};
  arr.forEach(function (d) { byId[d._id] = d; });
  if (o.orderBy === 'price') {
    arr.sort(function (a, b) { return a.price - b.price; });
  } else if (o.orderBy === 'priceDesc') {
    arr.sort(function (a, b) { return b.price - a.price; });
  } else {
    arr.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN'); });
  }
  return { items: arr, byId: byId };
}

async function ingredientMap() {
  const r = await listIngredients({});
  return r.byId;
}

async function getIngredient(id) {
  return db.get(COL.ingredients, id);
}

async function saveIngredient(data, id) {
  const payload = {
    name: String(data.name || '').trim(),
    category: data.category,
    unit: data.unit || '斤',
    price: F.round2(data.price),
    shop: data.shop || C.MARKET_NAME,
    spec: data.spec || '',
    image: data.image || '',
    note: data.note || ''
  };
  if (!payload.name) throw new Error('请填写食材名称');
  if (!(payload.price > 0)) throw new Error('请填写正确的单价');

  if (id) {
    const old = await db.get(COL.ingredients, id);
    await db.update(COL.ingredients, id, payload);
    if (old && F.round2(old.price) !== payload.price) {
      await db.add(COL.priceLogs, {
        ingredientId: id,
        name: payload.name,
        category: payload.category,
        unit: payload.unit,
        price: payload.price,
        prevPrice: old.price,
        shop: payload.shop,
        recordedAt: F.today(),
        source: 'edit'
      });
    }
    return id;
  }
  const newId = await db.add(COL.ingredients, payload);
  await db.add(COL.priceLogs, {
    ingredientId: newId,
    name: payload.name,
    category: payload.category,
    unit: payload.unit,
    price: payload.price,
    shop: payload.shop,
    recordedAt: F.today(),
    source: 'create'
  });
  return newId;
}

async function removeIngredient(id) {
  await db.remove(COL.ingredients, id);
  const logs = await db.listAll(COL.priceLogs, { where: { _openid: ctx.openid, ingredientId: id } });
  for (let i = 0; i < logs.length; i++) {
    await db.remove(COL.priceLogs, logs[i]._id);
  }
  return true;
}

/** 更新售价并留存历史价格 */
async function updatePrice(id, price, shop, note) {
  const old = await db.get(COL.ingredients, id);
  if (!old) throw new Error('食材不存在');
  const p = F.round2(price);
  if (!(p > 0)) throw new Error('请输入正确的价格');
  await db.update(COL.ingredients, id, { price: p, shop: shop || old.shop, note: note || old.note });
  await db.add(COL.priceLogs, {
    ingredientId: id,
    name: old.name,
    category: old.category,
    unit: old.unit,
    price: p,
    prevPrice: old.price,
    shop: shop || old.shop,
    note: note || '',
    recordedAt: F.today(),
    source: 'manual'
  });
  return true;
}

async function listPriceLogs(ingredientId) {
  const arr = await db.listAll(COL.priceLogs, {
    where: { _openid: ctx.openid, ingredientId: ingredientId },
    orderBy: { field: 'recordedAt', order: 'desc' },
    max: 200
  });
  return arr;
}

/** 全部价格记录的统计：涨跌榜 */
async function priceMovers(limit) {
  const logs = await db.listAll(COL.priceLogs, {
    where: { _openid: ctx.openid },
    orderBy: { field: 'recordedAt', order: 'desc' },
    max: 1000
  });
  const latest = {};
  logs.forEach(function (l) {
    if (!latest[l.ingredientId]) {
      latest[l.ingredientId] = { logs: [] };
    }
    if (latest[l.ingredientId].logs.length < 2) latest[l.ingredientId].logs.push(l);
  });
  const movers = [];
  Object.keys(latest).forEach(function (k) {
    const pair = latest[k].logs;
    if (pair.length < 2) return;
    const now = pair[0].price;
    const prev = pair[1].price;
    if (!prev) return;
    movers.push({
      ingredientId: k,
      name: pair[0].name,
      category: pair[0].category,
      unit: pair[0].unit,
      price: now,
      prevPrice: prev,
      delta: F.round2(now - prev),
      rate: Math.round(((now - prev) / prev) * 1000) / 10
    });
  });
  movers.sort(function (a, b) { return Math.abs(b.rate) - Math.abs(a.rate); });
  return movers.slice(0, limit || 5);
}

// ============================================================================
// 食谱
// ============================================================================
function emptyRecipe(weekStartStr) {
  const days = F.weekDays(weekStartStr).map(function (d) {
    return { date: d, meals: [] };
  });
  return {
    title: '本周家常食谱',
    scope: 'week',
    weekStart: weekStartStr,
    days: days,
    totalAmount: 0
  };
}

async function getWeekRecipe(weekStartStr) {
  const ws = weekStartStr || F.weekStart(F.today());
  const arr = await db.listAll(COL.recipes, {
    where: { _openid: ctx.openid, scope: 'week', weekStart: ws },
    limit: 5
  });
  const ing = await ingredientMap();
  if (!arr.length) return decorate(emptyRecipe(ws), ing);
  return decorate(arr[0], ing);
}

async function saveWeekRecipe(recipe) {
  const payload = {
    title: recipe.title || '本周家常食谱',
    scope: 'week',
    weekStart: recipe.weekStart,
    days: normalizeDays(recipe.days)
  };
  payload.totalAmount = F.sumItems(flattenItems(payload));
  if (recipe._id) {
    await db.update(COL.recipes, recipe._id, payload);
    return recipe._id;
  }
  const id = await db.add(COL.recipes, payload);
  return id;
}

/** 只保留必要字段，避免把 amount 等派生字段写进库 */
function normalizeDays(days) {
  return (days || []).map(function (d) {
    return {
      date: d.date,
      meals: (d.meals || []).map(function (m) {
        return {
          id: m.id || F.shortId('ml'),
          type: m.type || 'dinner',
          name: m.name || '',
          items: (m.items || []).map(function (it) {
            return {
              id: it.id || F.shortId('it'),
              ingredientId: it.ingredientId || '',
              name: it.name || '',
              unit: it.unit || '斤',
              price: F.round2(it.price),
              qty: Number(it.qty) || 0,
              note: it.note || '',
              // 自定义菜品：没有 ingredientId（菜不在食材库里），不写进食材表
              custom: it.custom === true || !it.ingredientId
            };
          })
        };
      })
    };
  });
}

/** 取本周食谱的可编辑副本（内部使用，不带装饰字段） */
async function rawWeekRecipe(weekStartStr) {
  const ws = weekStartStr || F.weekStart(F.today());
  const arr = await db.listAll(COL.recipes, {
    where: { _openid: ctx.openid, scope: 'week', weekStart: ws },
    limit: 1
  });
  if (arr.length) {
    return {
      _id: arr[0]._id,
      title: arr[0].title || '本周家常食谱',
      scope: 'week',
      weekStart: ws,
      days: normalizeDays(arr[0].days && arr[0].days.length ? arr[0].days : emptyRecipe(ws).days)
    };
  }
  return emptyRecipe(ws);
}

/** 向某天某餐次添加一个食材 */
async function addItemToRecipe(weekStart, date, mealType, mealName, item) {
  const recipe = await rawWeekRecipe(weekStart);
  let day = null;
  for (let i = 0; i < recipe.days.length; i++) {
    if (recipe.days[i].date === date) { day = recipe.days[i]; break; }
  }
  if (!day) {
    day = { date: date, meals: [] };
    recipe.days.push(day);
    recipe.days.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  let meal = null;
  for (let j = 0; j < day.meals.length; j++) {
    if (day.meals[j].type === mealType) { meal = day.meals[j]; break; }
  }
  if (!meal) {
    meal = { id: F.shortId('ml'), type: mealType, name: mealName || '', items: [] };
    day.meals.push(meal);
  }
  if (mealName) meal.name = mealName;
  const master = await db.get(COL.ingredients, item.ingredientId);
  const unit = master ? master.unit : (item.unit || '斤');
  const price = master ? master.price : (Number(item.price) || 0);
  meal.items.push({
    id: F.shortId('it'),
    ingredientId: item.ingredientId || '',
    name: master ? master.name : (item.name || ''),
    unit: unit,
    price: F.round2(price),
    qty: Number(item.qty) || 0,
    note: item.note || ''
  });
  const id = await saveWeekRecipe(recipe);
  return id;
}

async function removeRecipeItem(weekStart, date, mealId, itemId) {
  const recipe = await rawWeekRecipe(weekStart);
  recipe.days.forEach(function (d) {
    if (d.date !== date) return;
    d.meals = d.meals.map(function (m) {
      if (m.id !== mealId) return m;
      return Object.assign({}, m, {
        items: m.items.filter(function (it) { return it.id !== itemId; })
      });
    });
  });
  return saveWeekRecipe(recipe);
}

async function updateRecipeItemQty(weekStart, date, mealId, itemId, qty) {
  const recipe = await rawWeekRecipe(weekStart);
  recipe.days.forEach(function (d) {
    if (d.date !== date) return;
    d.meals.forEach(function (m) {
      if (m.id !== mealId) return;
      m.items.forEach(function (it) {
        if (it.id === itemId) it.qty = Number(qty) || 0;
      });
    });
  });
  return saveWeekRecipe(recipe);
}

async function removeMeal(weekStart, date, mealId) {
  const recipe = await rawWeekRecipe(weekStart);
  recipe.days.forEach(function (d) {
    if (d.date !== date) return;
    d.meals = d.meals.filter(function (m) { return m.id !== mealId; });
  });
  return saveWeekRecipe(recipe);
}

async function addEmptyMeal(weekStart, date, mealType, mealName) {
  return addItemToRecipe(weekStart, date, mealType, mealName, { ingredientId: '', name: '', qty: 0, price: 0 });
}

async function clearDayRecipe(weekStart, date) {
  const recipe = await rawWeekRecipe(weekStart);
  recipe.days.forEach(function (d) {
    if (d.date === date) d.meals = [];
  });
  return saveWeekRecipe(recipe);
}

async function renameRecipe(weekStart, title) {
  const recipe = await rawWeekRecipe(weekStart);
  recipe.title = title;
  return saveWeekRecipe(recipe);
}

/**
 * 汇总【消费记录】的金额。
 *
 * 注意：记录文档存的是顶层 totalAmount（明细在 items[].amount），
 * 没有顶层 amount 字段。因此不能直接丢给 F.sumItems()——那样结果恒为 0。
 * 这里优先取 totalAmount，缺失时才回退到明细累加。
 */
function sumRecords(recs) {
  return F.round2((recs || []).reduce(function (s, r) {
    if (!r) return s;
    const v = (r.totalAmount === undefined || r.totalAmount === null)
      ? F.sumItems(r.items)
      : Number(r.totalAmount);
    return s + (Number(v) || 0);
  }, 0));
}

function flattenItems(recipe) {
  const out = [];
  (recipe.days || []).forEach(function (d) {
    (d.meals || []).forEach(function (m) {
      (m.items || []).forEach(function (it) { out.push(it); });
    });
  });
  return out;
}

/** 用当前市场价重算条目金额，保证「改价后食谱成本自动跟着变」 */
function decorate(recipe, ingMap) {
  const days = (recipe.days || []).map(function (d) {
    const meals = (d.meals || []).map(function (m) {
      const items = (m.items || []).map(function (it) {
        const master = ingMap[it.ingredientId];
        const price = master ? master.price : it.price;
        const unit = master ? master.unit : it.unit;
        const name = master ? master.name : it.name;
        const amount = F.amount(it.qty, price);
        return Object.assign({}, it, {
          name: name,
          unit: unit,
          price: price,
          priceSnapshot: it.price,
          amount: amount,
          custom: it.custom === true || !it.ingredientId
        });
      });
      return Object.assign({}, m, { items: items, amount: F.sumItems(items) });
    });
    return Object.assign({}, d, {
      meals: meals,
      label: F.weekLabel(d.date),
      shortDate: F.shortDate(d.date),
      amount: F.sumItems(meals.reduce(function (s, m) { return s.concat(m.items); }, []))
    });
  });
  const all = days.reduce(function (s, d) {
    return s.concat(d.meals.reduce(function (s2, m) { return s2.concat(m.items); }, []));
  }, []);
  return Object.assign({}, recipe, { days: days, totalAmount: F.sumItems(all), itemCount: all.length });
}

/** 某天的计划成本 */
function dayCost(recipe, dateStr) {
  const d = (recipe.days || []).filter(function (x) { return x.date === dateStr; })[0];
  return d ? d.amount : 0;
}

async function listRecipes(limit) {
  const arr = await db.listAll(COL.recipes, {
    where: { _openid: ctx.openid, scope: 'week' },
    orderBy: { field: 'weekStart', order: 'desc' },
    max: limit || 30
  });
  return arr.map(function (r) {
    const items = flattenItems(r);
    return Object.assign({}, r, {
      totalAmount: F.sumItems(items),
      itemCount: items.length,
      rangeText: F.weekRangeText(r.weekStart),
      dayCount: (r.days || []).filter(function (d) {
        return (d.meals || []).some(function (m) { return (m.items || []).length > 0; });
      }).length
    });
  });
}

async function removeRecipe(id) {
  return db.remove(COL.recipes, id);
}

/** 复制上一周食谱到本周 */
async function copyRecipeToWeek(fromWeekStart, toWeekStart) {
  const arr = await db.listAll(COL.recipes, {
    where: { _openid: ctx.openid, scope: 'week', weekStart: fromWeekStart },
    limit: 1
  });
  if (!arr.length) return null;
  const src = arr[0];
  const srcDays = F.weekDays(fromWeekStart);
  const dstDays = F.weekDays(toWeekStart);
  const days = (src.days || []).map(function (d) {
    const idx = srcDays.indexOf(d.date);
    return Object.assign({}, d, { date: idx >= 0 ? dstDays[idx] : d.date });
  });
  const recipe = { title: src.title, scope: 'week', weekStart: toWeekStart, days: days };
  const exist = await db.listAll(COL.recipes, {
    where: { _openid: ctx.openid, scope: 'week', weekStart: toWeekStart },
    limit: 1
  });
  if (exist.length) {
    recipe._id = exist[0]._id;
  }
  return saveWeekRecipe(recipe);
}

// ============================================================================
// 采购清单
// ============================================================================
/** 由本周食谱聚合出采购清单 */
async function buildCartItems(weekStartStr) {
  const recipe = await getWeekRecipe(weekStartStr);
  const ing = await ingredientMap();
  const map = {};
  recipe.days.forEach(function (d) {
    d.meals.forEach(function (m) {
      m.items.forEach(function (it) {
        const key = it.ingredientId || it.name;
        if (!map[key]) {
          map[key] = {
            key: key,
            ingredientId: it.ingredientId,
            name: it.name,
            unit: it.unit,
            category: it.category || (ing[it.ingredientId] ? ing[it.ingredientId].category : 'vegetable'),
            price: it.price,
            qty: 0,
            amount: 0,
            from: []
          };
        }
        map[key].qty = F.round2(map[key].qty + (Number(it.qty) || 0));
        map[key].price = it.price;
        map[key].amount = F.amount(map[key].qty, it.price);
        map[key].from.push(F.weekLabel(d.date) + ' ' + (m.name || ''));
      });
    });
  });
  return Object.keys(map).map(function (k) { return map[k]; });
}

async function getCart(weekStartStr) {
  const ws = weekStartStr || F.weekStart(F.today());
  const arr = await db.listAll(COL.carts, {
    where: { _openid: ctx.openid, weekStart: ws },
    limit: 1
  });
  const doc = arr.length ? arr[0] : { weekStart: ws, manual: [], checked: [] };
  const auto = await buildCartItems(ws);
  const manual = doc.manual || [];
  const items = auto.concat(manual);
  const checked = doc.checked || [];
  items.forEach(function (it) {
    it.checked = checked.indexOf(it.key) >= 0;
  });
  return {
    _id: doc._id || '',
    weekStart: ws,
    autoItems: auto,
    manualItems: manual,
    items: items,
    checked: checked,
    total: F.sumItems(items),
    uncheckedTotal: F.sumItems(items.filter(function (i) { return !i.checked; }))
  };
}

async function toggleCartItem(weekStartStr, key) {
  const ws = weekStartStr || F.weekStart(F.today());
  const arr = await db.listAll(COL.carts, { where: { _openid: ctx.openid, weekStart: ws }, limit: 1 });
  const doc = arr.length ? arr[0] : null;
  let checked = (doc && doc.checked) || [];
  if (checked.indexOf(key) >= 0) {
    checked = checked.filter(function (k) { return k !== key; });
  } else {
    checked = checked.concat([key]);
  }
  if (doc) {
    await db.update(COL.carts, doc._id, { checked: checked });
  } else {
    await db.add(COL.carts, { weekStart: ws, manual: [], checked: checked });
  }
  return checked;
}

async function addManualCartItem(weekStartStr, item) {
  const ws = weekStartStr || F.weekStart(F.today());
  const arr = await db.listAll(COL.carts, { where: { _openid: ctx.openid, weekStart: ws }, limit: 1 });
  const doc = arr.length ? arr[0] : null;
  const manual = (doc && doc.manual) || [];
  const entry = Object.assign({}, item, {
    key: 'manual_' + F.shortId('m'),
    qty: Number(item.qty) || 0
  });
  entry.amount = F.amount(entry.qty, entry.price);
  if (doc) {
    await db.update(COL.carts, doc._id, { manual: manual.concat([entry]) });
  } else {
    await db.add(COL.carts, { weekStart: ws, manual: [entry], checked: [] });
  }
  return entry.key;
}

async function removeManualCartItem(weekStartStr, key) {
  const ws = weekStartStr || F.weekStart(F.today());
  const arr = await db.listAll(COL.carts, { where: { _openid: ctx.openid, weekStart: ws }, limit: 1 });
  if (!arr.length) return true;
  const manual = (arr[0].manual || []).filter(function (m) { return m.key !== key; });
  const checked = (arr[0].checked || []).filter(function (k) { return k !== key; });
  await db.update(COL.carts, arr[0]._id, { manual: manual, checked: checked });
  return true;
}

async function clearCart(weekStartStr) {
  const ws = weekStartStr || F.weekStart(F.today());
  const arr = await db.listAll(COL.carts, { where: { _openid: ctx.openid, weekStart: ws }, limit: 1 });
  if (arr.length) await db.update(COL.carts, arr[0]._id, { manual: [], checked: [] });
  return true;
}

/** 一键导出清单文本 */
async function exportCartText(weekStartStr) {
  const cart = await getCart(weekStartStr);
  const lines = [];
  lines.push('【' + C.APP_NAME + '】采购清单');
  lines.push('区域：' + C.REGION + '　周期：' + F.weekRangeText(cart.weekStart));
  lines.push('生成时间：' + F.fmtTime(new Date().toISOString()));
  lines.push('--------------------------');
  const groups = {};
  cart.items.forEach(function (it) {
    const cat = catOf(it.category);
    if (!groups[cat.name]) groups[cat.name] = [];
    groups[cat.name].push(it);
  });
  Object.keys(groups).forEach(function (g) {
    lines.push('[' + g + ']');
    groups[g].forEach(function (it) {
      lines.push((it.checked ? '[已购] ' : '[    ] ') + it.name + '  ' + F.qty(it.qty) + it.unit + '  ×  ' + F.fixed2(it.price) + '  =  ' + F.fixed2(it.amount));
    });
  });
  lines.push('--------------------------');
  lines.push('合计：' + cart.items.length + ' 项　共 ¥' + F.fixed2(cart.total));
  lines.push('预算：¥' + F.fixed2(budget()) + '　' + (cart.total > budget() ? '超出 ¥' + F.fixed2(cart.total - budget()) : '剩余 ¥' + F.fixed2(budget() - cart.total)));
  return lines.join('\n');
}

function catOf(key) {
  const found = C.CATEGORIES.filter(function (c) { return c.key === key; })[0];
  return found || { key: 'other', name: '其他', icon: 'bag', color: '#9AA5B4', bg: '#F1F3F6' };
}

// ============================================================================
// 消费记录
// ============================================================================
/** 结算采购清单 -> 生成消费记录 */
async function checkoutCart(weekStartStr, note) {
  const ws = weekStartStr || F.weekStart(F.today());
  const cart = await getCart(ws);
  const items = cart.items.filter(function (it) { return !it.checked; });
  if (!items.length) throw new Error('清单中已没有待采购的食材');
  const total = F.sumItems(items);
  const id = await db.add(COL.records, {
    type: 'purchase',
    title: F.cnDate(F.today()) + ' 采购',
    date: F.today(),
    weekStart: ws,
    items: items.map(function (it) {
      return {
        ingredientId: it.ingredientId,
        name: it.name,
        unit: it.unit,
        category: it.category,
        price: it.price,
        qty: it.qty,
        amount: it.amount
      };
    }),
    totalAmount: total,
    source: 'shopping',
    note: note || ''
  });
  // 结算后清空清单（勾选状态与手动项一并清除）
  await clearCart(ws);
  return id;
}

async function addManualRecord(record) {
  const items = (record.items || []).map(function (it) {
    // 支持两种条目：
    //  1) 食材条目：给 qty + price，金额由 数量 × 单价 算出
    //  2) 直接金额条目（每日消费）：直接给 amount，不需要单位与单价
    const hasDirect = it.amount !== undefined && it.amount !== null && it.amount !== '';
    const qty = Number(it.qty) || 0;
    const price = F.round2(it.price);
    return {
      ingredientId: it.ingredientId || '',
      name: it.name,
      // 必须保留 category：统计页「分类金额」依赖它，丢了会导致分类支出恒为 0
      category: it.category || '',
      unit: it.unit || '',
      price: price,
      qty: qty,
      amount: hasDirect ? F.round2(Number(it.amount) || 0) : F.amount(qty, price)
    };
  });
  const total = F.sumItems(items);
  return db.add(COL.records, {
    type: record.type || 'purchase',
    title: record.title || (F.cnDate(record.date || F.today()) + ' 采购'),
    date: record.date || F.today(),
    weekStart: F.weekStart(record.date || F.today()),
    items: items,
    totalAmount: total,
    source: 'manual',
    note: record.note || ''
  });
}

/**
 * 每日消费「记一笔」：一个金额 + 一个种类 + 归属日期（+ 可选备注）。
 *
 * 内部复用 addManualRecord，落成一条只有单个条目的记录。这样它天然被
 * 本周支出 / 按天汇总 / 分类占比 / 消费明细 / 近6周趋势 全部统计口径覆盖，
 * 无需在统计侧写任何特判。
 */
async function addSpendRecord(opt) {
  const o = opt || {};
  const amount = F.round2(Number(o.amount) || 0);
  if (!(amount > 0)) throw new Error('金额需大于 0');
  const date = o.date || F.today();
  const category = String(o.category || '').trim() || '其他';
  return addManualRecord({
    type: 'daily',
    title: category,                 // 标题直接用种类，列表里一眼可读
    date: date,
    note: o.note || '',
    items: [{
      name: category,
      category: category,
      amount: amount                 // 直接金额，不走 数量 × 单价
    }]
  });
}

async function listRecords(limit) {
  const arr = await db.listAll(COL.records, {
    where: { _openid: ctx.openid },
    orderBy: { field: 'date', order: 'desc' },
    max: limit || 200
  });
  return arr.map(function (r) {
    return Object.assign({}, r, {
      dateText: F.relDate(r.date),
      timeText: F.fmtTime(r.createdAt),
      itemCount: (r.items || []).length,
      rangeText: r.weekStart ? F.weekRangeText(r.weekStart) : ''
    });
  });
}

async function getRecord(id) {
  return db.get(COL.records, id);
}

async function removeRecord(id) {
  return db.remove(COL.records, id);
}

/**
 * 某一周的全部自定义消费（type='daily'，即「记一笔」/食谱页「记消费」落的数据）。
 *
 * 食谱页用它做两件事：
 *   1) 按天聚合出一周的消费汇总（周视图里给有消费的日期打标）；
 *   2) 单日视图里列出当天每一条自定义消费（名称 / 金额 / 备注）。
 */
async function listWeekSpends(weekStartStr) {
  const ws = F.weekStart(weekStartStr);
  const arr = await db.listAll(COL.records, {
    where: { _openid: ctx.openid, weekStart: ws, type: 'daily' },
    orderBy: { field: 'createdAt', order: 'desc' },
    max: 500
  });
  return arr.map(function (r) {
    const it = (r.items || [])[0] || {};
    return {
      _id: r._id,
      date: r.date,
      name: it.name || r.title || '消费',
      amount: F.round2(r.totalAmount || it.amount || 0),
      note: r.note || '',
      timeText: F.fmtTime(r.createdAt)
    };
  });
}

// ============================================================================
// 成本统计
// ============================================================================
/**
 * 汇总接口
 * @param {string} weekStartStr 周起始（周一）
 * @param {string} dateStr      单日日期
 */
async function summary(weekStartStr, dateStr) {
  const ws = weekStartStr || F.weekStart(F.today());
  const day = dateStr || F.today();
  const [recipe, records, ingredients] = await Promise.all([
    getWeekRecipe(ws),
    db.listAll(COL.records, { where: { _openid: ctx.openid }, orderBy: { field: 'date', order: 'desc' }, max: 500 }),
    listIngredients({})
  ]);

  const weekRecords = records.filter(function (r) { return r.weekStart === ws; });
  const weekActual = sumRecords(weekRecords);
  const weekPlan = recipe.totalAmount;

  const byDay = F.weekDays(ws).map(function (d) {
    const recs = records.filter(function (r) { return r.date === d; });
    return {
      date: d,
      label: F.weekLabel(d) === '周一' ? '周一' : F.weekLabel(d),
      shortDate: F.shortDate(d),
      plan: dayCost(recipe, d),
      actual: sumRecords(recs),
      recordCount: recs.length,
      isToday: d === F.today()
    };
  });

  const todayRecs = records.filter(function (r) { return r.date === day; });
  const todayPlan = dayCost(recipe, day);

  // 分类统计：食材四大分类（含库存数量与均价）
  const catStats = C.CATEGORIES.map(function (c) {
    const items = ingredients.items.filter(function (i) { return i.category === c.key; });
    const spent = F.sumItems(weekRecords.reduce(function (s, r) {
      return s.concat((r.items || []).filter(function (it) { return it.category === c.key; }));
    }, []));
    const avg = items.length ? F.round2(items.reduce(function (s, i) { return s + i.price; }, 0) / items.length) : 0;
    return {
      key: c.key, name: c.name, icon: c.icon, iconColor: c.iconColor || 'gray',
      color: c.color, bg: c.bg,
      count: items.length, avgPrice: avg, spent: spent, isCustom: false
    };
  });

  // 每日消费的自定义种类：把本周出现过的、不属于食材四分类的 category 动态聚合进来。
  // 这样用户自建的「餐饮 / 打车 / 宠物」等任意种类都会自动出现在分类占比里，无需预先登记。
  const knownCatKeys = {};
  C.CATEGORIES.forEach(function (c) { knownCatKeys[c.key] = true; });
  const spendPresets = {};
  (C.SPEND_CATEGORIES || []).forEach(function (c) { spendPresets[c.key] = c; });
  const extraCats = {};
  weekRecords.forEach(function (r) {
    (r.items || []).forEach(function (it) {
      const k = it.category;
      if (!k || knownCatKeys[k]) return;
      if (!extraCats[k]) extraCats[k] = { count: 0, amount: 0 };
      extraCats[k].count += 1;
      extraCats[k].amount += Number(it.amount) || 0;
    });
  });
  Object.keys(extraCats).forEach(function (k) {
    const preset = spendPresets[k];
    const style = preset || C.CUSTOM_CAT_STYLE || {};
    catStats.push({
      key: k, name: k,
      icon: style.icon || 'tag',
      iconColor: style.iconColor || 'gray',
      color: style.color || '#8B7BD8',
      bg: style.bg || '#F0EDFB',
      count: extraCats[k].count,
      avgPrice: 0,
      spent: F.round2(extraCats[k].amount),
      isCustom: !preset
    });
  });

  // 近 6 周趋势
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const s = F.addDays(ws, -7 * i);
    const recs = records.filter(function (r) { return r.weekStart === s; });
    trend.push({ weekStart: s, label: F.shortDate(s), amount: sumRecords(recs), isCurrent: i === 0 });
  }

  // 消费明细（本周）
  const detail = [];
  weekRecords.concat(records.filter(function (r) { return r.weekStart !== ws; }).slice(0, 20)).forEach(function (r) {
    (r.items || []).forEach(function (it) {
      detail.push({
        date: r.date,
        dateText: F.relDate(r.date),
        recordId: r._id,
        title: r.title,
        name: it.name,
        unit: it.unit,
        category: it.category,
        qty: it.qty,
        price: it.price,
        amount: it.amount,
        // 直接金额条目（每日消费）没有数量与单价，渲染时只显示金额
        direct: !(Number(it.qty) > 0)
      });
    });
  });

  const b = budget();
  return {
    weekStart: ws,
    weekRangeText: F.weekRangeText(ws),
    budget: b,
    weekPlan: weekPlan,
    weekActual: weekActual,
    weekRemaining: F.round2(b - weekActual),
    weekPercent: F.percent(weekActual, b),
    planPercent: F.percent(weekPlan, b),
    today: day,
    todayLabel: F.relDate(day),
    todayPlan: todayPlan,
    todayActual: sumRecords(todayRecs),
    byDay: byDay,
    catStats: catStats,
    trend: trend,
    detail: detail,
    recordCount: weekRecords.length,
    ingredientCount: ingredients.items.length,
    maxDayValue: Math.max.apply(null, byDay.map(function (x) { return Math.max(x.plan, x.actual); }).concat([1])),
    maxTrend: Math.max.apply(null, trend.map(function (x) { return x.amount; }).concat([1]))
  };
}

/** 首页总览 */
async function overview() {
  const ws = F.weekStart(F.today());
  const s = await summary(ws, F.today());
  const movers = await priceMovers(4);
  const recipe = await getWeekRecipe(ws);
  const upcomingDayCost = s.byDay.filter(function (d) { return d.date >= F.today(); });
  return {
    ctx: { mode: ctx.mode, user: ctx.user, budget: s.budget },
    week: s,
    movers: movers,
    today: {
      date: F.today(),
      label: F.relDate(F.today()),
      plan: s.todayPlan,
      actual: s.todayActual,
      meals: (recipe.days.filter(function (d) { return d.date === F.today(); })[0] || { meals: [] }).meals,
      upcoming: upcomingDayCost.slice(0, 4)
    },
    market: {
      name: C.MARKET_NAME,
      region: C.REGION,
      ingredientCount: s.ingredientCount,
      categories: s.catStats,
      updatedAt: F.fmtTime(new Date().toISOString())
    }
  };
}

/**
 * 月统计消费金额
 * 拉全量记录，按自然月（YYYY-MM）聚合：每月总额、笔数、分类占比；
 * 并返回近 12 个月序列（空月份也占位，便于柱状图连续）、当前月与上月对比。
 * 金额口径与 summary 一致：优先取记录顶层 totalAmount。
 */
async function monthlyStats() {
  const records = await db.listAll(COL.records, {
    where: { _openid: ctx.openid },
    orderBy: { field: 'date', order: 'desc' },
    max: 500
  });

  // 按月聚合：key = 'YYYY-MM'
  const map = {};
  records.forEach(function (r) {
    if (!r || !r.date) return;
    const mk = String(r.date).slice(0, 7);
    if (!map[mk]) map[mk] = { total: 0, count: 0, cat: {} };
    const total = sumRecords([r]);
    map[mk].total = F.round2(map[mk].total + total);
    map[mk].count += 1;
    // 分类占比：按 items 的金额占比分摊到各 category
    const items = r.items || [];
    if (items.length) {
      const itemSum = F.sumItems(items);
      items.forEach(function (it) {
        const k = it.category || '未分类';
        const part = itemSum > 0 ? total * (Number(it.amount) || 0) / itemSum : 0;
        map[mk].cat[k] = F.round2((map[mk].cat[k] || 0) + part);
      });
    } else {
      map[mk].cat['未分类'] = F.round2((map[mk].cat['未分类'] || 0) + total);
    }
  });

  const now = new Date();
  const curKey = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);

  // 近 12 个月序列（从 11 个月前到本月，空月份也占位）
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    const m = map[key] || { total: 0, count: 0, cat: {} };
    months.push({
      key: key,
      year: d.getFullYear(),
      label: (d.getMonth() + 1) + '月',
      total: m.total,
      count: m.count,
      cat: m.cat,
      isCurrent: key === curKey
    });
  }

  const cur = map[curKey] || { total: 0, count: 0, cat: {} };
  const prev = months.length >= 2 ? (map[months[months.length - 2].key] || { total: 0 }) : { total: 0 };
  const delta = F.round2(cur.total - prev.total);
  const rate = prev.total > 0 ? Math.round(delta / prev.total * 100) : (cur.total > 0 ? 100 : 0);

  const catList = Object.keys(cur.cat).map(function (k) {
    const style = (C.SPEND_CATEGORIES || []).filter(function (c) { return c.key === k; })[0];
    return {
      key: k,
      name: style ? style.name : k,
      amount: cur.cat[k],
      color: style ? style.color : (C.CUSTOM_CAT_STYLE ? C.CUSTOM_CAT_STYLE.color : '#8B7BD8')
    };
  }).sort(function (a, b) { return b.amount - a.amount; });

  const maxMonth = Math.max.apply(null, months.map(function (m) { return m.total; }).concat([1]));

  return {
    curKey: curKey,
    curTotal: cur.total,
    curCount: cur.count,
    prevTotal: prev.total,
    delta: delta,
    rate: rate,
    months: months,
    catList: catList,
    maxMonth: maxMonth
  };
}

window.FFM.biz = {
  init,
  getCtx,
  budget,
  saveProfile,
  setBudget,
  resetToSeedPrices,
  seedIngredients,
  // 食材
  listIngredients,
  ingredientMap,
  getIngredient,
  saveIngredient,
  removeIngredient,
  updatePrice,
  listPriceLogs,
  priceMovers,
  // 食谱
  getWeekRecipe,
  saveWeekRecipe,
  listRecipes,
  removeRecipe,
  copyRecipeToWeek,
  emptyRecipe,
  addItemToRecipe,
  removeRecipeItem,
  updateRecipeItemQty,
  removeMeal,
  addEmptyMeal,
  clearDayRecipe,
  renameRecipe,
  // 清单
  getCart,
  buildCartItems,
  toggleCartItem,
  addManualCartItem,
  removeManualCartItem,
  clearCart,
  exportCartText,
  checkoutCart,
  // 记录
  listRecords,
  getRecord,
  removeRecord,
  addManualRecord,
  addSpendRecord,
  listWeekSpends,
  // 统计
  monthlyStats,
  summary,
  overview,
  catOf,
  round2: F.round2
};

})();
