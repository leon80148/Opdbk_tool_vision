const { DBFFile } = require('dbffile');
const path = require('path');

async function findPatient() {
  const co01mPath = path.join(__dirname, 'data', 'CO01M.DBF');
  const co01m = await DBFFile.open(co01mPath, { encoding: 'cp950' });
  const records = await co01m.readRecords();

  // Search for patient IDs containing "14207"
  const matches = records.filter(r => r.KCSTMR?.includes('14207'));

  console.log(`找到 ${matches.length} 筆包含 "14207" 的病歷號：`);
  matches.forEach(p => {
    console.log(`  病歷號: ${p.KCSTMR}, 姓名: ${p.MNAME}`);
  });

  // Show some example patient IDs
  console.log('\n前 10 筆病歷號範例：');
  records.slice(0, 10).forEach(p => {
    console.log(`  ${p.KCSTMR} - ${p.MNAME}`);
  });
}

findPatient();
