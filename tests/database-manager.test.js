const DatabaseManager = require('../src/db/database-manager');
const ConfigManager = require('../src/main/config-manager');
const path = require('path');
const fs = require('fs');

describe('DatabaseManager', () => {
  let configManager;
  let databaseManager;
  let testDbPath;

  beforeAll(async () => {
    // 載入配置
    configManager = new ConfigManager();
    await configManager.load();

    // 使用測試資料庫路徑
    const config = configManager.getConfig();
    testDbPath = path.join(__dirname, '../data/test_lab_cache.db');
    config.database.sqlite_path = testDbPath;

    databaseManager = new DatabaseManager(config);
  });

  afterAll(() => {
    // 清理
    if (databaseManager) {
      databaseManager.close();
    }

    // 刪除測試資料庫
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // 刪除 WAL 和 SHM 檔案
    const walPath = testDbPath + '-wal';
    const shmPath = testDbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  describe('初始化測試', () => {
    test('應該成功初始化 DatabaseManager', async () => {
      await expect(databaseManager.initialize()).resolves.not.toThrow();
      expect(databaseManager.db).toBeTruthy();
    });

    test('應該建立必要的資料表', () => {
      const tables = databaseManager.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table'
      `).all();

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('lab_results_raw');
      expect(tableNames).toContain('lab_results_wide');
      expect(tableNames).toContain('sync_meta');
    });

    test('應該載入 LabCodeMap', () => {
      expect(databaseManager.labCodeMap).toBeTruthy();
      expect(databaseManager.labCodeMap.DM).toBeTruthy();
      expect(databaseManager.labCodeMap.HTN_LIP).toBeTruthy();
      expect(databaseManager.labCodeMap.VIRUS).toBeTruthy();
    });
  });

  describe('同步元資料測試', () => {
    test('應該能取得同步元資料', () => {
      const syncMeta = databaseManager.getSyncMeta();
      expect(syncMeta).toBeTruthy();
      expect(syncMeta.id).toBe(1);
    });

    test('應該能更新同步元資料', () => {
      const testDate = '20250101';
      databaseManager.updateSyncMeta({
        last_hdate_synced: testDate,
        last_sync_status: 'success'
      });

      const syncMeta = databaseManager.getSyncMeta();
      expect(syncMeta.last_hdate_synced).toBe(testDate);
      expect(syncMeta.last_sync_status).toBe('success');
    });
  });

  describe('檢驗項目代碼測試', () => {
    test('應該能取得所有檢驗項目代碼', () => {
      const codes = databaseManager.getLabItemCodes();
      expect(Array.isArray(codes)).toBe(true);
      expect(codes.length).toBeGreaterThan(0);
    });
  });

  describe('查詢檢驗矩陣測試', () => {
    beforeEach(() => {
      // 清空寬表
      databaseManager.db.prepare('DELETE FROM lab_results_wide').run();

      // 插入測試資料
      databaseManager.db.prepare(`
        INSERT INTO lab_results_wide
        (kcstmr, hba1c, hba1c_date, egfr, egfr_date, chol, chol_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('0000001234', 7.5, '20250101', 85.0, '20250101', 200.0, '20250101');
    });

    test('應該能查詢存在的病患檢驗矩陣', () => {
      const matrix = databaseManager.queryLabMatrix('0000001234');
      expect(matrix).toBeTruthy();
      expect(matrix.DM.HBA1C.value).toBe(7.5);
      expect(matrix.DM.HBA1C.date).toBe('20250101');
      expect(matrix.DM.eGFR.value).toBe(85.0);
      expect(matrix.HTN_LIP.CHOL.value).toBe(200.0);
    });

    test('不存在的病患應該返回 null', () => {
      const matrix = databaseManager.queryLabMatrix('9999999999');
      expect(matrix).toBeNull();
    });
  });

  describe('規則評估測試', () => {
    test('HBA1C >= 9.0 應該產生高優先級提醒', () => {
      const labMatrix = {
        DM: {
          HBA1C: { value: 9.5, date: '20250101' }
        }
      };

      const actions = databaseManager.evaluateRules('0000001234', {}, labMatrix);
      expect(actions.length).toBeGreaterThan(0);

      const hba1cAction = actions.find(a => a.title.includes('糖尿病衛教'));
      expect(hba1cAction).toBeTruthy();
      expect(hba1cAction.priority).toBe(1);
      expect(hba1cAction.color).toBe('red');
    });

    test('HBA1C >= 7.0 且 < 9.0 應該產生中優先級提醒', () => {
      const labMatrix = {
        DM: {
          HBA1C: { value: 7.5, date: '20250101' }
        }
      };

      const actions = databaseManager.evaluateRules('0000001234', {}, labMatrix);
      const hba1cAction = actions.find(a => a.title.includes('糖尿病衛教'));
      expect(hba1cAction).toBeTruthy();
      expect(hba1cAction.priority).toBe(2);
      expect(hba1cAction.color).toBe('orange');
    });

    test('聯絡資料不完整應該產生提醒', () => {
      const basicInfo = {
        mtelh: null,
        maddr: null
      };

      const actions = databaseManager.evaluateRules('0000001234', basicInfo, {});
      const contactAction = actions.find(a => a.title.includes('聯絡資料不完整'));
      expect(contactAction).toBeTruthy();
      expect(contactAction.message).toContain('手機');
      expect(contactAction.message).toContain('地址');
    });
  });
});
