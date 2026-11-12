/* -------------------------------------------------------------------------- */
/* 由 tools/build-web.js 从小程序源码自动生成，请勿直接编辑。                    */
/* 源文件：miniprogram/utils/db.js                                        */
/* -------------------------------------------------------------------------- */
(function () {
"use strict";
window.FFM = window.FFM || {};

/**
 * 统一数据访问层
 *
 * 三驱动设计：
 *  1) shared —— Supabase 共享云（多设备同步，按家庭码隔离数据）
 *  2) cloud  —— 微信云开发数据库（小程序生产模式）
 *  3) local  —— 本地 Storage（演示模式，云未配置 / 调用失败时自动降级）
 *
 * 对外方法在三种驱动下签名与返回结构完全一致，业务层无需关心当前模式。
 *
 * 约定：
 *  - 每份文档都带 _id / _openid / createdAt / updatedAt
 *  - 时间统一存 ISO 字符串（'2026-10-13T10:00:00.000Z'）或 'YYYY-MM-DD'，
 *    避免云端 serverDate 与本地时间类型不一致
 *  - shared 模式下 _openid 直接等于家庭码，业务层的归属过滤无需改动
 */
const { COLLECTIONS, CLOUD_ENV, LOCAL_OPENID, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_TABLE } = window.FFM.constants;
const family = window.FFM.family;

const LS_PREFIX = 'ffm_ls_';
const LS_OPENID = 'ffm_openid';
const LS_FORCE_LOCAL = 'ffm_force_local';
const PAGE_SIZE = 20; // 小程序端单次 get 上限

let _mode = 'cloud';
let _openid = '';
let _cldb = null;
let _ready = null;
let _lastError = '';

// Supabase 配置支持运行时覆盖：改代码不用重新构建，也便于测试注入
let _sbUrl = SUPABASE_URL;
let _sbKey = SUPABASE_ANON_KEY;

function genId(prefix) {
  return (prefix || 'doc') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowISO() {
  return new Date().toISOString();
}

function safeStorageGet(key, def) {
  try {
    const v = wx.getStorageSync(key);
    return v === '' || v === undefined || v === null ? def : v;
  } catch (e) {
    return def;
  }
}

function safeStorageSet(key, val) {
  try {
    wx.setStorageSync(key, val);
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================================================
// 条件匹配 / 排序（本地驱动用；云端驱动直接下推给数据库）
// ============================================================================
function matchWhere(doc, where) {
  if (!where) return true;
  return Object.keys(where).every(function (k) {
    const cond = where[k];
    const v = doc[k];
    if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      if ('$in' in cond) return (cond.$in || []).indexOf(v) >= 0;
      if ('$nin' in cond) return (cond.$nin || []).indexOf(v) < 0;
      if ('$ne' in cond) return v !== cond.$ne;
      if ('$gt' in cond) return v > cond.$gt;
      if ('$gte' in cond) return v >= cond.$gte;
      if ('$lt' in cond) return v < cond.$lt;
      if ('$lte' in cond) return v <= cond.$lte;
      if ('$exists' in cond) return cond.$exists ? v !== undefined : v === undefined;
      return false;
    }
    return v === cond;
  });
}

function sortList(arr, orderBy) {
  if (!orderBy) return arr;
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];
  return arr.slice().sort(function (a, b) {
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (!o || !o.field) continue;
      const av = a[o.field];
      const bv = b[o.field];
      if (av === bv) continue;
      const dir = o.order === 'desc' ? -1 : 1;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      return (av < bv ? -1 : 1) * dir;
    }
    return 0;
  });
}

// ============================================================================
// 本地驱动
// ============================================================================
const localDriver = {
  all: function (coll) {
    return safeStorageGet(LS_PREFIX + coll, []) || [];
  },
  save: function (coll, arr) {
    return safeStorageSet(LS_PREFIX + coll, arr);
  },
  list: function (coll, opts) {
    const o = opts || {};
    let arr = localDriver.all(coll).filter(function (d) {
      return matchWhere(d, o.where);
    });
    if (o.orderBy) arr = sortList(arr, o.orderBy);
    if (typeof o.skip === 'number' || typeof o.limit === 'number') {
      const s = o.skip || 0;
      const l = typeof o.limit === 'number' ? o.limit : arr.length;
      arr = arr.slice(s, s + l);
    }
    return Promise.resolve(arr);
  },
  count: function (coll, where) {
    return Promise.resolve(localDriver.all(coll).filter(function (d) {
      return matchWhere(d, where);
    }).length);
  },
  get: function (coll, id) {
    const found = localDriver.all(coll).filter(function (d) { return d._id === id; })[0];
    return Promise.resolve(found || null);
  },
  add: function (coll, data) {
    const arr = localDriver.all(coll);
    const doc = Object.assign({}, data, {
      _id: data._id || genId(coll),
      _openid: data._openid || _openid || LOCAL_OPENID,
      createdAt: data.createdAt || nowISO(),
      updatedAt: nowISO()
    });
    arr.unshift(doc);
    localDriver.save(coll, arr);
    return Promise.resolve(doc._id);
  },
  bulkAdd: function (coll, docs) {
    const arr = localDriver.all(coll);
    const ids = [];
    (docs || []).forEach(function (d) {
      const doc = Object.assign({}, d, {
        _id: d._id || genId(coll),
        _openid: d._openid || _openid || LOCAL_OPENID,
        createdAt: d.createdAt || nowISO(),
        updatedAt: nowISO()
      });
      arr.unshift(doc);
      ids.push(doc._id);
    });
    localDriver.save(coll, arr);
    return Promise.resolve(ids);
  },
  update: function (coll, id, patch) {
    const arr = localDriver.all(coll);
    let hit = false;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]._id === id) {
        arr[i] = Object.assign({}, arr[i], patch, { _id: id, updatedAt: nowISO() });
        hit = true;
        break;
      }
    }
    if (!hit) return Promise.reject(new Error('记录不存在或无权修改'));
    localDriver.save(coll, arr);
    return Promise.resolve(true);
  },
  remove: function (coll, id) {
    const arr = localDriver.all(coll);
    const next = arr.filter(function (d) { return d._id !== id; });
    if (next.length === arr.length) return Promise.reject(new Error('记录不存在或无权删除'));
    localDriver.save(coll, next);
    return Promise.resolve(true);
  },
  clear: function (coll) {
    localDriver.save(coll, []);
    return Promise.resolve(true);
  }
};

// ============================================================================
// 云端驱动
// ============================================================================
const cloudDriver = {
  list: function (coll, opts) {
    const o = opts || {};
    const limit = typeof o.limit === 'number' ? Math.min(o.limit, PAGE_SIZE) : PAGE_SIZE;
    let q = _cldb.collection(coll);
    if (o.where && Object.keys(o.where).length) q = q.where(o.where);
    if (o.orderBy) {
      const list = Array.isArray(o.orderBy) ? o.orderBy : [o.orderBy];
      list.forEach(function (ob) {
        if (ob && ob.field) q = q.orderBy(ob.field, ob.order || 'asc');
      });
    }
    if (o.skip) q = q.skip(o.skip);
    q = q.limit(limit);
    return q.get().then(function (res) { return res.data || []; });
  },
  count: function (coll, where) {
    let q = _cldb.collection(coll);
    if (where && Object.keys(where).length) q = q.where(where);
    return q.count().then(function (res) { return res.total || 0; });
  },
  get: function (coll, id) {
    return _cldb.collection(coll).doc(id).get()
      .then(function (res) { return res.data || null; })
      .catch(function () { return null; });
  },
  add: function (coll, data) {
    const doc = Object.assign({}, data, {
      _openid: data._openid || _openid,
      createdAt: data.createdAt || nowISO(),
      updatedAt: nowISO()
    });
    return _cldb.collection(coll).add({ data: doc }).then(function (res) {
      return res._id;
    });
  },
  bulkAdd: function (coll, docs) {
    // 小程序端不支持批量写，走云函数；这里退化为循环单条写（数量小时可接受）
    return docs.reduce(function (p, d) {
      return p.then(function (ids) {
        return cloudDriver.add(coll, d).then(function (id) { return ids.concat([id]); });
      });
    }, Promise.resolve([]));
  },
  update: function (coll, id, patch) {
    const data = Object.assign({}, patch, { updatedAt: nowISO() });
    delete data._id;
    delete data._openid;
    return _cldb.collection(coll).doc(id).update({ data: data }).then(function () { return true; });
  },
  remove: function (coll, id) {
    return _cldb.collection(coll).doc(id).remove().then(function () { return true; });
  },
  clear: function (coll) {
    return Promise.reject(new Error('云模式下不支持本地清空'));
  }
};

// ============================================================================
// 共享云驱动（多设备同步 · Supabase）
// ----------------------------------------------------------------------------
// 设计要点：
//  1) 一张通用表 ffm_docs 装下所有集合，用 coll 区分、fam（家庭码）隔离。
//  2) 归属键复用 _openid：本模式下 _openid 直接等于家庭码，
//     所以业务层所有 `where: { _openid: ... }` 一行都不用改。
//  3) 拉取按「家庭 + 集合」整包拉回，where 过滤/排序/分页都在本地做
//     （与 localDriver 行为完全一致，避免两套语义对不上）。
//     一个家庭的数据量在百条级，整包拉取比逐条件下推更简单也更可靠。
// ============================================================================
const sharedDriver = {
  // 内存缓存：同一次渲染里对同一集合的多次 listAll 只发一次请求
  _cache: {},
  _cacheAt: 0,
  _ttl: 3000,
  _lastServerUpdatedAt: '',

  _table: function () {
    return encodeURIComponent(SUPABASE_TABLE || 'ffm_docs');
  },
  _fam: function () {
    return encodeURIComponent(_openid || '');
  },

  /** 请求 Supabase REST；自动兼容 web(fetch) 与小程序(wx.request) */
  _fetch: function (path, opt) {
    const url = _sbUrl.replace(/\/+$/, '') + '/rest/v1/' + path;
    const o = opt || {};
    const headers = {
      'Content-Type': 'application/json',
      apikey: _sbKey,
      Authorization: 'Bearer ' + _sbKey
    };
    if (o.prefer) headers.Prefer = o.prefer;
    const method = o.method || 'GET';
    const body = o.body === undefined ? null : JSON.stringify(o.body);

    if (typeof fetch === 'function') {
      return fetch(url, { method: method, headers: headers, body: body }).then(function (res) {
        return res.text().then(function (txt) {
          let json = null;
          try { json = txt ? JSON.parse(txt) : null; } catch (e) { /* 非 JSON */ }
          if (!res.ok) {
            throw new Error('同步失败 ' + res.status + '：' + ((json && (json.message || json.hint)) || txt || res.statusText));
          }
          return json;
        });
      });
    }
    return new Promise(function (resolve, reject) {
      wx.request({
        url: url,
        method: method,
        header: headers,
        data: body ? JSON.parse(body) : {},
        success: function (res) {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
          else reject(new Error('同步失败 ' + res.statusCode + '：' + JSON.stringify(res.data || '').slice(0, 200)));
        },
        fail: function (e) { reject(new Error((e && (e && e.errMsg)) || '网络不给力，稍后再试')); }
      });
    });
  },

  /** 整包拉取某个集合（只认家庭码，不带业务条件） */
  _pullRaw: function (coll) {
    const t = sharedDriver._table();
    const fam = sharedDriver._fam();
    return sharedDriver._fetch(
      t + '?coll=eq.' + encodeURIComponent(coll) + '&fam=eq.' + fam + '&select=doc,updated_at&order=updated_at.desc',
      {}
    ).then(function (rows) {
      const docs = (rows || []).map(function (r) { return r.doc; }).filter(Boolean);
      let maxAt = '';
      (rows || []).forEach(function (r) {
        if (r.updated_at && r.updated_at > maxAt) maxAt = r.updated_at;
      });
      if (maxAt > sharedDriver._lastServerUpdatedAt) sharedDriver._lastServerUpdatedAt = maxAt;
      return docs;
    });
  },

  /** 带短 TTL 缓存的读取；force=true 时强制回源 */
  _read: function (coll, force) {
    const now = Date.now();
    if (!force && sharedDriver._cache[coll] && (now - sharedDriver._cacheAt) < sharedDriver._ttl) {
      return Promise.resolve(sharedDriver._cache[coll]);
    }
    return sharedDriver._pullRaw(coll).then(function (docs) {
      sharedDriver._cache[coll] = docs;
      sharedDriver._cacheAt = Date.now();
      return docs;
    });
  },

  _write: function (coll, fn) {
    return fn().then(function (r) {
      delete sharedDriver._cache[coll];
      return r;
    }, function (e) {
      delete sharedDriver._cache[coll];
      throw e;
    });
  },

  list: function (coll, opts) {
    const o = opts || {};
    return sharedDriver._read(coll).then(function (docs) {
      let arr = docs.filter(function (d) { return matchWhere(d, o.where); });
      if (o.orderBy) arr = sortList(arr, o.orderBy);
      if (typeof o.skip === 'number' || typeof o.limit === 'number') {
        const s = o.skip || 0;
        const l = typeof o.limit === 'number' ? o.limit : arr.length;
        arr = arr.slice(s, s + l);
      }
      return arr;
    });
  },

  count: function (coll, where) {
    return sharedDriver._read(coll).then(function (docs) {
      return docs.filter(function (d) { return matchWhere(d, where); }).length;
    });
  },

  get: function (coll, id) {
    return sharedDriver._read(coll).then(function (docs) {
      const found = docs.filter(function (d) { return d._id === id; })[0];
      return found || null;
    });
  },

  add: function (coll, data) {
    const doc = Object.assign({}, data, {
      _id: data._id || genId(coll),
      _openid: data._openid || _openid,
      createdAt: data.createdAt || nowISO(),
      updatedAt: nowISO()
    });
    return sharedDriver._write(coll, function () {
      return sharedDriver._fetch(sharedDriver._table(), {
        method: 'POST',
        prefer: 'return=minimal',
        body: {
          coll: coll,
          fam: _openid,
          doc_id: doc._id,
          doc: doc
        }
      });
    }).then(function () { return doc._id; });
  },

  bulkAdd: function (coll, docs) {
    const rows = (docs || []).map(function (d) {
      const doc = Object.assign({}, d, {
        _id: d._id || genId(coll),
        _openid: d._openid || _openid,
        createdAt: d.createdAt || nowISO(),
        updatedAt: nowISO()
      });
      return { coll: coll, fam: _openid, doc_id: doc._id, doc: doc };
    });
    if (!rows.length) return Promise.resolve([]);
    return sharedDriver._write(coll, function () {
      return sharedDriver._fetch(sharedDriver._table(), {
        method: 'POST',
        prefer: 'return=minimal',
        body: rows
      });
    }).then(function () { return rows.map(function (r) { return r.doc_id; }); });
  },

  update: function (coll, id, patch) {
    return sharedDriver._read(coll).then(function (docs) {
      const old = docs.filter(function (d) { return d._id === id; })[0];
      if (!old) return Promise.reject(new Error('记录不存在或无权修改'));
      const next = Object.assign({}, old, patch, { _id: id, updatedAt: nowISO() });
      return sharedDriver._write(coll, function () {
        return sharedDriver._fetch(
          sharedDriver._table() + '?coll=eq.' + encodeURIComponent(coll) +
            '&fam=eq.' + sharedDriver._fam() + '&doc_id=eq.' + encodeURIComponent(id),
          { method: 'PATCH', prefer: 'return=minimal', body: { doc: next } }
        );
      }).then(function () { return true; });
    });
  },

  remove: function (coll, id) {
    return sharedDriver._write(coll, function () {
      return sharedDriver._fetch(
        sharedDriver._table() + '?coll=eq.' + encodeURIComponent(coll) +
          '&fam=eq.' + sharedDriver._fam() + '&doc_id=eq.' + encodeURIComponent(id),
        { method: 'DELETE', prefer: 'return=minimal' }
      );
    }).then(function () { return true; });
  },

  clear: function (coll) {
    return sharedDriver._write(coll, function () {
      return sharedDriver._fetch(
        sharedDriver._table() + '?coll=eq.' + encodeURIComponent(coll) + '&fam=eq.' + sharedDriver._fam(),
        { method: 'DELETE', prefer: 'return=minimal' }
      );
    }).then(function () { return true; });
  },

  /** 换家庭码后必须清掉缓存，否则会看到上一个房间的数据 */
  resetCache: function () {
    sharedDriver._cache = {};
    sharedDriver._cacheAt = 0;
    sharedDriver._lastServerUpdatedAt = '';
  },

  /** 供 UI 显示同步状态 */
  status: function () {
    return {
      lastServerUpdatedAt: sharedDriver._lastServerUpdatedAt,
      family: _openid,
      cached: Object.keys(sharedDriver._cache).length
    };
  }
};

// ============================================================================
// 对外 API
// ============================================================================
function isSupabaseReady() {
  return !!(_sbUrl && _sbKey);
}

function driver() {
  return _mode === 'cloud' ? cloudDriver : (_mode === 'shared' ? sharedDriver : localDriver);
}

/** 分页拉取全部（云端单页上限 20 条，自动翻页） */
function listAll(collection, opts) {
  const o = Object.assign({}, opts || {});
  if (_mode === 'shared') {
    // 共享驱动整包拉回，where/排序/分页都在驱动内部本地完成
    return sharedDriver.list(collection, o);
  }
  if (_mode !== 'cloud') {
    return localDriver.list(collection, o);
  }
  const max = o.max || 500;
  const out = [];
  let skip = o.skip || 0;

  function step() {
    if (out.length >= max) return Promise.resolve(out);
    return cloudDriver.list(collection, Object.assign({}, o, { skip: skip, limit: PAGE_SIZE }))
      .then(function (arr) {
        out.push.apply(out, arr);
        if (arr.length < PAGE_SIZE) return out;
        skip += PAGE_SIZE;
        return step();
      });
  }
  return step();
}

const db = {
  /** 初始化：优先多设备同步（配了 Supabase），否则云开发，最后本地演示 */
  init: function (force) {
    if (_ready && !force) return _ready;
    _ready = (function () {
      // 1) 多设备同步：家庭码即归属键，两端（小程序 / 网页）走同一份云端数据
      if (isSupabaseReady()) {
        _mode = 'shared';
        _openid = family.current();
        return Promise.resolve({ mode: _mode, openid: _openid, family: _openid, shared: true });
      }
      const forceLocal = safeStorageGet(LS_FORCE_LOCAL, false);
      if (forceLocal || !wx.cloud) {
        _mode = 'local';
        _openid = LOCAL_OPENID;
        return Promise.resolve({ mode: _mode, openid: _openid, user: null });
      }
      return new Promise(function (resolve) {
        try {
          if (!_cldb) {
            const opt = { traceUser: true };
            if (CLOUD_ENV) opt.env = CLOUD_ENV;
            wx.cloud.init(opt);
            _cldb = wx.cloud.database();
          }
        } catch (e) {
          _lastError = '云开发初始化失败：' + ((e && e.errMsg) || e);
          _mode = 'local';
          _openid = LOCAL_OPENID;
          return resolve({ mode: _mode, openid: _openid, user: null, error: _lastError });
        }
        wx.cloud.callFunction({ name: 'login', data: {} })
          .then(function (res) {
            const r = (res && res.result) || {};
            if (!r || !r.openid) throw new Error(r.message || '登录云函数返回异常');
            _openid = r.openid;
            _mode = 'cloud';
            safeStorageSet(LS_OPENID, _openid);
            resolve({ mode: _mode, openid: _openid, user: r.user || null, isNewUser: !!r.isNewUser });
          })
          .catch(function (e) {
            _lastError = (e && (e.errMsg || e.message)) || String(e);
            _mode = 'local';
            _openid = LOCAL_OPENID;
            resolve({ mode: _mode, openid: _openid, user: null, error: _lastError });
          });
      });
    })();
    return _ready;
  },

  mode: function () { return _mode; },
  isLocal: function () { return _mode !== 'cloud'; },
  isShared: function () { return _mode === 'shared'; },
  openid: function () { return _openid; },
  lastError: function () { return _lastError; },
  setForceLocal: function (v) {
    safeStorageSet(LS_FORCE_LOCAL, !!v);
    _ready = null;
  },

  /** 当前家庭码（未开启同步时也返回，供 UI 展示） */
  familyCode: function () { return family.current(); },

  /** 加入家人的房间；非法家庭码返回 null，成功返回新家庭码 */
  joinFamily: function (code) {
    const next = family.join(code);
    if (!next) return null;
    if (_mode === 'shared') {
      _openid = next;
      sharedDriver.resetCache();
    }
    return next;
  },

  /** 换一个新家庭码（开新房间） */
  newFamily: function () {
    const next = family.reset();
    if (_mode === 'shared') {
      _openid = next;
      sharedDriver.resetCache();
    }
    return next;
  },

  /** 同步是否可用（配了 Supabase 才算开启） */
  syncEnabled: function () { return isSupabaseReady(); },

  /**
   * 运行时覆盖 Supabase 配置（url / key 传空串即关闭同步）。
   * 改完需重新 init() 才会切换驱动模式。
   */
  setSupabaseConfig: function (url, key) {
    _sbUrl = (url || '').trim();
    _sbKey = (key || '').trim();
    sharedDriver.resetCache();
    return isSupabaseReady();
  },

  /** 强制回源刷新；返回是否有远端数据。供「下拉刷新 / 手动同步」用 */
  pullLatest: function () {
    if (_mode !== 'shared') return Promise.resolve({ shared: false, changed: false });
    const before = sharedDriver._lastServerUpdatedAt;
    const colls = Object.keys(COLLECTIONS).map(function (k) { return COLLECTIONS[k]; });
    return Promise.all(colls.map(function (c) { return sharedDriver._read(c, true); }))
      .then(function () {
        return {
          shared: true,
          changed: sharedDriver._lastServerUpdatedAt !== before,
          lastServerUpdatedAt: sharedDriver._lastServerUpdatedAt,
          family: _openid
        };
      });
  },

  /** 同步状态（供 UI 展示「已同步 / 同步中 / 未开启」） */
  syncStatus: function () {
    if (_mode !== 'shared') return { shared: false };
    return Object.assign({ shared: true }, sharedDriver.status());
  },

  list: function (collection, opts) { return driver().list(collection, opts); },
  listAll: listAll,
  count: function (collection, where) { return driver().count(collection, where); },
  get: function (collection, id) { return driver().get(collection, id); },
  add: function (collection, data) { return driver().add(collection, data); },
  bulkAdd: function (collection, docs) { return driver().bulkAdd(collection, docs); },
  update: function (collection, id, patch) { return driver().update(collection, id, patch); },
  remove: function (collection, id) { return driver().remove(collection, id); },
  clear: function (collection) { return driver().clear(collection); },
  clearLocal: function (collection) { return localDriver.clear(collection); },

  /** 本地演示模式下清空全部数据（用于「重置演示数据」） */
  resetLocalAll: function () {
    Object.keys(COLLECTIONS).forEach(function (k) {
      try { wx.removeStorageSync(LS_PREFIX + COLLECTIONS[k]); } catch (e) { /* ignore */ }
    });
    return Promise.resolve(true);
  },

  /** 上传图片到云存储（本地模式返回临时路径） */
  uploadImage: function (filePath, folder) {
    if (_mode !== 'cloud') return Promise.resolve(filePath);
    const ext = (filePath.split('.').pop() || 'png').split('?')[0];
    const name = (folder || 'ffm') + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '.' + ext;
    return wx.cloud.uploadFile({ cloudPath: name, filePath: filePath }).then(function (res) {
      return res.fileID;
    });
  },

  /** fileID -> 可直接用于 <image src> 的地址 */
  imageUrl: function (fileID) {
    if (!fileID) return '';
    if (fileID.indexOf('cloud://') === 0) {
      // 云存储 fileID 可直接给 image 使用
      return fileID;
    }
    return fileID;
  }
};

window.FFM.db = db;

})();
