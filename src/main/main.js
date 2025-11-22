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

/**
 * 建立主視窗
 */
function createWindow() {
  const config = configManager.getConfig();

  mainWindow = new BrowserWindow({
    width: config.ui?.window_width || 1200,
    height: config.ui?.window_height || 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

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
  });

  // 視窗關閉時清理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 註冊全域熱鍵
 */
function registerGlobalHotkey() {
  const config = configManager.getConfig();
  const hotkey = config.hotkey?.global || 'Ctrl+Alt+C';

  try {
    const success = globalShortcut.register(hotkey, () => {
      logger.info(`Global hotkey triggered: ${hotkey}`);

      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
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

    // 初始化資料庫管理器
    databaseManager = new DatabaseManager(config);
    await databaseManager.initialize();

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
