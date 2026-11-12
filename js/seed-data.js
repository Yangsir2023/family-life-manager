/* -------------------------------------------------------------------------- */
/* 由 tools/build-web.js 从小程序源码自动生成，请勿直接编辑。                    */
/* 源文件：miniprogram/config/seed-data.js                                        */
/* -------------------------------------------------------------------------- */
(function () {
"use strict";
window.FFM = window.FFM || {};

/**
 * 纸坊菜市场常见食材物价种子数据
 * 价格单位：元 / 对应 unit（斤、个、把、份、盒、袋）
 * 说明：价格为 2026 年 10 月纸坊片区市场参考价，可在小程序内随时修改。
 * 该文件同时被「小程序端本地演示模式」和「云函数 seed」使用（两处内容保持一致）。
 */
window.FFM.seedData = [
  // ---------------- 蔬菜 ----------------
  { name: '大白菜', category: 'vegetable', unit: '斤', price: 1.98, shop: '纸坊菜市场', spec: '本地露天' },
  { name: '小白菜', category: 'vegetable', unit: '斤', price: 2.80, shop: '纸坊菜市场', spec: '本地时令' },
  { name: '上海青', category: 'vegetable', unit: '斤', price: 3.20, shop: '纸坊菜市场', spec: '' },
  { name: '土豆', category: 'vegetable', unit: '斤', price: 2.58, shop: '纸坊菜市场', spec: '黄心' },
  { name: '西红柿', category: 'vegetable', unit: '斤', price: 4.20, shop: '纸坊菜市场', spec: '沙瓤' },
  { name: '黄瓜', category: 'vegetable', unit: '斤', price: 3.50, shop: '纸坊菜市场', spec: '带刺' },
  { name: '青椒', category: 'vegetable', unit: '斤', price: 3.98, shop: '纸坊菜市场', spec: '' },
  { name: '螺丝椒', category: 'vegetable', unit: '斤', price: 5.20, shop: '纸坊菜市场', spec: '微辣' },
  { name: '茄子', category: 'vegetable', unit: '斤', price: 3.80, shop: '纸坊菜市场', spec: '紫长茄' },
  { name: '长豆角', category: 'vegetable', unit: '斤', price: 5.50, shop: '纸坊菜市场', spec: '' },
  { name: '菠菜', category: 'vegetable', unit: '斤', price: 4.50, shop: '纸坊菜市场', spec: '' },
  { name: '生菜', category: 'vegetable', unit: '斤', price: 3.20, shop: '纸坊菜市场', spec: '' },
  { name: '芹菜', category: 'vegetable', unit: '斤', price: 3.00, shop: '纸坊菜市场', spec: '西芹' },
  { name: '白萝卜', category: 'vegetable', unit: '斤', price: 1.80, shop: '纸坊菜市场', spec: '' },
  { name: '胡萝卜', category: 'vegetable', unit: '斤', price: 2.50, shop: '纸坊菜市场', spec: '' },
  { name: '莲藕', category: 'vegetable', unit: '斤', price: 4.98, shop: '纸坊菜市场', spec: '蔡甸藕' },
  { name: '冬瓜', category: 'vegetable', unit: '斤', price: 2.20, shop: '纸坊菜市场', spec: '' },
  { name: '南瓜', category: 'vegetable', unit: '斤', price: 2.80, shop: '纸坊菜市场', spec: '本地蜜本' },
  { name: '娃娃菜', category: 'vegetable', unit: '袋', price: 4.50, shop: '中百仓储(纸坊店)', spec: '3 颗装' },
  { name: '韭菜', category: 'vegetable', unit: '斤', price: 3.80, shop: '纸坊菜市场', spec: '' },
  { name: '蒜苔', category: 'vegetable', unit: '斤', price: 6.50, shop: '纸坊菜市场', spec: '' },
  { name: '鲜香菇', category: 'vegetable', unit: '斤', price: 7.98, shop: '纸坊菜市场', spec: '' },
  { name: '金针菇', category: 'vegetable', unit: '袋', price: 3.50, shop: '中百仓储(纸坊店)', spec: '200g' },
  { name: '豆腐', category: 'vegetable', unit: '块', price: 2.00, shop: '纸坊菜市场', spec: '老豆腐' },
  { name: '豆芽', category: 'vegetable', unit: '斤', price: 2.50, shop: '纸坊菜市场', spec: '黄豆芽' },

  // ---------------- 肉禽蛋 ----------------
  { name: '猪五花肉', category: 'meat', unit: '斤', price: 16.80, shop: '纸坊菜市场', spec: '带皮' },
  { name: '猪里脊', category: 'meat', unit: '斤', price: 18.50, shop: '纸坊菜市场', spec: '纯瘦' },
  { name: '猪前腿肉', category: 'meat', unit: '斤', price: 14.50, shop: '纸坊菜市场', spec: '绞肉' },
  { name: '猪排骨', category: 'meat', unit: '斤', price: 25.80, shop: '纸坊菜市场', spec: '肋排' },
  { name: '猪筒骨', category: 'meat', unit: '斤', price: 12.00, shop: '纸坊菜市场', spec: '煲汤' },
  { name: '牛腩', category: 'meat', unit: '斤', price: 38.00, shop: '纸坊菜市场', spec: '' },
  { name: '牛里脊', category: 'meat', unit: '斤', price: 45.00, shop: '纸坊菜市场', spec: '' },
  { name: '三黄鸡', category: 'meat', unit: '斤', price: 12.00, shop: '纸坊菜市场', spec: '整只' },
  { name: '老母鸡', category: 'meat', unit: '斤', price: 22.00, shop: '纸坊菜市场', spec: '土鸡' },
  { name: '鸡胸肉', category: 'meat', unit: '斤', price: 11.50, shop: '纸坊菜市场', spec: '冷冻' },
  { name: '鸡翅中', category: 'meat', unit: '斤', price: 21.80, shop: '纸坊菜市场', spec: '' },
  { name: '鸭肉', category: 'meat', unit: '斤', price: 13.00, shop: '纸坊菜市场', spec: '麻鸭' },
  { name: '鸡蛋', category: 'meat', unit: '斤', price: 5.60, shop: '纸坊菜市场', spec: '红壳鲜蛋' },
  { name: '咸鸭蛋', category: 'meat', unit: '个', price: 1.80, shop: '纸坊菜市场', spec: '流油' },
  { name: '腊肉', category: 'meat', unit: '斤', price: 32.00, shop: '纸坊兴新街市场', spec: '恩施腊肉' },

  // ---------------- 水产 ----------------
  { name: '草鱼', category: 'aquatic', unit: '斤', price: 8.50, shop: '纸坊菜市场', spec: '活鱼' },
  { name: '鲫鱼', category: 'aquatic', unit: '斤', price: 11.00, shop: '纸坊菜市场', spec: '活鱼' },
  { name: '鲈鱼', category: 'aquatic', unit: '斤', price: 21.80, shop: '纸坊菜市场', spec: '活鱼' },
  { name: '鳊鱼', category: 'aquatic', unit: '斤', price: 10.00, shop: '纸坊菜市场', spec: '活鱼' },
  { name: '花鲢', category: 'aquatic', unit: '斤', price: 9.00, shop: '纸坊菜市场', spec: '鱼头' },
  { name: '黄骨鱼', category: 'aquatic', unit: '斤', price: 18.00, shop: '纸坊菜市场', spec: '' },
  { name: '基围虾', category: 'aquatic', unit: '斤', price: 32.00, shop: '纸坊菜市场', spec: '鲜活' },
  { name: '小龙虾', category: 'aquatic', unit: '斤', price: 25.00, shop: '纸坊菜市场', spec: '4-6 钱' },
  { name: '武昌鱼', category: 'aquatic', unit: '斤', price: 12.50, shop: '纸坊菜市场', spec: '樊口鳊鱼' },
  { name: '鲜带鱼', category: 'aquatic', unit: '斤', price: 16.50, shop: '中百仓储(纸坊店)', spec: '冷冻段' },

  // ---------------- 水果 ----------------
  { name: '红富士苹果', category: 'fruit', unit: '斤', price: 5.50, shop: '纸坊菜市场', spec: '山东' },
  { name: '香蕉', category: 'fruit', unit: '斤', price: 3.20, shop: '纸坊菜市场', spec: '进口' },
  { name: '砂糖橘', category: 'fruit', unit: '斤', price: 4.50, shop: '纸坊菜市场', spec: '广西' },
  { name: '沃柑', category: 'fruit', unit: '斤', price: 5.20, shop: '纸坊菜市场', spec: '' },
  { name: '皇冠梨', category: 'fruit', unit: '斤', price: 4.00, shop: '纸坊菜市场', spec: '河北' },
  { name: '巨峰葡萄', category: 'fruit', unit: '斤', price: 8.50, shop: '纸坊菜市场', spec: '' },
  { name: '西瓜', category: 'fruit', unit: '斤', price: 2.50, shop: '纸坊菜市场', spec: '本地 8424' },
  { name: '哈密瓜', category: 'fruit', unit: '斤', price: 4.50, shop: '纸坊菜市场', spec: '新疆' },
  { name: '火龙果', category: 'fruit', unit: '个', price: 6.00, shop: '纸坊菜市场', spec: '红心' },
  { name: '猕猴桃', category: 'fruit', unit: '斤', price: 5.50, shop: '纸坊菜市场', spec: '徐香' },
  { name: '冰糖心苹果', category: 'fruit', unit: '斤', price: 6.80, shop: '中百仓储(纸坊店)', spec: '阿克苏' },
  { name: '冬枣', category: 'fruit', unit: '斤', price: 7.50, shop: '纸坊菜市场', spec: '沾化' }
];

})();
