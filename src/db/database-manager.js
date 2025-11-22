const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../main/logger');
const DBFReader = require('./dbf-reader');
const { formatPatientId } = require('../shared/utils');

/**
 * 資料庫管理器
 * 負責 SQLite 資料庫的初始化、查詢與維護
 */
class DatabaseManager {
  constructor(config) {
    this.config = config;
    this.db = null;
    this.dbfReader = null;
    this.labCodeMap = null;
  }

  /**
   * 初始化資料庫
   */
  async initialize() {
    try {
      // 確保資料庫目錄存在
      const dbDir = path.dirname(this.config.database.sqlite_path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // 開啟 SQLite 資料庫
      this.db = new Database(this.config.database.sqlite_path);
      this.db.pragma('journal_mode = WAL'); // 啟用 WAL 模式提升效能
      this.db.pragma(`cache_size = -${this.config.performance.sqlite_cache_size_kb}`);

      logger.info(`SQLite database opened: ${this.config.database.sqlite_path}`);

      // 建立資料表
      this.createTables();

      // 載入 LabCodeMap
      this.loadLabCodeMap();

      // 初始化 DBF Reader
      this.dbfReader = new DBFReader(this.config);

      // 預載入所有常用 DBF 表格到記憶體（效能優化）
      logger.info('Preloading DBF tables into memory...');
      await this.dbfReader.preloadAllTables();
      logger.info('DBF tables preloaded successfully');

      // 檢查是否需要初始匯入
      const syncMeta = this.getSyncMeta();
      if (!syncMeta || !syncMeta.last_hdate_synced) {
        logger.info('No sync history found, initial import will be required');
      }

      logger.info('DatabaseManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DatabaseManager:', error);
      throw error;
    }
  }

  /**
   * 建立資料表
   */
  createTables() {
    // lab_results_raw - 原始檢驗快取
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lab_results_raw (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kcstmr TEXT NOT NULL,
        hitem TEXT NOT NULL,
        hdate TEXT NOT NULL,
        hval TEXT,
        hunit TEXT,
        source_updated_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_lab_raw_patient
        ON lab_results_raw(kcstmr, hitem, hdate DESC);

      CREATE INDEX IF NOT EXISTS idx_lab_raw_date
        ON lab_results_raw(hdate DESC);
    `);

    // lab_results_wide - 寬表（供前端查詢）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lab_results_wide (
        kcstmr TEXT PRIMARY KEY,
        last_dm_date TEXT,
        hba1c REAL,
        hba1c_date TEXT,
        uacr REAL,
        uacr_date TEXT,
        egfr REAL,
        egfr_date TEXT,
        chol REAL,
        chol_date TEXT,
        ldl_c REAL,
        ldl_c_date TEXT,
        tg REAL,
        tg_date TEXT,
        bmi REAL,
        bmi_date TEXT,
        anti_hcv TEXT,
        anti_hcv_date TEXT,
        hbsag TEXT,
        hbsag_date TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // sync_meta - 同步狀態紀錄
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_hdate_synced TEXT,
        last_sync_started_at DATETIME,
        last_sync_finished_at DATETIME,
        last_sync_status TEXT,
        last_sync_error TEXT
      );

      INSERT OR IGNORE INTO sync_meta (id) VALUES (1);
    `);

    logger.info('Database tables created/verified');
  }

  /**
   * 載入 LabCodeMap
   */
  loadLabCodeMap() {
    try {
      const labCodeMapPath = this.config.labs.lab_code_map;
      const content = fs.readFileSync(labCodeMapPath, 'utf-8');
      this.labCodeMap = JSON.parse(content);

      logger.info('LabCodeMap loaded successfully');
    } catch (error) {
      logger.error('Failed to load LabCodeMap:', error);
      throw error;
    }
  }

  /**
   * 取得所有需要追蹤的檢驗項目代碼
   */
  getLabItemCodes() {
    const codes = [];

    // 從 LabCodeMap 提取所有 hitem_code
    for (const category in this.labCodeMap) {
      if (category.startsWith('_')) continue; // 跳過元資料

      const items = this.labCodeMap[category].items;
      if (!items) continue;

      for (const key in items) {
        const item = items[key];
        if (item.hitem_code) {
          codes.push(item.hitem_code);
        }
      }
    }

    return codes;
  }

  /**
   * 取得同步元資料
   */
  getSyncMeta() {
    const stmt = this.db.prepare('SELECT * FROM sync_meta WHERE id = 1');
    return stmt.get();
  }

  /**
   * 更新同步元資料
   */
  updateSyncMeta(updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    const sql = `UPDATE sync_meta SET ${fields.join(', ')} WHERE id = 1`;
    const stmt = this.db.prepare(sql);
    stmt.run(...values);
  }

  /**
   * 查詢病患完整資料
   */
  async queryPatient(patientId) {
    const formattedId = formatPatientId(patientId);
    const startTime = Date.now();
    const timings = {};

    try {
      // 並行查詢所有 DBF 資料（優化效能：預計省下 200-400ms）
      const dbfStartTime = Date.now();
      const [
        rawBasicInfo,
        clinicalHistory,
        rawAppointments,
        co03lRecords,
        diabetesRecords,
        kidneyRecords,
        metabolicRecords,
        examinationRecords
      ] = await Promise.all([
        this.dbfReader.queryPatientBasicInfo(formattedId),      // DBF CO01M
        this.dbfReader.queryClinicalHistory(formattedId),       // DBF CO02M + CO03M
        this.dbfReader.queryAppointments(formattedId),          // DBF co05b
        this.dbfReader.queryCO03LRecords(formattedId),          // DBF CO03L（看診紀錄，合併查詢）
        this.dbfReader.queryDiabetesRecords(formattedId),       // DBF CO02M（糖尿病）
        this.dbfReader.queryKidneyRecords(formattedId),         // DBF CO02M（腎臟病）
        this.dbfReader.queryMetabolicRecords(formattedId),      // DBF CO02M（代謝症候群）
        this.dbfReader.queryExaminationRecords(formattedId),    // DBF CO02M + CO02F（檢查記錄）
      ]);
      timings.dbfQueries = Date.now() - dbfStartTime;

      // 轉換欄位名稱為小寫（前端使用小寫）
      const normalizeStartTime = Date.now();
      const basicInfo = rawBasicInfo ? this.normalizeFieldNames(rawBasicInfo) : null;
      const appointments = rawAppointments.map(appt => this.normalizeFieldNames(appt));
      const visitHistory = co03lRecords.visitHistory.map(visit => this.normalizeFieldNames(visit));
      const preventiveCare = co03lRecords.preventiveCare.map(record => this.normalizeFieldNames(record));
      timings.normalization = Date.now() - normalizeStartTime;

      // 查詢檢驗矩陣（從 SQLite 寬表，本地查詢很快）
      const sqliteStartTime = Date.now();
      const labMatrix = this.queryLabMatrix(formattedId);
      timings.sqlite = Date.now() - sqliteStartTime;

      // 評估規則（Smart Action List）
      const rulesStartTime = Date.now();
      const actionList = this.evaluateRules(formattedId, rawBasicInfo, labMatrix);
      timings.rules = Date.now() - rulesStartTime;

      timings.total = Date.now() - startTime;

      // 記錄效能數據
      logger.info(`Query performance for patient ${formattedId}:`, {
        total: `${timings.total}ms`,
        dbfQueries: `${timings.dbfQueries}ms`,
        normalization: `${timings.normalization}ms`,
        sqlite: `${timings.sqlite}ms`,
        rules: `${timings.rules}ms`
      });

      return {
        basicInfo,
        labMatrix,
        clinicalHistory,
        appointments,
        visitHistory,
        preventiveCare,
        diabetesRecords,      // 糖尿病管理記錄
        kidneyRecords,        // 腎臟病管理記錄
        metabolicRecords,     // 代謝症候群管理記錄
        examinationRecords,   // 3年內檢查記錄
        actionList,
        queryTime: new Date().toISOString(),
        _performance: timings, // 加入效能數據供除錯用
      };
    } catch (error) {
      logger.error(`Error querying patient ${formattedId}:`, error);
      throw error;
    }
  }

  /**
   * 將 DBF 欄位名稱（大寫）轉換為前端使用的小寫格式
   */
  normalizeFieldNames(obj) {
    if (!obj) return null;

    const normalized = {};
    for (const key in obj) {
      const lowerKey = key.toLowerCase();
      const value = obj[key];

      // 如果是字串，去除前後空格
      if (typeof value === 'string') {
        normalized[lowerKey] = value.trim();
      } else {
        normalized[lowerKey] = value;
      }
    }

    // 加入格式化生日欄位
    if (obj.MBIRTHDT) {
      normalized.birthdate_formatted = this.dbfReader.formatBirthDate(obj.MBIRTHDT);
    }

    return normalized;
  }

  /**
   * 查詢檢驗矩陣（從 SQLite 寬表）
   */
  queryLabMatrix(patientId) {
    const stmt = this.db.prepare('SELECT * FROM lab_results_wide WHERE kcstmr = ?');
    const result = stmt.get(patientId);

    if (!result) {
      return null;
    }

    // 組織成矩陣格式
    return {
      DM: {
        HBA1C: { value: result.hba1c, date: result.hba1c_date },
        UACR: { value: result.uacr, date: result.uacr_date },
        eGFR: { value: result.egfr, date: result.egfr_date },
      },
      HTN_LIP: {
        CHOL: { value: result.chol, date: result.chol_date },
        LDL: { value: result.ldl_c, date: result.ldl_c_date },
        TG: { value: result.tg, date: result.tg_date },
        BMI: { value: result.bmi, date: result.bmi_date },
      },
      VIRUS: {
        AntiHCV: { value: result.anti_hcv, date: result.anti_hcv_date },
        HBsAg: { value: result.hbsag, date: result.hbsag_date },
      },
    };
  }

  /**
   * 評估規則（簡化版，完整版在 RulesEngine）
   */
  evaluateRules(patientId, basicInfo, labMatrix) {
    const actions = [];

    // TODO: 整合完整的規則引擎
    // 這裡先實作簡單的示範規則

    // 檢查 HBA1C
    if (labMatrix?.DM?.HBA1C?.value >= 7.0) {
      actions.push({
        priority: labMatrix.DM.HBA1C.value >= 9.0 ? 1 : 2,
        icon: labMatrix.DM.HBA1C.value >= 9.0 ? '🔴' : '🟠',
        color: labMatrix.DM.HBA1C.value >= 9.0 ? 'red' : 'orange',
        title: '需安排糖尿病衛教',
        message: `HBA1C：${labMatrix.DM.HBA1C.value}%（檢驗日：${labMatrix.DM.HBA1C.date}）`,
      });
    }

    // 檢查聯絡資料完整性
    if (!basicInfo?.mtelh || !basicInfo?.maddr) {
      const missing = [];
      if (!basicInfo?.mtelh) missing.push('手機');
      if (!basicInfo?.maddr) missing.push('地址');

      actions.push({
        priority: 5,
        icon: '🟡',
        color: 'orange',
        title: '聯絡資料不完整',
        message: `缺少：${missing.join('、')}，請協助病患補填`,
      });
    }

    // 依優先級排序
    actions.sort((a, b) => a.priority - b.priority);

    return actions;
  }

  /**
   * 關閉資料庫
   */
  close() {
    if (this.db) {
      this.db.close();
      logger.info('SQLite database closed');
    }

    if (this.dbfReader) {
      this.dbfReader.close();
    }
  }
}

module.exports = DatabaseManager;
