/**
 * 檢查 DBF 中病歷號的實際格式
 */

const DBFReader = require('./src/db/dbf-reader');
const ConfigManager = require('./src/main/config-manager');

async function checkFormat() {
  const configManager = new ConfigManager();
  await configManager.load();
  const config = configManager.getConfig();

  const dbfReader = new DBFReader(config);
  const patients = await dbfReader.openAndReadDBF('CO01M');

  console.log('前 10 筆病患的病歷號格式：\n');
  patients.slice(0, 10).forEach((p, i) => {
    const id = p.KCSTMR;
    console.log(`${i + 1}. 原始值: "${id}" | 長度: ${id?.length} | Trim後: "${id?.trim()}" | 長度: ${id?.trim().length}`);
  });

  // 查找病歷號 142077
  console.log('\n查找包含 142077 的病患：\n');
  const found = patients.filter(p => p.KCSTMR?.includes('142077'));
  found.forEach(p => {
    console.log(`病歷號: "${p.KCSTMR}" | 姓名: ${p.MNAME}`);
  });
}

checkFormat();
