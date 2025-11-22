import { Card, Tag, Space, Alert } from 'antd';
import { UserOutlined, PhoneOutlined, HomeOutlined } from '@ant-design/icons';
import './PatientHeader.css';

function PatientHeader({ data }) {
  if (!data) return null;

  // 轉換性別代碼為中文
  const getGenderText = (sex) => {
    if (sex === '1') return '男';
    if (sex === '2' || sex === '0') return '女';
    return '未知';
  };

  return (
    <Card className="patient-header">
      <div className="patient-info">
        <div className="patient-basic">
          <div className="patient-name">
            <UserOutlined style={{ marginRight: 8 }} />
            <span className="name">{data.mname}</span>
            <span className="id">（{data.kcstmr}）</span>
          </div>

          <Space size="middle">
            <span>性別：{getGenderText(data.msex)}</span>
            <span>年齡：{data.age || 'N/A'} 歲</span>
            {data.birthdate_formatted && (
              <span>生日：{data.birthdate_formatted}</span>
            )}
            <span>身分證：{data.mpersonid}</span>
          </Space>
        </div>

        <div className="patient-contact">
          <div>
            <PhoneOutlined /> {data.mtelh || '（未填）'}
          </div>
          <div>
            <HomeOutlined /> {data.maddr || '（未填）'}
          </div>
        </div>

        <div className="patient-tags-section">
          {data.mtyp && (
            <div className="patient-vip-tag">
              <Tag color="gold">VIP</Tag>
            </div>
          )}
          {data.mremark && (
            <div className="patient-remark">
              <Alert
                message="備註"
                description={data.mremark}
                type="warning"
                showIcon
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default PatientHeader;
