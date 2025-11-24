const fs = require('fs');
const path = require('path');
const ini = require('ini');
const { app } = require('electron');
const logger = require('./logger');

/**
 * 設定管理器
 * 負責載入與管理 config.ini 設定檔
 */
class ConfigManager {
  constructor(configPath = null) {
    // 取得應用程式根目錄（打包後使用安裝目錄，開發時使用專案根目錄）
    const appRoot = app && app.isPackaged
      ? path.dirname(app.getPath('exe'))
      : path.join(__dirname, '../..');

    const defaultConfigPath = app.isPackaged
      ? path.join(appRoot, 'config.ini')
      : path.join(__dirname, '../../config.ini');

    this.configPath = configPath || defaultConfigPath;
    this.exampleConfigPath = app.isPackaged
      ? path.join(appRoot, 'resources', 'config.ini.example')
      : path.join(__dirname, '../../config.ini.example');

    this.appRoot = appRoot; // 儲存根目錄供後續使用
    this.config = null;
    this.defaults = this.getDefaultConfig();
  }

  /**
   * 取得預設設定
   */
  getDefaultConfig() {
    // 使用應用程式根目錄（所有檔案都放在安裝目錄下）
    const appRoot = this.appRoot;
    const resourcesPath = app && app.isPackaged
      ? path.join(appRoot, 'resources')
      : appRoot;

    return {
      clinic: {
        name: '診所掛號助手',
      },
      database: {
        dbf_root: path.join(appRoot, 'data'),
        sqlite_path: path.join(appRoot, 'data', 'lab_cache.db'),
        connection_mode: 'odbc',
        encoding: 'big5',
        preload_years_back: 3,
      },
      hotkey: {
        global: 'Ctrl+1',
        capture: 'Ctrl+2',
        conflict_handling: 'warn',
      },
      labs: {
        lab_code_map: path.join(resourcesPath, 'config', 'lab_codes.json'),
        data_retention_years: 3,
        decimal_places: 2,
      },
      sync: {
        interval_minutes: 10,
        sync_on_startup: true,
        retry_count: 3,
        retry_interval_seconds: 30,
        batch_size: 5000,
      },
      rules: {
        rules_definition: path.join(resourcesPath, 'config', 'rules.json'),
        cache_ttl_seconds: 60,
        max_action_items: 10,
      },
      ui: {
        window_width: 1200,
        window_height: 800,
        start_maximized: true,
        hide_menu_bar: true,
        theme: 'light',
        font_size: 14,
        auto_pad_patient_id: true,
      },
      logging: {
        log_level: 'info',
        log_file: path.join(appRoot, 'logs', 'app.log'),
        log_max_size_mb: 10,
        log_max_files: 5,
        mask_sensitive_data: true,
      },
      performance: {
        query_timeout_seconds: 5,
        sqlite_cache_size_kb: 10000,
        enable_query_cache: true,
        query_cache_ttl_seconds: 300,
      },
      security: {
        encrypt_sqlite: false,
        network_access: 'none',
        auto_logout_minutes: 0,
      },
    };
  }

  /**
   * 載入設定檔
   */
  async load() {
    try {
      // 首次啟動：從 example 複製 config.ini
      if (!fs.existsSync(this.configPath)) {
        await this.createDefaultConfig();
      }

      if (fs.existsSync(this.configPath)) {
        logger.info(`Loading config from: ${this.configPath}`);

        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const parsedConfig = ini.parse(fileContent);

        // 合併預設值與載入的設定
        this.config = this.mergeConfig(this.defaults, parsedConfig);

        logger.info('Config loaded successfully');
      } else {
        logger.warn(`Config file not found: ${this.configPath}, using defaults`);
        this.config = this.defaults;
      }

      // 驗證設定
      this.validateConfig();

      return this.config;
    } catch (error) {
      logger.error('Failed to load config:', error);
      this.config = this.defaults;
      return this.config;
    }
  }

  /**
   * 建立預設設定檔（從 example 複製）
   */
  async createDefaultConfig() {
    try {
      logger.info('Creating default config.ini from example...');

      // 確保 userData 目錄存在
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // 嘗試從 example 複製
      if (fs.existsSync(this.exampleConfigPath)) {
        fs.copyFileSync(this.exampleConfigPath, this.configPath);
        logger.info(`Config created from example: ${this.configPath}`);
      } else {
        // 無 example 檔案，建立最小設定檔
        logger.warn('config.ini.example not found, creating minimal config');
        const minimalConfig = ini.stringify(this.defaults);
        fs.writeFileSync(this.configPath, minimalConfig, 'utf-8');
        logger.info(`Minimal config created: ${this.configPath}`);
      }
    } catch (error) {
      logger.error('Failed to create default config:', error);
      throw error;
    }
  }

  /**
   * 合併設定
   */
  mergeConfig(defaults, loaded) {
    const merged = { ...defaults };

    for (const section in loaded) {
      if (typeof loaded[section] === 'object' && !Array.isArray(loaded[section])) {
        merged[section] = {
          ...(merged[section] || {}),
          ...loaded[section],
        };

        // 轉換數值型別
        for (const key in merged[section]) {
          const value = merged[section][key];
          if (typeof value === 'string') {
            // 轉換布林值
            if (value.toLowerCase() === 'true') {
              merged[section][key] = true;
            } else if (value.toLowerCase() === 'false') {
              merged[section][key] = false;
            }
            // 轉換數字
            else if (!isNaN(value) && value.trim() !== '') {
              merged[section][key] = Number(value);
            }
          }
        }
      }
    }

    return merged;
  }

  /**
   * 驗證設定
   */
  validateConfig() {
    const warnings = [];

    // 警告 DBF 根目錄不存在（不阻止啟動，使用者可能還沒設定）
    if (!fs.existsSync(this.config.database.dbf_root)) {
      warnings.push(`DBF root directory not found: ${this.config.database.dbf_root}`);
      logger.warn(`DBF root directory not found: ${this.config.database.dbf_root}`);
      logger.warn('Please configure dbf_root in config.ini');
    }

    // 驗證 LabCodeMap 檔案（必須存在）
    if (!fs.existsSync(this.config.labs.lab_code_map)) {
      logger.error(`LabCodeMap file not found: ${this.config.labs.lab_code_map}`);
      // 不拋出錯誤，使用預設值
    }

    // 驗證同步間隔
    if (this.config.sync.interval_minutes < 0) {
      logger.warn('Sync interval is negative, periodic sync will be disabled');
    }

    if (warnings.length > 0) {
      logger.warn('Config validation warnings:', warnings);
    } else {
      logger.info('Config validation passed');
    }
  }

  /**
   * 取得設定
   */
  getConfig() {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * 取得特定設定值
   */
  get(section, key = null) {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.');
    }

    if (key) {
      return this.config[section]?.[key];
    }

    return this.config[section];
  }

  /**
   * 重新載入設定檔（用於讀取手動編輯的設定檔）
   */
  async reload() {
    try {
      if (fs.existsSync(this.configPath)) {
        logger.info(`Reloading config from: ${this.configPath}`);

        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const parsedConfig = ini.parse(fileContent);

        // 合併預設值與載入的設定
        this.config = this.mergeConfig(this.defaults, parsedConfig);

        logger.info('Config reloaded successfully');
      } else {
        logger.warn(`Config file not found during reload: ${this.configPath}`);
      }

      return this.config;
    } catch (error) {
      logger.error('Failed to reload config:', error);
      throw error;
    }
  }

  /**
   * 儲存設定到檔案
   */
  async save(newConfig) {
    try {
      // 合併新設定到目前設定
      for (const section in newConfig) {
        if (!this.config[section]) {
          this.config[section] = {};
        }
        Object.assign(this.config[section], newConfig[section]);
      }

      // 轉換成 INI 格式
      const iniContent = ini.stringify(this.config);

      // 寫入檔案
      fs.writeFileSync(this.configPath, iniContent, 'utf-8');

      logger.info('Config saved successfully');
      return true;
    } catch (error) {
      logger.error('Failed to save config:', error);
      throw error;
    }
  }
}

module.exports = ConfigManager;
