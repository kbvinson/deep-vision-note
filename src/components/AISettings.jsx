import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Slider, Switch, Divider, message, Space, Button } from 'antd';
import { cleanupFiles } from '../services/aiService';

const { Option } = Select;

const AISettings = ({ visible, onClose, onSave, initialSettings }) => {
  const [form] = Form.useForm();
  const [provider, setProvider] = useState('');

  const providerOptions = {
    moonshot: {
      models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    },
    openai: {
      models: ['gpt-3.5-turbo', 'gpt-4'],
    }
  };

  const handleProviderChange = (value) => {
    setProvider(value);
    form.setFieldsValue({
      baseURL: '',
      model: ''
    });
  };

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        temperature: 0.3,
        maxTokens: 4000,
        timeout: 60,
        ...initialSettings
      });
    }
  }, [visible, initialSettings, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      const requiredFields = ['provider', 'apiKey', 'baseURL', 'model'];
      for (const field of requiredFields) {
        if (!values[field]?.trim()) {
          message.error(`请填写 ${field}`);
          return;
        }
      }
      
      const settings = {
        ...values,
        temperature: values.temperature ?? 0.3,
        maxTokens: values.maxTokens ?? 4000,
        timeout: values.timeout ?? 60
      };
      
      onSave(settings);
      message.success('设置已保存');
      onClose();
    } catch (error) {
      message.error('保存设置失败: ' + error.message);
    }
  };

  return (
    <Modal
      title="AI 设置"
      open={visible}
      onCancel={onClose}
      footer={[
        <Space key="footer">
          <Button onClick={onClose}>
            取消
          </Button>
          <Button type="primary" onClick={handleSave}>
            保存
          </Button>
        </Space>
      ]}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="provider"
          label="API 提供商"
          rules={[{ required: true, message: '请选择 API 提供商' }]}
        >
          <Select onChange={handleProviderChange} placeholder="请选择 API 提供商">
            <Option value="moonshot">Moonshot AI</Option>
            <Option value="openai">OpenAI</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="apiKey"
          label="API Key"
          rules={[{ required: true, message: '请输入 API Key' }]}
        >
          <Input.Password placeholder="请输入您的 API Key" />
        </Form.Item>

        <Form.Item
          name="baseURL"
          label="API 基础地址"
          rules={[{ required: true, message: '请输入 API 基础地址' }]}
        >
          <Input placeholder="请输入 API 基础地址" />
        </Form.Item>

        <Form.Item
          name="model"
          label="AI 模型"
          rules={[{ required: true, message: '请选择 AI 模型' }]}
        >
          <Select placeholder="请选择 AI 模型">
            {provider && providerOptions[provider]?.models.map(model => (
              <Option key={model} value={model}>{model}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="temperature"
          label="温度"
          tooltip="控制生成的文本随机性"
        >
          <Slider min={0} max={2} step={0.1} />
        </Form.Item>

        <Form.Item
          name="maxTokens"
          label="最大 Token 数"
          tooltip="控制生成的文本长度"
        >
          <InputNumber min={0} max={128000} step={100} />
        </Form.Item>

        <Form.Item
          name="timeout"
          label="超时时间（秒）"
        >
          <InputNumber min={10} max={300} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AISettings;