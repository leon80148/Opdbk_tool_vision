# 診所掛號助手 (Clinic Registration Assistant) v0.9.0

> 基於 Electron + React 的桌面應用程式，協助診所掛號櫃檯提供智慧化病患資訊整合與預防保健管理。
>
> **可自訂診所名稱**，適用於各種診所環境。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-28.0-blue.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)

---

## 📖 目錄

- [專案簡介](#專案簡介)
- [主要功能](#主要功能)
- [快速開始](#快速開始)
- [設定說明](#設定說明)
- [使用手冊](#使用手冊)
- [技術架構](#技術架構)
- [常見問題](#常見問題)
- [版本歷史](#版本歷史)
- [授權資訊](#授權資訊)

---

## 專案簡介

**診所掛號助手**是專為診所櫃檯設計的智慧化病患資訊管理系統，透過整合 HIS 系統的 DBF 資料庫，提供快速、準確的病患資料查詢與預防保健管理功能。

### 核心特點

✅ **快速查詢**：全記憶體預載入，查詢速度 < 0.1 秒
✅ **預防保健**：自動判斷成健、篩檢、疫苗執行條件
✅ **熱鍵支援**：全域熱鍵快速喚出應用程式
✅ **自動擷取**：熱鍵自動擷取病歷號並查詢
✅ **效能優化**：React 元件優化，減少不必要渲染
✅ **易於部署**：單一執行檔，無需複雜設定
✅ **可自訂名稱**：診所名稱可在設定檔中自由修改

---

## 主要功能

### 1. 🔍 病患資料查詢

- **快速查詢**：輸入病歷號（自動補零至 7 碼）
- **基本資料顯示**：姓名、性別、年齡、身分證、聯絡方式
- **完整備註顯示**：病患特殊註記完整顯示
- **VIP 標籤**：特殊病患標示

### 2. 💉 預防保健管理

自動判斷病患是否符合各項預防保健服務執行條件：

- **成人健檢一階**：
  - 30-39 歲：每 5 年一次
  - 40-64 歲：每 3 年一次
  - 65 歲以上：每年一次
  - **自動處理年齡轉換**（例如：39→40 歲可重新執行）

- **成人健檢二階**：當年度已執行一階者可執行

- **腸篩（大腸癌篩檢）**：45-74 歲，兩年一次

- **口篩（口腔癌篩檢）**：30 歲以上，兩年一次

- **流感疫苗**：50 歲以上，按施打季判斷（10月-6月同一季）

- **新冠疫苗**：50 歲以上，按施打季判斷

- **肺鏈疫苗**：65 歲以上，終身一劑

### 3. 📅 預約與就診記錄

- **預約紀錄**：顯示未來 3 個月預約（含日期、時段、醫師）
- **就診歷史**：最近 10 次就診記錄
  - 看診日期與時間
  - 就診類別與主診斷
  - 開藥天數與慢箋次數
  - **慢箋到期日**（自動計算）

### 4. 🏥 慢性病管理

顯示最近兩年的慢性病管理記錄：

- **糖尿病管理**（卡序：3D、21、22、3E、23、24）
- **腎臟病管理**（相關卡序）
- **代謝症候群管理**（相關卡序）

每項顯示：執行日期、醫令名稱、下次可執行日

### 5. 🔬 檢查記錄

顯示 3 年內的檢查記錄：

- 腹部超音波
- 甲狀腺超音波
- 細針穿刺
- 肺功能檢查
- 尿流速檢查

每項顯示：檢查日期、種類、報告內容、下次追蹤日期

### 6. ⌨️ 熱鍵功能

- **視窗切換熱鍵**（預設 Ctrl+1）：從任何畫面喚出應用程式
- **病歷號擷取熱鍵**（預設 Ctrl+2）：自動擷取病歷號並查詢
- **可自訂設定**：在設定介面中自訂兩組熱鍵
- **錄製功能**：點選「開始錄製」後按下組合鍵即可設定

### 7. 📊 資料同步

- **全記憶體預載入**：啟動時預載入 DBF 資料（~596MB，約 16 秒）
- **定期同步**：每 10 分鐘自動同步新資料
- **增量更新**：僅同步變更的資料，效率高

---

## 快速開始

### 前置需求

1. **作業系統**：Windows 10/11（64-bit）

2. **Node.js 18+**（僅開發時需要）
   - 下載：https://nodejs.org/

3. **Visual FoxPro ODBC Driver**（用於讀取 DBF 檔案）
   - Windows 10/11 通常內建
   - 或下載 Microsoft Visual FoxPro OLE DB Provider

4. **DBF 資料檔案**
   - 確認 `data/` 目錄下有以下 DBF 檔案：
     - CO01M.DBF（病患主資料）
     - CO02M.DBF（處方記錄）
     - CO02F.DBF（處方明細）
     - CO03M.DBF（就醫紀錄）
     - CO03L.DBF（帳務明細）
     - co05b.DBF（預約記錄）

---

### 安裝步驟

#### 方法一：使用預編譯版本（推薦）

1. 下載安裝程式（`診所掛號助手-Setup-x.x.x.exe`）
2. 執行安裝程式，選擇安裝目錄
   - 建議：預設目錄或 `C:\ClinicAssistant\`（避免系統保護目錄）
3. 首次啟動，程式會自動建立 `config.ini`
4. **必須修改設定檔**：
   ```ini
   [clinic]
   name = 您的診所名稱

   [database]
   dbf_root = D:\\HIS\\DBF\\  # 改成您的 HIS 資料路徑
   ```
5. 重新啟動應用程式

**安裝後目錄結構**：
```
{安裝目錄}\
├── 診所掛號助手.exe      # 主程式
├── config.ini            # 設定檔（首次啟動自動建立）
├── data\                 # 快取資料庫
├── logs\                 # 日誌檔案
└── resources\            # 應用程式資源
```

**快速找到設定檔**：按 `Win + R`，輸入 `%LOCALAPPDATA%\Programs\診所掛號助手`

#### 方法二：從原始碼編譯

```bash
# 步驟 1：Clone 專案
git clone https://github.com/yourname/anchia-opd-toolkit.git
cd anchia-opd-toolkit

# 步驟 2：安裝相依套件
npm install

# 步驟 3：重建原生模組（robotjs、better-sqlite3）
npx electron-rebuild

# 步驟 4：建立設定檔
copy config.ini.example config.ini

# 步驟 5：編輯 config.ini（見下方說明）

# 步驟 6：開發模式執行
npm run dev

# 或建置生產版本
npm run build          # 建置 React 前端
npm run build:win      # 建置 Windows 安裝程式
```

---

## 設定說明

### config.ini

首次啟動前，請編輯 `config.ini`（或使用安裝目錄下的 config.ini）：

```ini
[clinic]
# ⚠️ 請修改為您的診所名稱（會顯示在應用程式標題列）
name = 您的診所名稱

[database]
# ⚠️ DBF 資料庫根目錄（使用雙反斜線 \\ 或單斜線 /）
dbf_root = D:\\path\\to\\your\\data\\
# SQLite 快取資料庫路徑
sqlite_path = D:\\path\\to\\your\\data\\lab_cache.db
# 預載入資料範圍（年）
preload_years_back = 3

[hotkey]
# 視窗切換熱鍵（可在設定介面修改）
global = Ctrl+1
# 病歷號擷取熱鍵（可在設定介面修改）
capture = Ctrl+2

[sync]
# 同步間隔（分鐘），0 = 僅啟動時同步
interval_minutes = 10
# 啟動時同步
sync_on_startup = true

[labs]
# 檢驗項目代碼對應表路徑
lab_code_map = config\\lab_codes.json

[ui]
# 隱藏選單列
hide_menu_bar = true
# 啟動時最大化
start_maximized = true

[preventive_care]
# 流感疫苗年齡限制
flu_vaccine_min_age = 50
# 新冠疫苗年齡限制
covid_vaccine_min_age = 50
```

> **重要提示**：
> - `[clinic] name`：設定您的診所名稱，會顯示在應用程式標題
> - Windows 路徑必須使用雙反斜線 `\\` 或單斜線 `/`
> - 確認 `dbf_root` 路徑下有所有必需的 DBF 檔案
> - 首次啟動會自動建立 SQLite 資料庫

---

## 使用手冊

詳細使用說明請參閱 [**USER_MANUAL.md**](./USER_MANUAL.md)

快速操作指引：

1. **查詢病患**：
   - 在搜尋框輸入病歷號（例如：`1`、`27`、`123`）
   - 按 Enter 或點選「查詢」按鈕
   - 系統自動補零為 7 碼（`0000001`、`0000027`、`0000123`）

2. **使用熱鍵擷取**：
   - 在 HIS 系統選中病歷號文字
   - 按下擷取熱鍵（預設 Ctrl+2）
   - 應用程式自動擷取並查詢

3. **設定熱鍵**：
   - 點選設定圖示（齒輪）
   - 在「視窗切換熱鍵」或「病歷號擷取熱鍵」欄位點選「開始錄製」
   - 按下想要的組合鍵（例如 Ctrl+Alt+A）
   - 點選「儲存設定」

4. **查看預防保健**：
   - 查詢病患後，右側會顯示預防保健卡片
   - ✓ 綠色勾勾 = 符合執行條件
   - 空白 = 不符合執行條件
   - 顯示最近 5 年內的執行日期

---

## 技術架構

### 專案結構

```
anchia-opd-toolkit/
├── config/                          # 設定檔目錄
│   ├── lab_codes.json              # 檢驗項目代碼對應表
│   └── rules.example.json          # 規則定義範例（已停用）
├── data/                           # DBF 資料檔案目錄
├── logs/                           # 日誌目錄
├── src/
│   ├── main/                       # Electron 主程序
│   │   ├── main.js                 # 應用程式入口
│   │   ├── preload.js              # 預載腳本（IPC 橋接）
│   │   ├── logger.js               # Winston 日誌模組
│   │   ├── config-manager.js       # 設定管理器
│   │   └── keyboard-simulator.js   # 鍵盤模擬（robotjs）
│   ├── db/                         # 資料庫存取層
│   │   ├── database-manager.js     # 資料庫管理器（預載入）
│   │   ├── dbf-reader.js           # DBF 讀取器（dbffile）
│   │   └── sync-manager.js         # 資料同步管理
│   ├── shared/                     # 共用程式碼
│   │   └── utils.js                # 工具函式
│   └── renderer/                   # React 前端
│       ├── main.jsx                # React 入口
│       ├── App.jsx                 # 主應用程式元件
│       └── components/             # UI 元件
│           ├── SearchBar.jsx       # 病歷號搜尋列
│           ├── Settings.jsx        # 設定介面
│           ├── PatientHeader.jsx   # 病患基本資料
│           ├── PreventiveCare.jsx  # 預防保健管理
│           ├── AppointmentRecords.jsx  # 預約紀錄
│           ├── VisitHistory.jsx    # 就診歷史
│           ├── ChronicDiseaseManagement.jsx  # 慢性病管理
│           └── ExaminationHistory.jsx  # 檢查記錄
├── tests/                          # 測試檔案
├── public/                         # 靜態資源
├── package.json                    # NPM 設定
└── vite.config.js                  # Vite 建構設定
```

### 技術棧

| 類別 | 技術 | 版本 | 用途 |
|------|------|------|------|
| **Desktop** | Electron | 28.0 | 跨平台桌面應用框架 |
| **Frontend** | React | 18.2 | UI 框架 |
| **UI Library** | Ant Design | 5.12 | React UI 元件庫 |
| **Backend** | Node.js | 18+ | 主程序運行環境 |
| **DBF 讀取** | dbffile | 1.12 | DBF 檔案解析 |
| **SQLite** | better-sqlite3 | 9.2 | 本機快取資料庫 |
| **編碼轉換** | iconv-lite | 0.6 | Big5 ↔ UTF-8 |
| **定時任務** | node-cron | - | 定期資料同步 |
| **鍵盤模擬** | robotjs | 0.6 | 原生鍵盤操作 |
| **日誌** | winston | 3.11 | 結構化日誌記錄 |
| **建構工具** | Vite | 5.0 | 快速建構與 HMR |
| **打包工具** | electron-builder | 24.9 | 應用程式打包 |

### 資料流程

```
使用者輸入病歷號
  ↓
formatPatientId() → "0000001"（補零至 7 碼）
  ↓
IPC: 'query-patient' → 主程序
  ↓
DatabaseManager.queryPatient()
  ├── 從記憶體快取查詢 CO01M（基本資料）
  ├── 從記憶體快取查詢 CO02M（處方記錄）
  ├── 從記憶體快取查詢 CO03M（就醫紀錄）
  ├── 從記憶體快取查詢 co05b（預約記錄）
  ├── 從記憶體快取查詢 CO02F（檢查記錄）
  └── 從 SQLite 查詢檢驗結果（若需要）
  ↓
正規化欄位名稱（大寫 → 小寫）
計算年齡、格式化日期（民國年）
  ↓
回傳至渲染程序
  ↓
React 元件顯示（PatientHeader, PreventiveCare, VisitHistory...）
```

### 效能優化

- **全記憶體預載入**（v4.3）：啟動時載入 3 年 DBF 資料至記憶體（~596MB）
- **React 優化**（v4.4）：使用 React.memo、useMemo、useCallback 減少重新渲染
- **預先計算**（v4.4）：慢箋到期日、預防保健判斷邏輯預先計算並快取
- **查詢速度**：< 0.1 秒（記憶體快取）vs 10+ 秒（磁碟讀取）

---

## 常見問題

### Q1: 啟動時出現「找不到 DBF 檔案」錯誤

**解決方案**：
1. 檢查 `config.ini` 中的 `dbf_root` 路徑是否正確
2. 確認路徑使用雙反斜線 `\\` 或單斜線 `/`
3. 確認 DBF 檔案確實存在於該目錄

### Q2: 熱鍵無法註冊或不作用

**解決方案**：
1. 檢查是否與其他程式的熱鍵衝突（例如 QQ、微信）
2. 嘗試更換熱鍵組合（在設定介面中修改）
3. 確認應用程式有管理員權限（某些系統需要）

### Q3: 病患查詢結果為空

**可能原因**：
1. 病歷號格式錯誤（應為純數字）
2. DBF 檔案中無此病患記錄
3. 資料未同步至記憶體快取

**解決方案**：
1. 確認輸入的病歷號正確
2. 重新啟動應用程式，等待資料預載入完成
3. 查看 `logs/` 目錄的日誌檔案

### Q4: 中文顯示亂碼

**解決方案**：
- 確認 DBF 檔案編碼為 Big5
- 檢查 `config.ini` 中的 `encoding` 設定（預設 big5）
- 確認系統區域設定為繁體中文

### Q5: 預防保健判斷不準確

**可能原因**：
1. CO05O 資料表中有未完診的記錄
2. 年齡計算錯誤（生日格式問題）

**解決方案**：
- 應用程式已自動過濾未完診記錄（TENDTIME 檢查）
- 確認病患生日資料正確（CO01M.MBIRTHDT）

### Q6: 記憶體佔用過高

**解決方案**：
1. 調整 `config.ini` 中的 `preload_years_back`（預設 3 年）
2. 減少至 1-2 年可降低記憶體佔用（150-300MB）
3. 權衡：記憶體 ↓ 但舊資料需從磁碟讀取（慢）

### Q7: 啟動速度慢

**解決方案**：
- 預載入 3 年資料需要約 15-20 秒，這是正常的
- 可在 `config.ini` 設定 `preload_years_back = 1` 加快啟動（約 5-8 秒）
- 或設定 `preload_enabled = false` 停用預載入（查詢會變慢）

### Q8: 慢箋到期日計算錯誤

**檢查項目**：
1. 確認「開藥天數」（dayqty）和「慢箋次數」（lldtt）正確
2. 計算公式：開立日期 + (開藥天數 × 慢箋次數)
3. 例如：2024/01/01 + (28 天 × 3 次) = 2024/03/25

---

## 版本歷史

### v0.9.1 (2025-11-25)
**新增診所名稱自訂功能**

🆕 **新功能**：
- ✅ 診所名稱可在 config.ini 中自訂
- ✅ 應用程式標題動態顯示設定的診所名稱
- ✅ 更新首次安裝說明文件

### v0.9.0 (2025-11-23)
**首次公開測試版本**

🎉 **核心功能**：
- ✅ 快速病患資料查詢（< 0.1 秒）
- ✅ 預防保健管理（成健、篩檢、疫苗）
- ✅ 預約與就診歷史查詢
- ✅ 慢性病管理記錄（糖尿病、腎臟病、代謝症候群）
- ✅ 檢查記錄追蹤（超音波、肺功能等）
- ✅ 熱鍵快速操作（視窗切換、病歷號擷取）

🚀 **效能特點**：
- 全記憶體預載入機制（查詢速度 < 0.1 秒）
- React 元件優化（React.memo、useMemo、useCallback）
- 動態記憶體管理（可調整預載入範圍）

🎨 **使用者體驗**：
- 民國年日期格式統一
- 自動計算慢箋到期日
- 預防保健判斷自動化
- 熱鍵錄製功能
- 完整使用手冊與文件

---

## 相關文件

- **使用手冊**：[USER_MANUAL.md](./USER_MANUAL.md)
- **變更日誌**：[CHANGELOG.md](./CHANGELOG.md)

---

## 開發團隊

如有問題或建議，請聯絡開發團隊。

---

## 授權資訊

MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

**診所掛號助手 v0.9.0** - 讓診所照護更智慧、更有溫度 ❤️
