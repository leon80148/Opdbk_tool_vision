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
});
