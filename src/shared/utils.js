/**
 * 共用工具函式
 */

/**
 * 格式化病歷號（補零至 7 碼）
 * @param {string|number} id - 病歷號
 * @returns {string} 格式化後的病歷號
 */
function formatPatientId(id) {
  if (!id) return '';

  // 移除空格並轉為字串
  const idStr = String(id).trim();

  // 移除前導零後再補零（確保正確格式）
  const numeric = idStr.replace(/^0+/, '') || '0';

  return numeric.padStart(7, '0');
}

/**
 * 格式化日期
 * @param {Date} date - 日期物件
 * @param {string} format - 格式（YYYYMMDD, YYYY-MM-DD 等）
 * @returns {string} 格式化後的日期字串
 */
function formatDate(date, format = 'YYYYMMDD') {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (format) {
    case 'YYYYMMDD':
      return `${year}${month}${day}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'YYYY/MM/DD':
      return `${year}/${month}/${day}`;
    default:
      return `${year}${month}${day}`;
  }
}

/**
 * 解析日期字串（YYYYMMDD）
 * @param {string} dateStr - 日期字串
 * @returns {Date|null} 日期物件
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) {
    return null;
  }

  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));

  return new Date(year, month, day);
}

/**
 * 計算兩個日期之間的天數
 * @param {string|Date} date1 - 日期1
 * @param {string|Date} date2 - 日期2
 * @returns {number} 天數差異
 */
function daysBetween(date1, date2) {
  const d1 = typeof date1 === 'string' ? parseDate(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseDate(date2) : date2;

  if (!d1 || !d2) return null;

  const diff = Math.abs(d2 - d1);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * 遮蔽身分證號
 * @param {string} pid - 身分證字號
 * @returns {string} 遮蔽後的身分證號
 */
function maskPID(pid) {
  if (!pid || pid.length < 4) {
    return '***';
  }

  return pid.substring(0, 2) + '******' + pid.slice(-2);
}

/**
 * 驗證病歷號格式
 * @param {string} id - 病歷號
 * @returns {boolean} 是否有效
 */
function isValidPatientId(id) {
  if (!id) return false;

  const trimmed = String(id).trim();
  return /^\d{1,7}$/.test(trimmed);
}

/**
 * 深度合併物件
 * @param {object} target - 目標物件
 * @param {object} source - 來源物件
 * @returns {object} 合併後的物件
 */
function deepMerge(target, source) {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }

  return output;
}

/**
 * 檢查是否為物件
 * @param {any} item - 項目
 * @returns {boolean} 是否為物件
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * 延遲執行
 * @param {number} ms - 毫秒數
 * @returns {Promise} Promise
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  formatPatientId,
  formatDate,
  parseDate,
  daysBetween,
  maskPID,
  isValidPatientId,
  deepMerge,
  isObject,
  sleep,
};
