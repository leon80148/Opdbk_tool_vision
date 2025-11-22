const DBFReader = require('../src/db/dbf-reader');
const ConfigManager = require('../src/main/config-manager');

describe('DBFReader', () => {
  let configManager;
  let dbfReader;

  beforeAll(async () => {
    // 載入配置
    configManager = new ConfigManager();
    await configManager.load();
    const config = configManager.getConfig();

    dbfReader = new DBFReader(config);
  });

  afterAll(() => {
    if (dbfReader) {
      dbfReader.close();
    }
  });

  describe('DBF 檔案讀取測試', () => {
    test('應該能開啟 CO01M.DBF（病患基本資料）', async () => {
      const records = await dbfReader.openAndReadDBF('CO01M');
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);
    });

    test('應該能開啟 CO03M.DBF（診療紀錄）', async () => {
      const records = await dbfReader.openAndReadDBF('CO03M');
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);
    });

    test('應該能開啟 CO18H.DBF（檢驗資料）', async () => {
      const records = await dbfReader.openAndReadDBF('CO18H');
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);
    });

    test('不存在的 DBF 檔案應該拋出錯誤', async () => {
      await expect(dbfReader.openAndReadDBF('NONEXISTENT')).rejects.toThrow();
    });
  });

  describe('病患基本資料查詢測試', () => {
    test('應該能查詢第一筆病患資料', async () => {
      // 先取得第一筆病患的病歷號
      const records = await dbfReader.openAndReadDBF('CO01M');
      const firstPatient = records[0];
      const patientId = firstPatient.KCSTMR?.trim();

      // 查詢該病患
      const patient = await dbfReader.queryPatientBasicInfo(patientId);
      expect(patient).toBeTruthy();
      expect(patient.KCSTMR?.trim()).toBe(patientId);
    });

    test('不存在的病患應該返回 null', async () => {
      const patient = await dbfReader.queryPatientBasicInfo('9999999999');
      expect(patient).toBeNull();
    });

    test('查詢的病患資料應該包含年齡計算', async () => {
      const records = await dbfReader.openAndReadDBF('CO01M');
      const patientWithBirthdate = records.find(r => r.MBIRTHDT);

      if (patientWithBirthdate) {
        const patientId = patientWithBirthdate.KCSTMR?.trim();
        const patient = await dbfReader.queryPatientBasicInfo(patientId);
        expect(patient.age).toBeDefined();
        expect(typeof patient.age).toBe('number');
        expect(patient.age).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('診療歷程查詢測試', () => {
    test('應該能查詢有就診紀錄的病患', async () => {
      // 先從 CO03M 取得第一筆病患
      const records = await dbfReader.openAndReadDBF('CO03M');
      const firstRecord = records[0];
      const patientId = firstRecord.KCSTMR?.trim();

      const history = await dbfReader.queryClinicalHistory(patientId);
      expect(history).toBeTruthy();
      expect(history.lastVisit).toBeTruthy();
      expect(history.lastVisit.KCSTMR?.trim()).toBe(patientId);
    });

    test('查詢結果應該包含最近就診和最近領藥', async () => {
      const records = await dbfReader.openAndReadDBF('CO03M');
      const firstRecord = records[0];
      const patientId = firstRecord.KCSTMR?.trim();

      const history = await dbfReader.queryClinicalHistory(patientId);
      expect(history).toHaveProperty('lastVisit');
      expect(history).toHaveProperty('lastMedication');
    });
  });

  describe('檢驗資料查詢測試', () => {
    test('應該能查詢有檢驗資料的病患', async () => {
      // 先從 CO18H 取得第一筆病患
      const records = await dbfReader.openAndReadDBF('CO18H');
      const firstRecord = records[0];
      const patientId = firstRecord.KCSTMR?.trim();

      const labData = await dbfReader.queryLabData(patientId);
      expect(Array.isArray(labData)).toBe(true);
      expect(labData.length).toBeGreaterThan(0);
      expect(labData[0].KCSTMR?.trim()).toBe(patientId);
    });

    test('應該能根據檢驗項目代碼過濾', async () => {
      const records = await dbfReader.openAndReadDBF('CO18H');
      const firstRecord = records[0];
      const patientId = firstRecord.KCSTMR?.trim();
      const itemCode = firstRecord.HITEM?.trim();

      const labData = await dbfReader.queryLabData(patientId, [itemCode]);
      expect(labData.length).toBeGreaterThan(0);
      labData.forEach(record => {
        expect(record.HITEM?.trim()).toBe(itemCode);
      });
    });

    test('應該能根據日期過濾', async () => {
      const records = await dbfReader.openAndReadDBF('CO18H');
      const firstRecord = records[0];
      const patientId = firstRecord.KCSTMR?.trim();
      const startDate = '20240101';

      const labData = await dbfReader.queryLabData(patientId, null, startDate);
      labData.forEach(record => {
        expect(record.HDATE).toBeGreaterThanOrEqual(startDate);
      });
    });

    test('批次查詢應該能正確限制數量', async () => {
      const itemCodes = ['A001', 'A002']; // 測試用代碼
      const startDate = '20240101';
      const limit = 10;

      const labData = await dbfReader.queryLabDataBatch(itemCodes, startDate, limit);
      expect(Array.isArray(labData)).toBe(true);
      expect(labData.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('年齡計算測試', () => {
    test('應該能正確計算年齡', () => {
      const birthDate = '19900101'; // 1990年1月1日
      const age = dbfReader.calculateAge(birthDate);
      const expectedAge = new Date().getFullYear() - 1990;
      expect(age).toBeGreaterThanOrEqual(expectedAge - 1);
      expect(age).toBeLessThanOrEqual(expectedAge + 1);
    });

    test('空的生日應該返回 null', () => {
      const age = dbfReader.calculateAge(null);
      expect(age).toBeNull();
    });

    test('格式錯誤的生日應該返回 null', () => {
      const age = dbfReader.calculateAge('invalid');
      expect(age).toBeNull();
    });
  });
});
