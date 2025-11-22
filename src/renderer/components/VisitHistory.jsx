import { Card, Table, Empty, Tag } from 'antd';
import { MedicineBoxOutlined } from '@ant-design/icons';
import './VisitHistory.css';

function VisitHistory({ data }) {
  // 時段對應
  const getSessionText = (session) => {
    if (session === 'S') return '早上';
    if (session === 'T') return '下午';
    if (session === 'U') return '晚上';
    return session || '未知';
  };

  // 格式化日期顯示（YYYYMMDD -> YYYY/MM/DD）
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}/${month}/${day}`;
  };

  // 格式化掛號時間（已經是 HH:MM 格式，直接顯示）
  const formatBookingTime = (timeStr) => {
    if (!timeStr) return '-';
    return timeStr.trim() || '-';
  };

  // 格式化看診/完診時間（六位數 HHMMSS -> HH:MM）
  const formatVisitTime = (timeStr) => {
    if (!timeStr || timeStr.length < 6) return timeStr || '-';
    const hour = timeStr.substring(0, 2);
    const minute = timeStr.substring(2, 4);
    return `${hour}:${minute}`;
  };

  // 表格欄位定義
  const columns = [
    {
      title: '就診日期',
      dataIndex: 'tbkdate',
      key: 'tbkdate',
      width: 120,
      render: (text) => formatDate(text),
    },
    {
      title: '掛號時間',
      dataIndex: 'tbktime',
      key: 'tbktime',
      width: 80,
      render: (text) => formatBookingTime(text),
    },
    {
      title: '時段',
      dataIndex: 'tsec',
      key: 'tsec',
      width: 80,
      render: (text) => (
        <Tag color={text === 'S' ? 'blue' : text === 'T' ? 'green' : 'orange'}>
          {getSessionText(text)}
        </Tag>
      ),
    },
    {
      title: '醫師代號',
      dataIndex: 'tid',
      key: 'tid',
      width: 100,
    },
    {
      title: '看診時間',
      dataIndex: 'tbegtime',
      key: 'tbegtime',
      width: 80,
      render: (text) => formatVisitTime(text),
    },
    {
      title: '完診時間',
      dataIndex: 'tendtime',
      key: 'tendtime',
      width: 80,
      render: (text) => formatVisitTime(text),
    },
    {
      title: '就診類別',
      dataIndex: 'tcs',
      key: 'tcs',
      width: 100,
    },
    {
      title: '身分別',
      dataIndex: 'lm',
      key: 'lm',
      width: 80,
    },
    {
      title: '註記',
      dataIndex: 'tnote',
      key: 'tnote',
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
        rowKey={(record) => `${record.kcstmr}_${record.tbkdate}_${record.tbktime}`}
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
