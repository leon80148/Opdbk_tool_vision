import { useEffect, useState } from 'react';
import { Spin, Progress, Alert } from 'antd';
import { LoadingOutlined, DatabaseOutlined } from '@ant-design/icons';
import './LoadingScreen.css';

function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('正在初始化...');
  const [error, setError] = useState(null);

  useEffect(() => {
    // 監聽資料庫初始化進度
    if (window.electronAPI && window.electronAPI.onDbInitProgress) {
      window.electronAPI.onDbInitProgress((progressData) => {
        console.log('Loading progress:', progressData);

        // 處理不同階段的進度
        if (progressData.stage === 'init') {
          setProgress(progressData.progress);
          setMessage(progressData.message || '初始化中...');
        } else if (progressData.stage === 'preload') {
          // DBF 預載入進度：20% ~ 100%
          const baseProgress = 20;
          const preloadProgress = (progressData.progress / 100) * 80;
          setProgress(baseProgress + preloadProgress);
          setMessage(progressData.message || '載入資料中...');
        } else if (progressData.stage === 'complete') {
          setProgress(100);
          setMessage('載入完成！');
        }
      });
    }

    // 監聽初始化錯誤
    if (window.electronAPI && window.electronAPI.onDbInitError) {
      window.electronAPI.onDbInitError((errorData) => {
        console.error('DB init error:', errorData);
        setError(errorData.message);
      });
    }
  }, []);

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <DatabaseOutlined className="loading-icon" />
        <h1 className="loading-title">安家診所掛號助手</h1>

        {error ? (
          <Alert
            message="載入錯誤"
            description={error}
            type="error"
            showIcon
            style={{ marginTop: 24, maxWidth: 500 }}
          />
        ) : (
          <>
            <Progress
              type="circle"
              percent={Math.round(progress)}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              size={120}
            />
            <div className="loading-message">{message}</div>
            <Spin
              indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
              style={{ marginTop: 16 }}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default LoadingScreen;
