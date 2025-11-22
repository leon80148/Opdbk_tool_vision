const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload Script
 * 提供安全的 API 給 Renderer Process
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 查詢病患資料
   * @param {string} patientId - 病歷號
   * @returns {Promise<Object>} 病患資料
   */
  queryPatient: (patientId) => ipcRenderer.invoke('query-patient', patientId),

  /**
   * 手動觸發同步
   * @returns {Promise<Object>} 同步結果
   */
  manualSync: () => ipcRenderer.invoke('manual-sync'),

  /**
   * 取得同步狀態
   * @returns {Promise<Object>} 同步狀態
   */
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),

  /**
   * 取得設定
   * @returns {Promise<Object>} 設定物件
   */
  getConfig: () => ipcRenderer.invoke('get-config'),

  /**
   * 儲存設定
   * @param {Object} config - 設定物件
   * @returns {Promise<Object>} 儲存結果
   */
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  /**
   * 取得目前視窗位置和大小
   * @returns {Promise<Object>} 視窗邊界資訊
   */
  getCurrentWindowBounds: () => ipcRenderer.invoke('get-window-bounds').then(result => result.success ? result.data : null),

  /**
   * 關閉應用程式
   * @returns {Promise<void>}
   */
  closeApp: () => ipcRenderer.invoke('close-app'),

  /**
   * 監聽資料庫初始化進度
   * @param {Function} callback - 進度回呼函數
   */
  onDbInitProgress: (callback) => {
    ipcRenderer.on('db-init-progress', (event, progress) => callback(progress));
  },

  /**
   * 監聽資料庫初始化錯誤
   * @param {Function} callback - 錯誤回呼函數
   */
  onDbInitError: (callback) => {
    ipcRenderer.on('db-init-error', (event, error) => callback(error));
  },

  /**
   * 監聽病患ID抓取事件（從其他視窗複製）
   * @param {Function} callback - 回呼函數，參數為抓取到的ID（病歷號或身分證）
   * @returns {Function} 清理函數，用於移除監聽器
   */
  onPatientIdCaptured: (callback) => {
    const handler = (event, patientId) => callback(patientId);
    ipcRenderer.on('patient-id-captured', handler);

    // 返回清理函數
    return () => {
      ipcRenderer.removeListener('patient-id-captured', handler);
    };
  },
});
