import { useState, useEffect, useCallback } from 'react';
import { Layout, Button, Space } from 'antd';
import { SettingOutlined, CloseOutlined } from '@ant-design/icons';
import SearchBar from './components/SearchBar';
import PatientHeader from './components/PatientHeader';
import PreventiveCare from './components/PreventiveCare';
import AppointmentRecords from './components/AppointmentRecords';
import VisitHistory from './components/VisitHistory';
import ChronicDiseaseManagement from './components/ChronicDiseaseManagement';
import ExaminationHistory from './components/ExaminationHistory';
import Settings from './components/Settings';
import LoadingScreen from './components/LoadingScreen';
import './App.css';

const { Header, Content } = Layout;

function App() {
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false); // 資料庫是否載入完成
  const [settingsVisible, setSettingsVisible] = useState(false); // 設定對話框顯示狀態
  const [clinicName, setClinicName] = useState('診所掛號助手'); // 診所名稱（從設定讀取）

  /**
   * 處理病患查詢（使用 useCallback 避免閉包問題）
   */
  const handlePatientQuery = useCallback(async (patientId) => {
    console.log('[handlePatientQuery] 開始查詢病患:', patientId);
    setLoading(true);

    try {
      const result = await window.electronAPI.queryPatient(patientId);

      if (result.success) {
        console.log('[handlePatientQuery] 查詢成功:', result.data);
        setPatientData(result.data);
      } else {
        console.error('[handlePatientQuery] Query failed:', result.error);
        // TODO: 顯示錯誤訊息
      }
    } catch (error) {
      console.error('[handlePatientQuery] Query error:', error);
    } finally {
      setLoading(false);
    }
  }, []); // 空依賴數組，因為只使用 setState

  // 載入設定（包含診所名稱）
  useEffect(() => {
    const loadConfig = async () => {
      try {
        if (window.electronAPI && window.electronAPI.getConfig) {
          const config = await window.electronAPI.getConfig();
          if (config?.clinic?.name) {
            setClinicName(config.clinic.name);
          }
        }
      } catch (error) {
        console.error('[App] Failed to load config:', error);
      }
    };
    loadConfig();
  }, []);

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

  // 監聽病患ID抓取事件（從其他視窗複製身分證或病歷號）
  useEffect(() => {
    console.log('[useEffect] 設定 patient-id-captured 監聽器');

    if (window.electronAPI && window.electronAPI.onPatientIdCaptured) {
      const removeListener = window.electronAPI.onPatientIdCaptured((patientId) => {
        console.log('[IPC] Patient ID captured:', patientId);
        // 自動查詢抓取到的病患ID
        handlePatientQuery(patientId);
      });

      // 清理函數
      return () => {
        console.log('[useEffect] 移除 patient-id-captured 監聽器');
        if (removeListener && typeof removeListener === 'function') {
          removeListener();
        }
      };
    }
  }, [handlePatientQuery]); // 添加 handlePatientQuery 到依賴數組

  // 如果資料庫尚未載入完成，顯示 LoadingScreen
  if (!dbReady) {
    return <LoadingScreen />;
  }

  /**
   * 開啟設定對話框
   */
  const handleOpenSettings = () => {
    setSettingsVisible(true);
  };

  /**
   * 關閉設定對話框
   */
  const handleCloseSettings = () => {
    setSettingsVisible(false);
  };

  /**
   * 關閉應用程式
   */
  const handleCloseApp = () => {
    if (window.electronAPI && window.electronAPI.closeApp) {
      window.electronAPI.closeApp();
    }
  };

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="header-title">{clinicName}</div>
        <Space size="middle" className="header-actions">
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={handleOpenSettings}
            style={{ color: 'white' }}
          >
            設定
          </Button>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={handleCloseApp}
            style={{ color: 'white' }}
            danger
          >
            關閉
          </Button>
        </Space>
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

      {/* 設定對話框 */}
      <Settings visible={settingsVisible} onClose={handleCloseSettings} />
    </Layout>
  );
}

export default App;
