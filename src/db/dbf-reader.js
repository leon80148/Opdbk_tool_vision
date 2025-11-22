const { DBFFile } = require('dbffile');
const iconv = require('iconv-lite');
const path = require('path');
const logger = require('../main/logger');

/**
 * DBF 讀取器（使用 dbffile 純 JavaScript 方案）
 * 不需要安裝 ODBC Driver
 */
class DBFReader {
  constructor(config) {
    this.config = config;
    this.dbfRoot = config.database.dbf_root;
    this.encoding = config.database?.encoding || 'big5';

    // 全量預載入記憶體快取（啟動時載入，查詢時直接使用）
    this.preloadedData = new Map();
    this.isPreloaded = false;

    // 定義需要預載入的表格（所有常用表格）
    this.preloadTables = ['CO01M', 'CO02M', 'CO02F', 'CO03M', 'CO03L', 'co05b'];

    // 預載入資料範圍設定（只載入近期資料，減少記憶體占用）
    this.preloadYearsBack = config.performance?.preload_years_back || 3; // 預設載入最近 3 年

    // 快取預防保健日期計算（每日更新）
    this.cachedFiveYearsAgoStr = null;
    this.cachedFiveYearsAgoDate = null;
  }

  /**
   * 計算預載入的日期範圍起始點（ROC 年格式）
   */
  getPreloadStartDate() {
    const today = new Date();
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - this.preloadYearsBack);

    const rocYear = startDate.getFullYear() - 1911;
    const startDateStr =
      String(rocYear).padStart(3, '0') +
      String(startDate.getMonth() + 1).padStart(2, '0') +
      String(startDate.getDate()).padStart(2, '0');

    return startDateStr;
  }

  /**
   * 預載入所有常用 DBF 表格到記憶體
   * 只載入近期資料（預設最近 3 年），減少記憶體占用
   */
  async preloadAllTables(progressCallback) {
    if (this.isPreloaded) {
      logger.info('DBF tables already preloaded, skipping');
      return;
    }

    // 檢查是否載入全部資料
    const loadAll = this.preloadYearsBack <= 0;
    const startDateStr = loadAll ? '0000000' : this.getPreloadStartDate();

    if (loadAll) {
      logger.info(`Starting DBF preload (ALL data - may use significant memory)...`);
    } else {
      logger.info(`Starting DBF preload (recent ${this.preloadYearsBack} years, from ${startDateStr})...`);
    }

    const startTime = Date.now();

    // 定義每個表格的日期欄位
    const dateFields = {
      'CO02M': 'IDATE',
      'CO02F': 'FDATE',
      'CO03M': 'IDATE',
      'CO03L': 'DATE',
      'co05b': 'TBKDT'
      // CO01M 沒有日期欄位，載入全部
    };

    const totalTables = this.preloadTables.length;
    let currentTableIndex = 0;

    for (const tableName of this.preloadTables) {
      try {
        currentTableIndex++;
        const progress = Math.round((currentTableIndex / totalTables) * 100);

        // 回報進度
        if (progressCallback) {
          progressCallback({
            stage: 'preload',
            tableName,
            current: currentTableIndex,
            total: totalTables,
            progress,
            message: `載入資料表 ${tableName} (${currentTableIndex}/${totalTables})`
          });
        }

        const tableStartTime = Date.now();
        const allRecords = await this.readDBFFromDisk(tableName);

        // 如果有日期欄位且不是載入全部，只保留近期資料
        let records = allRecords;
        const dateField = dateFields[tableName];
        if (dateField && !loadAll) {
          const beforeFilter = allRecords.length;
          records = allRecords.filter(r => {
            const recordDate = r[dateField]?.trim() || '';
            return recordDate >= startDateStr;
          });
          const filtered = beforeFilter - records.length;
          logger.info(`[PRELOAD] ${tableName} filtered: ${beforeFilter} → ${records.length} records (removed ${filtered} old records)`);
        }

        const tableTime = Date.now() - tableStartTime;
        this.preloadedData.set(tableName, records);

        const sizeKB = Math.round((records.length * 500) / 1024);
        logger.info(`[PRELOAD] ${tableName} loaded: ${records.length} records (~${sizeKB}KB) in ${tableTime}ms`);
      } catch (error) {
        logger.error(`Failed to preload ${tableName}:`, error);
      }
    }

    this.isPreloaded = true;
    const totalTime = Date.now() - startTime;
    const totalRecords = Array.from(this.preloadedData.values()).reduce((sum, records) => sum + records.length, 0);
    const estimatedMemoryMB = Math.round((totalRecords * 1500) / 1024 / 1024); // 更準確的估算
    logger.info(`[PRELOAD] Completed: ${totalRecords} total records (~${estimatedMemoryMB}MB) in ${totalTime}ms`);
  }

  /**
   * 從磁碟讀取 DBF 檔案（內部方法）
   */
  async readDBFFromDisk(tableName) {
    const dbfPath = path.join(this.dbfRoot, `${tableName}.DBF`);
    const dbf = await DBFFile.open(dbfPath, { encoding: this.encoding === 'big5' ? 'cp950' : 'utf8' });
    const records = await dbf.readRecords();
    return records;
  }

  /**
   * 取得五年前的日期（民國年格式 YYYMMDD）
   * 快取計算結果，每日只計算一次
   */
  getFiveYearsAgoStr() {
    const today = new Date();
    const todayStr = today.toDateString();

    // 檢查快取是否有效（同一天）
    if (this.cachedFiveYearsAgoStr && this.cachedFiveYearsAgoDate === todayStr) {
      return this.cachedFiveYearsAgoStr;
    }

    // 計算五年前的日期
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const rocYear = fiveYearsAgo.getFullYear() - 1911;
    const fiveYearsAgoStr =
      String(rocYear).padStart(3, '0') +
      String(fiveYearsAgo.getMonth() + 1).padStart(2, '0') +
      String(fiveYearsAgo.getDate()).padStart(2, '0');

    // 更新快取
    this.cachedFiveYearsAgoStr = fiveYearsAgoStr;
    this.cachedFiveYearsAgoDate = todayStr;

    return fiveYearsAgoStr;
  }

  /**
   * 開啟 DBF 檔案並讀取所有記錄（優先使用預載入資料）
   */
  async openAndReadDBF(tableName) {
    const startTime = Date.now();

    // 如果已預載入，直接從記憶體返回
    if (this.isPreloaded && this.preloadedData.has(tableName)) {
      const records = this.preloadedData.get(tableName);
      const elapsed = Date.now() - startTime;
      logger.debug(`[PERF] ${tableName} - Memory HIT (${records.length} records) - ${elapsed}ms`);
      return records;
    }

    // 如果未預載入，從磁碟讀取（備用方案）
    logger.warn(`[PERF] ${tableName} - Memory MISS, reading from disk (preload not done?)`);
    try {
      const records = await this.readDBFFromDisk(tableName);
      return records;
    } catch (error) {
      logger.error(`Failed to open DBF file: ${tableName}`, error);
      throw new Error(`無法開啟 DBF 檔案: ${tableName}.DBF - ${error.message}`);
    }
  }

  /**
   * 查詢病患基本資料
   */
  async queryPatientBasicInfo(patientId) {
    const records = await this.openAndReadDBF('CO01M');

    // 查找病歷號
    const patient = records.find(r => r.KCSTMR?.trim() === patientId);

    if (!patient) {
      return null;
    }

    // 計算年齡
    if (patient.MBIRTHDT) {
      patient.age = this.calculateAge(patient.MBIRTHDT);
    }

    return patient;
  }

  /**
   * 用身分證字號查詢病患（取得病歷號）
   * @param {string} personId - 身分證字號
   * @returns {Object|null} - { kcstmr, mname, mpersonid } 或 null
   */
  async queryPatientByPersonId(personId) {
    const records = await this.openAndReadDBF('CO01M');

    // 查找身分證字號
    const patient = records.find(r => r.MPERSONID?.trim().toUpperCase() === personId.trim().toUpperCase());

    if (!patient) {
      return null;
    }

    // 回傳病歷號和基本資訊
    return {
      kcstmr: patient.KCSTMR?.trim(),
      mname: patient.MNAME?.trim(),
      mpersonid: patient.MPERSONID?.trim()
    };
  }

  /**
   * 查詢診療歷程
   */
  async queryClinicalHistory(patientId) {
    // 最近就診（從 CO03M）
    const co03mRecords = await this.openAndReadDBF('CO03M');

    const patientVisits = co03mRecords
      .filter(r => r.KCSTMR?.trim() === patientId)
      .sort((a, b) => {
        // 按日期時間排序（降序）
        const dateCompare = (b.IDATE || '').localeCompare(a.IDATE || '');
        if (dateCompare !== 0) return dateCompare;
        return (b.ITIME || '').localeCompare(a.ITIME || '');
      });

    const lastVisit = patientVisits[0] || null;

    // 最近領藥（從 CO02M）
    const co02mRecords = await this.openAndReadDBF('CO02M');

    const patientMedications = co02mRecords
      .filter(r => r.KCSTMR?.trim() === patientId && r.PTP === 'M')
      .sort((a, b) => {
        const dateCompare = (b.IDATE || '').localeCompare(a.IDATE || '');
        if (dateCompare !== 0) return dateCompare;
        return (b.ITIME || '').localeCompare(a.ITIME || '');
      });

    const lastMedication = patientMedications[0] || null;

    return {
      lastVisit,
      lastMedication,
    };
  }

  /**
   * 查詢檢驗資料（從 CO18H）
   */
  async queryLabData(patientId, itemCodes, startDate = null) {
    const records = await this.openAndReadDBF('CO18H');

    let filtered = records.filter(r => r.KCSTMR?.trim() === patientId);

    if (itemCodes && itemCodes.length > 0) {
      filtered = filtered.filter(r => itemCodes.includes(r.HITEM?.trim()));
    }

    if (startDate) {
      filtered = filtered.filter(r => (r.HDATE || '') >= startDate);
    }

    // 排序
    filtered.sort((a, b) => {
      const dateCompare = (b.HDATE || '').localeCompare(a.HDATE || '');
      if (dateCompare !== 0) return dateCompare;
      return (b.HTIME || '').localeCompare(a.HTIME || '');
    });

    return filtered;
  }

  /**
   * 批次查詢檢驗資料（用於同步）
   */
  async queryLabDataBatch(itemCodes, startDate, limit = 5000) {
    const records = await this.openAndReadDBF('CO18H');

    let filtered = records.filter(r => (r.HDATE || '') >= startDate);

    if (itemCodes && itemCodes.length > 0) {
      filtered = filtered.filter(r => itemCodes.includes(r.HITEM?.trim()));
    }

    // 排序並限制數量
    filtered.sort((a, b) => {
      const dateCompare = (b.HDATE || '').localeCompare(a.HDATE || '');
      if (dateCompare !== 0) return dateCompare;
      return (b.HTIME || '').localeCompare(a.HTIME || '');
    });

    return filtered.slice(0, limit);
  }

  /**
   * 計算年齡（簡化版：今年 - 出生年）
   */
  calculateAge(birthDate) {
    if (!birthDate) return null;

    try {
      const birthStr = String(birthDate).trim();

      // 檢查格式長度
      if (birthStr.length !== 7 && birthStr.length !== 8) {
        return null;
      }

      let birthYear;

      if (birthStr.length === 7) {
        // 民國年格式：YYYMMDD (例如：0761015 = 民國76年10月15日)
        const rocYear = parseInt(birthStr.substring(0, 3));
        birthYear = rocYear + 1911; // 轉換為西元年
      } else {
        // 西元年格式：YYYYMMDD
        birthYear = parseInt(birthStr.substring(0, 4));
      }

      // 檢查年份是否有效
      if (isNaN(birthYear) || birthYear < 1900 || birthYear > 2100) {
        return null;
      }

      // 簡化計算：今年 - 出生年
      const currentYear = new Date().getFullYear();
      const age = currentYear - birthYear;

      return age;
    } catch (error) {
      logger.error('Error calculating age:', error);
      return null;
    }
  }

  /**
   * 格式化生日顯示（民國年或西元年轉為可讀格式）
   */
  formatBirthDate(birthDate) {
    if (!birthDate) return null;

    try {
      const birthStr = String(birthDate).trim();

      if (birthStr.length === 7) {
        // 民國年格式：YYYMMDD -> YYY/MM/DD (YYYY/MM/DD)
        const rocYear = birthStr.substring(0, 3);
        const month = birthStr.substring(3, 5);
        const day = birthStr.substring(5, 7);
        const adYear = parseInt(rocYear) + 1911;
        return `${rocYear}/${month}/${day} (${adYear}/${month}/${day})`;
      } else if (birthStr.length === 8) {
        // 西元年格式：YYYYMMDD -> 轉換為民國年
        const year = parseInt(birthStr.substring(0, 4));
        const rocYear = year - 1911;
        const month = birthStr.substring(4, 6);
        const day = birthStr.substring(6, 8);
        return `${rocYear}/${month}/${day} (${year}/${month}/${day})`;
      }

      return null;
    } catch (error) {
      logger.error('Error formatting birth date:', error);
      return null;
    }
  }

  /**
   * 查詢預約紀錄（從 co05b）
   */
  async queryAppointments(patientId, limit = 10) {
    try {
      const records = await this.openAndReadDBF('co05b');

      // 篩選病患的預約紀錄
      const appointments = records
        .filter(r => r.KCSTMR?.trim() === patientId)
        .sort((a, b) => {
          // 按預約日期排序（降序 - 最新的在前）
          const dateCompare = (b.TBKDT || '').localeCompare(a.TBKDT || '');
          if (dateCompare !== 0) return dateCompare;

          // 相同日期則按時段排序
          const sessionCompare = (b.TSTS || '').localeCompare(a.TSTS || '');
          if (sessionCompare !== 0) return sessionCompare;

          // 相同時段則按預約號碼排序
          return (b.TARTIME || '').localeCompare(a.TARTIME || '');
        });

      // 限制返回數量
      return appointments.slice(0, limit);
    } catch (error) {
      logger.error(`Failed to query appointments for patient ${patientId}:`, error);
      return [];
    }
  }

  /**
   * 查詢就診歷史紀錄（從 CO05O）
   * 只返回有完診時間的紀錄
   */
  async queryVisitHistory(patientId, limit = 10) {
    try {
      const records = await this.openAndReadDBF('CO05O');

      // 篩選病患的就診紀錄，並且只保留有完診時間的紀錄
      const visits = records
        .filter(r => {
          // 必須是該病患的紀錄
          if (r.KCSTMR?.trim() !== patientId) return false;

          // 必須有完診時間（tendtime 不為空）
          const tendtime = r.TENDTIME?.trim();
          return tendtime && tendtime !== '';
        })
        .sort((a, b) => {
          // 按就診日期排序（降序 - 最新的在前）
          const dateCompare = (b.TBKDATE || '').localeCompare(a.TBKDATE || '');
          if (dateCompare !== 0) return dateCompare;

          // 相同日期則按掛號時間排序
          return (b.TBKTIME || '').localeCompare(a.TBKTIME || '');
        });

      // 限制返回數量（預設10筆）
      return visits.slice(0, limit);
    } catch (error) {
      logger.error(`Failed to query visit history for patient ${patientId}:`, error);
      return [];
    }
  }

  /**
   * 查詢預防保健紀錄（從 CO05O）
   * 根據卡序(tisrs)查詢特定類型的預防保健紀錄
   * 只返回五年內的紀錄
   */
  async queryPreventiveCareRecords(patientId) {
    try {
      const records = await this.openAndReadDBF('CO05O');

      // 定義所有預防保健項目的卡序
      const preventiveCareCardSequences = [
        '3D', '21', '22', // 成健一階
        '3E', '23', '24', // 成健二階
        '85',             // 腸篩
        '95',             // 口篩
        'AU',             // 流感
        'VU',             // 新冠
        'DU'              // 肺鏈
      ];

      // 取得五年前的日期（使用快取，避免重複計算）
      const fiveYearsAgoStr = this.getFiveYearsAgoStr();

      // 篩選病患的預防保健紀錄（五年內）
      const preventiveRecords = records
        .filter(r => {
          // 必須是該病患的紀錄
          if (r.KCSTMR?.trim() !== patientId) return false;

          // 必須是預防保健相關的卡序
          const tisrs = r.TISRS?.trim();
          if (!tisrs || !preventiveCareCardSequences.includes(tisrs)) return false;

          // 必須有完診時間（過濾掛號錯誤或未完診的記錄）
          const tendtime = r.TENDTIME?.trim() || '';
          if (!tendtime || tendtime === '000000') return false;

          // 必須是五年內的紀錄（民國年格式比較）
          const recordDate = r.TBKDATE?.trim() || '';
          return recordDate >= fiveYearsAgoStr;
        })
        .sort((a, b) => {
          // 按就診日期排序（降序 - 最新的在前）
          const dateCompare = (b.TBKDATE || '').localeCompare(a.TBKDATE || '');
          if (dateCompare !== 0) return dateCompare;

          // 相同日期則按掛號時間排序
          return (b.TBKTIME || '').localeCompare(a.TBKTIME || '');
        });

      return preventiveRecords;
    } catch (error) {
      logger.error(`Failed to query preventive care records for patient ${patientId}:`, error);
      return [];
    }
  }

  /**
   * 合併查詢 CO03L 看診紀錄（優化效能，避免重複讀取）
   * 一次讀取，同時返回就診歷史和預防保健記錄
   */
  async queryCO03LRecords(patientId, visitHistoryLimit = 10) {
    try {
      const records = await this.openAndReadDBF('CO03L');

      // 定義預防保健卡序
      const preventiveCareCardSequences = [
        '3D', '21', '22', // 成健一階
        '3E', '23', '24', // 成健二階
        '85',             // 腸篩
        '95',             // 口篩
        'AU',             // 流感
        'VU',             // 新冠
        'DU'              // 肺鏈
      ];

      // 取得五年前的日期（使用快取，避免重複計算）
      const fiveYearsAgoStr = this.getFiveYearsAgoStr();

      // 一次過濾，分類記錄
      const visitHistory = [];
      const preventiveCare = [];

      for (const r of records) {
        // 只處理該病患的記錄
        if (r.KCSTMR?.trim() !== patientId) continue;

        const lisrs = r.LISRS?.trim() || '';
        const recordDate = r.DATE?.trim() || '';

        // 判斷是否為預防保健記錄
        if (lisrs && preventiveCareCardSequences.includes(lisrs)) {
          // 只保留五年內的預防保健記錄
          if (recordDate >= fiveYearsAgoStr) {
            preventiveCare.push(r);
          }
        }

        // 所有記錄都加入就診歷史
        visitHistory.push(r);
      }

      // 排序函數（共用）
      const sortByDateTime = (a, b) => {
        const dateCompare = (b.DATE || '').localeCompare(a.DATE || '');
        if (dateCompare !== 0) return dateCompare;
        return (b.TIME || '').localeCompare(a.TIME || '');
      };

      // 排序並限制數量
      visitHistory.sort(sortByDateTime);
      preventiveCare.sort(sortByDateTime);

      return {
        visitHistory: visitHistory.slice(0, visitHistoryLimit),
        preventiveCare: preventiveCare
      };
    } catch (error) {
      logger.error(`Failed to query CO03L records for patient ${patientId}:`, error);
      return {
        visitHistory: [],
        preventiveCare: []
      };
    }
  }

  /**
   * @deprecated 使用 queryCO03LRecords 取代
   * 合併查詢 CO05O 掛號記錄（已棄用，保留以維持向後相容）
   */
  async queryCO05ORecords(patientId, visitHistoryLimit = 10) {
    logger.warn('queryCO05ORecords is deprecated, use queryCO03LRecords instead');
    return this.queryCO03LRecords(patientId, visitHistoryLimit);
  }

  /**
   * 日期加減天數（民國年格式 YYYMMDD）
   * @param {string} rocDateStr - 民國年日期字串 (YYYMMDD)
   * @param {number} days - 要加的天數（可為負數）
   * @returns {string} - 加減後的民國年日期字串
   */
  addDaysToROCDate(rocDateStr, days) {
    try {
      if (!rocDateStr || rocDateStr.length !== 7) return null;

      // 轉換為西元年
      const rocYear = parseInt(rocDateStr.substring(0, 3));
      const month = parseInt(rocDateStr.substring(3, 5));
      const day = parseInt(rocDateStr.substring(5, 7));

      const date = new Date(rocYear + 1911, month - 1, day);

      // 加天數
      date.setDate(date.getDate() + days);

      // 轉回民國年格式
      const newRocYear = date.getFullYear() - 1911;
      const newMonth = date.getMonth() + 1;
      const newDay = date.getDate();

      return String(newRocYear).padStart(3, '0') +
             String(newMonth).padStart(2, '0') +
             String(newDay).padStart(2, '0');
    } catch (error) {
      logger.error('Error adding days to ROC date:', error);
      return null;
    }
  }

  /**
   * 日期加減月數（民國年格式 YYYMMDD）
   * @param {string} rocDateStr - 民國年日期字串 (YYYMMDD)
   * @param {number} months - 要加的月數（可為負數）
   * @returns {string} - 加減後的民國年日期字串
   */
  addMonthsToROCDate(rocDateStr, months) {
    try {
      if (!rocDateStr || rocDateStr.length !== 7) return null;

      // 轉換為西元年
      const rocYear = parseInt(rocDateStr.substring(0, 3));
      const month = parseInt(rocDateStr.substring(3, 5));
      const day = parseInt(rocDateStr.substring(5, 7));

      const date = new Date(rocYear + 1911, month - 1, day);

      // 加月數
      date.setMonth(date.getMonth() + months);

      // 轉回民國年格式
      const newRocYear = date.getFullYear() - 1911;
      const newMonth = date.getMonth() + 1;
      const newDay = date.getDate();

      return String(newRocYear).padStart(3, '0') +
             String(newMonth).padStart(2, '0') +
             String(newDay).padStart(2, '0');
    } catch (error) {
      logger.error('Error adding months to ROC date:', error);
      return null;
    }
  }

  /**
   * 查詢糖尿病管理記錄
   * @param {string} patientId - 病歷號
   * @returns {Array} - 糖尿病記錄列表
   */
  async queryDiabetesRecords(patientId) {
    try {
      const diabetesCodes = ['P1407C', 'P1408C', 'P1409C', 'P7001C', 'P7002C'];
      const twoYearsAgo = this.addDaysToROCDate(this.getTodayROCDate(), -730); // 2年前

      const records = await this.openAndReadDBF('CO02M');

      const diabetesRecords = records
        .filter(r => {
          const kcstmr = r.KCSTMR?.trim();
          const dno = r.DNO?.trim();
          const idate = r.IDATE?.trim() || '';

          return kcstmr === patientId &&
                 dno && diabetesCodes.includes(dno) &&
                 idate >= twoYearsAgo;
        })
        .map(r => {
          const dno = r.DNO?.trim();
          const idate = r.IDATE?.trim();

          // 計算下次可執行日
          let nextExecutableDate = null;
          if (dno === 'P1407C') {
            nextExecutableDate = this.addDaysToROCDate(idate, 50);
          } else {
            nextExecutableDate = this.addDaysToROCDate(idate, 71);
          }

          return {
            date: idate,
            code: dno,
            codeName: this.getChronicDiseaseName(dno),
            nextExecutableDate: nextExecutableDate
          };
        })
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')); // 由新到舊

      return diabetesRecords;
    } catch (error) {
      logger.error(`Failed to query diabetes records for patient ${patientId}:`, error);
      return [];
    }
  }

  /**
   * 查詢腎臟病管理記錄
   * @param {string} patientId - 病歷號
   * @returns {Array} - 腎臟病記錄列表
   */
  async queryKidneyRecords(patientId) {
    try {
      const kidneyCodes = ['P4301C', 'P4302C'];
      const twoYearsAgo = this.addDaysToROCDate(this.getTodayROCDate(), -730); // 2年前

      const records = await this.openAndReadDBF('CO02M');

      const kidneyRecords = records
        .filter(r => {
          const kcstmr = r.KCSTMR?.trim();
          const dno = r.DNO?.trim();
          const idate = r.IDATE?.trim() || '';

          return kcstmr === patientId &&
                 dno && kidneyCodes.includes(dno) &&
                 idate >= twoYearsAgo;
        })
        .map(r => {
          const dno = r.DNO?.trim();
          const idate = r.IDATE?.trim();

          // 計算下次可執行日
          let nextExecutableDate = null;
          if (dno === 'P4301C') {
            nextExecutableDate = this.addDaysToROCDate(idate, 77);
          } else if (dno === 'P4302C') {
            nextExecutableDate = this.addDaysToROCDate(idate, 161);
          }

          return {
            date: idate,
            code: dno,
            codeName: this.getChronicDiseaseName(dno),
            nextExecutableDate: nextExecutableDate
          };
        })
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')); // 由新到舊

      return kidneyRecords;
    } catch (error) {
      logger.error(`Failed to query kidney records for patient ${patientId}:`, error);
      return [];
    }
  }

  /**
   * 查詢代謝症候群管理記錄
   * @param {string} patientId - 病歷號
   * @returns {Array} - 代謝記錄列表
   */
  async queryMetabolicRecords(patientId) {
    try {
      const metabolicCodes = ['P7501C', 'P7502C', 'P7503C'];
      const twoYearsAgo = this.addDaysToROCDate(this.getTodayROCDate(), -730); // 2年前

      const records = await this.openAndReadDBF('CO02M');

      const metabolicRecords = records
        .filter(r => {
          const kcstmr = r.KCSTMR?.trim();
          const dno = r.DNO?.trim();
          const idate = r.IDATE?.trim() || '';

          return kcstmr === patientId &&
                 dno && metabolicCodes.includes(dno) &&
                 idate >= twoYearsAgo;
        })
        .map(r => {
          const dno = r.DNO?.trim();
          const idate = r.IDATE?.trim();

          // 統一加 71 天
          const nextExecutableDate = this.addDaysToROCDate(idate, 71);

          return {
            date: idate,
            code: dno,
            codeName: this.getChronicDiseaseName(dno),
            nextExecutableDate: nextExecutableDate
          };
        })
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')); // 由新到舊

      return metabolicRecords;
    } catch (error) {
      logger.error(`Failed to query metabolic records for patient ${patientId}:`, error);
      return [];
    }
  }

  /**
   * 查詢3年內檢查記錄（結合 CO02M 和 CO02F）
   * @param {string} patientId - 病歷號
   * @returns {Object} - 各項檢查記錄
   */
  async queryExaminationRecords(patientId) {
    try {
      const threeYearsAgo = this.addDaysToROCDate(this.getTodayROCDate(), -1095); // 3年前

      // 查詢 CO02M 的檢查記錄
      const co02mRecords = await this.openAndReadDBF('CO02M');

      // 查詢 CO02F 的報告內容
      const co02fRecords = await this.openAndReadDBF('CO02F');

      // 輔助函數：根據日期查找報告
      const findReport = (date) => {
        const report = co02fRecords.find(r =>
          r.KCSTMR?.trim() === patientId &&
          r.FDATE?.trim() === date
        );
        return report ? report.FTEXT?.trim() || '' : '';
      };

      // 定義檢查項目
      const examinations = {
        abdomen: { codes: ['19001C', '19009C'], name: '腹部超音波', interval: 6, unit: 'months' },
        thyroid: { codes: ['19012C'], name: '甲狀腺超音波', interval: 6, unit: 'months' },
        puncture: { codes: ['15021C'], name: '細針穿刺', interval: 1, unit: 'years' },
        lung: { codes: ['17003C', '17006C'], name: '肺功能檢查', interval: 6, unit: 'months' },
        urine: { codes: ['21004C'], name: '尿流速檢查', interval: 1, unit: 'years' }
      };

      const results = {};

      for (const [key, exam] of Object.entries(examinations)) {
        // 查找該檢查的最近記錄
        const examRecords = co02mRecords
          .filter(r => {
            const kcstmr = r.KCSTMR?.trim();
            const dno = r.DNO?.trim();
            const idate = r.IDATE?.trim() || '';

            return kcstmr === patientId &&
                   dno && exam.codes.includes(dno) &&
                   idate >= threeYearsAgo;
          })
          .sort((a, b) => (b.IDATE || '').localeCompare(a.IDATE || ''));

        if (examRecords.length > 0) {
          const latest = examRecords[0];
          const examDate = latest.IDATE?.trim();
          const examCode = latest.DNO?.trim();

          // 計算建議下次追蹤日期
          let nextFollowUpDate = null;
          if (exam.unit === 'months') {
            nextFollowUpDate = this.addMonthsToROCDate(examDate, exam.interval);
          } else {
            nextFollowUpDate = this.addDaysToROCDate(examDate, exam.interval * 365);
          }

          // 查找報告內容（僅部分檢查有報告）
          let reportContent = '';
          if (!['15021C', '21004C'].includes(examCode)) {
            reportContent = findReport(examDate);
          }

          results[key] = {
            name: exam.name,
            code: examCode,
            date: examDate,
            reportContent: reportContent,
            nextFollowUpDate: nextFollowUpDate
          };
        } else {
          results[key] = null; // 無記錄
        }
      }

      return results;
    } catch (error) {
      logger.error(`Failed to query examination records for patient ${patientId}:`, error);
      return {};
    }
  }

  /**
   * 獲取今天的民國年日期
   * @returns {string} - 今天的民國年日期 (YYYMMDD)
   */
  getTodayROCDate() {
    const today = new Date();
    const rocYear = today.getFullYear() - 1911;
    const month = today.getMonth() + 1;
    const day = today.getDate();

    return String(rocYear).padStart(3, '0') +
           String(month).padStart(2, '0') +
           String(day).padStart(2, '0');
  }

  /**
   * 取得慢性病醫令名稱
   * @param {string} code - 醫令代碼
   * @returns {string} - 醫令名稱
   */
  getChronicDiseaseName(code) {
    const names = {
      'P1407C': 'DM-新收',
      'P1408C': 'DM-複診',
      'P1409C': 'DM-年度',
      'P7001C': 'DKD-複診',
      'P7002C': 'DKD-年度',
      'P4301C': 'CKD-新收',
      'P4302C': 'CKD-複診',
      'P7501C': '代謝症候群-新收',
      'P7502C': '代謝症候群-追蹤',
      'P7503C': '代謝症候群-年度',
      '19001C': '腹部超音波（初次）',
      '19009C': '腹部超音波（追蹤）',
      '19012C': '甲狀腺超音波',
      '15021C': '細針穿刺',
      '17003C': '肺功能檢查',
      '17006C': '肺功能檢查（吸藥）',
      '21004C': '尿流速檢查'
    };
    return names[code] || code;
  }

  /**
   * 關閉
   */
  close() {
    logger.info('DBFReader closed');
  }
}

module.exports = DBFReader;
