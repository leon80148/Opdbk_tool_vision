# 資料庫規格書 (Database Schema) - Anchia Lab Clinic System

* **專案名稱**：Anchia Lab Clinic Assistant
* **最後更新**：2025-11-22
* **檔案格式**：DBF (dBASE III/IV)

**描述**：
本文件定義診所櫃檯輔助系統的資料庫結構。
資料來源為 legacy DBF 檔案，系統需透過 ODBC 或 DBF Parser 讀取。

---

## 1. 資料表總覽 (Tables Overview)

| 檔案名稱 (Table) | 描述用途                          | 關鍵欄位 (PK)                           |
| ------------ | ----------------------------- | ----------------------------------- |
| `CO01M`      | 病患主資料表，儲存病患核心靜態資料（姓名、電話、備註）。  | `kcstmr`                            |
| `CO02M`      | 處方/療程記錄，記錄特定時間點的用藥或治療項目。      | `kcstmr`, `idate`, `itime`, `dno`   |
| `CO03M`      | 檢驗單/帳務摘要，記錄就醫批次的摘要、診斷與帳務金額。   | `kcstmr`, `idate`, `itime`          |
| `co05b`      | 預約紀錄，儲存病患預約掛號資訊。              | `kcstmr`, `tbkdt`, `tsts`, `tartime` |
| `CO05O`      | 就醫歷史紀錄，記錄病患實際就診的詳細時間與狀態。      | `kcstmr`, `tbkdate`, `tbktime`      |
| `CO18H`      | 檢驗項目歷史檔（核心垂直表），儲存所有檢驗結果與生理數據。 | `kcstmr`, `hdate`, `htime`, `hitem` |
| `VISHFAM`    | 家戶名單，儲存家戶成員關係或家戶基本資料。         | `pat_pid`（對應 `kcstmr`）              |

---

## 2. 詳細欄位定義 (Table Definitions)

### 2.1 `CO01M` - 病患主資料表 (Patient Master)

**用途**：
查詢病患基本資料、聯絡方式、VIP 狀態及奧客/過敏備註。

| 欄位名稱         | 類型      | Nullable | 描述 / 備註                               |
| ------------ | ------- | -------- | ------------------------------------- |
| `kcstmr`     | varchar | No       | **主鍵**，病歷號（7 位數字，不足位左側補零，如 `0012345`） |
| `mname`      | varchar | Yes      | 病患姓名                                  |
| `mpersonid`  | varchar | Yes      | 身分證字號 / ID                            |
| `msex`       | varchar | Yes      | 性別                                    |
| `mbirthdt`   | varchar | Yes      | 出生年月日                                 |
| `mtelh`      | varchar | Yes      | 電話 / 行動電話（優先聯絡）                       |
| `mfml`       | varchar | Yes      | 住家電話                                  |
| `maddr`      | varchar | Yes      | 地址                                    |
| `mtyp`       | varchar | Yes      | 病患類型（標記 VIP、自費等）                      |
| `mremark`    | varchar | Yes      | 備註（顯示於櫃檯警示區）                          |
| `mmedi`      | varchar | Yes      | 特殊註記（醫療相關）                            |
| `mlcasedate` | varchar | Yes      | 最後就診日期                                |
| `mlcasedise` | varchar | Yes      | 最後就診主診斷                               |
| `mweight`    | varchar | Yes      | 體重（基本檔紀錄）                             |
| `mheight`    | varchar | Yes      | 身高（基本檔紀錄）                             |
| `mbegdt`     | varchar | Yes      | 初診 / 建檔日期                             |
| `mmsdt`      | varchar | Yes      | 會員資格起始日                               |

---

### 2.2 `CO02M` - 處方或療程記錄檔 (Prescriptions)

**用途**：
判斷是否為慢性病患（看開藥天數）、查詢疫苗施打紀錄、查詢超音波/內視鏡醫令。

| 欄位名稱     | 類型      | Nullable | 描述 / 備註            |
| -------- | ------- | -------- | ------------------ |
| `kcstmr` | varchar | No       | **複合主鍵**，病歷號       |
| `idate`  | varchar | No       | **複合主鍵**，開立日期      |
| `itime`  | varchar | No       | **複合主鍵**，開立時間      |
| `dno`    | varchar | No       | **複合主鍵**，藥品代碼/醫令代碼 |
| `ptp`    | varchar | Yes      | 藥品類型               |
| `pfq`    | varchar | Yes      | 使用頻率（如：`TID`）      |
| `ptday`  | varchar | Yes      | 總天數（判斷慢籤依據）        |

---

### 2.3 `CO03M` - 檢驗單批次與帳務摘要 (Billing & Visits)

**用途**：
查詢欠費、歷史就醫主診斷、醫師。

| 欄位名稱        | 類型      | Nullable | 描述 / 備註         |
| ----------- | ------- | -------- | --------------- |
| `kcstmr`    | varchar | No       | **複合主鍵**，病歷號    |
| `idate`     | varchar | No       | **複合主鍵**，就醫日期   |
| `itime`     | varchar | No       | **複合主鍵**，就醫時間   |
| `labno`     | varchar | Yes      | 主診斷代碼           |
| `lacd01~05` | varchar | Yes      | 次診斷 / 部分負擔代碼    |
| `tot`       | varchar | Yes      | 金額：申報金額         |
| `sa98`      | varchar | Yes      | 金額：部分負擔（欠費檢查重點） |
| `a98`       | varchar | Yes      | 金額：部分負擔（欠費檢查重點） |
| `ipk2`      | varchar | Yes      | 檢驗套餐代碼 2        |
| `ipk3`      | varchar | Yes      | 看診醫師代碼          |
| `iuldt`     | varchar | Yes      | 上傳日期            |

---

### 2.4 `co05b` - 預約紀錄 (Appointment Records)

**用途**：
儲存病患預約掛號資訊，包括預約時段、醫師與預約號碼。

| 欄位名稱     | 類型      | Nullable | 描述 / 備註                                  |
| -------- | ------- | -------- | ---------------------------------------- |
| `kcstmr` | varchar | No       | **複合主鍵**，病歷號                             |
| `tbkdt`  | varchar | No       | **複合主鍵**，預約日期                            |
| `tsts`   | varchar | No       | **複合主鍵**，預約時段（S: 早上，T: 下午，U: 晚上）        |
| `tartime`| varchar | No       | **複合主鍵**，預約號碼                            |
| `tid`    | varchar | Yes      | 醫師代號                                     |
| `tnote`  | varchar | Yes      | 預約註記                                     |

---

### 2.5 `CO05O` - 就醫歷史紀錄 (Visit History Records)

**用途**：
記錄病患實際就診的詳細時間、看診狀態與身分別，用於追蹤就醫流程。

| 欄位名稱       | 類型      | Nullable | 描述 / 備註                           |
| ---------- | ------- | -------- | --------------------------------- |
| `kcstmr`   | varchar | No       | **複合主鍵**，病歷號                      |
| `tbkdate`  | varchar | No       | **複合主鍵**，就醫日期                     |
| `tbktime`  | varchar | No       | **複合主鍵**，掛號時間                     |
| `tsec`     | varchar | Yes      | 就醫時段（S: 早上，T: 下午，U: 晚上）          |
| `tid`      | varchar | Yes      | 醫師代號                              |
| `tnote`    | varchar | Yes      | 註記                                |
| `tbegtime` | varchar | Yes      | 開始看診時間                            |
| `tendtime` | varchar | Yes      | 完診時間                              |
| `tcs`      | varchar | Yes      | 就診類別                              |
| `tisrs`    | varchar | Yes      | 卡序                                |
| `lm`       | varchar | Yes      | 身分別                               |

---

### 2.6 `CO18H` - 檢驗項目歷史結果檔 (Lab History)

**用途**：
儲存細項檢驗結果（HBA1C、eGFR、WBC...）與生理數據。

**結構**：
垂直資料表（EAV Model: Entity-Attribute-Value）。

| 欄位名稱      | 類型      | Nullable | 描述 / 備註                                 |
| --------- | ------- | -------- | --------------------------------------- |
| `kcstmr`  | varchar | No       | **複合主鍵**，病歷號                            |
| `hdate`   | varchar | No       | **複合主鍵**，紀錄日期                           |
| `htime`   | varchar | No       | **複合主鍵**，紀錄時間                           |
| `hitem`   | varchar | No       | **複合主鍵**，檢驗項目代碼（例：`HBA1C`, `BP`, `WBC`） |
| `hval`    | varchar | Yes      | 檢驗數值（例：`6.5`, `130/80`）                 |
| `hunit`   | varchar | Yes      | 檢驗單位（例：`%`, `mg/dL`, `mL/min/1.73m²`）    |
| `hdscp`   | varchar | Yes      | 項目描述                                    |
| `hresult` | varchar | Yes      | 檢驗結果（文字判定，如：`H`, `L`）                   |
| `hrule`   | varchar | Yes      | 參考值範圍                                   |
| `hinpdt`  | varchar | Yes      | 輸入日期                                    |
| `hsnddt`  | varchar | Yes      | 報告發送日期                                  |

---

### 2.7 `VISHFAM` - 家戶名單 (Householder List)

**用途**：
查詢家戶關係，可能用於聯繫家屬或家戶共用額度查詢。

> **註**：實際欄位以 DBF 結構為準，以下為推測參考欄位。

| 欄位名稱 (參考)  | 描述     | 備註                |
| ---------- | ------ | ----------------- |
| `pat_pid`  | 病歷號    | 對應 `CO01M.kcstmr` |
| `pat_id`   | 身分證字號  |                   |
| `pat_name` | 姓名     |                   |
| （其他家戶欄位）   | 家戶相關欄位 | 視實際 DBF 內容而定      |

---

## 3. 開發注意事項 (Developer Notes)

### 3.1 資料轉置 (Data Pivoting)

前端儀表板所需的「檢驗矩陣（DM/HTN/LIP）」必須透過查詢 `CO18H` 動態生成。

範例查詢：

```sql
SELECT hitem, hval, hdate, hrule
FROM CO18H
WHERE kcstmr = ?
  AND hitem IN ('HBA1C', 'eGFR', 'CHOL', 'TG', 'WBC', ...)
ORDER BY hdate DESC;
```

程式端需將取回的垂直資料（Rows）轉換為水平物件（Object）以供 UI 顯示。

---

### 3.2 病歷號格式

* 所有 DBF 表（`CO01M`, `CO18H` 等）的病歷號欄位均為 **7 碼補零** 格式（例如：`0014207`）。
* 請確保輸入搜尋時自動補零（左側補零至 7 碼）。

---

### 3.3 欠費與衛教判斷

* **欠費判斷**：

  * 檢查 `CO03M` 中：`sa98 + a98 > 0` 即視為可能有欠費紀錄。

* **衛教提醒**：

  * 需掃描 `CO18H` 最近一次 `HBA1C` 是否 `> 7.0`。
  * 或檢查 `CO01M.mremark` 是否包含特定關鍵字（例如：需衛教、飲食控制、追蹤用藥等）。
