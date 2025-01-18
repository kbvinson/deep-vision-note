const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  // 创建浏览器窗口
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false
    }
  });

  // 加载应用
  if (isDev) {
    // 开发环境
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools(); // 打开开发者工具
  } else {
    // 生产环境
    mainWindow.loadFile(path.join(__dirname, './dist/index.html'));
  }

  // 调试用：监听页面加载状态
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('An uncaught error occurred:', error);
}); 