import axios from 'axios';
import { log, logTypes } from './logService';

// 获取保存的设置
export const getSavedSettings = () => {
  try {
    const settings = localStorage.getItem('aiSettings');
    if (!settings) {
      return null;
    }
    const parsedSettings = JSON.parse(settings);
    
    // 严格验证必要的设置项
    const requiredFields = ['provider', 'apiKey', 'baseURL', 'model'];
    if (!requiredFields.every(field => parsedSettings[field]?.trim())) {
      return null;
    }
    
    // 设置默认值
    return {
      ...parsedSettings,
      temperature: parsedSettings.temperature ?? 0.3,
      maxTokens: parsedSettings.maxTokens ?? 4000,
      timeout: parsedSettings.timeout ?? 60
    };
  } catch (error) {
    console.error('获取设置失败:', error);
    return null;
  }
};

// 创建 axios 实例
const createAPI = (settings) => {
  if (!settings?.apiKey?.trim() || !settings?.baseURL?.trim()) {
    throw new Error('请先完成 API 设置配置');
  }
  if (!settings.timeout) {
    throw new Error('请配置超时时间');
  }

  return axios.create({
    baseURL: settings.baseURL,
    timeout: settings.timeout * 1000,
    headers: {
      'Authorization': `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json'
    }
  });
};

// 在使用 API 时获取最新设置
const getAPI = () => {
  const settings = getSavedSettings();
  if (!settings) {
    throw new Error('请先配置 AI 设置');
  }
  if (!settings.apiKey) {
    throw new Error('请配置 API Key');
  }
  if (!settings.baseURL) {
    throw new Error('请配置 API 基础地址');
  }
  return createAPI(settings);
};

// 等待文件处理完成
const waitForFileProcessing = async (fileId) => {
  let attempts = 0;
  const maxAttempts = 60;
  const initialDelay = 1000;
  
  const api = getAPI();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  while (attempts < maxAttempts) {
    try {
      // 检查文件状态
      const statusResponse = await api.get(`/files/${fileId}`);
      const status = statusResponse.data.status;
      
      log(`文件处理状态: ${status}`, logTypes.INFO);

      if (status === 'succeeded' || status === 'processed') {
        // 如果文件处理成功，获取内容
        try {
          const contentResponse = await api.get(`/files/${fileId}/content`);
          if (contentResponse.data?.text) {
            log('文件处理完成', logTypes.SUCCESS);
            return contentResponse.data.text;
          }
        } catch (contentError) {
          // 如果获取内容失败，可能需要多等待一会
          log('等待文件内容准备完成...', logTypes.INFO);
        }
      } else if (status === 'failed' || status === 'error') {
        throw new Error('文件处理失败');
      } else {
        // 计算和显示进度
        const progress = Math.min(90, Math.round((attempts / maxAttempts) * 100));
        log('文件处理中...', logTypes.PROGRESS, progress);
      }

      // 使用动态等待时间，但不超过3秒
      const delay = Math.min(initialDelay * Math.pow(1.1, attempts), 3000);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempts++;
    } catch (error) {
      if (error.response?.status === 404) {
        log('文件正在准备中...', logTypes.INFO);
        await new Promise(resolve => setTimeout(resolve, initialDelay));
        attempts++;
        continue;
      }
      
      // 如果是其他错误，等待较短时间后重试
      log(`检查文件状态失败: ${error.message}`, logTypes.WARNING);
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
  }
  throw new Error('文件处理超时，请重试');
};

// 上传并处理文件
export const uploadFile = async (file) => {
  const api = getAPI();
  if (file.size > 100 * 1024 * 1024) {
    throw new Error('文件大小超过限制(100MB)');
  }

  let fileId = null;
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'file-extract');

    const uploadResponse = await api.post('/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`文件上传进度: ${percentCompleted}%`);
      }
    });

    if (!uploadResponse.data?.id) {
      throw new Error('文件上传失败：未获取到文件ID');
    }

    fileId = uploadResponse.data.id;
    const content = await waitForFileProcessing(fileId);
    return content;

  } catch (error) {
    console.error('文件上传失败:', error);
    throw error;
  } finally {
    if (fileId) {
      await api.delete(`/files/${fileId}`);
    }
  }
};

// 调用 AI API
export const callAIAPI = async ({ command, files = [], settings, context = [] }) => {
  // 严格验证必填设置
  const requiredFields = ['provider', 'apiKey', 'baseURL', 'model'];
  for (const field of requiredFields) {
    if (!settings[field]?.trim()) {
      throw new Error(`请配置 ${field}`);
    }
  }

  try {
    const api = getAPI();
    const messages = [];

    // 添加上下文消息
    if (context.length > 0) {
      messages.push(...context.map(msg => ({
        role: msg.role,
        content: msg.content
      })));
    }

    // 添加当前命令
    messages.push({
      role: "user",
      content: command
    });

    // 确保所有必要的参数都来自用户设置
    if (!settings.temperature) {
      throw new Error('请配置 temperature 参数');
    }
    if (!settings.maxTokens) {
      throw new Error('请配置 maxTokens 参数');
    }

    const response = await api.post('/chat/completions', {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature ?? 0.3,
      max_tokens: settings.maxTokens ?? 4000,
      stream: false
    });

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('API 响应格式错误');
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('AI 调用失败:', error);
    if (error.message.includes('API 设置')) {
      throw new Error('请先完成 API 设置配置');
    }
    throw error;
  }
};

// 清理所有已上传的文件
export const cleanupFiles = async () => {
  try {
    const api = getAPI();
    const response = await api.get('/files');
    if (response.data?.data?.length > 0) {
      await Promise.all(response.data.data.map(file => api.delete(`/files/${file.id}`)));
      log(`已清理 ${response.data.data.length} 个历史文件`, logTypes.SUCCESS);
    }
  } catch (error) {
    console.error('清理文件失败:', error);
    log('清理历史文件失败', logTypes.ERROR);
  }
};

// 在组件挂载时清理历史文件
export const initializeFileCleanup = () => {
  cleanupFiles().catch(console.error);
};