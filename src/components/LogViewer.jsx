import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Tooltip, Progress, Badge, Space } from 'antd';
import { CopyOutlined, DeleteOutlined, BugOutlined, ClearOutlined } from '@ant-design/icons';
import { logEmitter, logTypes } from '../services/logService';
import '../styles/log-viewer.css';

const LogViewer = () => {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const logContainerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = logEmitter.addListener((newLogs) => {
      setLogs(newLogs);
      if (!visible) {
        setUnreadCount(prev => prev + 1);
      }
    });
    return () => unsubscribe();
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setUnreadCount(0);
    }
  }, [visible]);

  useEffect(() => {
    if (logContainerRef.current && visible) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, visible]);

  const handleCopy = () => {
    const logText = logs
      .map(log => `[${log.timestamp.toLocaleTimeString()}] [${log.type.toUpperCase()}] ${log.message}`)
      .join('\n');
    navigator.clipboard.writeText(logText);
  };

  const getLogStyle = (type) => {
    switch (type) {
      case logTypes.SUCCESS:
        return { color: '#52c41a', borderLeft: '4px solid #52c41a' };
      case logTypes.WARNING:
        return { color: '#faad14', borderLeft: '4px solid #faad14' };
      case logTypes.ERROR:
        return { color: '#f5222d', borderLeft: '4px solid #f5222d' };
      case logTypes.PROGRESS:
        return { color: '#1890ff', borderLeft: '4px solid #1890ff' };
      default:
        return { color: '#1890ff', borderLeft: '4px solid #1890ff' };
    }
  };

  const renderLogEntry = (log) => {
    const baseStyle = {
      ...getLogStyle(log.type),
      paddingLeft: '12px'
    };

    if (log.type === logTypes.PROGRESS) {
      return (
        <div key={log.timestamp.getTime()} className="log-entry" style={baseStyle}>
          <span className="log-time">{log.timestamp.toLocaleTimeString()}</span>
          <span className="log-message">
            {log.message}
          </span>
          <div className="log-progress">
            <Progress 
              percent={log.data} 
              size="small" 
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </div>
        </div>
      );
    }

    return (
      <div key={log.timestamp.getTime()} className="log-entry" style={baseStyle}>
        <span className="log-time">{log.timestamp.toLocaleTimeString()}</span>
        <span className="log-message">
          {log.message}
        </span>
      </div>
    );
  };

  const handleClearLogs = () => {
    logEmitter.clear();
    setUnreadCount(0);
  };

  return (
    <>
      <Badge count={unreadCount} offset={[-5, 5]}>
        <Button 
          type="primary"
          icon={<BugOutlined />}
          onClick={() => setVisible(true)}
          className="log-viewer-button"
        >
          查看日志
        </Button>
      </Badge>
      <Modal
        title="操作日志"
        open={visible}
        onCancel={() => setVisible(false)}
        footer={[
          <Space key="footer">
            <Button 
              icon={<ClearOutlined />}
              onClick={handleClearLogs}
            >
              清空日志
            </Button>
            <Button 
              type="primary" 
              onClick={() => setVisible(false)}
            >
              关闭
            </Button>
          </Space>
        ]}
        width={800}
        bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
      >
        <div className="log-container" ref={logContainerRef}>
          {logs.length > 0 ? (
            logs.map(renderLogEntry)
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
              暂无日志记录
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default LogViewer; 