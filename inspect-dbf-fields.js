/**
 * DBF 欄位名稱檢查工具
 */

const { DBFFile } = require('dbffile');
const path = require('path');

const dbfRoot = path.join(__dirname, 'data');

async function inspectDBF() {
  try {
    // 檢查 CO01M 欄位
    console.log('='.repeat(60));
    console.log('CO01M.DBF 欄位結構');
    console.log('='.repeat(60));

    const co01mPath = path.join(dbfRoot, 'CO01M.DBF');
    const co01m = await DBFFile.open(co01mPath, { encoding: 'cp950' });

    console.log(`總記錄數: ${co01m.recordCount}`);
    console.log(`\n欄位列表 (共 ${co01m.fields.length} 個):`);
    console.log('-'.repeat(60));

    co01m.fields.forEach((field, index) => {
      console.log(`${index + 1}. ${field.name.padEnd(15)} (類型: ${field.type}, 大小: ${field.size})`);
    });

    // 顯示第一筆有資料的記錄
    console.log('\n第一筆記錄範例:');
    console.log('-'.repeat(60));
    const records = await co01m.readRecords(1);
    if (records.length > 0) {
      const first = records[0];
      Object.keys(first).forEach(key => {
        const value = first[key];
        if (value !== null && value !== undefined && value !== '') {
          console.log(`${key}: ${value}`);
        }
      });
    }

    console.log('\n');

    // 檢查 CO18H 欄位
    console.log('='.repeat(60));
    console.log('CO18H.DBF 欄位結構');
    console.log('='.repeat(60));

    const co18hPath = path.join(dbfRoot, 'CO18H.DBF');
    const co18h = await DBFFile.open(co18hPath, { encoding: 'cp950' });

    console.log(`總記錄數: ${co18h.recordCount}`);
    console.log(`\n欄位列表 (共 ${co18h.fields.length} 個):`);
    console.log('-'.repeat(60));

    co18h.fields.forEach((field, index) => {
      console.log(`${index + 1}. ${field.name.padEnd(15)} (類型: ${field.type}, 大小: ${field.size})`);
    });

    // 顯示第一筆有資料的記錄
    console.log('\n第一筆記錄範例:');
    console.log('-'.repeat(60));
    const co18hRecords = await co18h.readRecords(1);
    if (co18hRecords.length > 0) {
      const first = co18hRecords[0];
      Object.keys(first).forEach(key => {
        const value = first[key];
        if (value !== null && value !== undefined && value !== '') {
          console.log(`${key}: ${value}`);
        }
      });
    }

    console.log('\n');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('錯誤:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

inspectDBF();
