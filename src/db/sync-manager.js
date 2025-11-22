const cron = require('node-cron');
const logger = require('../main/logger');
const { formatDate } = require('../shared/utils');

/**
 * 同步管理器
 * 負責 CO18H → SQLite 的初始匯入與增量同步
 */
class SyncManager {
  constructor(config, databaseManager) {
    this.config = config;
    this.dbManager = databaseManager;
    this.cronJob = null;
    this.isSyncing = false;
  }

  /**
   * 執行同步
   */
  async runSync() {
    if (this.isSyncing) {
      logger.warn('Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;

    try {
      const syncMeta = this.dbManager.getSyncMeta();
      const lastSyncedDate = syncMeta?.last_hdate_synced;

      // 更新同步開始時間
      this.dbManager.updateSyncMeta({
        last_sync_started_at: new Date().toISOString(),
        last_sync_status: 'running',
      });

      if (!lastSyncedDate) {
        // 初始匯入
        await this.initialImport();
      } else {
        // 增量同步
        await this.incrementalSync(lastSyncedDate);
      }

      // 更新同步完成時間
      this.dbManager.updateSyncMeta({
        last_sync_finished_at: new Date().toISOString(),
        last_sync_status: 'success',
        last_sync_error: null,
      });

      logger.info('Sync completed successfully');
    } catch (error) {
      logger.error('Sync failed:', error);

      this.dbManager.updateSyncMeta({
        last_sync_finished_at: new Date().toISOString(),
        last_sync_status: 'failed',
        last_sync_error: error.message,
      });

      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 初始匯入
   */
  async initialImport() {
    logger.info('Starting initial import...');

    const retentionYears = this.config.labs?.data_retention_years || 3;
    const startDate = this.calculateStartDate(retentionYears);
    const itemCodes = this.dbManager.getLabItemCodes();

    logger.info(`Importing data from ${startDate} for ${itemCodes.length} lab items`);

    let totalImported = 0;
    const batchSize = this.config.sync?.batch_size || 5000;

    // 批次匯入
    let hasMore = true;
    let currentStartDate = startDate;

    while (hasMore) {
      const labData = await this.dbManager.dbfReader.queryLabDataBatch(
        itemCodes,
        currentStartDate,
        batchSize
      );

      if (labData.length === 0) {
        hasMore = false;
        break;
      }

      // 插入到 lab_results_raw
      this.insertLabData(labData);

      totalImported += labData.length;
      logger.info(`Imported ${totalImported} records...`);

      // 取得最後一筆的日期，作為下次查詢的起始點
      const lastRecord = labData[labData.length - 1];
      currentStartDate = lastRecord.HDATE;

      // 如果這批資料少於 batch size，表示已經沒有更多資料
      if (labData.length < batchSize) {
        hasMore = false;
      }
    }

    // 建立寬表
    await this.rebuildWideTable();

    // 更新同步元資料
    const maxDate = await this.getMaxLabDate();
    this.dbManager.updateSyncMeta({
      last_hdate_synced: maxDate,
    });

    logger.info(`Initial import completed: ${totalImported} records`);
  }

  /**
   * 增量同步
   */
  async incrementalSync(lastSyncedDate) {
    logger.info(`Starting incremental sync from ${lastSyncedDate}...`);

    const itemCodes = this.dbManager.getLabItemCodes();
    const labData = await this.dbManager.dbfReader.queryLabDataBatch(
      itemCodes,
      lastSyncedDate,
      this.config.sync?.batch_size || 5000
    );

    if (labData.length === 0) {
      logger.info('No new data to sync');
      return;
    }

    logger.info(`Found ${labData.length} new records`);

    // 插入到 lab_results_raw
    this.insertLabData(labData);

    // 取得受影響的病患
    const affectedPatients = [...new Set(labData.map(r => r.KCSTMR))];
    logger.info(`Updating wide table for ${affectedPatients.length} patients`);

    // 更新寬表（僅更新受影響的病患）
    for (const patientId of affectedPatients) {
      this.updateWideTableForPatient(patientId);
    }

    // 更新同步元資料
    const maxDate = labData[0].HDATE; // 已按日期排序，第一筆是最新的
    this.dbManager.updateSyncMeta({
      last_hdate_synced: maxDate,
    });

    logger.info('Incremental sync completed');
  }

  /**
   * 插入檢驗資料到 raw 表
   */
  insertLabData(labData) {
    const insert = this.dbManager.db.prepare(`
      INSERT OR REPLACE INTO lab_results_raw
        (kcstmr, hitem, hdate, hval, hunit, source_updated_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.dbManager.db.transaction((records) => {
      for (const record of records) {
        insert.run(
          record.KCSTMR,
          record.HITEM,
          record.HDATE,
          record.HVAL,
          record.HUNIT,
          new Date().toISOString(),
          new Date().toISOString()
        );
      }
    });

    insertMany(labData);
  }

  /**
   * 重建整個寬表
   */
  async rebuildWideTable() {
    logger.info('Rebuilding wide table...');

    // 清空寬表
    this.dbManager.db.prepare('DELETE FROM lab_results_wide').run();

    // 取得所有有檢驗資料的病患
    const patients = this.dbManager.db.prepare(`
      SELECT DISTINCT kcstmr FROM lab_results_raw
    `).all();

    logger.info(`Rebuilding for ${patients.length} patients...`);

    // 逐一更新
    for (const { kcstmr } of patients) {
      this.updateWideTableForPatient(kcstmr);
    }

    logger.info('Wide table rebuilt');
  }

  /**
   * 更新單一病患的寬表資料
   */
  updateWideTableForPatient(patientId) {
    const labCodeMap = this.dbManager.labCodeMap;
    const wideData = { kcstmr: patientId };

    // DM 區
    const dmItems = labCodeMap.DM?.items || {};
    for (const [key, item] of Object.entries(dmItems)) {
      const latest = this.getLatestLabValue(patientId, item.hitem_code);
      if (latest) {
        const fieldName = key.toLowerCase();
        wideData[fieldName] = this.parseNumericValue(latest.hval);
        wideData[`${fieldName}_date`] = latest.hdate;
      }
    }

    // HTN_LIP 區
    const htnLipItems = labCodeMap.HTN_LIP?.items || {};
    for (const [key, item] of Object.entries(htnLipItems)) {
      const latest = this.getLatestLabValue(patientId, item.hitem_code);
      if (latest) {
        const fieldName = key.toLowerCase();
        wideData[fieldName] = this.parseNumericValue(latest.hval);
        wideData[`${fieldName}_date`] = latest.hdate;
      }
    }

    // VIRUS 區
    const virusItems = labCodeMap.VIRUS?.items || {};
    for (const [key, item] of Object.entries(virusItems)) {
      const latest = this.getLatestLabValue(patientId, item.hitem_code);
      if (latest) {
        const fieldName = key.toLowerCase();
        wideData[fieldName] = latest.hval; // 文字值（Reactive/Non-reactive）
        wideData[`${fieldName}_date`] = latest.hdate;
      }
    }

    // 插入或更新寬表
    this.upsertWideTable(wideData);
  }

  /**
   * 取得最新檢驗值
   */
  getLatestLabValue(patientId, itemCode) {
    return this.dbManager.db.prepare(`
      SELECT hval, hdate, hunit
      FROM lab_results_raw
      WHERE kcstmr = ? AND hitem = ?
      ORDER BY hdate DESC, updated_at DESC
      LIMIT 1
    `).get(patientId, itemCode);
  }

  /**
   * 解析數值
   */
  parseNumericValue(value) {
    if (!value) return null;

    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * 插入或更新寬表
   */
  upsertWideTable(data) {
    const fields = Object.keys(data).filter(k => k !== 'kcstmr');
    const placeholders = fields.map(() => '?').join(', ');
    const updates = fields.map(f => `${f} = excluded.${f}`).join(', ');

    const sql = `
      INSERT INTO lab_results_wide (kcstmr, ${fields.join(', ')}, updated_at)
      VALUES (?, ${placeholders}, ?)
      ON CONFLICT(kcstmr) DO UPDATE SET ${updates}, updated_at = excluded.updated_at
    `;

    const values = [data.kcstmr, ...fields.map(f => data[f]), new Date().toISOString()];

    this.dbManager.db.prepare(sql).run(...values);
  }

  /**
   * 取得最大檢驗日期
   */
  async getMaxLabDate() {
    const result = this.dbManager.db.prepare(`
      SELECT MAX(hdate) as max_date FROM lab_results_raw
    `).get();

    return result?.max_date || null;
  }

  /**
   * 計算起始日期（N 年前）
   */
  calculateStartDate(years) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);

    return formatDate(date, 'YYYYMMDD');
  }

  /**
   * 啟動定期同步
   */
  startPeriodicSync(intervalMinutes) {
    if (this.cronJob) {
      this.stopPeriodicSync();
    }

    // 每 N 分鐘執行一次
    const cronExpression = `*/${intervalMinutes} * * * *`;

    this.cronJob = cron.schedule(cronExpression, async () => {
      logger.info('Periodic sync triggered');

      try {
        await this.runSync();
      } catch (error) {
        logger.error('Periodic sync error:', error);
      }
    });

    logger.info(`Periodic sync started: every ${intervalMinutes} minutes`);
  }

  /**
   * 停止定期同步
   */
  stopPeriodicSync() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Periodic sync stopped');
    }
  }
}

module.exports = SyncManager;
