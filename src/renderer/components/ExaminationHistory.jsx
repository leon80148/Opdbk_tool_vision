import { Card, Table, Tag, Tooltip } from 'antd';
import { FileSearchOutlined, CheckCircleOutlined } from '@ant-design/icons';
import './ExaminationHistory.css';

function ExaminationHistory({ examinationRecords }) {
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

  // 檢查追蹤日期是否已到期
  const isFollowUpDue = (nextDate) => {
    if (!nextDate) return false;

    const today = new Date();
    const rocYear = today.getFullYear() - 1911;
    const todayStr =
      String(rocYear).padStart(3, '0') +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');

    return nextDate <= todayStr;
  };

  // 準備表格資料
  const tableData = [
    {
      key: 'abdomen',
      examName: '腹部超音波',
      record: examinationRecords?.abdomen,
    },
    {
      key: 'thyroid',
      examName: '甲狀腺超音波',
      record: examinationRecords?.thyroid,
    },
    {
      key: 'puncture',
      examName: '細針穿刺',
      record: examinationRecords?.puncture,
    },
    {
      key: 'lung',
      examName: '肺功能檢查',
      record: examinationRecords?.lung,
    },
    {
      key: 'urine',
      examName: '尿流速檢查',
      record: examinationRecords?.urine,
    },
  ];

  // 表格欄位定義
  const columns = [
    {
      title: '檢查項目',
      dataIndex: 'examName',
      key: 'examName',
      width: 140,
      render: (name) => <strong>{name}</strong>,
    },
    {
      title: '檢查種類',
      key: 'code',
      width: 100,
      render: (_, row) => {
        if (!row.record) return '-';
        return (
          <Tag color="blue">{row.record.code}</Tag>
        );
      },
    },
    {
      title: '檢查日期',
      key: 'date',
      width: 120,
      render: (_, row) => {
        if (!row.record) return '-';
        return formatDate(row.record.date);
      },
    },
    {
      title: '報告內容',
      key: 'reportContent',
      render: (_, row) => {
        if (!row.record) return '-';
        const content = row.record.reportContent;

        if (!content || content.length === 0) {
          return <span style={{ color: '#999' }}>無文字報告</span>;
        }

        // 如果報告內容太長，顯示 Tooltip
        if (content.length > 50) {
          return (
            <Tooltip title={content} placement="topLeft">
              <div className="report-content-truncate">
                {content.substring(0, 50)}...
              </div>
            </Tooltip>
          );
        }

        return <div className="report-content">{content}</div>;
      },
    },
    {
      title: '建議下次追蹤日期',
      key: 'nextFollowUpDate',
      width: 180,
      render: (_, row) => {
        if (!row.record) return '-';

        const nextDate = row.record.nextFollowUpDate;
        const formatted = formatDate(nextDate);
        const isDue = isFollowUpDue(nextDate);

        return (
          <span>
            {formatted}
            {isDue && (
              <CheckCircleOutlined style={{ fontSize: '18px', color: '#52c41a', marginLeft: 8 }} />
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div className="examination-history">
      <Card
        title={
          <span>
            <FileSearchOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            3年內檢查記錄
          </span>
        }
        size="small"
        className="examination-card"
      >
        <Table
          dataSource={tableData}
          columns={columns}
          pagination={false}
          size="small"
          bordered
        />
      </Card>
    </div>
  );
}

export default ExaminationHistory;
