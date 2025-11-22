import { Card, Descriptions, Tag } from 'antd';
import './LabMatrix.css';

function LabMatrix({ data }) {
  if (!data) {
    return (
      <Card title="檢驗矩陣" className="lab-matrix">
        <div className="empty-labs">尚無檢驗資料</div>
      </Card>
    );
  }

  const renderLabValue = (value, date, normalRange) => {
    if (!value && value !== 0) {
      return <span className="no-data">--</span>;
    }

    // TODO: 依據正常範圍判斷顏色
    const color = 'default';

    return (
      <div className="lab-value">
        <Tag color={color}>{value}</Tag>
        {date && <span className="lab-date">({date})</span>}
      </div>
    );
  };

  return (
    <Card title="檢驗矩陣" className="lab-matrix">
      {/* DM 區 */}
      <div className="lab-section">
        <h3>糖尿病相關</h3>
        <Descriptions bordered size="small" column={3}>
          <Descriptions.Item label="HBA1C">
            {renderLabValue(data.DM?.HBA1C?.value, data.DM?.HBA1C?.date)}
          </Descriptions.Item>
          <Descriptions.Item label="UACR">
            {renderLabValue(data.DM?.UACR?.value, data.DM?.UACR?.date)}
          </Descriptions.Item>
          <Descriptions.Item label="eGFR">
            {renderLabValue(data.DM?.eGFR?.value, data.DM?.eGFR?.date)}
          </Descriptions.Item>
        </Descriptions>
      </div>

      {/* HTN/LIP 區 */}
      <div className="lab-section">
        <h3>三高相關</h3>
        <Descriptions bordered size="small" column={4}>
          <Descriptions.Item label="CHOL">
            {renderLabValue(data.HTN_LIP?.CHOL?.value, data.HTN_LIP?.CHOL?.date)}
          </Descriptions.Item>
          <Descriptions.Item label="LDL">
            {renderLabValue(data.HTN_LIP?.LDL?.value, data.HTN_LIP?.LDL?.date)}
          </Descriptions.Item>
          <Descriptions.Item label="TG">
            {renderLabValue(data.HTN_LIP?.TG?.value, data.HTN_LIP?.TG?.date)}
          </Descriptions.Item>
          <Descriptions.Item label="BMI">
            {renderLabValue(data.HTN_LIP?.BMI?.value, data.HTN_LIP?.BMI?.date)}
          </Descriptions.Item>
        </Descriptions>
      </div>

      {/* Virus 區 */}
      <div className="lab-section">
        <h3>病毒/肝炎</h3>
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Anti-HCV">
            {renderLabValue(data.VIRUS?.AntiHCV?.value, data.VIRUS?.AntiHCV?.date)}
          </Descriptions.Item>
          <Descriptions.Item label="HBsAg">
            {renderLabValue(data.VIRUS?.HBsAg?.value, data.VIRUS?.HBsAg?.date)}
          </Descriptions.Item>
        </Descriptions>
      </div>
    </Card>
  );
}

export default LabMatrix;
