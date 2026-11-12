/* -------------------------------------------------------------------------- */
/* 由 tools/build-web.js 从小程序源码自动生成，请勿直接编辑。                    */
/* 源文件：miniprogram/utils/family.js                                        */
/* -------------------------------------------------------------------------- */
(function () {
"use strict";
window.FFM = window.FFM || {};

/**
 * 家庭码（多设备同步的房间号）
 *
 * 作用：把「哪份数据属于我」从设备维度提升到家庭维度。
 *   - 手机、电脑、平板填入同一个家庭码 → 看到同一份账本
 *   - 不知道码的人打开链接 → 各自一份空账本，互不干扰
 *
 * 存储：localStorage / 微信 Storage，键名 ffm_family。
 * 家庭码是 6 位大写字母+数字（去掉易混淆的 0/O/1/I），约 21 亿组合。
 */

// 去掉 0/O/1/I 这类看错的字符
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LS_KEY = 'ffm_family';

let _code = null;

function storage() {
  if (typeof wx !== 'undefined' && wx.getStorageSync) return wx;
  return null;
}

function readRaw() {
  const w = storage();
  if (w) {
    try {
      const v = w.getStorageSync(LS_KEY);
      return v === '' || v === undefined || v === null ? null : String(v);
    } catch (e) { return null; }
  }
  try {
    const v = localStorage.getItem(LS_KEY);
    return v === '' || v === undefined || v === null ? null : String(v);
  } catch (e) { return null; }
}

function writeRaw(code) {
  const w = storage();
  if (w) {
    try { w.setStorageSync(LS_KEY, code); return true; } catch (e) { /* fallthrough */ }
  }
  try { localStorage.setItem(LS_KEY, code); return true; } catch (e) { return false; }
}

function randomCode() {
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return 'FAM-' + s;
}

/** 规范化用户输入：大写、去空格、自动补 FAM- 前缀 */
function normalize(input) {
  let s = String(input == null ? '' : input).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return '';
  if (s.indexOf('FAM') === 0) s = s.slice(3);
  if (s.length !== 6) return '';
  // 校验字符都在允许表里（防止用户手打 0/O/1/I）
  for (let i = 0; i < s.length; i++) {
    if (ALPHABET.indexOf(s[i]) < 0) return '';
  }
  return 'FAM-' + s;
}

const family = {
  /** 取当前家庭码；没有则生成一个并落库（首次进入自动建房间） */
  current: function () {
    if (_code) return _code;
    const existed = readRaw();
    if (existed) { _code = normalize(existed) || existed; return _code; }
    const fresh = randomCode();
    writeRaw(fresh);
    _code = fresh;
    return fresh;
  },

  /** 切换到指定家庭码（加入家人的房间）。非法输入返回 null */
  join: function (input) {
    const code = normalize(input);
    if (!code) return null;
    writeRaw(code);
    _code = code;
    return code;
  },

  /** 重新生成一个家庭码（相当于开一个新房间，旧房间数据留在云端） */
  reset: function () {
    const fresh = randomCode();
    writeRaw(fresh);
    _code = fresh;
    return fresh;
  },

  normalize: normalize
};

window.FFM.family = family;

})();
