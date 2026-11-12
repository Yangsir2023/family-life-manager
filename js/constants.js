/* -------------------------------------------------------------------------- */
/* 由 tools/build-web.js 从小程序源码自动生成，请勿直接编辑。                    */
/* 源文件：miniprogram/config/constants.js                                        */
/* -------------------------------------------------------------------------- */
(function () {
"use strict";
window.FFM = window.FFM || {};

/**
 * 全局常量与配置
 * 适用地区：武汉市江夏区纸坊
 */

// 云开发环境 ID。留空表示使用小程序当前的「默认环境」。
// 若你创建了多个云环境，请填写具体环境 ID，例如 'family-food-8gxxxxx'
const CLOUD_ENV = '';

// 云数据库集合名
const COLLECTIONS = {
  users: 'ffm_users',            // 用户与预算设置
  ingredients: 'ffm_ingredients', // 食材档案（含当前售价）
  priceLogs: 'ffm_price_logs',    // 历史价格记录
  recipes: 'ffm_recipes',         // 每日 / 每周食谱
  records: 'ffm_records',         // 采购消费记录
  carts: 'ffm_carts'              // 采购清单（按周）
};

// 食材四大分类
// iconColor 是图标可用的色名字典（对应 assets/icons 里的配色后缀，见 tools/gen-icons.py COLORS）
const CATEGORIES = [
  { key: 'vegetable', name: '蔬菜', icon: 'leaf', iconColor: 'veg', color: '#3FA96B', bg: '#EAF6EF' },
  { key: 'meat', name: '肉禽蛋', icon: 'egg', iconColor: 'meat', color: '#E4695E', bg: '#FCEDEB' },
  { key: 'aquatic', name: '水产', icon: 'fish', iconColor: 'blue', color: '#4A90D9', bg: '#EAF2FB' },
  { key: 'fruit', name: '水果', icon: 'apple', iconColor: 'orange', color: '#F0954A', bg: '#FDF1E7' }
];

// 每日消费的预设种类（「记一笔」用）。
// key 直接作为记录里 item.category 的存储值，因此用中文，统计时无需再做映射。
// 用户可以在这之外自建种类，自建种类由 biz.summary() 动态纳入分类统计。
const SPEND_CATEGORIES = [
  { key: '买菜', name: '买菜', icon: 'bag', iconColor: 'veg', color: '#3FA96B', bg: '#EAF6EF' },
  { key: '餐饮', name: '餐饮', icon: 'shop', iconColor: 'meat', color: '#E4695E', bg: '#FCEDEB' },
  { key: '日用', name: '日用', icon: 'tag', iconColor: 'blue', color: '#4A90D9', bg: '#EAF2FB' },
  { key: '交通', name: '交通', icon: 'location', iconColor: 'orange', color: '#F0954A', bg: '#FDF1E7' },
  { key: '水果零食', name: '水果零食', icon: 'apple', iconColor: 'price', color: '#E8613C', bg: '#FDF0EB' },
  { key: '其他', name: '其他', icon: 'list', iconColor: 'gray', color: '#9AA5B4', bg: '#F1F3F6' }
];

// 自建种类的默认样式（用户输入的、不在 SPEND_CATEGORIES 里的种类）
const CUSTOM_CAT_STYLE = { icon: 'tag', iconColor: 'gray', color: '#8B7BD8', bg: '#F0EDFB' };

// 计量单位
const UNITS = [
  { key: 'jin', name: '斤', step: 0.5 },
  { key: 'kg', name: '公斤', step: 0.5 },
  { key: 'ge', name: '个', step: 1 },
  { key: 'ba', name: '把', step: 1 },
  { key: 'fen', name: '份', step: 1 },
  { key: 'kuai', name: '块', step: 1 },
  { key: 'zhi', name: '只', step: 1 },
  { key: 'he', name: '盒', step: 1 },
  { key: 'dai', name: '袋', step: 1 },
  { key: 'ping', name: '瓶', step: 1 }
];

// 餐次
const MEALS = [
  { key: 'breakfast', name: '早餐' },
  { key: 'lunch', name: '午餐' },
  { key: 'dinner', name: '晚餐' }
];

// 常见购买地点（纸坊片区）
const SHOPS = [
  '纸坊菜市场',
  '纸坊北华街菜场',
  '纸坊兴新街市场',
  '中百仓储(纸坊店)',
  '武商量贩(纸坊店)',
  '社区团购'
];

const REGION = '武汉市江夏区纸坊';
const MARKET_NAME = '纸坊菜市场';
const DEFAULT_BUDGET = 400; // 默认每周饮食预算（元）
const APP_NAME = '家庭生活管家';

// 本地演示模式（云开发未配置时）使用的虚拟用户标识
const LOCAL_OPENID = 'local_demo_user';

// ============================================================================
// 多设备同步（Supabase）
// ----------------------------------------------------------------------------
// 填入你的项目信息后，网页版即开启「家庭码」云端同步：
// 同一家庭码下的所有设备（手机 / 电脑 / 平板）共享同一份账本。
// 任一端留空 = 关闭同步，自动回落到本地存储，功能不受影响。
//
// 获取方式：supabase.com → 你的项目 → Project Settings → Data API
//   SUPABASE_URL    形如 https://abcdefghijklm.supabase.co
//   SUPABASE_ANON_KEY 形如 eyJhbGciOi...（anon public key，可随前端分发）
// ============================================================================
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
const SUPABASE_TABLE = 'ffm_docs'; // 数据表名，见 docs/supabase-setup.md

// 一周中文标签
const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

window.FFM.constants = {
  CLOUD_ENV,
  COLLECTIONS,
  CATEGORIES,
  SPEND_CATEGORIES,
  CUSTOM_CAT_STYLE,
  UNITS,
  MEALS,
  SHOPS,
  REGION,
  MARKET_NAME,
  DEFAULT_BUDGET,
  APP_NAME,
  LOCAL_OPENID,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_TABLE,
  WEEK_LABELS
};

})();
