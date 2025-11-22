import React, { useMemo } from 'react';
import { Card, Table, Tooltip } from 'antd';
import { CheckCircleOutlined, MedicineBoxOutlined, WarningOutlined } from '@ant-design/icons';
import './PreventiveCare.css';

function PreventiveCare({ basicInfo, preventiveCareRecords }) {
  // 格式化日期顯示（統一顯示為民國年格式）
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';

    // 民國年格式：YYYMMDD (7位數) -> YYY/MM/DD
    if (dateStr.length === 7) {
      const rocYear = dateStr.substring(0, 3);
      const month = dateStr.substring(3, 5);
      const day = dateStr.substring(5, 7);
      return `${rocYear}/${month}/${day}`;
    }

    // 西元年格式：YYYYMMDD (8位數) -> 轉換為民國年
    if (dateStr.length === 8) {
      const year = parseInt(dateStr.substring(0, 4));
      const rocYear = year - 1911;
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${rocYear}/${month}/${day}`;
    }

    return '-';
  };

  // 取得年份（支援民國年和西元年）
  const getYear = (dateStr) => {
    if (!dateStr) return null;

    // 民國年格式：YYYMMDD (7位數)
    if (dateStr.length === 7) {
      const rocYear = parseInt(dateStr.substring(0, 3));
      return rocYear + 1911; // 轉換為西元年
    }

    // 西元年格式：YYYYMMDD (8位數)
    if (dateStr.length === 8) {
      return parseInt(dateStr.substring(0, 4));
    }

    return null;
  };

  // 取得當前年份
  const currentYear = new Date().getFullYear();

  // 取得當前月份（1-12）
  const currentMonth = new Date().getMonth() + 1;

  // 判斷是否在流感/新冠施打期間（10月到隔年6月）
  const isInVaccinePeriod = () => {
    return currentMonth >= 10 || currentMonth <= 6;
  };

  // 取得疫苗施打季（10月到隔年6月算同一季，以開始年份命名）
  // 例如：2024/10 - 2025/6 = 2024施打季
  const getVaccineSeason = (year, month) => {
    // 10-12月：屬於當年的施打季
    if (month >= 10) return year;
    // 1-6月：屬於前一年的施打季
    if (month <= 6) return year - 1;
    // 7-9月：非施打期間
    return null;
  };

  // 取得當前的施打季
  const getCurrentVaccineSeason = () => {
    return getVaccineSeason(currentYear, currentMonth);
  };

  // 根據卡序查找最近一次紀錄
  const findLatestRecord = (cardSequences) => {
    if (!preventiveCareRecords || preventiveCareRecords.length === 0) return null;

    const matchedRecords = preventiveCareRecords.filter(r =>
      cardSequences.includes(r.lisrs)
    );

    return matchedRecords.length > 0 ? matchedRecords[0] : null;
  };

  // 輔助函數：判斷卡序屬於哪個年齡層
  const getCardSeqAgeGroup = (cardSeq) => {
    if (['3D', '3E'].includes(cardSeq)) return '30-39';
    if (['21', '23'].includes(cardSeq)) return '40-64';
    if (['22', '24'].includes(cardSeq)) return '65+';
    return null;
  };

  // 輔助函數：取得當前年齡層
  const getCurrentAgeGroup = (age) => {
    if (age >= 30 && age < 40) return '30-39';
    if (age >= 40 && age < 65) return '40-64';
    if (age >= 65) return '65+';
    return null;
  };

  // 輔助函數：查找所有成健一階記錄
  const findLatestPhase1Record = () => {
    return findLatestRecord(['3D', '21', '22']);
  };

  // 輔助函數：查找所有成健二階記錄
  const findLatestPhase2Record = () => {
    return findLatestRecord(['3E', '23', '24']);
  };

  // 判斷成健一階是否可執行
  const checkAdultHealthPhase1 = () => {
    const age = basicInfo?.age;

    // 先查詢施打記錄，無論年齡是否符合都要顯示歷史記錄
    const lastRecord = findLatestPhase1Record();
    const lastDate = lastRecord ? formatDate(lastRecord.date) : '-';

    if (!age) return { canExecute: false, lastDate, reason: '無年齡資料' };

    if (age < 30) {
      return { canExecute: false, lastDate, reason: '未滿30歲' };
    }

    // 取得當前年齡層和對應的間隔年數
    const currentAgeGroup = getCurrentAgeGroup(age);
    let intervalYears;
    if (currentAgeGroup === '30-39') intervalYears = 5;
    else if (currentAgeGroup === '40-64') intervalYears = 3;
    else if (currentAgeGroup === '65+') intervalYears = 1;

    if (!lastRecord) {
      return { canExecute: true, lastDate, reason: '未曾執行' };
    }

    // 取得最近一次記錄的卡序和年齡層
    const lastCardSeq = lastRecord.lisrs;
    const lastAgeGroup = getCardSeqAgeGroup(lastCardSeq);
    const lastYear = getYear(lastRecord.date);
    const yearsSince = currentYear - lastYear;

    // 判斷：如果年齡層不同，表示剛滿40或65歲，可以執行
    if (lastAgeGroup !== currentAgeGroup) {
      return { canExecute: true, lastDate, reason: '年齡轉換可執行' };
    }

    // 判斷：如果年齡層相同，依間隔年數判斷
    return {
      canExecute: yearsSince >= intervalYears,
      lastDate,
      reason: yearsSince >= intervalYears ? '可執行' : `需${intervalYears}年一次`
    };
  };

  // 判斷成健二階是否可執行
  const checkAdultHealthPhase2 = () => {
    const age = basicInfo?.age;

    // 先查詢施打記錄，無論年齡是否符合都要顯示歷史記錄
    const phase2Record = findLatestPhase2Record();
    const lastDate = phase2Record ? formatDate(phase2Record.date) : '-';

    if (!age) return { canExecute: false, lastDate, reason: '無年齡資料' };

    if (age < 30) {
      return { canExecute: false, lastDate, reason: '未滿30歲' };
    }

    // 檢查一階是否在當年度執行過（檢查所有一階卡序）
    const phase1Record = findLatestPhase1Record();
    const phase1Year = phase1Record ? getYear(phase1Record.date) : null;

    if (!phase1Record || phase1Year !== currentYear) {
      return { canExecute: false, lastDate, reason: '需先執行一階' };
    }
    const phase2Year = phase2Record ? getYear(phase2Record.date) : null;

    if (!phase2Record || phase2Year !== currentYear) {
      return { canExecute: true, lastDate, reason: '可執行' };
    }

    return { canExecute: false, lastDate, reason: '本年已執行' };
  };

  // 判斷腸篩是否可執行
  const checkColorectalScreening = () => {
    const age = basicInfo?.age;

    // 先查詢施打記錄，無論年齡是否符合都要顯示歷史記錄
    const lastRecord = findLatestRecord(['85']);
    const lastDate = lastRecord ? formatDate(lastRecord.date) : '-';

    if (!age) return { canExecute: false, lastDate, reason: '無年齡資料' };

    if (age < 45 || age > 74) {
      return { canExecute: false, lastDate, reason: '年齡不符（45-74歲）' };
    }

    if (!lastRecord) {
      return { canExecute: true, lastDate, reason: '未曾執行' };
    }

    const lastYear = getYear(lastRecord.date);
    const yearsSince = currentYear - lastYear;

    return {
      canExecute: yearsSince >= 2,
      lastDate,
      reason: yearsSince >= 2 ? '可執行' : '需2年一次'
    };
  };

  // 判斷口篩是否可執行
  const checkOralScreening = () => {
    const age = basicInfo?.age;
    if (!age) return { canExecute: false, lastDate: '-', reason: '無年齡資料' };

    if (age < 30) {
      return { canExecute: false, lastDate: '-', reason: '未滿30歲' };
    }

    // TODO: 需要檢查是否有抽菸或嚼檳榔（目前資料庫沒有此欄位）
    // 暫時假設符合條件

    const lastRecord = findLatestRecord(['95']);
    const lastDate = lastRecord ? formatDate(lastRecord.date) : '-';

    if (!lastRecord) {
      return { canExecute: true, lastDate, reason: '未曾執行' };
    }

    const lastYear = getYear(lastRecord.date);
    const yearsSince = currentYear - lastYear;

    return {
      canExecute: yearsSince >= 2,
      lastDate,
      reason: yearsSince >= 2 ? '可執行' : '需2年一次'
    };
  };

  // 判斷流感疫苗是否可執行
  const checkFluVaccine = () => {
    const age = basicInfo?.age;

    // 先查詢施打記錄，無論年齡是否符合都要顯示歷史記錄
    const lastRecord = findLatestRecord(['AU']);
    const lastDate = lastRecord ? formatDate(lastRecord.date) : '-';

    if (!age) return { canExecute: false, lastDate, reason: '無年齡資料' };

    // TODO: 從 config 讀取年齡設定，目前暫用 50 歲
    const minAge = 50;

    if (age < minAge) {
      return { canExecute: false, lastDate, reason: `未滿${minAge}歲` };
    }

    if (!isInVaccinePeriod()) {
      return { canExecute: false, lastDate, reason: '非施打期間（10月-6月）' };
    }

    if (!lastRecord) {
      return { canExecute: true, lastDate, reason: '未曾施打' };
    }

    // 取得最後施打日期的年份和月份
    const currentSeason = getCurrentVaccineSeason();
    const lastYear = getYear(lastRecord.date);
    const lastMonth = lastRecord.date ? parseInt(lastRecord.date.substring(3, 5)) : 0;

    // 計算最後施打的施打季
    const lastSeason = getVaccineSeason(lastYear, lastMonth);

    // 比較施打季：不同施打季就可以再次施打
    return {
      canExecute: lastSeason !== currentSeason,
      lastDate,
      reason: lastSeason !== currentSeason ? '可施打' : '本施打季已施打'
    };
  };

  // 判斷新冠疫苗是否可執行
  const checkCovidVaccine = () => {
    const age = basicInfo?.age;

    // 先查詢施打記錄，無論年齡是否符合都要顯示歷史記錄
    const lastRecord = findLatestRecord(['VU']);
    const lastDate = lastRecord ? formatDate(lastRecord.date) : '-';

    if (!age) return { canExecute: false, lastDate, reason: '無年齡資料' };

    // TODO: 從 config 讀取年齡設定，目前暫用 50 歲
    const minAge = 50;

    if (age < minAge) {
      return { canExecute: false, lastDate, reason: `未滿${minAge}歲` };
    }

    if (!isInVaccinePeriod()) {
      return { canExecute: false, lastDate, reason: '非施打期間（10月-6月）' };
    }

    const currentSeason = getCurrentVaccineSeason();

    if (!lastRecord) {
      return { canExecute: true, lastDate, reason: '未曾施打' };
    }

    // 取得最後施打日期的年份和月份
    const lastYear = getYear(lastRecord.date);
    const lastMonth = lastRecord.date ? parseInt(lastRecord.date.substring(3, 5)) : 0;

    // 計算最後施打的施打季
    const lastSeason = getVaccineSeason(lastYear, lastMonth);

    // 比較施打季：不同施打季就可以再次施打
    return {
      canExecute: lastSeason !== currentSeason,
      lastDate,
      reason: lastSeason !== currentSeason ? '可施打' : '本施打季已施打'
    };
  };

  // 判斷肺鏈疫苗是否可執行
  const checkPneumococcalVaccine = () => {
    const age = basicInfo?.age;

    // 先查詢施打記錄，無論年齡是否符合都要顯示歷史記錄
    const lastRecord = findLatestRecord(['DU']);
    const lastDate = lastRecord ? formatDate(lastRecord.date) : '-';

    if (!age) return { canExecute: false, lastDate, reason: '無年齡資料' };

    if (age < 65) {
      return { canExecute: false, lastDate, reason: '未滿65歲' };
    }

    if (!lastRecord) {
      return { canExecute: true, lastDate, reason: '未曾施打' };
    }

    // 終身一劑，已施打就不能再施打
    return {
      canExecute: false,
      lastDate,
      reason: '已施打（終身一劑）'
    };
  };

  // 建立表格資料（使用 useMemo 快取計算結果，避免重複渲染時重新計算）
  const tableData = useMemo(() => {
    const health1Result = checkAdultHealthPhase1();
    const health2Result = checkAdultHealthPhase2();

    // 檢查異常：有二階但沒有一階
    const hasPhase2ButNoPhase1 =
      health2Result.lastDate !== '-' && health1Result.lastDate === '-';

    return [
      {
        key: 'health1',
        item: '成健一階',
        ...health1Result,
        hasWarning: hasPhase2ButNoPhase1
      },
      {
        key: 'health2',
        item: '成健二階',
        ...health2Result,
        hasWarning: hasPhase2ButNoPhase1
      },
      { key: 'colorectal', item: '腸篩', ...checkColorectalScreening() },
      { key: 'oral', item: '口篩(抽菸或嚼檳榔者)', ...checkOralScreening() },
      { key: 'flu', item: '流感', ...checkFluVaccine() },
      { key: 'covid', item: '新冠', ...checkCovidVaccine() },
      { key: 'pneumococcal', item: '肺鏈', ...checkPneumococcalVaccine() },
    ];
  }, [basicInfo, preventiveCareRecords]); // 只在 basicInfo 或 preventiveCareRecords 改變時重新計算

  // 表格欄位定義
  const columns = [
    {
      title: '項目',
      dataIndex: 'item',
      key: 'item',
      width: 120,
    },
    {
      title: '符合資格',
      dataIndex: 'canExecute',
      key: 'canExecute',
      width: 60,
      align: 'center',
      render: (canExecute) => (
        canExecute ? (
          <CheckCircleOutlined style={{ fontSize: '18px', color: '#52c41a' }} />
        ) : null
      ),
    },
    {
      title: '最近五年內',
      dataIndex: 'lastDate',
      key: 'lastDate',
      width: 120,
      render: (lastDate, record) => (
        <span>
          {lastDate}
          {record.hasWarning && (
            <Tooltip title="資料異常：有二階記錄但無一階記錄">
              <WarningOutlined
                style={{ marginLeft: 8, color: '#faad14', fontSize: '14px' }}
              />
            </Tooltip>
          )}
        </span>
      ),
    },
  ];

  return (
    <Card
      title={
        <span>
          <MedicineBoxOutlined style={{ marginRight: 8 }} />
          預防保健(僅查詢本院資料,仍需搭配國健署資料庫確認)
        </span>
      }
      className="preventive-care"
    >
      <Table
        columns={columns}
        dataSource={tableData}
        pagination={false}
        size="small"
      />
    </Card>
  );
}

// 使用 React.memo 優化，避免父元件更新時不必要的重新渲染
export default React.memo(PreventiveCare);
