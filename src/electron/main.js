/**
 * Electron 主进程
 * 负责启动 Flask 服务、显示前端界面和自动更新
 */
const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

// 开发模式标志
const isDev = process.env.NODE_ENV === 'development';

// 自动更新配置
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

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
 * 获取平台特定的错误消息
 */
function getPlatformErrorMessage() {
    const platform = process.platform;
    if (platform === 'win32') {
        return 'Windows 平台：请确保 api.exe 文件存在于应用目录或 resources 目录中';
    } else if (platform === 'darwin') {
        return 'macOS 平台：请确保 api 文件存在于应用包的 Contents/Resources 目录中';
    } else if (platform === 'linux') {
        return 'Linux 平台：请确保 api 文件存在于 AppImage 解压后的目录中';
    }
    return '未知平台：请确保 API 可执行文件存在';
}

/**
 * 启动 Flask 服务
 */
function startFlaskServer() {
    console.log('启动 Flask 服务...');
    
    const apiName = getApiExecutableName();
    
    // API 可执行文件路径
    // 尝试多个可能的路径
    let apiExePath = null;
    const possiblePaths = [];
    
    // 路径1：打包后的 resources 目录（适用于所有平台）
    if (process.resourcesPath) {
        possiblePaths.push(path.join(process.resourcesPath, apiName));
        // 路径2：portable 模式下可能在 app 根目录（Windows portable）
        possiblePaths.push(path.join(process.resourcesPath, '..', apiName));
        // 路径3：macOS 应用包内的 Frameworks 或 Resources 目录
        possiblePaths.push(path.join(process.resourcesPath, '..', 'Frameworks', apiName));
    }
    
    // 路径4：开发模式路径
    possiblePaths.push(path.join(__dirname, '..', 'backend', 'dist', apiName));
    
    // 路径5：可执行文件所在目录（portable 模式）
    if (process.execPath) {
        const execDir = path.dirname(process.execPath);
        possiblePaths.push(path.join(execDir, apiName));
        // 路径6：portable 模式下可能在 app 目录下
        possiblePaths.push(path.join(execDir, '..', apiName));
    }
    
    // 路径7：当前工作目录
    possiblePaths.push(path.join(process.cwd(), apiName));
    
    // 查找第一个存在的路径
    for (const pathCandidate of possiblePaths) {
        if (fs.existsSync(pathCandidate)) {
            apiExePath = pathCandidate;
            break;
        }
    }
    
    console.log(`[Flask] 平台: ${process.platform}`);
    console.log(`[Flask] 尝试的 API 路径:`);
    possiblePaths.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p} (存在: ${fs.existsSync(p)})`);
    });
    console.log(`[Flask] 找到的 API 路径: ${apiExePath || '未找到'}`);
    console.log(`[Flask] process.resourcesPath: ${process.resourcesPath || 'undefined'}`);
    console.log(`[Flask] process.execPath: ${process.execPath || 'undefined'}`);
    
    // 检查 API 可执行文件是否存在
    if (!apiExePath) {
        const errorMsg = `错误：未找到 API 可执行文件 (${apiName})\n\n${getPlatformErrorMessage()}`;
        console.error(`[Flask] ${errorMsg}`);
        
        // 向主窗口发送错误消息
        if (mainWindow) {
            mainWindow.webContents.send('api-error', {
                message: errorMsg
            });
        }
        
        // 显示对话框提示用户
        const { dialog } = require('electron');
        dialog.showErrorBox('启动失败', errorMsg);
        
        return;
    }
    
    // 确保 API 文件有执行权限（Linux/macOS）
    if (process.platform !== 'win32') {
        try {
            fs.chmodSync(apiExePath, 0o755);
            console.log(`[Flask] 设置 ${apiName} 执行权限成功`);
        } catch (e) {
            console.warn(`[Flask] 设置 ${apiName} 执行权限失败: ${e.message}`);
        }
    }
    
    // 启动 API（直接运行可执行文件，无需 Python）
    const spawnCwd = path.dirname(apiExePath);
    const spawnOptions = {
        cwd: spawnCwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
    };
    
    // macOS 特殊处理：设置环境变量
    if (process.platform === 'darwin') {
        spawnOptions.env = { ...process.env, PATH: `/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}` };
    }
    
    console.log(`[Flask] 启动命令: ${apiExePath}`);
    console.log(`[Flask] 工作目录: ${spawnCwd}`);
    
    flaskProcess = spawn(apiExePath, [], spawnOptions);
    
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

function setupAutoUpdater() {
    if (isDev) {
        console.log('[AutoUpdate] 开发模式，跳过自动更新');
        return;
    }

    autoUpdater.on('checking-for-update', () => {
        console.log('[AutoUpdate] 正在检查更新...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log(`[AutoUpdate] 发现新版本: ${info.version}`);
        
        dialog.showMessageBox({
            type: 'info',
            title: '发现更新',
            message: `版本 ${info.version} 已发布！\n\n更新内容：${info.releaseNotes || '暂无更新说明'}`,
            buttons: ['立即更新', '稍后提醒'],
            defaultId: 0
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.downloadUpdate();
            }
        }).catch((err) => {
            console.error('[AutoUpdate] 显示更新对话框失败:', err);
        });
    });

    autoUpdater.on('update-not-available', () => {
        console.log('[AutoUpdate] 当前已是最新版本');
    });

    autoUpdater.on('download-progress', (progress) => {
        console.log(`[AutoUpdate] 下载进度: ${Math.round(progress.percent)}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[AutoUpdate] 更新下载完成');
        
        dialog.showMessageBox({
            type: 'info',
            title: '更新下载完成',
            message: '更新已下载完成，是否立即重启应用以安装更新？',
            buttons: ['立即重启', '稍后重启'],
            defaultId: 0
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        }).catch((err) => {
            console.error('[AutoUpdate] 显示安装对话框失败:', err);
        });
    });

    autoUpdater.on('error', (error) => {
        console.error('[AutoUpdate] 更新失败:', error);
    });

    console.log('[AutoUpdate] 自动更新模块已初始化');
}

function checkForUpdates() {
    if (isDev) {
        return;
    }
    
    console.log('[AutoUpdate] 开始检查更新');
    autoUpdater.checkForUpdates().catch((err) => {
        console.error('[AutoUpdate] 检查更新失败:', err);
    });
}

function waitForFlaskServer(maxAttempts = 30, delay = 1000) {
    return new Promise((resolve, reject) => {
        const http = require('http');
        let attempts = 0;
        
        const check = () => {
            attempts++;
            console.log(`[Flask] 等待服务就绪... 第 ${attempts} 次尝试`);
            
            const req = http.request({
                hostname: '127.0.0.1',
                port: 5000,
                path: '/api/health',
                method: 'GET',
                timeout: 2000
            }, (res) => {
                if (res.statusCode === 200) {
                    console.log('[Flask] Flask 服务已就绪');
                    resolve();
                } else {
                    if (attempts < maxAttempts) {
                        setTimeout(check, delay);
                    } else {
                        reject(new Error('Flask 服务启动超时'));
                    }
                }
                res.resume();
            });
            
            req.on('error', () => {
                if (attempts < maxAttempts) {
                    setTimeout(check, delay);
                } else {
                    reject(new Error('Flask 服务启动超时'));
                }
            });
            
            req.on('timeout', () => {
                req.destroy();
                if (attempts < maxAttempts) {
                    setTimeout(check, delay);
                } else {
                    reject(new Error('Flask 服务启动超时'));
                }
            });
            
            req.end();
        };
        
        setTimeout(check, 1000);
    });
}

// 应用准备就绪
app.whenReady().then(async () => {
    console.log('Electron 应用准备就绪');
    
    // 初始化自动更新
    setupAutoUpdater();
    
    // 启动 Flask 服务
    startFlaskServer();
    
    try {
        // 等待 Flask 服务就绪
        await waitForFlaskServer();
        
        // 创建窗口
        createWindow();
        
        // 窗口创建后检查更新
        setTimeout(() => {
            checkForUpdates();
        }, 3000);
    } catch (error) {
        console.error('[Flask] 等待服务就绪失败:', error.message);
        
        dialog.showErrorBox('启动失败', 'Flask 服务启动超时，请检查网络连接或重新启动应用');
        
        app.quit();
    }
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
