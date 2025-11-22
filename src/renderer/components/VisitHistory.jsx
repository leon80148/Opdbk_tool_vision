import { Card, Table, Empty, Tag } from 'antd';
import { MedicineBoxOutlined } from '@ant-design/icons';
import './VisitHistory.css';

function VisitHistory({ data }) {
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

    return dateStr;
  };

  // 格式化時間（HHMMSS -> HH:MM）
  const formatTime = (timeStr) => {
    if (!timeStr) return '-';

    // 六位數格式 HHMMSS
    if (timeStr.length >= 4) {
      const hour = timeStr.substring(0, 2);
      const minute = timeStr.substring(2, 4);
      return `${hour}:${minute}`;
    }

    return timeStr;
  };

  // 計算慢箋到期日（民國年日期 + 天數）
  const calculateExpiryDate = (dateStr, days) => {
    if (!dateStr || !days || days <= 0) return null;

    try {
      // 解析民國年日期
      if (dateStr.length === 7) {
        const rocYear = parseInt(dateStr.substring(0, 3));
        const month = parseInt(dateStr.substring(3, 5));
        const day = parseInt(dateStr.substring(5, 7));

        // 轉換為西元年
        const date = new Date(rocYear + 1911, month - 1, day);

        // 加上天數
        date.setDate(date.getDate() + days);

        // 轉回民國年格式
        const newRocYear = date.getFullYear() - 1911;
        const newMonth = date.getMonth() + 1;
        const newDay = date.getDate();

        return String(newRocYear).padStart(3, '0') +
               String(newMonth).padStart(2, '0') +
               String(newDay).padStart(2, '0');
      }

      // 西元年格式處理
      if (dateStr.length === 8) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6));
        const day = parseInt(dateStr.substring(6, 8));

        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() + days);

        const newYear = date.getFullYear();
        const newMonth = date.getMonth() + 1;
        const newDay = date.getDate();

        return String(newYear).padStart(4, '0') +
               String(newMonth).padStart(2, '0') +
               String(newDay).padStart(2, '0');
      }

      return null;
    } catch (error) {
      console.error('Error calculating expiry date:', error);
      return null;
    }
  };

  // 表格欄位定義
  const columns = [
    {
      title: '看診日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (text) => formatDate(text),
    },
    {
      title: '看診時間',
      dataIndex: 'time',
      key: 'time',
      width: 90,
      render: (text) => formatTime(text),
    },
    {
      title: '就診類別',
      dataIndex: 'lcs',
      key: 'lcs',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: '主診斷',
      dataIndex: 'labdt',
      key: 'labdt',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: '開藥天數',
      dataIndex: 'dayqty',
      key: 'dayqty',
      width: 100,
      align: 'center',
      render: (text) => {
        if (!text || text === '0') return '-';
        return (
          <Tag color="blue">
            {text} 天
          </Tag>
        );
      },
    },
    {
      title: '慢箋次數',
      dataIndex: 'lldtt',
      key: 'lldtt',
      width: 100,
      align: 'center',
      render: (text) => {
        if (!text || text === '0') return '-';
        return (
          <Tag color="green">
            {text}
          </Tag>
        );
      },
    },
    {
      title: '慢箋到期日',
      key: 'expiryDate',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const lldtt = parseInt(record.lldtt);
        const dayqty = parseInt(record.dayqty);

        // 只有當慢箋次數有數據時才計算
        if (!lldtt || lldtt === 0 || !dayqty || dayqty === 0) {
          return '-';
        }

        // 計算總天數 = 開藥天數 * 慢箋次數
        const totalDays = dayqty * lldtt;

        // 計算到期日
        const expiryDateStr = calculateExpiryDate(record.date, totalDays);

        if (!expiryDateStr) return '-';

        return formatDate(expiryDateStr);
      },
    },
    {
      title: '註記',
      dataIndex: 'labeno',
      key: 'labeno',
      ellipsis: true,
      render: (text) => text || '-',
    },
  ];

  if (!data || data.length === 0) {
    return (
      <Card
        title={
          <span>
            <MedicineBoxOutlined style={{ marginRight: 8 }} />
            最近10次就診紀錄
          </span>
        }
        className="visit-history"
      >
        <Empty description="尚無就診紀錄" />
      </Card>
    );
  }

  return (
    <Card
      title={
        <span>
          <MedicineBoxOutlined style={{ marginRight: 8 }} />
          最近10次就診紀錄
        </span>
      }
      className="visit-history"
    >
      <Table
        columns={columns}
        dataSource={data}
        rowKey={(record) => `${record.kcstmr}_${record.date}_${record.time}`}
        pagination={{
          pageSize: 10,
          size: 'small',
          showTotal: (total) => `共 ${total} 筆`,
        }}
        size="small"
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
}

export default VisitHistory;
