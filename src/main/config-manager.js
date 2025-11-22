const fs = require('fs');
const path = require('path');
const ini = require('ini');
const logger = require('./logger');

/**
 * 設定管理器
 * 負責載入與管理 config.ini 設定檔
 */
class ConfigManager {
  constructor(configPath = null) {
    this.configPath = configPath || path.join(__dirname, '../../config.ini');
    this.config = null;
    this.defaults = this.getDefaultConfig();
  }

  /**
   * 取得預設設定
   */
  getDefaultConfig() {
    return {
      database: {
        dbf_root: path.join(__dirname, '../../data'),
        sqlite_path: path.join(__dirname, '../../data/lab_cache.db'),
        connection_mode: 'odbc',
        encoding: 'big5',
      },
      hotkey: {
        global: 'Ctrl+Alt+C',
        capture: 'Ctrl+Alt+G',
        conflict_handling: 'warn',
      },
      labs: {
        lab_code_map: path.join(__dirname, '../../config/lab_codes.json'),
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
        rules_definition: path.join(__dirname, '../../config/rules.json'),
        cache_ttl_seconds: 60,
        max_action_items: 10,
      },
      ui: {
        window_width: 1200,
        window_height: 800,
        start_maximized: false,
        theme: 'light',
        font_size: 14,
        auto_pad_patient_id: true,
      },
      logging: {
        log_level: 'info',
        log_file: path.join(__dirname, '../../logs/app.log'),
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
    const errors = [];

    // 驗證 DBF 根目錄
    if (!fs.existsSync(this.config.database.dbf_root)) {
      errors.push(`DBF root directory not found: ${this.config.database.dbf_root}`);
    }

    // 驗證 LabCodeMap 檔案
    if (!fs.existsSync(this.config.labs.lab_code_map)) {
      errors.push(`LabCodeMap file not found: ${this.config.labs.lab_code_map}`);
    }

    // 驗證同步間隔
    if (this.config.sync.interval_minutes < 0) {
      logger.warn('Sync interval is negative, periodic sync will be disabled');
    }

    if (errors.length > 0) {
      logger.error('Config validation errors:', errors);
      throw new Error(`Config validation failed: ${errors.join(', ')}`);
    }

    logger.info('Config validation passed');
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
