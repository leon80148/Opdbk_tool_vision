import { List, Card, Tag } from 'antd';
import './SmartActionList.css';

function SmartActionList({ actions }) {
  if (!actions || actions.length === 0) {
    return (
      <Card title="待辦事項清單" className="smart-action-list">
        <div className="empty-actions">目前無待辦事項</div>
      </Card>
    );
  }

  return (
    <Card title="待辦事項清單" className="smart-action-list">
      <List
        dataSource={actions}
        renderItem={(action) => (
          <List.Item className={`action-item action-${action.color}`}>
            <div className="action-icon">{action.icon}</div>
            <div className="action-content">
              <div className="action-title">{action.title}</div>
              <div className="action-message">{action.message}</div>
            </div>
            <div className="action-priority">
              <Tag color={action.color}>優先級 {action.priority}</Tag>
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
}

export default SmartActionList;
