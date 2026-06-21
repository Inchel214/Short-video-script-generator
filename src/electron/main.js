/**
 * Electron 主进程
 * 负责启动 Flask 服务和显示前端界面
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// 开发模式标志
const isDev = process.env.NODE_ENV === 'development';

// Flask 服务进程
let flaskProcess = null;

// 主窗口
let mainWindow = null;

/**
 * 创建主窗口
 */
function createWindow() {
    console.log('创建主窗口');
    
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        title: '短视频剧本生成器',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: false
        },
        show: false
    });
    
    // 加载前端页面
    const frontendPath = path.join(__dirname, '..', 'frontend');
    
    if (isDev) {
        // 开发模式：从文件系统加载
        mainWindow.loadFile(path.join(frontendPath, 'index.html'));
    } else {
        // 生产模式：从打包的资源加载
        mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'index.html'));
    }
    
    // 窗口准备好后显示
    mainWindow.once('ready-to-show', () => {
        console.log('窗口准备好，显示');
        mainWindow.show();
    });
    
    // 窗口关闭时退出应用
    mainWindow.on('closed', () => {
        console.log('窗口关闭');
        mainWindow = null;
    });
}

/**
 * 获取后端 API 可执行文件名称
 */
function getApiExecutableName() {
    if (process.platform === 'win32') {
        return 'api.exe';
    } else {
        return 'api';
    }
}

/**
 * 启动 Flask 服务
 */
function startFlaskServer() {
    console.log('启动 Flask 服务...');
    
    const apiName = getApiExecutableName();
    
    // API 可执行文件路径
    // 打包后：api 通过 extraResources 放在 resources 目录下
    // 开发模式：从 src/backend/dist 目录查找
    let apiExePath;
    if (process.resourcesPath) {
        // 打包后的路径：resources/api
        apiExePath = path.join(process.resourcesPath, apiName);
    } else {
        // 开发模式路径
        apiExePath = path.join(__dirname, '..', 'backend', 'dist', apiName);
    }
    
    console.log(`API 路径: ${apiExePath}`);
    console.log(`API 是否存在: ${fs.existsSync(apiExePath)}`);
    console.log(`process.resourcesPath: ${process.resourcesPath || 'undefined'}`);
    
    // 启动 API（直接运行可执行文件，无需 Python）
    const spawnCwd = process.resourcesPath || path.join(__dirname, '../..');
    flaskProcess = spawn(apiExePath, [], {
        cwd: spawnCwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
    });
    
    // 监听 Flask 输出
    flaskProcess.stdout.on('data', (data) => {
        console.log(`[Flask] ${data}`);
    });
    
    flaskProcess.stderr.on('data', (data) => {
        console.error(`[Flask Error] ${data}`);
    });
    
    flaskProcess.on('error', (error) => {
        console.error('启动 Flask 失败:', error);
    });
    
    flaskProcess.on('exit', (code) => {
        console.log(`Flask 进程退出，退出码: ${code}`);
    });
    
    console.log('Flask 服务已启动');
}

/**
 * 停止 Flask 服务
 */
function stopFlaskServer() {
    if (flaskProcess) {
        console.log('停止 Flask 服务');
        
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', flaskProcess.pid, '/f', '/t']);
        } else {
            flaskProcess.kill('SIGTERM');
        }
        
        flaskProcess = null;
    }
}

// 应用准备就绪
app.whenReady().then(() => {
    console.log('Electron 应用准备就绪');
    
    // 启动 Flask 服务
    startFlaskServer();
    
    // 创建窗口
    createWindow();
});

// 所有窗口关闭
app.on('window-all-closed', () => {
    console.log('所有窗口已关闭');
    
    // 停止 Flask 服务
    stopFlaskServer();
    
    // macOS 除外
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// macOS 点击 Dock 图标
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// 应用退出前清理
app.on('before-quit', () => {
    console.log('应用即将退出');
    stopFlaskServer();
});

// 未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的 Promise 拒绝:', reason);
});
