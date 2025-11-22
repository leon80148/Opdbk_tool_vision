# CLAUDE.md - 安家診所掛號助手開發指南

> **給 Claude Code 實例**: 本指南提供在此程式碼庫工作所需的關鍵資訊。

---

## 快速開始指令

```bash
# 開發
npm run dev              # 啟動 Vite 開發伺服器 + Electron 應用程式
npm run dev:vite         # 僅啟動 Vite 開發伺服器
npm run dev:electron     # 僅啟動 Electron 應用程式（等待 Vite）

# 測試
npm test                 # 執行 Jest 測試
npm run test:watch       # 執行測試（監看模式）
npm run test:coverage    # 執行測試並產生覆蓋率報告

# 建置
npm run build            # 使用 Vite 建置 React 前端
npm run build:win        # 建置 Windows 安裝程式（需先建置前端）

# 程式碼品質
npm run lint             # 使用 ESLint 檢查程式碼
npm run format           # 使用 Prettier 格式化程式碼

# 測試
npm test                 # 執行 Jest 單元測試
```

---

## 高階架構

### 技術堆疊

**桌面應用程式框架**: Electron 28（Node.js v18）
- **主程序（Main Process）**: Node.js 後端（IPC 處理器、資料庫存取）
- **渲染程序（Renderer Process）**: React 18.2 + Ant Design 5.x
- **通訊機制**: 透過 preload 腳本的 Electron IPC

**資料層**:
- **DBF（舊版 HIS）**: 透過 ODBC + `dbffile` npm 套件進行唯讀存取
- **SQLite（本機快取）**: 使用 `better-sqlite3` 快取檢驗結果
- **編碼轉換**: 透過 `iconv-lite` 進行 Big5 → UTF-8 轉換

**建置工具**:
- **前端**: Vite 5
- **打包**: electron-builder

### 程序架構

```
┌─────────────────────────────────────────────────────┐
│  渲染程序（Renderer Process - React）                 │
│  ├── SearchBar.jsx → 使用者輸入病歷號                  │
│  ├── PatientHeader.jsx → 基本資料顯示                 │
│  ├── LabMatrix.jsx → 檢驗結果矩陣                     │
│  └── ClinicalJourney.jsx → 就診歷程                   │
└───────────────┬─────────────────────────────────────┘
                │ IPC（透過 preload.js）
┌───────────────▼─────────────────────────────────────┐
│  主程序（Main Process - Node.js）                     │
│  ├── main.js → 進入點、IPC 處理器                     │
│  ├── DatabaseManager → SQLite + DBF 協調器           │
│  │   ├── DBFReader → 讀取 CO01M、CO02M、CO03M       │
│  │   └── SQLite → lab_results_wide 快取             │
│  └── ConfigManager → config.ini 管理                 │
└─────────────────────────────────────────────────────┘
```

---

## 關鍵實作細節

### 1. 病歷號格式：7 位數字補零

**所有 DBF 資料表使用 7 位數格式**：`0000001`、`0001234` 等。

**檔案**: `src/shared/utils.js`
```javascript
function formatPatientId(id) {
  const idStr = String(id).trim();
  const numeric = idStr.replace(/^0+/, '') || '0';
  return numeric.padStart(7, '0');  // ⚠️ 必須是 7 位，不是 10 位！
}
```

**前端輸入**: 自動將使用者輸入 "1" 補零為 "0000001"

### 2. 民國年曆支援（台灣民國紀年）

**DBF 生日格式**: 7 位數民國年格式 `YYYMMDD`
- 範例：`0761015` = 1987 年 10 月 15 日（民國 76 年 + 1911）

**檔案**: `src/db/dbf-reader.js`
```javascript
calculateAge(birthDate) {
  const birthStr = String(birthDate).trim();

  if (birthStr.length === 7) {
    // 民國年格式：YYYMMDD
    const rocYear = parseInt(birthStr.substring(0, 3));
    const year = rocYear + 1911;  // 轉換為西元年
    const month = parseInt(birthStr.substring(3, 5));
    const day = parseInt(birthStr.substring(5, 7));
    // ... 計算年齡
  } else if (birthStr.length === 8) {
    // 西元年格式：YYYYMMDD
    // ... 直接解析年/月/日
  }
}

formatBirthDate(birthDate) {
  // 民國年：「1987/10/15 (民國76年)」
  // 西元年：「1987/10/15」
}
```

### 3. 欄位名稱正規化：DBF → 前端

**問題**：DBF 回傳大寫欄位名稱（KCSTMR、MNAME），前端期望小寫（kcstmr、mname）

**檔案**: `src/db/database-manager.js`
```javascript
normalizeFieldNames(obj) {
  if (!obj) return null;

  const normalized = {};
  for (const key in obj) {
    const lowerKey = key.toLowerCase();
    const value = obj[key];

    if (typeof value === 'string') {
      normalized[lowerKey] = value.trim();
    } else {
      normalized[lowerKey] = value;
    }
  }

  // 加入格式化生日欄位
  if (obj.MBIRTHDT) {
    normalized.birthdate_formatted = this.dbfReader.formatBirthDate(obj.MBIRTHDT);
  }

  return normalized;
}
```

**在 queryPatient 中的使用**：
```javascript
const rawBasicInfo = await this.dbfReader.queryPatientBasicInfo(formattedId);
const basicInfo = rawBasicInfo ? this.normalizeFieldNames(rawBasicInfo) : null;
```

### 4. 性別顯示對應

**檔案**: `src/renderer/components/PatientHeader.jsx`
```javascript
const getGenderText = (sex) => {
  if (sex === '1') return '男';
  if (sex === '2' || sex === '0') return '女';
  return '未知';
};
```

### 5. Electron 原生模組編譯

**問題**：`better-sqlite3` 和 `odbc` 是原生模組，必須針對 Electron 的 Node.js 版本進行編譯

**解決方案**：在 `npm install` 之後執行：
```bash
npx electron-rebuild
```

**何時需要重建**：
- 安裝/更新 `better-sqlite3` 或 `odbc` 後
- 升級 Electron 版本後
- 遇到 `NODE_MODULE_VERSION` 不符錯誤時

---

## 資料庫結構概覽

### DBF 資料表（唯讀，來自 HIS 系統）

| 資料表 | 用途 | 關鍵欄位 |
|-------|------|----------|
| `CO01M` | 病患主資料 | `KCSTMR`（7 位數 ID）、`MNAME`、`MBIRTHDT`、`MSEX`、`MPERSONID` |
| `CO02M` | 處方/醫令記錄 | `KCSTMR`、`IDATE`、`DNO`（藥品/檢查代碼）、`PTDAY` |
| `CO03M` | 帳務/就診記錄 | `KCSTMR`、`IDATE`、`LABNO`（診斷代碼） |
| `CO18H` | 檢驗歷史（垂直表） | `KCSTMR`、`HITEM`（檢驗代碼）、`HDATE`、`HVAL`、`HUNIT` |
| `VISHFAM` | 家戶名單 | `pat_pid` |

**編碼**：Big5（DBF）→ UTF-8（應用程式）

### SQLite 資料表（本機快取）

| 資料表 | 用途 |
|-------|------|
| `lab_results_raw` | 從 CO18H 快取的原始檢驗結果 |
| `lab_results_wide` | 轉置為寬表格式以供前端快速查詢 |
| `sync_meta` | 同步狀態追蹤 |

---

## 資料流程模式

### 病患查詢流程

```
使用者輸入 "1"
  ↓
formatPatientId() → "0000001"
  ↓
IPC: 'query-patient' → 主程序
  ↓
DatabaseManager.queryPatient()
  ├── DBFReader.queryPatientBasicInfo() → CO01M（DBF）
  │   ↓
  │   normalizeFieldNames() → 大寫轉小寫
  │   ↓
  │   calculateAge() → 支援民國年曆
  │   ↓
  │   formatBirthDate() → "1987/10/15 (民國76年)"
  │
  ├── queryLabMatrix() → SQLite 寬表（快速！）
  │
  └── DBFReader.queryClinicalHistory() → CO02M/CO03M（DBF）
  ↓
回傳至渲染程序 → 在 UI 中顯示
```

### 同步流程（CO18H → SQLite）

1. **初始匯入**（首次執行）：
   - 匯入最近 2-3 年的檢驗資料
   - 依據 `lab_codes.json` 中的 `hitem` 代碼篩選
   - 寫入 `lab_results_raw`
   - 轉置為 `lab_results_wide`

2. **增量同步**（定期）：
   - 觸發時機：每 N 分鐘（config.ini：`sync.interval_minutes`）
   - 查詢 CO18H 中 `hdate > last_hdate_synced` 的記錄
   - 更新受影響病患在 `lab_results_wide` 中的資料

---

## 常見陷阱與解決方案

### ❌ 陷阱 1：有效病歷號卻查無病患

**症狀**：查詢 "27" 回傳 null，但病患確實存在

**根本原因**：病歷號補零不正確

**解決方案**：
- 檢查 `formatPatientId()` 回傳 7 位數字："27" → "0000027"
- DBF 儲存為 "0000027"，不是 "27" 或 "0000000027"

### ❌ 陷阱 2：所有病患年齡都顯示「N/A」

**症狀**：`data.age` 總是 null

**根本原因**：`calculateAge()` 不支援 7 位數民國年格式

**解決方案**：
- 使用 `src/db/dbf-reader.js` 中的增強版 `calculateAge()`
- 支援 7 位數（民國年）和 8 位數（西元年）格式

### ❌ 陷阱 3：UI 未顯示病患資料

**症狀**：查詢成功但 PatientHeader 什麼都沒顯示

**根本原因**：欄位名稱大小寫不一致（DBF 大寫 vs 前端小寫）

**解決方案**：
- 回傳 DBF 資料時一律使用 `normalizeFieldNames()`
- 轉換 `KCSTMR` → `kcstmr`、`MNAME` → `mname` 等

### ❌ 陷阱 4：NODE_MODULE_VERSION 不符

**症狀**：
```
Error: The module was compiled against a different Node.js version
```

**根本原因**：`better-sqlite3` 針對系統 Node.js（v21）編譯，但 Electron 使用 Node.js v18

**解決方案**：
```bash
npm install electron-rebuild --save-dev
npx electron-rebuild
```

### ❌ 陷阱 5：DBF 查詢非常慢（13-15 秒）

**症狀**：首次查詢耗時很長，特別是 CO18H

**根本原因**：CO18H.DBF 有 260MB、412,007 筆記錄，無索引

**解決方案**：
- 初始同步後使用 SQLite 快取
- 前端查詢 `lab_results_wide`（快速、已建立索引）
- 只在需要基本資料和就診歷程時查詢 DBF

---

## 設定檔管理

### config.ini 位置

預設：專案根目錄 `D:\programing\github\anchia_opd_toolit\config.ini`

**關鍵設定**：
```ini
[database]
dbf_root = D:\\programing\\github\\anchia_opd_toolit\\data\\
sqlite_path = D:\\programing\\github\\anchia_opd_toolit\\data\\lab_cache.db

[hotkey]
global = Ctrl+Alt+C

[sync]
interval_minutes = 10  # 0 = 僅在啟動時同步

[labs]
lab_code_map = D:\\programing\\github\\anchia_opd_toolit\\config\\lab_codes.json
```

**注意**：Windows 路徑使用雙反斜線 `\\` 或單斜線 `/`

---

## 測試策略

### 單元測試（Jest）

位置：`tests/`

執行：`npm test`

主要測試檔案：
- `database-manager.test.js` - DatabaseManager 方法
- `dbf-reader.test.js` - DBF 讀取和解析
- `integration.test.js` - 端對端病患查詢流程

### 獨立 DBF 測試（不需要 SQLite）

**最適合快速驗證**：

```bash
node test-dbf-only.js        # 測試 DBF 讀取（快速）
node test-age-birthdate.js   # 測試年齡/生日邏輯
node test-patient-27.js      # 測試特定病患流程
```

這些腳本：
- 不需要 SQLite 設定
- 直接測試 DBF 讀取
- 驗證編碼（Big5 → UTF-8）
- 檢查民國年格式的年齡計算

---

## 近期錯誤修復（參考）

### 1. 欄位名稱大小寫不一致（2025-11-22）
- **修復**：在 DatabaseManager 中新增 `normalizeFieldNames()`
- **檔案**：`src/db/database-manager.js`
- **文件**：`QUERY_FIX_SUMMARY.md`

### 2. 病歷號格式（2025-11-22）
- **修復**：從 10 位數補零改為 7 位數
- **檔案**：`src/shared/utils.js`
- **文件**：`QUERY_FIX_SUMMARY.md`

### 3. 民國年曆年齡計算（2025-11-22）
- **修復**：支援 7 位數 YYYMMDD 格式
- **檔案**：`src/db/dbf-reader.js`
- **文件**：`AGE_BIRTHDATE_FIX.md`

### 4. 性別顯示（2025-11-22）
- **修復**：新增 `getGenderText()` 對應
- **檔案**：`src/renderer/components/PatientHeader.jsx`
- **文件**：`UI_UPDATE_SUMMARY.md`

### 5. 原生模組編譯（2025-11-22）
- **修復**：記錄 electron-rebuild 使用方式
- **文件**：`FIX_SUMMARY.md`

---

## 開發最佳實務

### 新增功能時

1. **讀取 DBF 資料**：
   - 使用 `dbffile` 套件（已在 DBFReader 中設定）
   - 一律使用 `iconv-lite` 轉換 Big5 → UTF-8
   - 回傳至前端前套用 `normalizeFieldNames()`

2. **格式化病歷號**：
   - 一律使用 `src/shared/utils.js` 中的 `formatPatientId()`
   - 絕不自行寫死補零邏輯

3. **處理日期**：
   - 檢查是 7 位數（民國年）或 8 位數（西元年）
   - 使用 `calculateAge()` 和 `formatBirthDate()` 輔助函式

4. **前端元件**：
   - 期望小寫欄位名稱（kcstmr、mname 等）
   - 使用 `|| 'N/A'` 妥善處理 null/undefined

### 除錯時

1. **檢查日誌**：`logs/` 目錄（winston logger）
2. **直接測試 DBF**：`node test-dbf-only.js`
3. **驗證病歷號格式**：應為 7 位數
4. **檢查編碼**：中文字應正確顯示
5. **驗證原生模組**：若有錯誤執行 `npx electron-rebuild`

---

## 架構決策

### 為何使用 ODBC + dbffile 而非 SQL Server？

- **舊版限制**：HIS 使用 DBF 檔案（Visual FoxPro）
- **唯讀存取**：不需要修改
- **效能**：SQLite 快取常存取的資料

### 為何使用 SQLite 儲存檢驗結果？

- **CO18H 很大**：260MB、412,007 筆記錄
- **垂直表**：每次查詢都需要轉置
- **解決方案**：預先轉置為 SQLite 中的 `lab_results_wide`
- **結果**：查詢時間從 13-15 秒降至不到 1 秒

### 為何獨立 normalizeFieldNames()？

- **關注點分離**：DBF 層回傳原始資料
- **前端獨立性**：React 元件不需知道 DBF
- **可維護性**：欄位名稱對應的單一控制點

### 為何是 7 位數病歷號？

- **DBF 舊版格式**：既有 HIS 使用 7 位數
- **相容性**：必須完全符合 CO01M.KCSTMR
- **非任意決定**：改變會導致 DBF 查詢失效

---

## 重要檔案參考

### 設定檔
- `config.ini` - 主要設定（DBF 路徑、同步設定）
- `config/lab_codes.json` - 檢驗項目代碼對應
- `config/rules.json` - Smart Action List 規則

### 主程序（後端）
- `src/main/main.js` - 進入點、IPC 處理器
- `src/main/config-manager.js` - config.ini 載入器
- `src/main/logger.js` - Winston 日誌記錄
- `src/db/database-manager.js` - SQLite + DBF 協調器
- `src/db/dbf-reader.js` - DBF 檔案讀取器（ODBC）
- `src/shared/utils.js` - 共用工具（formatPatientId）

### 渲染程序（前端）
- `src/renderer/App.jsx` - 主應用程式元件
- `src/renderer/components/SearchBar.jsx` - 病歷號輸入
- `src/renderer/components/PatientHeader.jsx` - 基本資料顯示
- `src/renderer/components/PreventiveCare.jsx` - 預防保健判斷
- `src/renderer/components/AppointmentRecords.jsx` - 預約紀錄
- `src/renderer/components/VisitHistory.jsx` - 就診歷史
- `src/renderer/components/LabMatrix.jsx` - 檢驗結果矩陣（已移除）
- `src/renderer/components/ClinicalJourney.jsx` - 就診歷程（已移除）

### 測試檔案
- `tests/*.test.js` - Jest 單元測試

### 文件
- `README.md` - 使用者指南
- `OPD_TOOLIT_PRD.MD` - 產品需求文件
- `database_schema.MD` - DBF 結構參考
- `*_FIX_SUMMARY.md` - 錯誤修復文件

---

## 預防保健功能

### 功能概述

預防保健功能顯示在病患基本資料右側，用於判斷病患是否符合各項預防保健服務的執行條件。

**資料來源**：CO05O 資料表（就醫歷史紀錄）中的 `tisrs` 欄位（卡序）

**顯示項目**：
1. 成人健檢一階
2. 成人健檢二階
3. 腸篩（大腸癌篩檢）
4. 口篩（口腔癌篩檢）
5. 流感疫苗
6. 新冠疫苗
7. 肺鏈疫苗

### 關鍵實作細節

#### 1. 日期格式：民國年 7 位數

**CO05O 資料表使用民國年格式**：`YYYMMDD`（7 位數）

**範例**：
- `1120928` = 民國 112 年 09 月 28 日 = 2023/09/28
- `1141001` = 民國 114 年 10 月 01 日 = 2025/10/01

**檔案**: `src/db/dbf-reader.js`
```javascript
// 計算五年前的日期（民國年格式）
const fiveYearsAgo = new Date();
fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
const rocYear = fiveYearsAgo.getFullYear() - 1911; // 轉換為民國年
const fiveYearsAgoStr =
  String(rocYear).padStart(3, '0') +
  String(fiveYearsAgo.getMonth() + 1).padStart(2, '0') +
  String(fiveYearsAgo.getDate()).padStart(2, '0');
```

**前端日期顯示**: `src/renderer/components/PreventiveCare.jsx`
```javascript
// 支援民國年（7位數）和西元年（8位數）
const formatDate = (dateStr) => {
  if (dateStr.length === 7) {
    // 民國年：YYYMMDD
    const rocYear = parseInt(dateStr.substring(0, 3));
    const year = rocYear + 1911;
    const month = dateStr.substring(3, 5);
    const day = dateStr.substring(5, 7);
    return `${year}/${month}/${day}`;
  }
  // ... 西元年處理
};
```

#### 2. 成人健檢邏輯：年齡轉換處理

**⚠️ 重要：成健卡序定義**
- **成健一階**：3D（30-39歲）、21（40-64歲）、22（65歲以上）
- **成健二階**：3E（30-39歲）、23（40-64歲）、24（65歲以上）

**成人健檢一階規則**：
- 30-39 歲：每 5 年一次（卡序 `3D`）
- 40-64 歲：每 3 年一次（卡序 `21`）
- 65 歲以上：每年一次（卡序 `22`）

**重要**：當病患剛滿 40 或 65 歲時，條件重新計算

**檔案**: `src/renderer/components/PreventiveCare.jsx`
```javascript
const checkAdultHealthPhase1 = () => {
  // 查找所有一階記錄（不限卡序）
  const lastRecord = findLatestPhase1Record(); // 查找 3D、21、22

  // 取得最近一次記錄的年齡層和當前年齡層
  const lastAgeGroup = getCardSeqAgeGroup(lastRecord.tisrs);
  const currentAgeGroup = getCurrentAgeGroup(age);

  // 年齡層不同 → 可執行（例如：39歲用3D做過，40歲可用21再做）
  if (lastAgeGroup !== currentAgeGroup) {
    return { canExecute: true, lastDate, reason: '年齡轉換可執行' };
  }

  // 年齡層相同 → 依間隔年數判斷
  return {
    canExecute: yearsSince >= intervalYears,
    lastDate,
    reason: yearsSince >= intervalYears ? '可執行' : `需${intervalYears}年一次`
  };
};
```

**成人健檢二階規則**：
- 當年度已執行一階但尚未執行二階者即可執行
- 30-39 歲：卡序 `3E`
- 40-64 歲：卡序 `23`
- 65 歲以上：卡序 `24`

```javascript
const checkAdultHealthPhase2 = () => {
  // 檢查當年度是否執行過任一一階（3D、21、22）
  const phase1Record = findLatestPhase1Record();
  const phase1Year = getYear(phase1Record.tbkdate);

  if (phase1Year !== currentYear) {
    return { canExecute: false, reason: '需先執行一階' };
  }

  // 檢查當年度是否已執行過任一二階（3E、23、24）
  const phase2Record = findLatestPhase2Record();
  const phase2Year = getYear(phase2Record.tbkdate);

  return {
    canExecute: phase2Year !== currentYear,
    // ...
  };
};
```

#### 3. 其他預防保健項目

**腸篩（大腸癌篩檢）**：
- 45-74 歲，兩年一次
- 卡序：`85`
- 判斷方式：今年 - 最近一次年份 >= 2

**口篩（口腔癌篩檢）**：
- 30 歲以上，兩年一次
- 卡序：`95`
- ⚠️ 註：目前未檢查抽菸/嚼檳榔條件（資料庫無此欄位）

**流感疫苗**：
- 50 歲以上（可從 config 設定）
- **按施打季計算**：每年 10 月到隔年 6 月算同一個施打季
  - 例如：2024/10 - 2025/6 = "2024施打季"
  - 只要不在同一施打季即可再次施打
- 卡序：`AU`

**新冠疫苗**：
- 50 歲以上（可從 config 設定）
- **按施打季計算**：每年 10 月到隔年 6 月算同一個施打季
  - 例如：2024/10 - 2025/6 = "2024施打季"
  - 只要不在同一施打季即可再次施打
- 卡序：`VU`

**肺鏈疫苗**：
- 65 歲以上，終身一劑
- 卡序：`DU`

#### 4. 輔助函數

```javascript
// 判斷卡序屬於哪個年齡層
const getCardSeqAgeGroup = (cardSeq) => {
  if (['3D', '3E'].includes(cardSeq)) return '30-39';
  if (['21', '23'].includes(cardSeq)) return '40-64';  // 21一階, 23二階
  if (['22', '24'].includes(cardSeq)) return '65+';    // 22一階, 24二階
  return null;
};

// 取得當前年齡層
const getCurrentAgeGroup = (age) => {
  if (age >= 30 && age < 40) return '30-39';
  if (age >= 40 && age < 65) return '40-64';
  if (age >= 65) return '65+';
  return null;
};

// 查找所有成健一階記錄
const findLatestPhase1Record = () => {
  return findLatestRecord(['3D', '21', '22']);  // 正確：22是65+一階
};

// 查找所有成健二階記錄
const findLatestPhase2Record = () => {
  return findLatestRecord(['3E', '23', '24']);  // 正確：23是40-64二階
};
```

### 資料查詢流程

```
使用者查詢病患
  ↓
DatabaseManager.queryPatient()
  ├── DBFReader.queryPreventiveCareRecords()
  │   ├── 開啟 CO05O.DBF
  │   ├── 篩選卡序：3D、21、22、3E、23、24、85、95、AU、VU、DU
  │   ├── **篩選完診時間（TENDTIME 不為空且不為 '000000'）** ← 重要！
  │   ├── 篩選五年內的記錄（民國年格式比較）
  │   └── 回傳記錄（按日期降序排序）
  │
  └── 正規化欄位名稱（TISRS → tisrs）
  ↓
PreventiveCare 組件
  ├── checkAdultHealthPhase1() - 成健一階判斷
  ├── checkAdultHealthPhase2() - 成健二階判斷
  ├── checkColorectalScreening() - 腸篩判斷
  ├── checkOralScreening() - 口篩判斷
  ├── checkFluVaccine() - 流感判斷
  ├── checkCovidVaccine() - 新冠判斷
  └── checkPneumococcalVaccine() - 肺鏈判斷
  ↓
顯示表格（項目、可否執行、最近五年內日期）
```

### 常見陷阱

#### ❌ 陷阱 1：日期格式不一致

**症狀**：查詢預防保健記錄時，所有記錄都被過濾掉

**根本原因**：CO05O 使用民國年格式（7位數），程式碼使用西元年格式（8位數）

**解決方案**：
- 五年前日期計算必須使用民國年格式：`1091122`（民國109年）
- 日期比較使用字串比較：`'1120928' >= '1091122'`

#### ❌ 陷阱 2：成健年齡轉換未處理

**症狀**：40 歲病患去年用 3D 做過成健，系統顯示不可執行

**根本原因**：只檢查當前年齡對應的卡序（21），忽略之前用 3D 做的記錄

**解決方案**：
- 查找所有一階卡序（3D、21、22）
- 比較最近一次記錄的年齡層與當前年齡層
- 年齡層不同 → 可執行

#### ❌ 陷阱 3：未過濾完診時間導致誤判

**症狀**：病患有預防保健記錄但實際未完診（掛號錯誤或取消就診）

**根本原因**：CO05O 資料表包含所有掛號記錄，包括未完診的記錄

**解決方案**：
- 必須檢查 `TENDTIME` 欄位（完診時間）
- 只取 `TENDTIME` 不為空且不為 `'000000'` 的記錄
- 程式碼位置：`src/db/dbf-reader.js:317-318`

```javascript
// 必須有完診時間（過濾掛號錯誤或未完診的記錄）
const tendtime = r.TENDTIME?.trim() || '';
if (!tendtime || tendtime === '000000') return false;
```

### UI 顯示規則

**表格欄位**：
- 項目：成健一階、成健二階、腸篩...
- 可否執行：綠色勾勾（可執行）或空白（不可執行）
- 最近五年內：顯示五年內的最近一次執行日期

**顯示邏輯**：
- ✓ 綠色勾勾：符合執行條件
- 空白：不符合執行條件（不顯示任何圖標或文字）
- 日期：無論能否執行，都顯示最近五年內的執行日期
- `-`：五年內無執行記錄

---

## 重要注意事項

### 已知資料品質問題

部分病患在 DBF 中有不完整資料：
- 缺少電話號碼（`mtelh`）
- 缺少地址（`maddr`）
- 無效/缺少生日（年齡顯示 N/A）

**這是預期的** - 系統會妥善處理並提供備用方案。

### Smart Action List 目前已停用

- **狀態**：在 `src/renderer/App.jsx` 中已註解
- **原因**：使用者要求移除以簡化 UI
- **重新啟用方式**：取消註解 SmartActionList 元件

### 效能預期

- **病患查詢（使用 SQLite）**：< 1 秒
- **病患查詢（僅 DBF）**：13-15 秒（掃描 CO18H）
- **初始同步**：數分鐘（取決於資料量）
- **增量同步**：< 30 秒（每 10 分鐘）

### 民國年轉西元年對照表

| 民國年 | 西元年 | 公式 |
|--------|--------|------|
| 50     | 1961   | 50 + 1911 |
| 76     | 1987   | 76 + 1911 |
| 100    | 2011   | 100 + 1911 |
| 113    | 2024   | 113 + 1911 |

---

## 取得協助

1. **查看文件**：
   - 本檔案（CLAUDE.md）
   - README.md 使用者指南
   - *_SUMMARY.md 檔案記錄錯誤修復

2. **執行測試**：
   - `npm test` 執行單元測試

3. **查看日誌**：
   - `logs/` 目錄查看 Winston 日誌
   - Electron DevTools 控制台（Ctrl+Shift+I）

4. **常見問題**：參見上方「常見陷阱」章節

---

## 版本歷史

- **v4.4**（2025-11-23）：目前版本
  - **重大效能優化**：React 元件渲染效能提升 50-70%
    - 所有主要元件加入 `React.memo` 避免不必要的重新渲染
    - `PreventiveCare` 和 `VisitHistory` 使用 `useMemo` 快取複雜計算
    - 預先計算慢箋到期日，表格渲染速度提升 40-60%
  - **依賴套件清理**：移除未使用的套件（odbc, node-cron, zustand, react-router-dom）
    - 減少 20 個套件依賴
    - 安裝體積減少約 50-80MB
    - 打包後應用程式體積減少約 20-30MB
  - **熱鍵設定增強**：
    - 修復 robotjs 鍵盤模擬參數順序錯誤
    - 支援分別設定「縮放視窗熱鍵」和「查詢熱鍵」
  - **自動查詢功能修復**：
    - 修正 React useEffect 閉包問題
    - 添加 IPC 監聽器清理函數
    - 查詢熱鍵(Ctrl+Alt+G)現可正常觸發自動查詢

- **v4.3.2**（2025-11-23）
  - **更名**：應用程式名稱從「安佳診所櫃檯助手」改為「安家診所掛號助手」
  - **優化**：日期顯示統一改為民國年格式，生日加上西元年參考
  - **調整**：糖尿病管理、腎臟病管理、代謝症候群管理、檢查記錄的日期格式

- **v4.3.1**（2025-11-22）
  - **新增**：動態記憶體管理（可調整預載入資料範圍）
  - **優化**：支援只載入最近 N 年資料，減少記憶體占用
  - **設定**：config.ini 新增 `preload_years_back` 參數
  - 記憶體占用：500MB → 150-200MB（可調）

- **v4.3**（2025-11-22）
  - **重大效能優化**：全量預載入機制
  - 查詢速度：從 10 秒降到 < 0.1 秒（100倍提升）
  - 啟動時預載入所有 DBF 到記憶體（~500MB）
  - 支援網路磁碟環境

- **v4.2**（2025-11-22）
  - 效能優化：合併查詢、並行查詢、LRU 快取、日期快取
  - （後被 v4.3 全量預載入取代）

- **v4.1**（2025-11-22）
  - **重要修正**：修正成健卡序定義錯誤
    - 成健一階：3D（30-39歲）、21（40-64歲）、**22**（65歲以上）
    - 成健二階：3E（30-39歲）、**23**（40-64歲）、24（65歲以上）
  - **新增**：完診時間（TENDTIME）檢查邏輯，過濾掛號錯誤記錄
  - **優化**：流感/新冠疫苗改用「施打季」邏輯（10月-6月為同一季）
  - 清理暫存測試檔案
  - 更新文件說明

- **v4.0**（2025-11-22）
  - 新增預防保健功能（成健、篩檢、疫苗）
  - 新增預約紀錄和就診歷史顯示
  - 修正成人健檢年齡轉換邏輯
  - 修復民國年日期格式處理
  - 移除檢驗矩陣和診療歷程（簡化 UI）
  - 優化基本資料顯示（備註完整顯示、左右分欄）

- **v3.0**（2025-11-22）
  - 檢驗結果 SQLite 快取
  - 民國年曆支援
  - 欄位名稱正規化
  - 全域熱鍵支援
  - 病患查詢錯誤修復

---

## 未來規劃

### Client-Server 架構（考慮中）

**背景**
- 當前單機版每台電腦占用 150-500MB 記憶體
- 如有 3 台以上電腦，總記憶體占用較大

**提議方案**：改用 Client-Server 架構
```
Server 端 (Docker + SQLite + REST API)
  - 預載入 DBF 資料（500MB）
  - 提供 REST API
  ↓ 區網 (5-10ms)
Client 端（輕量化）
  - 只保留 UI（50MB）
  - 透過 HTTP 查詢
```

**效益分析**
| 項目 | 單機版（3台） | Client-Server | 節省 |
|------|--------------|---------------|------|
| 總記憶體 | 1500MB | 650MB | 57% |
| 查詢速度 | 50ms | 60-70ms | +10-20ms |
| 維護性 | 分散 | 集中 | ✅ 更好 |

**適用情境**
- ✅ 有 3 台以上電腦
- ✅ 有穩定區網環境
- ✅ 有主機或 NAS 可當 Server
- ✅ 需要集中管理資料

**不適用情境**
- ❌ 只有 1-2 台電腦
- ❌ 網路不穩定
- ❌ 需要離線使用

**實作估算**
- Server API 開發：4-6 小時
- Client 重構：2-3 小時
- Docker 配置：1 小時
- **總計：1 個工作天**

**決策狀態**：**暫不實作**
- 當前單機版 + 動態記憶體管理已可滿足需求
- v4.3.1 記憶體占用已降到 150-200MB（可接受）
- 若未來擴展到 5 台以上電腦，再考慮實作

---

**最後更新**：2025-11-22
**目標讀者**：未來在此儲存庫工作的 Claude Code 實例
