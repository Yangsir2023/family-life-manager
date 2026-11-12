/* -------------------------------------------------------------------------- */
/* 由 tools/build-web.js 从小程序源码自动生成，请勿直接编辑。                    */
/* 源文件：miniprogram/utils/format.js                                        */
/* -------------------------------------------------------------------------- */
(function () {
"use strict";
window.FFM = window.FFM || {};

/**
 * 通用格式化 / 日期 / 金额计算工具
 * 全部以「元」为金额单位，内部用 round2 消除浮点误差。
 */

const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 四舍五入到分 */
function round2(n) {
  const v = Number(n) || 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** 保留 2 位小数字符串 */
function fixed2(n) {
  return round2(n).toFixed(2);
}

/**
 * 金额展示：整数不显示小数，非整数保留 2 位
 * 128 -> "128"   128.5 -> "128.50"
 */
function money(n) {
  const v = round2(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/** 带 ¥ 前缀 */
function yuan(n) {
  return '¥' + money(n);
}

/** 大额缩写：1234.5 -> 1,234.5 */
function thousand(n) {
  const s = money(n);
  const parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

// ---------------------------------------------------------------- 日期
function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/** Date -> 'YYYY-MM-DD' */
function toISODate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
}

/** 今天 'YYYY-MM-DD' */
function today() {
  return toISODate(new Date());
}

/** 'YYYY-MM-DD' -> Date（本地 0 点） */
function parseISODate(s) {
  if (!s) return new Date();
  const p = String(s).split('-').map(Number);
  return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
}

/** 日期加减天数，返回 'YYYY-MM-DD' */
function addDays(dateStr, n) {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** 取所在周的周一（中国习惯周一为一周开始） */
function weekStart(dateStr) {
  const d = parseISODate(dateStr || today());
  const dow = d.getDay(); // 0=周日
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

/** 一周 7 天的日期数组 */
function weekDays(startStr) {
  const s = startStr || weekStart(today());
  const out = [];
  for (let i = 0; i < 7; i++) out.push(addDays(s, i));
  return out;
}

/** 'YYYY-MM-DD' -> '周一' */
function weekLabel(dateStr) {
  return WEEK_CN[parseISODate(dateStr).getDay()];
}

/** 'YYYY-MM-DD' -> '10/13' */
function shortDate(dateStr) {
  const d = parseISODate(dateStr);
  return (d.getMonth() + 1) + '/' + d.getDate();
}

/** 'YYYY-MM-DD' -> '10月13日' */
function cnDate(dateStr) {
  const d = parseISODate(dateStr);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

/** 相对日期标签 */
function relDate(dateStr) {
  const t = today();
  if (dateStr === t) return '今天';
  if (dateStr === addDays(t, -1)) return '昨天';
  if (dateStr === addDays(t, 1)) return '明天';
  return cnDate(dateStr);
}

/** 一周区间文字：10月13日 - 10月19日 */
function weekRangeText(startStr) {
  const s = startStr || weekStart(today());
  return cnDate(s) + ' - ' + cnDate(addDays(s, 6));
}

/** 两个日期相差天数 */
function diffDays(a, b) {
  const d1 = parseISODate(a).getTime();
  const d2 = parseISODate(b).getTime();
  return Math.round((d1 - d2) / 86400000);
}

/** 'YYYY-MM-DDTHH:mm:ss' -> '10-13 18:20' */
function fmtTime(iso) {
  if (!iso) return '';
  const raw = String(iso);
  const d = raw.length === 10 ? parseISODate(raw) : new Date(raw);
  if (isNaN(d.getTime())) return '';
  return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

// ---------------------------------------------------------------- 计算
/** 单项金额 = 用量 × 单价 */
function amount(qty, price) {
  return round2((Number(qty) || 0) * (Number(price) || 0));
}

/** 汇总条目金额 */
function sumItems(items) {
  return round2((items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0));
}

/** 按 key 分组求和 */
function groupSum(list, key, valueKey) {
  const map = {};
  (list || []).forEach((it) => {
    const k = it[key];
    map[k] = round2((map[k] || 0) + (Number(it[valueKey]) || 0));
  });
  return map;
}

/** 百分比（0-100 整数） */
function percent(part, total) {
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.min(999, Math.round(((Number(part) || 0) / t) * 100));
}

/** 数量展示：1 -> "1"，0.5 -> "0.5" */
function qty(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return Number.isInteger(v) ? String(v) : String(v);
}

/** 单位 key -> 中文名 */
function unitName(key, units) {
  const found = (units || []).filter((u) => u.key === key)[0];
  return found ? found.name : key || '';
}

/** 生成短 ID */
function shortId(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

window.FFM.format = {
  round2,
  fixed2,
  money,
  yuan,
  thousand,
  toISODate,
  today,
  parseISODate,
  addDays,
  weekStart,
  weekDays,
  weekLabel,
  shortDate,
  cnDate,
  relDate,
  weekRangeText,
  diffDays,
  fmtTime,
  amount,
  sumItems,
  groupSum,
  percent,
  qty,
  unitName,
  shortId
};

})();
