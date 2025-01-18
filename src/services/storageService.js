// 定义存储键名
const STORAGE_KEYS = {
  FOLDERS: 'dvn_folders',
  CONVERSATIONS: 'dvn_conversations',
  CUSTOM_COMMANDS: 'dvn_commands',
  AI_SETTINGS: 'dvn_ai_settings',
  SELECTED_FILE: 'dvn_selected_file',
  UI_STATE: 'dvn_ui_state'
};

// 数据存储服务
export const StorageService = {
  // 保存数据
  save: (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('保存数据失败:', error);
    }
  },

  // 读取数据
  load: (key, defaultValue = null) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error('读取数据失败:', error);
      return defaultValue;
    }
  },

  // 删除数据
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('删除数据失败:', error);
    }
  },

  // 清除所有数据
  clear: () => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('清除数据失败:', error);
    }
  }
};

export { STORAGE_KEYS }; 