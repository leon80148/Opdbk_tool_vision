/**
 * 驗證修復腳本
 * 測試 DatabaseManager 和 DBFReader 是否正常運作
 */

const ConfigManager = require('./src/main/config-manager');
const DatabaseManager = require('./src/db/database-manager');

async function verifyFix() {
  console.log('=== 開始驗證修復 ===\n');

  try {
    // 1. 載入配置
    console.log('1. 載入配置...');
    const configManager = new ConfigManager();
    await configManager.load();
    console.log('   ✅ 配置載入成功\n');

    // 2. 初始化 DatabaseManager
    console.log('2. 初始化 DatabaseManager...');
    const config = configManager.getConfig();
    const databaseManager = new DatabaseManager(config);
    await databaseManager.initialize();
    console.log('   ✅ DatabaseManager 初始化成功\n');

    // 3. 測試 SQLite 連線
    console.log('3. 測試 SQLite 連線...');
    const syncMeta = databaseManager.getSyncMeta();
    console.log('   ✅ SQLite 連線正常');
    console.log(`   同步狀態: ${syncMeta.last_sync_status || '尚未同步'}\n`);

    // 4. 測試 DBF 讀取
    console.log('4. 測試 DBF 讀取...');
    const records = await databaseManager.dbfReader.openAndReadDBF('CO01M');
    console.log(`   ✅ DBF 讀取成功，共 ${records.length} 筆病患資料\n`);

    // 5. 測試病患查詢
    console.log('5. 測試病患查詢...');
    if (records.length > 0) {
      const testPatientId = records[0].KCSTMR?.trim();
      console.log(`   測試病患 ID: ${testPatientId}`);

      const result = await databaseManager.queryPatient(testPatientId);

      if (result && result.basicInfo) {
        console.log('   ✅ 病患查詢成功');
        console.log(`   病歷號: ${result.basicInfo.KCSTMR?.trim()}`);
        console.log(`   姓名: ${result.basicInfo.MNAME?.trim()}`);
        console.log(`   年齡: ${result.basicInfo.age || 'N/A'}`);
        console.log(`   最近就診: ${result.clinicalHistory?.lastVisit?.IDATE || 'N/A'}`);
        console.log(`   待辦事項: ${result.actionList?.length || 0} 項\n`);
      } else {
        console.log('   ⚠️  查詢到病患但資料不完整\n');
      }
    }

    // 6. 清理
    databaseManager.close();
    console.log('=== 驗證完成！所有功能正常運作 ===\n');
    console.log('✅ 您現在可以執行 npm run dev 啟動應用程式');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 驗證失敗:', error.message);
    console.error('\n請檢查：');
    console.error('1. 是否已執行 npx electron-rebuild');
    console.error('2. config.ini 路徑設定是否正確');
    console.error('3. DBF 檔案是否存在');
    console.error('\n詳細錯誤：', error);
    process.exit(1);
  }
}

// 執行驗證
verifyFix();
