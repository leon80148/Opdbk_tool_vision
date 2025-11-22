import { useState, useEffect } from 'react';
import { Badge, Button, Tooltip } from 'antd';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import './SyncStatus.css';

function SyncStatus() {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadSyncStatus();

    // 每 30 秒更新一次狀態
    const interval = setInterval(loadSyncStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSyncStatus = async () => {
    try {
      const result = await window.electronAPI.getSyncStatus();
      if (result.success) {
        setStatus(result.data);
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);

    try {
      const result = await window.electronAPI.manualSync();

      if (result.success) {
        await loadSyncStatus();
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = () => {
    if (!status) return null;

    if (status.last_sync_status === 'success') {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    } else if (status.last_sync_status === 'failed') {
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    } else if (status.last_sync_status === 'running') {
      return <SyncOutlined spin style={{ color: '#1890ff' }} />;
    }

    return null;
  };

  const getStatusText = () => {
    if (!status) return '載入中...';

    if (status.last_sync_finished_at) {
      const date = new Date(status.last_sync_finished_at);
      const time = date.toLocaleTimeString('zh-TW');
      return `上次同步：${time}`;
    }

    return '尚未同步';
  };

  return (
    <div className="sync-status">
      <Tooltip title={getStatusText()}>
        <Badge status={status?.last_sync_status === 'success' ? 'success' : 'default'}>
          {getStatusIcon()}
          <span className="sync-text">{getStatusText()}</span>
        </Badge>
      </Tooltip>

      <Button
        size="small"
        icon={<SyncOutlined />}
        loading={syncing}
        onClick={handleManualSync}
        className="sync-button"
      >
        手動同步
      </Button>
    </div>
  );
}

export default SyncStatus;
