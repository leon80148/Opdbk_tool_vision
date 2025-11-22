import { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Button, message, Divider } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import './Settings.css';

function Settings({ visible, onClose }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(null);

  // 載入目前設定
  useEffect(() => {
    if (visible) {
      loadCurrentConfig();
    }
  }, [visible]);

  const loadCurrentConfig = async () => {
    try {
      const result = await window.electronAPI.getConfig();
      if (result.success) {
        setCurrentConfig(result.data);

        // 設定表單初始值
        form.setFieldsValue({
          hotkey: result.data.hotkey?.global || 'Ctrl+Alt+C',
          windowWidth: result.data.ui?.window_width || 1200,
          windowHeight: result.data.ui?.window_height || 800,
          windowX: result.data.ui?.window_x || null,
          windowY: result.data.ui?.window_y || null,
        });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      message.error('載入設定失敗');
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // 準備設定資料
      const configToSave = {
        hotkey: {
          global: values.hotkey,
        },
        ui: {
          window_width: values.windowWidth,
          window_height: values.windowHeight,
          window_x: values.windowX !== null && values.windowX !== undefined ? values.windowX : null,
          window_y: values.windowY !== null && values.windowY !== undefined ? values.windowY : null,
        },
      };

      // 呼叫儲存 API
      const result = await window.electronAPI.saveConfig(configToSave);

      if (result.success) {
        message.success('設定已儲存，將在下次啟動時生效');
        onClose();
      } else {
        message.error('儲存設定失敗：' + result.error);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      message.error('儲存設定失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentPosition = async () => {
    try {
      const position = await window.electronAPI.getCurrentWindowBounds();
      if (position) {
        form.setFieldsValue({
          windowX: position.x,
          windowY: position.y,
          windowWidth: position.width,
          windowHeight: position.height,
        });
        message.success('已取得目前視窗位置與大小');
      }
    } catch (error) {
      console.error('Failed to get window position:', error);
      message.error('取得視窗位置失敗');
    }
  };

  return (
    <Modal
      title={
        <span>
          <SettingOutlined style={{ marginRight: 8 }} />
          應用程式設定
        </span>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" loading={loading} onClick={handleSave}>
          儲存
        </Button>,
      ]}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        className="settings-form"
      >
        <Divider orientation="left">熱鍵設定</Divider>

        <Form.Item
          label="全域熱鍵"
          name="hotkey"
          rules={[{ required: true, message: '請輸入熱鍵組合' }]}
          extra="格式：Modifier+Key，例如 Ctrl+Alt+C"
        >
          <Input placeholder="Ctrl+Alt+C" />
        </Form.Item>

        <Divider orientation="left">視窗設定</Divider>

        <Form.Item
          label="視窗寬度（像素）"
          name="windowWidth"
          rules={[
            { required: true, message: '請輸入視窗寬度' },
            { type: 'number', min: 800, max: 3840, message: '寬度必須在 800-3840 之間' }
          ]}
        >
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="視窗高度（像素）"
          name="windowHeight"
          rules={[
            { required: true, message: '請輸入視窗高度' },
            { type: 'number', min: 600, max: 2160, message: '高度必須在 600-2160 之間' }
          ]}
        >
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="視窗位置">
          <Input.Group compact>
            <Form.Item
              name="windowX"
              noStyle
              rules={[{ type: 'number', message: 'X 座標必須是數字' }]}
            >
              <InputNumber placeholder="X 座標" style={{ width: '48%', marginRight: '4%' }} />
            </Form.Item>
            <Form.Item
              name="windowY"
              noStyle
              rules={[{ type: 'number', message: 'Y 座標必須是數字' }]}
            >
              <InputNumber placeholder="Y 座標" style={{ width: '48%' }} />
            </Form.Item>
          </Input.Group>
          <Button
            type="dashed"
            onClick={handleGetCurrentPosition}
            style={{ marginTop: 8, width: '100%' }}
          >
            使用目前視窗位置與大小
          </Button>
        </Form.Item>

        <div className="settings-hint">
          <p>
            💡 <strong>提示</strong>：視窗位置留空時，每次啟動會在螢幕中央顯示。
            設定位置後，每次啟動會固定在該位置。
          </p>
        </div>
      </Form>
    </Modal>
  );
}

export default Settings;
