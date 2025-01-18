import React, { useState, useRef, useEffect } from 'react';
import { Layout, Button, Input, Card, List, Tooltip, message, Modal, Space, Divider, Upload, Form } from 'antd';
import { 
  RobotOutlined, 
  SendOutlined, 
  DeleteOutlined, 
  LoadingOutlined, 
  CopyOutlined,
  FileOutlined,
  EditOutlined,
  SaveOutlined,
  EyeOutlined,
  PlusOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import copy from 'copy-to-clipboard';
import { callAIAPI } from '../services/aiService';
import { StorageService, STORAGE_KEYS } from '../services/storageService';

const { Sider } = Layout;
const { TextArea } = Input;

const AddCommandModal = ({ visible, onCancel, onOk }) => {
  const [form] = Form.useForm();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onOk(values);
      form.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  return (
    <Modal
      title="添加常用指令"
      open={visible}
      onCancel={onCancel}
      onOk={handleOk}
      okText="确定"
      cancelText="取消"
      width={500}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="指令名称"
          rules={[{ required: true, message: '请输入指令名称' }]}
        >
          <Input placeholder="请输入指令名称" />
        </Form.Item>
        <Form.Item
          name="command"
          label="指令内容"
          rules={[{ required: true, message: '请输入指令内容' }]}
        >
          <TextArea placeholder="请输入指令内容" rows={4} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

const AICommandPanel = ({ selectedFile, aiSettings, treeFiles, onSelectFile }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [command, setCommand] = useState('');
  const [responses, setResponses] = useState([]);
  const [showFullContent, setShowFullContent] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState('');
  const responseRef = useRef(null);
  const [conversations, setConversations] = useState(() => 
    StorageService.load(STORAGE_KEYS.CONVERSATIONS, [{
      id: Date.now(),
      title: '新对话',
      messages: []
    }])
  );
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [isAddCommandVisible, setIsAddCommandVisible] = useState(false);
  const [customCommands, setCustomCommands] = useState(() => 
    StorageService.load(STORAGE_KEYS.CUSTOM_COMMANDS, [{
      id: 1,
      title: '提取关键信息',
      command: '请阅读这份PDF文件，提取其中的关键信息和主要观点。'
    }])
  );

  useEffect(() => {
    StorageService.save(STORAGE_KEYS.CONVERSATIONS, conversations);
  }, [conversations]);

  useEffect(() => {
    StorageService.save(STORAGE_KEYS.CUSTOM_COMMANDS, customCommands);
  }, [customCommands]);

  const handleFileSelect = (file) => {
    if (file && !selectedFiles.some(f => f.name === file.name)) {
      setSelectedFiles(prev => [...prev, file]);
    }
  };

  const handleFileRemove = (fileName) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const handleNewConversation = () => {
    const newConversation = {
      id: Date.now(),
      title: `新对话 ${conversations.length + 1}`,
      messages: []
    };
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
  };

  const handleSendCommand = async () => {
    if (!command.trim()) {
      message.warning('请输入指令');
      return;
    }

    if (!aiSettings?.apiKey) {
      message.error('请先配置AI API设置');
      return;
    }

    setIsLoading(true);
    
    // 获取当前对话的所有消息作为上下文
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    const contextMessages = currentConversation?.messages || [];

    const newMessage = {
      id: Date.now(),
      role: 'user',
      content: command,
      timestamp: new Date().toLocaleTimeString(),
      files: selectedFiles.map(f => f.name)
    };

    // 更新对话消息
    setConversations(prev => prev.map(conv => 
      conv.id === currentConversationId
        ? {
            ...conv,
            messages: [...conv.messages, newMessage]
          }
        : conv
    ));

    try {
      const files = selectedFiles.length > 0 ? selectedFiles : [];
      
      // 将上下文消息传递给 API
      const response = await callAIAPI({
        command,
        files,
        settings: aiSettings,
        context: contextMessages // 添加上下文支持
      });

      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString()
      };

      // 更新对话
      setConversations(prev => prev.map(conv => 
        conv.id === currentConversationId
          ? {
              ...conv,
              messages: [...conv.messages, aiMessage]
            }
          : conv
      ));

      // 模拟流式输出
      const chars = response.split('');
      for (let i = 0; i < chars.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
        setConversations(prev => prev.map(conv => 
          conv.id === currentConversationId
            ? {
                ...conv,
                messages: conv.messages.map(msg => 
                  msg.id === aiMessage.id
                    ? { ...msg, content: msg.content + chars[i] }
                    : msg
                )
              }
            : conv
        ));
      }

      setCommand('');
      if (selectedFiles.length > 0) {
        setSelectedFiles([]);
      }

    } catch (error) {
      console.error('AI处理失败:', error);
      message.error('AI处理失败: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetCommand = (cmd) => {
    setCommand(cmd);
  };

  const handleClearHistory = () => {
    Modal.confirm({
      title: '确认清除历史记录',
      content: '是否清除所有对话历史？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      centered: true,
      className: 'custom-modal',
      okButtonProps: { danger: true },
      onOk: () => {
        setConversations([{
          id: Date.now(),
          title: '新对话',
          messages: []
        }]);
        setCurrentConversationId(null);
        message.success('对话历史已清除');
      }
    });
  };

  const handleCopy = (content) => {
    copy(content);
    message.success('已复制到剪贴板');
  };

  const handleShowFullContent = (message) => {
    setSelectedMessage(message);
    setShowFullContent(true);
  };

  // Markdown渲染组件
  const MarkdownContent = ({ content }) => (
    <ReactMarkdown
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={tomorrow}
              language={match[1]}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        // 添加表格支持
        table: ({ children }) => (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table>
        ),
        th: ({ children }) => (
          <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5' }}>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td style={{ border: '1px solid #ddd', padding: '8px' }}>{children}</td>
        )
      }}
    >
      {content}
    </ReactMarkdown>
  );

  const FileSelector = () => (
    <Modal
      title="选择文件"
      open={showFileSelector}
      onCancel={() => setShowFileSelector(false)}
      footer={[
        <Button key="cancel" onClick={() => setShowFileSelector(false)}>
          取消
        </Button>
      ]}
      width={600}
    >
      <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
        {treeFiles.length > 0 ? (
          <List
            size="small"
            dataSource={treeFiles}
            renderItem={file => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      handleFileSelect(file);
                      setShowFileSelector(false);
                    }}
                  >
                    选择
                  </Button>
                ]}
              >
                <FileOutlined /> {file.name}
              </List.Item>
            )}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            暂无可选择的 PDF 文件
          </div>
        )}
      </div>
    </Modal>
  );

  // 简化 EditableContent 组件
  const EditableContent = ({ content, isEditing, onEdit, onSave }) => {
    const [editContent, setEditContent] = useState(content);

    useEffect(() => {
      if (isEditing) {
        setEditContent(content);
      }
    }, [content, isEditing]);

    if (!isEditing) {
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  style={tomorrow}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {content}
        </ReactMarkdown>
      );
    }

    return (
      <TextArea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        onBlur={() => {
          onSave(editContent);
          setEditContent(''); // 清空编辑内容
        }}
        autoSize={{ minRows: 6, maxRows: 20 }}
        className="response-textarea"
        autoFocus
      />
    );
  };

  // 首先确保初始化时设置当前对话
  useEffect(() => {
    if (conversations.length > 0 && !currentConversationId) {
      setCurrentConversationId(conversations[0].id);
    }
  }, [conversations, currentConversationId]);

  // 添加删除对话的处理函数
  const handleDeleteConversation = (convId) => {
    Modal.confirm({
      title: '确认删除对话',
      content: '是否删除此对话？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      centered: true,
      className: 'custom-modal',
      okButtonProps: { danger: true },
      onOk: () => {
        setConversations(prev => prev.filter(conv => conv.id !== convId));
        if (currentConversationId === convId) {
          setCurrentConversationId(conversations[0]?.id);
        }
        message.success('对话已删除');
      }
    });
  };

  const saveCustomCommands = (commands) => {
    setCustomCommands(commands);
    StorageService.save(STORAGE_KEYS.CUSTOM_COMMANDS, commands);
  };

  const handleAddCommand = () => {
    setIsAddCommandVisible(true);
  };

  const handleAddCommandOk = (values) => {
    const newCommand = {
      id: Date.now(),
      title: values.title,
      command: values.command
    };
    saveCustomCommands([...customCommands, newCommand]);
    setIsAddCommandVisible(false);
    message.success('指令添加成功');
  };

  return (
    <Sider 
      width={500} 
      className="ai-command-panel"
      theme="light"
    >
      <div className="panel-container">
        <div className="input-section">
          <div className="section-header">
            <div className="header-left">
              <h3>
                <RobotOutlined /> 指令输入
                <div className="conversation-controls">
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={handleNewConversation}
                    className="new-chat-btn"
                  />
                  {conversations.map(conv => (
                    <Button
                      key={conv.id}
                      type="text"
                      size="small"
                      className={`conversation-btn ${conv.id === currentConversationId ? 'active' : ''}`}
                      onClick={() => setCurrentConversationId(conv.id)}
                    >
                      {conv.title}
                      <DeleteOutlined
                        className="delete-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(conv.id);
                        }}
                      />
                    </Button>
                  ))}
                </div>
              </h3>
            </div>
          </div>
          <div className="section-content">
            <div className="quick-actions">
              <div className="files-section">
                <div className="section-title">
                  <span>已选文件</span>
                  <Space>
                    <Button 
                      type="link" 
                      size="small"
                      onClick={() => setShowFileSelector(true)}
                    >
                      选择
                    </Button>
                    {selectedFiles.length > 0 && (
                      <Button 
                        type="link" 
                        size="small"
                        danger
                        onClick={() => setSelectedFiles([])}
                      >
                        清空
                      </Button>
                    )}
                  </Space>
                </div>
                {selectedFiles.length > 0 ? (
                  <div className="selected-files-list">
                    {selectedFiles.map(file => (
                      <div key={file.name} className="file-item">
                        <FileOutlined />
                        <span className="file-name">{file.name}</span>
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => handleFileRemove(file.name)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-hint">未选择文件</div>
                )}
              </div>

              <div className="commands-section">
                <div className="section-title">
                  <span>常用指令</span>
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={handleAddCommand}
                    >
                      添加
                    </Button>
                  </Space>
                </div>
                <div className="commands-list">
                  {customCommands.map(cmd => (
                    <div key={cmd.id} className="command-item">
                      <Tooltip title={cmd.command}>
                        <div className="command-content" onClick={() => handlePresetCommand(cmd.command)}>
                          {cmd.title}
                        </div>
                      </Tooltip>
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          saveCustomCommands(customCommands.filter(c => c.id !== cmd.id));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="command-input">
              <TextArea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="在此输入指令..."
                autoSize={{ minRows: 3, maxRows: 6 }}
                disabled={isLoading}
                onPressEnter={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    handleSendCommand();
                  }
                }}
              />
              <Button
                type="primary"
                icon={isLoading ? <LoadingOutlined /> : <SendOutlined />}
                onClick={handleSendCommand}
                disabled={isLoading || !command.trim()}
                loading={isLoading}
                style={{ marginTop: 8 }}
                block
              >
                {isLoading ? '处理中...' : '发送指令 (Ctrl + Enter)'}
              </Button>
            </div>
          </div>
        </div>

        {/* 输出区域 */}
        <div className="output-section">
          <div className="section-header">
            <h3>AI 响应</h3>
            <Space>
              <Button 
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={handleClearHistory}
              >
                清除历史
              </Button>
            </Space>
          </div>
          <div className="section-content">
            {currentConversationId ? (
              <div className="responses-container">
                {conversations
                  .find(conv => conv.id === currentConversationId)
                  ?.messages.map((message, index, messages) => {
                    const isUser = message.role === 'user';
                    const nextMessage = messages[index + 1];
                    
                    // 只渲染用户消息，并将AI回复作为子内容
                    if (!isUser) return null;
                    
                    return (
                      <div key={message.id} className="conversation-item">
                        {/* 用户消息 */}
                        <div className="message user-message">
                          <div className="message-header">
                            <div className="message-info">
                              <span className="message-role">用户</span>
                              <span className="message-time">{message.timestamp}</span>
                            </div>
                            <Space>
                              <Button 
                                type="text"
                                icon={<CopyOutlined />}
                                onClick={() => handleCopy(message.content)}
                              >
                                复制
                              </Button>
                            </Space>
                          </div>
                          <div className="message-content">
                            {message.content}
                          </div>
                        </div>

                        {/* AI回复 */}
                        {nextMessage && (
                          <div className="message ai-message">
                            <div className="message-header">
                              <div className="message-info">
                                <span className="message-role">AI</span>
                                <span className="message-time">{nextMessage.timestamp}</span>
                              </div>
                              <Space>
                                <Button 
                                  type="text"
                                  icon={<EditOutlined />}
                                  onClick={() => {
                                    if (isEditing === nextMessage.id) {
                                      // 如果已经在编辑状态，点击按钮会保存并退出编辑
                                      const content = editingContent;
                                      setConversations(prev => prev.map(conv => 
                                        conv.id === currentConversationId
                                          ? {
                                              ...conv,
                                              messages: conv.messages.map(msg => 
                                                msg.id === nextMessage.id
                                                  ? { ...msg, content }
                                                  : msg
                                              )
                                            }
                                          : conv
                                      ));
                                      setIsEditing(null);
                                      setEditingContent(''); // 清空编辑内容
                                    } else {
                                      // 进入编辑状态
                                      setIsEditing(nextMessage.id);
                                      setEditingContent(nextMessage.content);
                                    }
                                  }}
                                >
                                  {isEditing === nextMessage.id ? '完成' : '编辑'}
                                </Button>
                                <Button 
                                  type="text"
                                  icon={<CopyOutlined />}
                                  onClick={() => handleCopy(nextMessage.content)}
                                >
                                  复制
                                </Button>
                              </Space>
                            </div>
                            <div className="message-content">
                              <EditableContent
                                content={nextMessage.content}
                                isEditing={isEditing === nextMessage.id}
                                onEdit={() => {
                                  setIsEditing(nextMessage.id);
                                  setEditingContent(nextMessage.content);
                                }}
                                onSave={(content) => {
                                  setConversations(prev => prev.map(conv => 
                                    conv.id === currentConversationId
                                      ? {
                                          ...conv,
                                          messages: conv.messages.map(msg => 
                                            msg.id === nextMessage.id
                                              ? { ...msg, content }
                                              : msg
                                          )
                                        }
                                      : conv
                                  ));
                                  setIsEditing(null);
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }).reverse()}
              </div>
            ) : (
              <div className="empty-response">
                <div className="empty-text">
                  {isLoading ? '正在等待 AI 响应...' : '在上方输入指令并发送'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        title="完整内容"
        open={showFullContent}
        onCancel={() => setShowFullContent(false)}
        footer={[
          <Space key="footer">
            <Button 
              icon={<CopyOutlined />}
              onClick={() => handleCopy(selectedMessage?.content)}
            >
              复制
            </Button>
            <Button 
              type="primary" 
              onClick={() => setShowFullContent(false)}
            >
              关闭
            </Button>
          </Space>
        ]}
        width={800}
        bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
      >
        {selectedMessage?.type === 'ai' ? (
          <MarkdownContent content={selectedMessage.content} />
        ) : (
          selectedMessage?.content
        )}
      </Modal>

      <FileSelector />

      <AddCommandModal
        visible={isAddCommandVisible}
        onCancel={() => setIsAddCommandVisible(false)}
        onOk={handleAddCommandOk}
      />
    </Sider>
  );
};

export default AICommandPanel;