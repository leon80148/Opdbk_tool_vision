const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const ConfigManager = require('./config-manager');
const DatabaseManager = require('../db/database-manager');
const SyncManager = require('../db/sync-manager');
const logger = require('./logger');

let mainWindow = null;
let configManager = null;
let databaseManager = null;
let syncManager = null;
let isWindowVisible = false; // 追蹤視窗可見狀態（用於熱鍵切換）

/**
 * 建立主視窗
 */
function createWindow() {
  const config = configManager.getConfig();

  // 視窗選項
  const windowOptions = {
    width: config.ui?.window_width || 1200,
    height: config.ui?.window_height || 800,
    show: false,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  };

  // 如果有設定視窗位置，則使用設定的位置
  if (config.ui?.window_x !== null && config.ui?.window_x !== undefined) {
    windowOptions.x = config.ui.window_x;
  }
  if (config.ui?.window_y !== null && config.ui?.window_y !== undefined) {
    windowOptions.y = config.ui.window_y;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // 開發模式：載入 Vite 開發伺服器
  // 生產模式：載入建置後的檔案
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist-renderer/index.html'));
  }

  // 視窗準備好後顯示
  mainWindow.once('ready-to-show', () => {
    if (config.ui?.start_maximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
    isWindowVisible = true;
  });

  // 監聽視窗顯示/隱藏事件
  mainWindow.on('show', () => {
    isWindowVisible = true;
  });

  mainWindow.on('hide', () => {
    isWindowVisible = false;
  });

  mainWindow.on('minimize', () => {
    isWindowVisible = false;
  });

  mainWindow.on('restore', () => {
    isWindowVisible = true;
  });

  // 視窗關閉前儲存位置和大小
  mainWindow.on('close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      const config = configManager.getConfig();

      // 更新設定（不儲存到檔案，下次啟動時會使用）
      config.ui.window_x = bounds.x;
      config.ui.window_y = bounds.y;
      config.ui.window_width = bounds.width;
      config.ui.window_height = bounds.height;

      logger.info(`Window bounds saved: ${JSON.stringify(bounds)}`);
    }
  });

  // 視窗關閉時清理
  mainWindow.on('closed', () => {
    mainWindow = null;
    isWindowVisible = false;
  });
}

/**
 * 註冊全域熱鍵
 * 按一次：顯示並置頂（alwaysOnTop）
 * 再按一次：最小化
 */
function registerGlobalHotkey() {
  const config = configManager.getConfig();
  const hotkey = config.hotkey?.global || 'Ctrl+Alt+C';

  try {
    const success = globalShortcut.register(hotkey, () => {
      logger.info(`Global hotkey triggered: ${hotkey}, isWindowVisible: ${isWindowVisible}`);

      if (!mainWindow) {
        createWindow();
        return;
      }

      if (isWindowVisible && !mainWindow.isMinimized()) {
        // 視窗已顯示且未最小化 → 最小化
        logger.info('Window visible, minimizing...');
        mainWindow.minimize();
      } else {
        // 視窗未顯示或已最小化 → 恢復、顯示、置頂、聚焦
        logger.info('Window hidden or minimized, showing and setting always on top...');
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.setAlwaysOnTop(true); // 置頂
        mainWindow.show();
        mainWindow.focus();

        // 0.5秒後取消置頂（保持在最上層，但不永久置頂）
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
          }
        }, 500);
      }
    });

    if (success) {
      logger.info(`Global hotkey registered: ${hotkey}`);
    } else {
      logger.warn(`Failed to register global hotkey: ${hotkey}`);

      if (config.hotkey?.conflict_handling === 'fail') {
        app.quit();
      }
    }
  } catch (error) {
    logger.error('Error registering global hotkey:', error);

    if (config.hotkey?.conflict_handling === 'fail') {
      app.quit();
    }
  }
}

/**
 * 初始化資料庫與同步管理
 */
async function initializeDatabase() {
  try {
    const config = configManager.getConfig();

    // 進度回呼函數：轉發到前端
    const progressCallback = (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('db-init-progress', progress);
      }
    };

    // 初始化資料庫管理器
    databaseManager = new DatabaseManager(config);
    await databaseManager.initialize(progressCallback);

    // 初始化同步管理器
    syncManager = new SyncManager(config, databaseManager);

    // 啟動時同步
    if (config.sync?.sync_on_startup !== false) {
      logger.info('Starting initial sync...');
      await syncManager.runSync();
    }

    // 啟動定期同步
    const intervalMinutes = config.sync?.interval_minutes || 0;
    if (intervalMinutes > 0) {
      syncManager.startPeriodicSync(intervalMinutes);
      logger.info(`Periodic sync enabled: every ${intervalMinutes} minutes`);
    }

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);

    // 發送錯誤到前端
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('db-init-error', {
        message: error.message,
        stack: error.stack
      });
    }

    throw error;
  }
}

/**
 * 設定 IPC 處理器
 */
function setupIpcHandlers() {
  // 查詢病患資料
  ipcMain.handle('query-patient', async (event, patientId) => {
    try {
      logger.info(`Querying patient: ${patientId}`);
      const result = await databaseManager.queryPatient(patientId);
      return { success: true, data: result };
    } catch (error) {
      logger.error('Error querying patient:', error);
      return { success: false, error: error.message };
    }
  });

  // 手動觸發同步
  ipcMain.handle('manual-sync', async () => {
    try {
      logger.info('Manual sync triggered');
      await syncManager.runSync();
      return { success: true };
    } catch (error) {
      logger.error('Error during manual sync:', error);
      return { success: false, error: error.message };
    }
  });

  // 取得同步狀態
  ipcMain.handle('get-sync-status', async () => {
    try {
      const status = databaseManager.getSyncMeta();
      return { success: true, data: status };
    } catch (error) {
      logger.error('Error getting sync status:', error);
      return { success: false, error: error.message };
    }
  });

  // 取得設定
  ipcMain.handle('get-config', async () => {
    try {
      const config = configManager.getConfig();
      return { success: true, data: config };
    } catch (error) {
      logger.error('Error getting config:', error);
      return { success: false, error: error.message };
    }
  });

  // 儲存設定
  ipcMain.handle('save-config', async (event, newConfig) => {
    try {
      logger.info('Saving config:', newConfig);
      await configManager.save(newConfig);

      // 如果熱鍵有變更，重新註冊
      if (newConfig.hotkey?.global) {
        const currentHotkey = configManager.get('hotkey', 'global');
        if (currentHotkey !== newConfig.hotkey.global) {
          logger.info('Hotkey changed, re-registering...');
          globalShortcut.unregisterAll();
          registerGlobalHotkey();
        }
      }

      return { success: true };
    } catch (error) {
      logger.error('Error saving config:', error);
      return { success: false, error: error.message };
    }
  });

  // 取得目前視窗位置和大小
  ipcMain.handle('get-window-bounds', async () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const bounds = mainWindow.getBounds();
        return { success: true, data: bounds };
      }
      return { success: false, error: 'Window not available' };
    } catch (error) {
      logger.error('Error getting window bounds:', error);
      return { success: false, error: error.message };
    }
  });

  // 關閉應用程式
  ipcMain.handle('close-app', async () => {
    try {
      logger.info('Closing application via IPC');
      app.quit();
      return { success: true };
    } catch (error) {
      logger.error('Error closing app:', error);
      return { success: false, error: error.message };
    }
  });
}

/**
 * 應用程式啟動
 */
app.whenReady().then(async () => {
  try {
    // 載入設定檔
    configManager = new ConfigManager();
    await configManager.load();

    // 建立視窗
    createWindow();

    // 註冊全域熱鍵
    registerGlobalHotkey();

    // 設定 IPC 處理器
    setupIpcHandlers();

    // 初始化資料庫（非同步，不阻塞視窗顯示）
    initializeDatabase().catch(error => {
      logger.error('Database initialization failed:', error);
    });

  } catch (error) {
    logger.error('Application startup failed:', error);
    app.quit();
  }
});

/**
 * macOS 特殊處理
 */
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

/**
 * 所有視窗關閉時退出（macOS 除外）
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * 應用程式退出前清理
 */
app.on('will-quit', () => {
  // 取消註冊全域熱鍵
  globalShortcut.unregisterAll();

  // 停止同步任務
  if (syncManager) {
    syncManager.stopPeriodicSync();
  }

  // 關閉資料庫連線
  if (databaseManager) {
    databaseManager.close();
  }

  logger.info('Application quit');
});

/**
 * 未處理的錯誤
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
});
