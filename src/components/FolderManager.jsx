import React, { useState } from 'react';
import { Tree, Button, Input, Modal, message, Space, Dropdown, Select, Menu } from 'antd';
import { 
  FolderOutlined, 
  FileOutlined, 
  DeleteOutlined, 
  FolderAddOutlined,
  UploadOutlined,
  PlusOutlined,
  EditOutlined,
  ExpandOutlined,
  CompressOutlined,
  SaveOutlined,
  EllipsisOutlined
} from '@ant-design/icons';
import './folder-manager.css';

const { DirectoryTree } = Tree;
const { Option } = Select;

const FolderManager = ({ folders, setFolders, onFileSelect }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [selectedImportFolder, setSelectedImportFolder] = useState(null);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renamingNode, setRenamingNode] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  // 创建文件夹
  const handleCreateFolder = (parentKey = null) => {
    const newFolder = {
      key: Date.now().toString(),
      title: getNewFolderName(folders, parentKey),
      isLeaf: false,
      icon: <FolderOutlined />,
      children: []
    };

    setFolders(prev => {
      if (!parentKey) {
        return [...prev, newFolder];
      }
      const addSubFolder = (items) => {
        return items.map(item => {
          if (item.key === parentKey) {
            return {
              ...item,
              children: [...(item.children || []), newFolder]
            };
          }
          if (item.children) {
            return {
              ...item,
              children: addSubFolder(item.children)
            };
          }
          return item;
        });
      };
      return addSubFolder(prev);
    });

    message.success('文件夹创建成功');
  };

  // 获取新文件夹名称
  const getNewFolderName = (items, parentKey = null) => {
    let existingNames = [];
    const getNames = (folders, inTargetParent = true) => {
      folders.forEach(folder => {
        if (!folder.isLeaf && inTargetParent) {
          existingNames.push(folder.title);
        }
        if (folder.children) {
          getNames(folder.children, folder.key === parentKey);
        }
      });
    };
    
    getNames(items);
    
    let index = 1;
    let newName = '新建文件夹';
    while (existingNames.includes(newName)) {
      newName = `新建文件夹 (${index})`;
      index++;
    }
    return newName;
  };

  // 删除文件夹
  const handleDeleteFolder = () => {
    if (!selectedFolder) return;

    const deleteFromTree = (items) => {
      return items.filter(item => {
        if (item.key === selectedFolder) return false;
        if (item.children) {
          item.children = deleteFromTree(item.children);
        }
        return true;
      });
    };

    setFolders(prev => deleteFromTree(prev));
    setIsDeleteModalVisible(false);
    setSelectedFolder(null);
    message.success('文件夹删除成功');
  };

  // 获取所有文件夹选项
  const getFolderOptions = (items = folders, parentPath = '') => {
    let options = [];
    items.forEach(item => {
      if (!item.isLeaf) {
        const currentPath = parentPath ? `${parentPath}/${item.title}` : item.title;
        options.push({
          value: item.key,
          label: currentPath
        });
        if (item.children) {
          options = [...options, ...getFolderOptions(item.children, currentPath)];
        }
      }
    });
    return options;
  };

  // 处理文件导入
  const handleImportPDF = () => {
    if (!selectedImportFolder) {
      message.warning('请选择要导入到的文件夹');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        const newFiles = files.map(file => ({
          key: Date.now().toString() + Math.random(),
          title: file.name,
          isLeaf: true,
          file,
          icon: <FileOutlined />,
          parentKey: selectedImportFolder
        }));

        setFolders(prev => {
          const addToFolder = (items) => {
            return items.map(item => {
              if (item.key === selectedImportFolder) {
                return {
                  ...item,
                  children: [...(item.children || []), ...newFiles]
                };
              }
              if (item.children) {
                return {
                  ...item,
                  children: addToFolder(item.children)
                };
              }
              return item;
            });
          };
          return addToFolder(prev);
        });

        message.success(`成功导入 ${files.length} 个文件`);
        setIsImportModalVisible(false);
        setSelectedImportFolder(null);
      }
    };
    input.click();
  };

  // 处理拖拽
  const onDrop = (info) => {
    const dropKey = info.node.key;
    const dragKey = info.dragNode.key;
    const dropPos = info.node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);

    const loop = (data, key, callback) => {
      for (let i = 0; i < data.length; i++) {
        if (data[i].key === key) {
          return callback(data[i], i, data);
        }
        if (data[i].children) {
          loop(data[i].children, key, callback);
        }
      }
    };

    const data = [...folders];
    let dragObj;

    loop(data, dragKey, (item, index, arr) => {
      arr.splice(index, 1);
      dragObj = item;
    });

    if (!info.dropToGap) {
      loop(data, dropKey, (item) => {
        item.children = item.children || [];
        item.children.push(dragObj);
      });
    }

    setFolders(data);
    message.success('移动成功');
  };

  // 处理选择
  const handleSelect = (selectedKeys, { node }) => {
    if (node.isLeaf) {
      onFileSelect(node);
    } else {
      setSelectedFolder(node.key);
    }
  };

  // 处理重命名
  const handleRename = () => {
    if (!renameValue.trim()) {
      message.warning('文件夹名称不能为空');
      return;
    }

    setFolders(prev => {
      const rename = (items) => {
        return items.map(item => {
          if (item.key === renamingNode.key) {
            return { ...item, title: renameValue };
          }
          if (item.children) {
            return { ...item, children: rename(item.children) };
          }
          return item;
        });
      };
      return rename(prev);
    });

    setIsRenameModalVisible(false);
    setRenameValue('');
    setRenamingNode(null);
    message.success('重命名成功');
  };

  // 右键菜单项
  const getContextMenu = (node) => {
    return {
      items: [
        {
          key: 'addFolder',
          label: '新建子文件夹',
          icon: <FolderAddOutlined />,
          onClick: () => handleCreateFolder(node.key)
        },
        {
          key: 'addFile',
          label: '导入PDF文件',
          icon: <FileOutlined />,
          onClick: () => handleImportPDF(node.key)
        },
        {
          key: 'delete',
          label: '删除文件夹',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => {
            setSelectedFolder(node.key);
            setIsDeleteModalVisible(true);
          }
        }
      ]
    };
  };

  // 修改渲染文件夹操作按钮函数
  const renderFolderActions = (folder) => {
    if (!folder) return null;
    
    // 创建文件导入处理函数
    const handleFileImport = (e) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.multiple = true;
      input.onchange = (event) => {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
          const newFiles = files.map(file => ({
            key: Date.now().toString() + Math.random(),
            title: file.name,
            isLeaf: true,
            file,
            icon: <FileOutlined />,
            parentKey: folder.key
          }));

          setFolders(prev => {
            const addToFolder = (items) => {
              return items.map(item => {
                if (item.key === folder.key) {
                  return {
                    ...item,
                    children: [...(item.children || []), ...newFiles]
                  };
                }
                if (item.children) {
                  return {
                    ...item,
                    children: addToFolder(item.children)
                  };
                }
                return item;
              });
            };
            return addToFolder(prev);
          });

          message.success(`成功导入 ${files.length} 个文件`);
        }
      };
      input.click();
    };
    
    return (
      <div className="folder-action-buttons">
        <Button
          size="small"
          type="text"
          icon={<FolderAddOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleCreateFolder(folder.key);
          }}
          className="action-button"
          title="新建子文件夹"
        />
        <Button
          size="small"
          type="text"
          icon={<UploadOutlined />}
          onClick={handleFileImport}
          className="action-button"
          title="导入PDF"
        />
        <Button
          size="small"
          type="text"
          icon={<EditOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            setRenamingNode(folder);
            setRenameValue(folder.title);
            setIsRenameModalVisible(true);
          }}
          className="action-button"
          title="重命名"
        />
      </div>
    );
  };

  // 修改自定义树节点标题渲染函数
  const titleRender = (nodeData) => {
    return (
      <div className="tree-node-content">
        <span className="node-title">
          <Dropdown 
            overlay={getNodeDropdownMenu(nodeData)} 
            trigger={['contextMenu']}
          >
            <span>{nodeData.title}</span>
          </Dropdown>
        </span>
        {!nodeData.isLeaf && renderFolderActions(nodeData)}
        {nodeData.isLeaf && nodeData.file?.type === 'application/pdf' && (
          <div className="file-action-buttons">
            <Button
              size="small"
              type="text"
              icon={<SaveOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleSaveAs(nodeData);
              }}
              className="action-button"
              title="另存为"
            />
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setRenamingNode(nodeData);
                setRenameValue(nodeData.title);
                setIsRenameModalVisible(true);
              }}
              className="action-button"
              title="重命名"
            />
            <Button
              size="small"
              type="text"
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFile(nodeData);
              }}
              className="action-button"
              title="删除"
            />
          </div>
        )}
      </div>
    );
  };

  // 处理展开/折叠
  const handleExpandAll = () => {
    if (isAllExpanded) {
      // 折叠所有文件夹
      setExpandedKeys([]);
    } else {
      // 展开所有文件夹
      const getAllKeys = (items) => {
        let keys = [];
        items.forEach(item => {
          if (!item.isLeaf) {
            keys.push(item.key);
            if (item.children) {
              keys = [...keys, ...getAllKeys(item.children)];
            }
          }
        });
        return keys;
      };
      setExpandedKeys(getAllKeys(folders));
    }
    setIsAllExpanded(!isAllExpanded);
  };

  const handleSaveAs = async (node) => {
    try {
      // 创建一个隐藏的下载链接
      const url = URL.createObjectURL(node.file);
      const link = document.createElement('a');
      link.href = url;
      link.download = node.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success('文件保存成功');
    } catch (error) {
      console.error('文件保存失败:', error);
      message.error('文件保存失败');
    }
  };

  const handleDeleteFile = (node) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除文件 "${node.title}" 吗？`,
      onOk() {
        setFolders(prev => {
          const deleteFile = (items) => {
            return items.map(item => {
              if (item.children) {
                return {
                  ...item,
                  children: item.children.filter(child => child.key !== node.key)
                };
              }
              return item;
            });
          };
          return deleteFile(prev);
        });
        message.success('文件已删除');
      },
    });
  };

  const getNodeDropdownMenu = (node) => {
    if (node.isLeaf && node.file?.type === 'application/pdf') {
      return (
        <Menu>
          <Menu.Item key="rename" icon={<EditOutlined />} onClick={() => handleRename(node)}>
            重命名
          </Menu.Item>
          <Menu.Item key="saveAs" icon={<SaveOutlined />} onClick={() => handleSaveAs(node)}>
            另存为
          </Menu.Item>
          <Menu.Item key="delete" icon={<DeleteOutlined />} onClick={() => handleDeleteFile(node)}>
            删除
          </Menu.Item>
        </Menu>
      );
    }
    // ... 其他菜单项保持不变
  };

  const renderTreeNodes = (data) => {
    return data.map(item => {
      const title = (
        <span className="node-wrapper">
          <span className="node-title">{item.title}</span>
          <span className="node-actions">
            <span className="more-actions">
              <EllipsisOutlined />
            </span>
            <span className="action-buttons">
              {!item.isLeaf && (
                <Button
                  className="action-button"
                  icon={<FolderAddOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddFolder(item.key);
                  }}
                />
              )}
              <Button
                className="action-button"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRename(item);
                }}
              />
              <Button
                className="action-button"
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(item);
                }}
              />
              {/* 其他按钮... */}
            </span>
          </span>
        </span>
      );

      if (item.children) {
        return {
          ...item,
          title,
          children: renderTreeNodes(item.children)
        };
      }

      return {
        ...item,
        title
      };
    });
  };

  return (
    <div className="folder-manager">
      <div className="folder-actions">
        <Space wrap>
          <Button 
            type="primary"
            icon={<FolderAddOutlined />}
            onClick={() => handleCreateFolder()}
          >
            新建文件夹
          </Button>
          <Button
            icon={isAllExpanded ? <CompressOutlined /> : <ExpandOutlined />}
            onClick={handleExpandAll}
          >
            {isAllExpanded ? '折叠全部' : '展开全部'}
          </Button>
          <Button
            danger
            type="primary"
            icon={<DeleteOutlined />}
            onClick={() => setIsDeleteModalVisible(true)}
            disabled={!selectedFolder}
          >
            删除文件夹
          </Button>
        </Space>
      </div>

      <DirectoryTree
        className="folder-tree"
        treeData={folders}
        onSelect={handleSelect}
        draggable
        onDrop={onDrop}
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
        onRightClick={({ node }) => !node.isLeaf && getContextMenu(node)}
        icon={(props) => 
          props.isLeaf ? <FileOutlined /> : <FolderOutlined />
        }
        titleRender={titleRender}
      />

      <Modal
        title="重命名文件夹"
        open={isRenameModalVisible}
        onOk={handleRename}
        onCancel={() => {
          setIsRenameModalVisible(false);
          setRenameValue('');
          setRenamingNode(null);
        }}
        okText="确认"
        cancelText="取消"
        width={400}
        centered
        maskClosable={false}
        className="custom-modal"
      >
        <Input
          placeholder="请输入新的文件夹名称"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          maxLength={30}
          autoFocus
        />
      </Modal>

      <Modal
        title="删除文件夹"
        open={isDeleteModalVisible}
        onOk={handleDeleteFolder}
        onCancel={() => setIsDeleteModalVisible(false)}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        width={400}
        centered
        maskClosable={false}
        className="custom-modal"
      >
        <p>确定要删除该文件夹及其所有内容吗？此操作不可恢复。</p>
      </Modal>
    </div>
  );
};

export default FolderManager;
