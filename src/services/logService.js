// 创建一个事件发射器来处理日志更新
class LogEmitter {
  constructor() {
    this.listeners = new Set();
    this.logs = [];
    this.maxLogs = 1000; // 最大日志数量
  }

  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(log) {
    this.logs.push(log);
    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    this.listeners.forEach(listener => listener(this.logs));
  }

  clear() {
    this.logs = [];
    this.listeners.forEach(listener => listener(this.logs));
  }

  getLogs() {
    return this.logs;
  }
}

export const logEmitter = new LogEmitter();

export const logTypes = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  PROGRESS: 'progress'
};

export const log = (message, type = logTypes.INFO, data = null) => {
  const logEntry = {
    timestamp: new Date(),
    type,
    message,
    data
  };
  logEmitter.emit(logEntry);
}; 