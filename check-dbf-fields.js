/**
 * 檢查 DBF 欄位結構
 */

const DBFReader = require('./src/db/dbf-reader');
const ConfigManager = require('./src/main/config-manager');

async function checkFields() {
  const configManager = new ConfigManager();
  await configManager.load();
  const config = configManager.getConfig();

  const dbfReader = new DBFReader(config);
  const patients = await dbfReader.openAndReadDBF('CO01M');

  if (patients.length > 0) {
    const firstPatient = patients[0];
    console.log('CO01M.DBF 欄位結構：\n');
    console.log(Object.keys(firstPatient).join(', '));
    console.log('\n第一筆資料：\n');
    console.log(firstPatient);
  }
}

checkFields();
