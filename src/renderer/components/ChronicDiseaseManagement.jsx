import { Card, Table, Tag, Tooltip, Row, Col } from 'antd';
import { HeartOutlined, ExperimentOutlined, AlertOutlined, CheckCircleOutlined } from '@ant-design/icons';
import './ChronicDiseaseManagement.css';

function ChronicDiseaseManagement({ diabetesRecords, kidneyRecords, metabolicRecords }) {
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

  // 檢查下次可執行日是否已到期（可以申報）
  const isExecutable = (nextDate) => {
    if (!nextDate) return false;

    const today = new Date();
    const rocYear = today.getFullYear() - 1911;
    const todayStr =
      String(rocYear).padStart(3, '0') +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');

    return nextDate <= todayStr;
  };

  // 處理記錄：只保留第一筆的下次可執行日
  const processRecords = (records) => {
    if (!records || records.length === 0) return [];

    return records.slice(0, 10).map((record, index) => ({
      ...record,
      // 只有第一筆保留 nextExecutableDate，其他設為 null
      nextExecutableDate: index === 0 ? record.nextExecutableDate : null
    }));
  };

  // 表格欄位定義
  const columns = [
    {
      title: '執行日期',
      dataIndex: 'date',
      key: 'date',
      render: (date) => formatDate(date),
      width: 120,
    },
    {
      title: '醫令名稱',
      dataIndex: 'codeName',
      key: 'codeName',
      render: (name, record) => (
        <Tooltip title={`代碼: ${record.code}`}>
          <span>{name}</span>
        </Tooltip>
      ),
    },
    {
      title: '下次可執行日',
      dataIndex: 'nextExecutableDate',
      key: 'nextExecutableDate',
      render: (date) => {
        const formatted = formatDate(date);
        const canExecute = isExecutable(date);

        return (
          <span>
            {formatted}
            {canExecute && (
              <CheckCircleOutlined style={{ fontSize: '18px', color: '#52c41a', marginLeft: 8 }} />
            )}
          </span>
        );
      },
      width: 160,
    },
  ];

  return (
    <div className="chronic-disease-management">
      <Row gutter={[16, 16]}>
        {/* 糖尿病管理 */}
        <Col span={24}>
          <Card
            title={
              <span>
                <HeartOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                糖尿病管理
              </span>
            }
            size="small"
            className="disease-card"
          >
            {diabetesRecords && diabetesRecords.length > 0 ? (
              <Table
                dataSource={processRecords(diabetesRecords)}
                columns={columns}
                pagination={false}
                size="small"
                rowKey={(record) => `${record.date}-${record.code}`}
              />
            ) : (
              <div className="no-data">無糖尿病管理記錄（最近兩年）</div>
            )}
          </Card>
        </Col>

        {/* 腎臟病管理 */}
        <Col span={24}>
          <Card
            title={
              <span>
                <ExperimentOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                腎臟病管理
              </span>
            }
            size="small"
            className="disease-card"
          >
            {kidneyRecords && kidneyRecords.length > 0 ? (
              <Table
                dataSource={processRecords(kidneyRecords)}
                columns={columns}
                pagination={false}
                size="small"
                rowKey={(record) => `${record.date}-${record.code}`}
              />
            ) : (
              <div className="no-data">無腎臟病管理記錄（最近兩年）</div>
            )}
          </Card>
        </Col>

        {/* 代謝症候群管理 */}
        <Col span={24}>
          <Card
            title={
              <span>
                <AlertOutlined style={{ marginRight: 8, color: '#faad14' }} />
                代謝症候群管理
              </span>
            }
            size="small"
            className="disease-card"
          >
            {metabolicRecords && metabolicRecords.length > 0 ? (
              <Table
                dataSource={processRecords(metabolicRecords)}
                columns={columns}
                pagination={false}
                size="small"
                rowKey={(record) => `${record.date}-${record.code}`}
              />
            ) : (
              <div className="no-data">無代謝症候群管理記錄（最近兩年）</div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default ChronicDiseaseManagement;
