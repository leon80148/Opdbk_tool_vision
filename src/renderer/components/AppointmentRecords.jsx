import { Card, Table, Empty, Tag } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import './AppointmentRecords.css';

function AppointmentRecords({ data }) {
  // 時段對應
  const getSessionText = (session) => {
    if (session === 'S') return '早上';
    if (session === 'T') return '下午';
    if (session === 'U') return '晚上';
    return session || '未知';
  };

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

  // 表格欄位定義
  const columns = [
    {
      title: '預約日期',
      dataIndex: 'tbkdt',
      key: 'tbkdt',
      width: 120,
      render: (text) => formatDate(text),
    },
    {
      title: '時段',
      dataIndex: 'tsts',
      key: 'tsts',
      width: 80,
      render: (text) => (
        <Tag color={text === 'S' ? 'blue' : text === 'T' ? 'green' : 'orange'}>
          {getSessionText(text)}
        </Tag>
      ),
    },
    {
      title: '預約號碼',
      dataIndex: 'tartime',
      key: 'tartime',
      width: 100,
    },
    {
      title: '醫師代號',
      dataIndex: 'tid',
      key: 'tid',
      width: 100,
    },
    {
      title: '預約註記',
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
            <CalendarOutlined style={{ marginRight: 8 }} />
            預約紀錄
          </span>
        }
        className="appointment-records"
      >
        <Empty description="尚無預約紀錄" />
      </Card>
    );
  }

  return (
    <Card
      title={
        <span>
          <CalendarOutlined style={{ marginRight: 8 }} />
          預約紀錄
        </span>
      }
      className="appointment-records"
    >
      <Table
        columns={columns}
        dataSource={data}
        rowKey={(record) => `${record.kcstmr}_${record.tbkdt}_${record.tsts}_${record.tartime}`}
        pagination={{
          pageSize: 5,
          size: 'small',
          showTotal: (total) => `共 ${total} 筆`,
        }}
        size="small"
      />
    </Card>
  );
}

export default AppointmentRecords;
