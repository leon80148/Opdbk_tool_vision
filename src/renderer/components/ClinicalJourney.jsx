import { Card, Timeline, Empty } from 'antd';
import { ClockCircleOutlined, MedicineBoxOutlined } from '@ant-design/icons';
import './ClinicalJourney.css';

function ClinicalJourney({ data }) {
  if (!data) {
    return (
      <Card title="診療歷程" className="clinical-journey">
        <Empty description="尚無診療記錄" />
      </Card>
    );
  }

  const items = [];

  // 上次就診
  if (data.lastVisit) {
    items.push({
      dot: <ClockCircleOutlined style={{ fontSize: '16px' }} />,
      color: 'blue',
      children: (
        <div className="timeline-item">
          <div className="timeline-title">上次就診</div>
          <div className="timeline-content">
            <div>日期：{data.lastVisit.idate}</div>
            <div>診斷：{data.lastVisit.labno || '無'}</div>
            <div>醫師：{data.lastVisit.doctor || '無'}</div>
          </div>
        </div>
      ),
    });
  }

  // 上次領藥
  if (data.lastMedication) {
    items.push({
      dot: <MedicineBoxOutlined style={{ fontSize: '16px' }} />,
      color: 'green',
      children: (
        <div className="timeline-item">
          <div className="timeline-title">上次領藥</div>
          <div className="timeline-content">
            <div>日期：{data.lastMedication.idate}</div>
            <div>藥品代碼：{data.lastMedication.dno || '無'}</div>
            <div>天數：{data.lastMedication.ptday || '無'}</div>
          </div>
        </div>
      ),
    });
  }

  if (items.length === 0) {
    return (
      <Card title="診療歷程" className="clinical-journey">
        <Empty description="尚無診療記錄" />
      </Card>
    );
  }

  return (
    <Card title="診療歷程" className="clinical-journey">
      <Timeline items={items} />
    </Card>
  );
}

export default ClinicalJourney;
