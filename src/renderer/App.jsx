import { useState, useEffect } from 'react';
import { Layout } from 'antd';
import SearchBar from './components/SearchBar';
import PatientHeader from './components/PatientHeader';
import PreventiveCare from './components/PreventiveCare';
import AppointmentRecords from './components/AppointmentRecords';
import VisitHistory from './components/VisitHistory';
import ChronicDiseaseManagement from './components/ChronicDiseaseManagement';
import ExaminationHistory from './components/ExaminationHistory';
import SyncStatus from './components/SyncStatus';
import LoadingScreen from './components/LoadingScreen';
import './App.css';

const { Header, Content, Sider } = Layout;

function App() {
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false); // 資料庫是否載入完成

  // 監聽資料庫初始化進度
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onDbInitProgress) {
      window.electronAPI.onDbInitProgress((progress) => {
        if (progress.stage === 'complete') {
          // 載入完成，延遲 500ms 再隱藏 loading screen（讓使用者看到 100%）
          setTimeout(() => {
            setDbReady(true);
          }, 500);
        }
      });
    }
  }, []);

  // 如果資料庫尚未載入完成，顯示 LoadingScreen
  if (!dbReady) {
    return <LoadingScreen />;
  }

  /**
   * 處理病患查詢
   */
  const handlePatientQuery = async (patientId) => {
    setLoading(true);

    try {
      const result = await window.electronAPI.queryPatient(patientId);

      if (result.success) {
        setPatientData(result.data);
      } else {
        console.error('Query failed:', result.error);
        // TODO: 顯示錯誤訊息
      }
    } catch (error) {
      console.error('Query error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="header-title">安家診所掛號助手</div>
        <SyncStatus />
      </Header>

      <Content className="app-content">
        <div className="search-section">
          <SearchBar onSearch={handlePatientQuery} loading={loading} />
        </div>

        {patientData && (
          <>
            <div className="patient-info-section">
              <div className="patient-header-panel">
                <PatientHeader data={patientData.basicInfo} />
              </div>

              <div className="preventive-care-panel">
                <PreventiveCare
                  basicInfo={patientData.basicInfo}
                  preventiveCareRecords={patientData.preventiveCare}
                />
              </div>
            </div>

            {/* 慢性病管理區域 */}
            <div className="chronic-disease-section">
              <ChronicDiseaseManagement
                diabetesRecords={patientData.diabetesRecords}
                kidneyRecords={patientData.kidneyRecords}
                metabolicRecords={patientData.metabolicRecords}
              />
            </div>

            {/* 3年內檢查記錄區域 */}
            <div className="examination-section">
              <ExaminationHistory
                examinationRecords={patientData.examinationRecords}
              />
            </div>

            <div className="appointments-visits-section">
              <div className="appointment-records-panel">
                <AppointmentRecords data={patientData.appointments} />
              </div>

              <div className="visit-history-panel">
                <VisitHistory data={patientData.visitHistory} />
              </div>
            </div>
          </>
        )}

        {!patientData && !loading && (
          <div className="empty-state">
            <p>請輸入病歷號開始查詢</p>
          </div>
        )}
      </Content>
    </Layout>
  );
}

export default App;
