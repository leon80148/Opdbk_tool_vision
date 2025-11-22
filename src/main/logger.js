const winston = require('winston');
const path = require('path');
const fs = require('fs');

// 確保 logs 目錄存在
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * 遮蔽敏感資料
 * @param {string} text - 原始文字
 * @returns {string} 遮蔽後的文字
 */
function maskSensitiveData(text) {
  if (!text) return text;

  // 遮蔽身分證號：A123456789 → A1******89
  text = text.replace(/([A-Z]\d)(\d{6})(\d{2})/g, '$1******$3');

  return text;
}

/**
 * 自訂格式化器
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let msg = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    // 遮蔽敏感資料
    msg = maskSensitiveData(msg);

    if (stack) {
      msg += `\n${stack}`;
    }

    return msg;
  })
);

/**
 * Logger 實例
 */
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: customFormat,
  transports: [
    // 控制台輸出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      ),
    }),
    // 檔案輸出
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // 錯誤檔案
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

module.exports = logger;
