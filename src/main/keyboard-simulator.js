const robot = require('robotjs');
const logger = require('./logger');

/**
 * 鍵盤模擬器
 * 使用 robotjs 進行原生鍵盤模擬（快速且可靠）
 *
 * robotjs 優勢：
 * - 速度快：<10ms（PowerShell 需要 500-5000ms）
 * - 可靠性高：原生 C++ 綁定，無超時問題
 * - 跨平台：支援 Windows、macOS、Linux
 */
class KeyboardSimulator {
  /**
   * 模擬 Ctrl+A（全選）
   */
  selectAll() {
    try {
      robot.keyTap('a', 'control');  // 正確順序：主鍵在前，修飾鍵在後
      logger.debug('Keyboard: Ctrl+A sent successfully');
    } catch (error) {
      logger.error('Failed to send Ctrl+A', error);
      throw new Error(`鍵盤模擬失敗 (Ctrl+A): ${error.message}`);
    }
  }

  /**
   * 模擬 Ctrl+C（複製）
   */
  copy() {
    try {
      robot.keyTap('c', 'control');  // 正確順序：主鍵在前，修飾鍵在後
      logger.debug('Keyboard: Ctrl+C sent successfully');
    } catch (error) {
      logger.error('Failed to send Ctrl+C', error);
      throw new Error(`鍵盤模擬失敗 (Ctrl+C): ${error.message}`);
    }
  }

  /**
   * 模擬 Ctrl+V（貼上）
   */
  paste() {
    try {
      robot.keyTap('v', 'control');
      logger.debug('Keyboard: Ctrl+V sent successfully');
    } catch (error) {
      logger.error('Failed to send Ctrl+V', error);
      throw new Error(`鍵盤模擬失敗 (Ctrl+V): ${error.message}`);
    }
  }

  /**
   * 發送按鍵組合（通用方法）
   * @param {string} key - 按鍵（例如 'a', 'c', 'v'）
   * @param {string|string[]} modifier - 修飾鍵（例如 'control', 'shift', 'alt'）
   */
  sendKey(key, modifier = null) {
    try {
      if (modifier) {
        robot.keyTap(key, modifier);
        logger.debug(`Keyboard: ${modifier}+${key} sent successfully`);
      } else {
        robot.keyTap(key);
        logger.debug(`Keyboard: ${key} sent successfully`);
      }
    } catch (error) {
      logger.error(`Failed to send key: ${key}`, error);
      throw new Error(`鍵盤模擬失敗 (${key}): ${error.message}`);
    }
  }

  /**
   * 等待指定毫秒數
   * @param {number} ms - 等待時間（毫秒）
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new KeyboardSimulator();
