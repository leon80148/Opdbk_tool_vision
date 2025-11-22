const DatabaseManager = require('../src/db/database-manager');
const ConfigManager = require('../src/main/config-manager');
const path = require('path');
const fs = require('fs');

describe('完整病患查詢流程整合測試', () => {
  let configManager;
  let databaseManager;
  let testDbPath;
  let testPatientId;

  beforeAll(async () => {
    // 載入配置
    configManager = new ConfigManager();
    await configManager.load();

    // 使用測試資料庫路徑
    const config = configManager.getConfig();
    testDbPath = path.join(__dirname, '../data/test_integration.db');
    config.database.sqlite_path = testDbPath;

    // 初始化 DatabaseManager
    databaseManager = new DatabaseManager(config);
    await databaseManager.initialize();

    // 從 DBF 取得第一筆病患作為測試對象
    const records = await databaseManager.dbfReader.openAndReadDBF('CO01M');
    if (records.length > 0) {
      testPatientId = records[0].KCSTMR?.trim();
      console.log(`測試使用病患 ID: ${testPatientId}`);
    }
  }, 30000); // 增加 timeout 到 30 秒

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

  describe('完整查詢流程', () => {
    test('應該能成功查詢病患完整資料', async () => {
      if (!testPatientId) {
        console.warn('沒有可用的測試病患 ID，跳過測試');
        return;
      }

      const result = await databaseManager.queryPatient(testPatientId);

      // 驗證結果結構
      expect(result).toBeTruthy();
      expect(result).toHaveProperty('basicInfo');
      expect(result).toHaveProperty('labMatrix');
      expect(result).toHaveProperty('clinicalHistory');
      expect(result).toHaveProperty('actionList');
      expect(result).toHaveProperty('queryTime');

      // 驗證基本資料
      if (result.basicInfo) {
        expect(result.basicInfo.KCSTMR?.trim()).toBe(testPatientId);
        console.log('病患基本資料:', {
          病歷號: result.basicInfo.KCSTMR?.trim(),
          姓名: result.basicInfo.MNAME?.trim(),
          年齡: result.basicInfo.age
        });
      }

      // 驗證診療歷程
      expect(result.clinicalHistory).toBeTruthy();
      console.log('診療歷程:', {
        最近就診: result.clinicalHistory.lastVisit?.IDATE,
        最近領藥: result.clinicalHistory.lastMedication?.IDATE
      });

      // 驗證 Action List
      expect(Array.isArray(result.actionList)).toBe(true);
      console.log('Smart Action List:', result.actionList);
    }, 30000);

    test('查詢不存在的病患應該拋出錯誤或返回空資料', async () => {
      const nonExistentId = '9999999999';

      try {
        const result = await databaseManager.queryPatient(nonExistentId);
        // 如果沒有拋出錯誤，basicInfo 應該為 null
        expect(result.basicInfo).toBeNull();
      } catch (error) {
        // 如果拋出錯誤，應該是有意義的錯誤訊息
        expect(error).toBeTruthy();
        expect(error.message).toBeTruthy();
      }
    }, 30000);
  });

  describe('檢驗矩陣查詢', () => {
    test('應該能查詢檢驗矩陣（即使為空）', () => {
      if (!testPatientId) {
        console.warn('沒有可用的測試病患 ID，跳過測試');
        return;
      }

      const labMatrix = databaseManager.queryLabMatrix(testPatientId);
      // labMatrix 可能為 null（尚未同步）或有資料
      if (labMatrix) {
        expect(labMatrix).toHaveProperty('DM');
        expect(labMatrix).toHaveProperty('HTN_LIP');
        expect(labMatrix).toHaveProperty('VIRUS');
        console.log('檢驗矩陣:', labMatrix);
      } else {
        console.log('檢驗矩陣: 尚無資料（需執行同步）');
      }
    });
  });

  describe('病歷號格式化測試', () => {
    const { formatPatientId } = require('../src/shared/utils');

    test('應該能正確補零', () => {
      expect(formatPatientId('1234')).toBe('0000001234');
      expect(formatPatientId('123456')).toBe('0000123456');
      expect(formatPatientId('0001234')).toBe('0000001234');
    });

    test('已經是 10 位的病歷號不應該改變', () => {
      expect(formatPatientId('0000001234')).toBe('0000001234');
    });

    test('應該移除空格', () => {
      expect(formatPatientId(' 1234 ')).toBe('0000001234');
    });
  });

  describe('多病患查詢測試', () => {
    test('應該能連續查詢多位病患', async () => {
      const records = await databaseManager.dbfReader.openAndReadDBF('CO01M');
      const patientIds = records.slice(0, 5).map(r => r.KCSTMR?.trim());

      for (const patientId of patientIds) {
        const result = await databaseManager.queryPatient(patientId);
        expect(result).toBeTruthy();
        expect(result.basicInfo?.KCSTMR?.trim()).toBe(patientId);
      }
    }, 60000); // 增加 timeout 到 60 秒
  });
});
