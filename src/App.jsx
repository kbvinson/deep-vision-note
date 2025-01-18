import React, { useState, useEffect } from 'react';
import { Layout, message, Button, Modal, Progress, Space, Alert } from 'antd';
import { FileOutlined, FolderOutlined, ScanOutlined, SettingOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createWorker } from 'tesseract.js';
import FolderManager from './components/FolderManager';
import PDFViewer from './components/PDFViewer';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/main.css';
import * as pdfjs from 'pdfjs-dist';
import fontkit from '@pdf-lib/fontkit';
import AISettings from './components/AISettings';
import AICommandPanel from './components/AICommandPanel';
import './styles/ai-command-panel.css';
import { getSavedSettings, initializeFileCleanup } from './services/aiService';
import LogViewer from './components/LogViewer';
import { StorageService, STORAGE_KEYS } from './services/storageService';

const { Header, Content, Sider } = Layout;

// 设置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = process.env.NODE_ENV === 'production'
  ? './pdf.worker.min.js'  // 生产环境使用本地文件
  : `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;  // 开发环境使用 CDN

const App = () => {
  const [selectedFile, setSelectedFile] = useState(() =>
    StorageService.load(STORAGE_KEYS.SELECTED_FILE, null)
  );
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folders, setFolders] = useState(() => 
    StorageService.load(STORAGE_KEYS.FOLDERS, [])
  );
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResults, setOcrResults] = useState([]);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [aiSettings, setAiSettings] = useState(() =>
    StorageService.load(STORAGE_KEYS.AI_SETTINGS, null)
  );
  const [treeFiles, setTreeFiles] = useState([]);
  const [folderCollapsed, setFolderCollapsed] = useState(() =>
    StorageService.load(STORAGE_KEYS.UI_STATE, {})?.folderCollapsed || false
  );

  useEffect(() => {
    // 加载保存的设置
    const savedSettings = getSavedSettings();
    if (savedSettings?.apiKey) {
      setAiSettings(savedSettings);
    } else {
      // 如果没有设置 API Key，显示设置对话框
      setIsSettingsVisible(true);
      message.info('请先配置 AI 设置');
    }
  }, []);

  useEffect(() => {
    // 在组件挂载时清理历史文件
    initializeFileCleanup();
  }, []);

  const handleFileSelect = (fileNode) => {
    if (fileNode.file && fileNode.file.type === 'application/pdf') {
      setSelectedFile(fileNode.file);
      const parentFolder = fileNode.parentKey;
      setCurrentFolder(parentFolder);
      console.log('Selected file:', fileNode.file.name);
      console.log('Parent folder:', parentFolder);
    } else {
      message.warning('请选择有效的PDF文件');
    }
  };

  // 处理新文件创建
  const handleFileCreate = (newFile, folderId) => {
    setFolders(prev => {
      const addNewFile = (items) => {
        return items.map(item => {
          if (item.key === folderId) {
            const newNode = {
              key: Date.now().toString(),
              title: newFile.name,
              isLeaf: true,
              file: newFile,
              icon: <FileOutlined />,
              parentKey: item.key
            };
            // 更新 treeFiles
            setTreeFiles(prevFiles => [...prevFiles, newFile]);
            return {
              ...item,
              children: [...(item.children || []), newNode]
            };
          }
          if (item.children) {
            return {
              ...item,
              children: addNewFile(item.children)
            };
          }
          return item;
        });
      };
      return addNewFile(prev);
    });
  };

  // 添加函数来收集所有 PDF 文件
  const collectPDFFiles = (items) => {
    let files = [];
    items.forEach(item => {
      if (item.isLeaf && item.file && item.file.type === 'application/pdf') {
        files.push(item.file);
      }
      if (item.children) {
        files = [...files, ...collectPDFFiles(item.children)];
      }
    });
    return files;
  };

  // 在 folders 变化时更新 treeFiles
  useEffect(() => {
    const pdfFiles = collectPDFFiles(folders);
    setTreeFiles(pdfFiles);
  }, [folders]);

  // 处理PDF拆分
  const handlePDFSplit = async (selectedPages) => {
    if (!selectedFile || !currentFolder) {
      message.error('未选择PDF文件或找不到所在文件夹');
      console.log('currentFolder:', currentFolder);
      return;
    }

    try {
      // 读取源PDF文件
      const fileArrayBuffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(fileArrayBuffer);
      
      // 创建新的PDF文档
      const newPdfDoc = await PDFDocument.create();
      
      // 复制选中的页面
      for (const pageNum of selectedPages) {
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
        newPdfDoc.addPage(copiedPage);
      }
      
      // 保存新PDF
      const pdfBytes = await newPdfDoc.save();
      
      // 创建新文件
      const newFile = new File(
        [pdfBytes],
        `${selectedFile.name.replace('.pdf', '')}_提取${selectedPages.join('-')}.pdf`,
        { type: 'application/pdf' }
      );

      // 更新文件夹结构
      setFolders(prevFolders => {
        console.log('Previous folders:', prevFolders);
        console.log('Current folder:', currentFolder);

        const updateFolderStructure = (items) => {
          return items.map(item => {
            if (item.key === currentFolder) {
              console.log('Found target folder:', item);
              
              // 查找或创建拆分文件夹
              const splitFolderKey = `${item.key}_split`;
              let splitFolder = item.children?.find(child => 
                child.key === splitFolderKey && !child.isLeaf
              );

              if (!splitFolder) {
                splitFolder = {
                  key: splitFolderKey,
                  title: '拆分文件',
                  isLeaf: false,
                  icon: <FolderOutlined />,
                  children: [],
                  parentKey: item.key
                };
                console.log('Created new split folder:', splitFolder);
              }

              // 创建新文件节点
              const newFileNode = {
                key: Date.now().toString(),
                title: newFile.name,
                isLeaf: true,
                file: newFile,
                icon: <FileOutlined />,
                parentKey: splitFolder.key
              };
              console.log('Created new file node:', newFileNode);

              // 更新拆分文件夹
              const updatedSplitFolder = {
                ...splitFolder,
                children: [...(splitFolder.children || []), newFileNode]
              };

              // 更新当前文件夹
              const updatedItem = {
                ...item,
                children: [
                  ...(item.children?.filter(child => child.key !== splitFolderKey) || []),
                  updatedSplitFolder
                ]
              };
              console.log('Updated folder:', updatedItem);
              return updatedItem;
            }
            if (item.children) {
              return {
                ...item,
                children: updateFolderStructure(item.children)
              };
            }
            return item;
          });
        };

        const newFolders = updateFolderStructure(prevFolders);
        console.log('Updated folders structure:', newFolders);
        return newFolders;
      });

      message.success('PDF拆分成功');
      return true;
    } catch (error) {
      console.error('PDF拆分失败:', error);
      message.error('PDF拆分失败: ' + error.message);
      throw error;
    }
  };

  // PDF 页面转换为图像
  const convertPageToImage = async (pdfPage) => {
    const viewport = pdfPage.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // 设置白色背景
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // 渲染 PDF 页面到 canvas
    await pdfPage.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    return canvas.toDataURL('image/png');
  };

  // 处理设置保存
  const handleSettingsSave = (values) => {
    // 确保设置包含必要的字段
    const settings = {
      ...values,
      baseURL: values.baseURL || providerOptions[values.provider].baseURL,
    };
    
    // 保存设置
    localStorage.setItem('aiSettings', JSON.stringify(settings));
    setAiSettings(settings);
    
    console.log('保存的设置:', {
      baseURL: settings.baseURL,
      hasApiKey: !!settings.apiKey
    });
  };

  // OCR 识别 PDF 文件
  const handleOCR = async () => {
    if (!selectedFile) {
      message.error('未选择PDF文件');
      return;
    }

    setIsOcrProcessing(true);
    setOcrProgress(0);

    let worker = null;
    try {
      // 加载 PDF 文件
      const fileData = await selectedFile.arrayBuffer();
      const pdf = await pdfjs.getDocument(fileData).promise;
      const totalPages = pdf.numPages;
      
      message.info(`开始处理 PDF，共 ${totalPages} 页`);
      
      // 使用设置中的语言
      const languages = aiSettings?.language?.join('+') || 'chi_sim+eng';
      worker = await createWorker(languages);

      // 应用其他设置
      if (aiSettings?.requestInterval) {
        // 在页面处理之间添加延迟
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        await delay(aiSettings.requestInterval);
      }

      const results = [];
      const errors = [];

      // 创建新的 PDF 文档
      const newPdfDoc = await PDFDocument.create();
      
      // 使用标准字体
      const helveticaFont = await newPdfDoc.embedFont(StandardFonts.Helvetica);

      // 处理每一页
      for (let i = 1; i <= totalPages; i++) {
        try {
          setOcrProgress((i / totalPages) * 100);
          message.info(`正在处理第 ${i} 页`);

          const page = await pdf.getPage(i);
          const imageData = await convertPageToImage(page);
          
          // OCR 识别
          const result = await worker.recognize(imageData);
          console.log(`第 ${i} 页识别结果:`, result);

          // 检查识别结果是否有效
          if (!result.data || !result.data.text.trim() === '') {
            throw new Error('识别结果为空');
          }

          // 复制原页面到新文档
          const pdfBytes = await selectedFile.arrayBuffer();
          const originalPdf = await PDFDocument.load(pdfBytes);
          const [copiedPage] = await newPdfDoc.copyPages(originalPdf, [i - 1]);
          newPdfDoc.addPage(copiedPage);

          // 获取页面尺寸
          const { width, height } = copiedPage.getSize();

          try {
            // 将识别的文本分成多行
            const lines = result.data.text.split('\n');
            
            // 为每行文本创建一个隐藏的文本层
            let yPosition = height - 12;  // 从顶部开始
            for (const line of lines) {
              if (line.trim()) {  // 只处理非空行
                copiedPage.drawText(line, {
                  x: 0,
                  y: yPosition,
                  size: 12,
                  font: helveticaFont,
                  color: { red: 0, green: 0, blue: 0, alpha: 0.01 },  // 几乎透明
                });
                yPosition -= 14;  // 行间距
              }
            }
          } catch (textError) {
            console.error('添加文本层时出错:', textError);
            // 继续处理，不中断流程
          }

          results.push({
            page: i,
            text: result.data.text,
            confidence: result.data.confidence
          });

          // 根据设置的置信度阈值处理结果
          if (aiSettings?.confidenceThreshold) {
            const threshold = aiSettings.confidenceThreshold;
            if (result.data.confidence < threshold) {
              console.warn(`页面 ${i} 的识别置信度低于阈值`);
            }
          }

        } catch (error) {
          console.error(`处理第 ${i} 页时出错:`, error);
          errors.push(i);
          message.warning(`第 ${i} 页处理失败：${error.message}`);
        }
      }

      if (results.length > 0) {
        // 保存新的 PDF 文件
        const pdfBytes = await newPdfDoc.save();
        const newFile = new File(
          [pdfBytes],
          `${selectedFile.name.replace('.pdf', '')}_OCR.pdf`,
          { type: 'application/pdf' }
        );

        if (currentFolder) {
          handleFileCreate(newFile, currentFolder);
        }

        // 计算总体识别情况
        const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
        const successPages = results.length;
        const failedPages = errors.length;

        // 显示结果总结
        Modal.info({
          title: errors.length > 0 ? 'OCR 识别部分完成' : 'OCR 识别完成',
          width: 600,
          content: (
            <div>
              <h3>识别结果总结</h3>
              <p>总页数：{totalPages} 页</p>
              <p>成功识别：{successPages} 页</p>
              <p>识别失败：{failedPages} 页</p>
              <p>平均置信度：{totalConfidence.toFixed(2)}%</p>
              {errors.length > 0 && (
                <Alert
                  message="部分页面识别失败"
                  description={`失败页码：${errors.join(', ')}`}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}
              <Alert
                message={errors.length > 0 ? "部分处理完成" : "处理完成"}
                description={`已生成新的 PDF 文件：${newFile.name}`}
                type={errors.length > 0 ? "warning" : "success"}
                showIcon
              />
            </div>
          ),
        });
      } else {
        Modal.error({
          title: 'OCR 识别失败',
          content: '所有页面识别均失败，请检查PDF文件是否正确。',
        });
      }

    } catch (error) {
      console.error('OCR 处理失败:', error);
      message.error(`OCR 处理失败: ${error.message}`);
    } finally {
      // 确保资源被正确释放
      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {
          console.error('Worker 终止失败:', e);
        }
      }
      setIsOcrProcessing(false);
      setOcrProgress(0);
    }
  };

  // 更新文件树数据的函数
  const updateTreeFiles = (files) => {
    setTreeFiles(files);
  };

  // 添加状态持久化效果
  useEffect(() => {
    StorageService.save(STORAGE_KEYS.FOLDERS, folders);
  }, [folders]);

  useEffect(() => {
    if (selectedFile) {
      StorageService.save(STORAGE_KEYS.SELECTED_FILE, selectedFile);
    }
  }, [selectedFile]);

  useEffect(() => {
    StorageService.save(STORAGE_KEYS.UI_STATE, { folderCollapsed });
  }, [folderCollapsed]);

  useEffect(() => {
    if (aiSettings) {
      StorageService.save(STORAGE_KEYS.AI_SETTINGS, aiSettings);
    }
  }, [aiSettings]);

  // 添加数据导出功能
  const handleExportData = () => {
    try {
      const exportData = {
        folders: StorageService.load(STORAGE_KEYS.FOLDERS),
        conversations: StorageService.load(STORAGE_KEYS.CONVERSATIONS),
        customCommands: StorageService.load(STORAGE_KEYS.CUSTOM_COMMANDS),
        aiSettings: StorageService.load(STORAGE_KEYS.AI_SETTINGS),
        uiState: StorageService.load(STORAGE_KEYS.UI_STATE)
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deep-vision-note-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error('导出数据失败');
      console.error('导出数据失败:', error);
    }
  };

  // 添加数据导入功能
  const handleImportData = (file) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        
        // 导入各项数据
        if (data.folders) StorageService.save(STORAGE_KEYS.FOLDERS, data.folders);
        if (data.conversations) StorageService.save(STORAGE_KEYS.CONVERSATIONS, data.conversations);
        if (data.customCommands) StorageService.save(STORAGE_KEYS.CUSTOM_COMMANDS, data.customCommands);
        if (data.aiSettings) StorageService.save(STORAGE_KEYS.AI_SETTINGS, data.aiSettings);
        if (data.uiState) StorageService.save(STORAGE_KEYS.UI_STATE, data.uiState);

        // 刷新页面以加载导入的数据
        window.location.reload();
      };
      reader.readAsText(file);
    } catch (error) {
      message.error('导入数据失败');
      console.error('导入数据失败:', error);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="app-header">
        <div className="app-title">Deep Vision Note 映书</div>
        <Space style={{ marginLeft: 'auto' }}>
          <Button
            type="text"
            icon={folderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setFolderCollapsed(!folderCollapsed)}
          />
          <Button
            icon={<SettingOutlined />}
            onClick={() => setIsSettingsVisible(true)}
          >
            AI 设置
          </Button>
        </Space>
      </Header>
      <Layout className="app-main-layout">
        <Sider 
          width={300} 
          className="app-sider"
          collapsible
          collapsed={folderCollapsed}
          collapsedWidth={0}
          trigger={null}
          zeroWidthTriggerStyle={{ top: '64px' }}
        >
          <FolderManager 
            folders={folders}
            setFolders={setFolders}
            onFileSelect={handleFileSelect}
          />
        </Sider>
        <Content className="app-content">
          <div className="content-wrapper">
            <div className="pdf-container">
              <ErrorBoundary>
                <PDFViewer 
                  file={selectedFile} 
                  onSplit={handlePDFSplit}
                />
              </ErrorBoundary>
              <div className="actions">
                <Button 
                  type="primary" 
                  icon={<ScanOutlined />}
                  onClick={handleOCR}
                  loading={isOcrProcessing}
                  disabled={!selectedFile}
                >
                  OCR识别PDF
                </Button>
              </div>
            </div>
          </div>
        </Content>
        <AICommandPanel 
          selectedFile={selectedFile}
          aiSettings={aiSettings}
          treeFiles={treeFiles.filter(file => file.name.toLowerCase().endsWith('.pdf'))}
          onSelectFile={(file) => setSelectedFile(file)}
        />
      </Layout>

      {/* OCR 进度弹窗 */}
      <Modal
        title="OCR 识别进度"
        open={isOcrProcessing}
        footer={null}
        closable={false}
        centered
      >
        <Progress 
          percent={Math.round(ocrProgress)} 
          status="active"
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
        />
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          正在进行 OCR 识别，请稍候...
        </div>
      </Modal>

      <AISettings
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        onSave={handleSettingsSave}
      />

      <LogViewer />
    </Layout>
  );
};

export default App;
