import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Document, Page } from 'react-pdf';
import { Button, Slider, Row, Col, Spin, Alert, Switch, Space, Tooltip, Input, message, Modal, Checkbox, Progress } from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  CopyOutlined,
  AppstoreOutlined,
  MenuOutlined,
  VerticalAlignMiddleOutlined,
  ScissorOutlined
} from '@ant-design/icons';
import './pdf-viewer.css';

import { pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.js`;

const PDFViewer = ({ file, onSplit }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [pageWidth, setPageWidth] = useState(800);
  const [error, setError] = useState(null);
  const [showTextLayer, setShowTextLayer] = useState(false);
  const [multiPageView, setMultiPageView] = useState(false);
  const [visiblePages, setVisiblePages] = useState(1);
  const [inputPage, setInputPage] = useState('');
  const [isSplitModalVisible, setIsSplitModalVisible] = useState(false);
  const [selectedPages, setSelectedPages] = useState([]);

  // A4 纸张尺寸（以像素为单位，假设 96 DPI）
  const A4_WIDTH = 794;  // 210mm = 794px
  const A4_HEIGHT = 1123; // 297mm = 1123px

  // 计算页面宽度
  const calculatePageWidth = useCallback((containerWidth) => {
    if (multiPageView) {
      // 根据显示页数动态计算每页宽度
      const pagesPerRow = visiblePages; // 1-5列
      const gap = 24; // 页面间距
      const padding = 32; // 容器内边距
      const totalGaps = pagesPerRow - 1;
      // 计算可用宽度（考虑内边距和间距）
      const availableWidth = containerWidth - (padding * 2) - (gap * totalGaps);
      // 计算单个页面的宽度
      const singlePageWidth = availableWidth / pagesPerRow;
      // 根据页面数量动态调整缩放
      setScale(singlePageWidth / A4_WIDTH);
      return singlePageWidth;
    }
    // 单页视图时重置缩放
    setScale(1);
    return Math.min(containerWidth * 0.9, A4_WIDTH);
  }, [multiPageView, visiblePages]);

  // 处理多页视图切换
  const handleViewModeChange = () => {
    setMultiPageView(!multiPageView);
    setVisiblePages(1); // 切换时重置为1列
    // 重新计算页面宽度
    const container = document.querySelector('.pdf-content');
    if (container) {
      setPageWidth(calculatePageWidth(container.clientWidth));
    }
  };

  useEffect(() => {
    if (file) {
      setPageNumber(1);
      setScale(1);
    }
  }, [file]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error) => {
    console.error('PDF加载失败:', error);
    setError('PDF文件加载失败，请检查文件是否有效');
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  };

  const handlePageChange = (value) => {
    const newPage = Math.max(1, Math.min(value, numPages));
    setPageNumber(newPage);
    setInputPage('');
    const targetPage = document.querySelector(`[data-page-number="${newPage}"]`);
    if (targetPage) {
      targetPage.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handlePageInput = (e) => {
    const value = e.target.value;
    setInputPage(value);
  };

  const handlePageInputConfirm = () => {
    const pageNum = parseInt(inputPage);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= numPages) {
      handlePageChange(pageNum);
    } else {
      message.warning('请输入有效的页码');
      setInputPage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handlePageInputConfirm();
    }
  };

  const handlePrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages));
  };

  // 渲染页面
  const renderPages = useMemo(() => {
    if (!numPages) return null;

    const pages = [];
    const totalPages = numPages;
    const pagesPerRow = multiPageView ? visiblePages : 1;

    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      if (pageNum > numPages) break;

      pages.push(
        <div 
          key={`page-${pageNum}`} 
          className={`pdf-page-container ${multiPageView ? 'multi-page' : ''}`}
          data-page-number={pageNum}
        >
          <Page 
            pageNumber={pageNum}
            scale={scale}
            width={pageWidth}
            height={multiPageView ? A4_HEIGHT * (pageWidth / A4_WIDTH) : undefined}
            renderTextLayer={showTextLayer}
            renderAnnotationLayer={true}
          />
          <div className="page-number">
            第 {pageNum} 页 / 共 {numPages} 页
          </div>
        </div>
      );
    }

    return (
      <div 
        className="pages-container" 
        style={{
          display: 'grid',
          gridTemplateColumns: multiPageView ? `repeat(${pagesPerRow}, 1fr)` : '1fr',
          gap: '24px',
          padding: '32px',
          justifyItems: 'center'
        }}
      >
        {pages}
      </div>
    );
  }, [numPages, pageNumber, scale, pageWidth, showTextLayer, multiPageView, visiblePages]);

  useEffect(() => {
    const handleResize = () => {
      const container = document.querySelector('.pdf-content');
      if (container) {
        setPageWidth(calculatePageWidth(container.clientWidth));
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculatePageWidth]);

  const validateFile = useCallback((file) => {
    if (!file) return null;
    try {
      if (file instanceof File || file instanceof Blob) {
        return URL.createObjectURL(file);
      }
      return file;
    } catch (error) {
      return null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (file instanceof Blob) {
        URL.revokeObjectURL(validateFile(file));
      }
    };
  }, [file, validateFile]);

  // 处理页面选择
  const handlePageSelect = (pageNumber) => {
    setSelectedPages(prev => {
      if (prev.includes(pageNumber)) {
        return prev.filter(p => p !== pageNumber);
      }
      return [...prev, pageNumber].sort((a, b) => a - b);
    });
  };

  // 处理拆分确认
  const handleSplitConfirm = async () => {
    if (selectedPages.length === 0) {
      message.warning('请至少选择一页进行拆分');
      return;
    }
    
    try {
      // 调用父组件传入的拆分处理函数
      await onSplit(selectedPages);
      setIsSplitModalVisible(false);
      setSelectedPages([]);
      message.success('PDF拆分成功');
    } catch (error) {
      message.error('PDF拆分失败');
    }
  };

  // 渲染拆分预览页面
  const renderSplitPages = () => {
    if (!numPages || !file) return null;

    return (
      <div className="split-pages-grid">
        {Array.from(new Array(numPages), (el, index) => (
          <div 
            key={`split-page-${index + 1}`} 
            className={`split-page-container ${selectedPages.includes(index + 1) ? 'selected' : ''}`}
            onClick={() => handlePageSelect(index + 1)}
          >
            <Checkbox
              checked={selectedPages.includes(index + 1)}
              className="page-checkbox"
              onClick={(e) => e.stopPropagation()}
              onChange={() => handlePageSelect(index + 1)}
            />
            <Document
              file={file}
              className="split-page-document"
            >
              <Page
                pageNumber={index + 1}
                width={180}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="split-page-preview"
              />
            </Document>
            <div className="split-page-number">第 {index + 1} 页</div>
          </div>
        ))}
      </div>
    );
  };

  // 修改页面列数变化的处理函数
  const handleColumnsChange = (value) => {
    setVisiblePages(value);
    // 重新计算页面宽度
    const container = document.querySelector('.pdf-content');
    if (container) {
      setPageWidth(calculatePageWidth(container.clientWidth));
    }
  };

  if (!file) {
    return (
      <div className="pdf-viewer-empty">
        <div className="empty-prompt">请从左侧选择PDF文件进行预览</div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-controls">
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col>
            <Space size="middle">
              <Space>
                <Tooltip title="缩小">
                  <Button 
                    icon={<ZoomOutOutlined />}
                    onClick={handleZoomOut}
                    disabled={scale <= 0.5}
                  />
                </Tooltip>
                <Slider
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={scale}
                  onChange={setScale}
                  tooltip={{ formatter: value => `${Math.round(value * 100)}%` }}
                  style={{ width: 100 }}
                />
                <Tooltip title="放大">
                  <Button 
                    icon={<ZoomInOutlined />}
                    onClick={handleZoomIn}
                    disabled={scale >= 2}
                  />
                </Tooltip>
              </Space>

              <div className="page-input-container">
                <Input
                  placeholder={`${pageNumber}`}
                  value={inputPage}
                  onChange={handlePageInput}
                  onPressEnter={handlePageInputConfirm}
                  onBlur={handlePageInputConfirm}
                  style={{ width: 60 }}
                />
                <span className="page-total">/ {numPages || 1}</span>
              </div>

              <Tooltip title={multiPageView ? "单页视图" : "多页视图"}>
                <Button
                  icon={multiPageView ? <MenuOutlined /> : <AppstoreOutlined />}
                  onClick={handleViewModeChange}
                />
              </Tooltip>

              {multiPageView && (
                <Slider
                  min={1}
                  max={5}
                  value={visiblePages}
                  onChange={handleColumnsChange}
                  tooltip={{ formatter: value => `${value}列` }}
                  style={{ width: 120 }}
                  marks={{
                    1: '1列',
                    2: '2列',
                    3: '3列',
                    4: '4列',
                    5: '5列'
                  }}
                />
              )}

              <Button
                icon={<ScissorOutlined />}
                onClick={() => setIsSplitModalVisible(true)}
              >
                拆分PDF
              </Button>
            </Space>
          </Col>

          <Col>
            <Space size="middle" className="control-right">
              <Tooltip title={showTextLayer ? "禁用文本选择" : "启用文本选择"}>
                <div className="text-layer-switch">
                  <Switch
                    checkedChildren={<CopyOutlined />}
                    unCheckedChildren={<CopyOutlined />}
                    checked={showTextLayer}
                    onChange={setShowTextLayer}
                  />
                  <span className="switch-label">文本选择</span>
                </div>
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </div>

      <div className="pdf-content">
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          className={showTextLayer ? 'text-layer-active' : ''}
        >
          {renderPages}
        </Document>
      </div>

      {/* 拆分设置对话框 */}
      <Modal
        title="拆分PDF"
        open={isSplitModalVisible}
        onCancel={() => {
          setIsSplitModalVisible(false);
          setSelectedPages([]);
        }}
        footer={[
          <Space key="footer">
            <Button 
              onClick={() => {
                setIsSplitModalVisible(false);
                setSelectedPages([]);
              }}
            >
              取消
            </Button>
            <Button 
              type="primary" 
              onClick={handleSplitConfirm}
            >
              确认拆分
            </Button>
          </Space>
        ]}
        width={900}
        centered
        className="split-modal"
      >
        <div className="split-modal-content">
          <div className="split-instructions">
            请选择需要提取的页面，可多选。选中的页面将被提取为新的PDF文件。
          </div>
          {renderSplitPages()}
        </div>
      </Modal>
    </div>
  );
};

export default PDFViewer;
