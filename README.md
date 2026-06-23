# 短视频剧本生成器

基于火山引擎大模型的短视频剧本生成工具，支持上传图片和文字输入，智能生成短视频剧本。

## 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Electron 桌面应用                              │
│  ┌───────────────────────┐   ┌───────────────────────────────┐  │
│  │     前端 (HTML/CSS/JS) │   │     后端 (Python Flask)       │  │
│  │  - 图片上传组件        │   │  - API 接口                   │  │
│  │  - 文字输入组件       │   │  - Agent 逻辑                 │  │
│  │  - 结果展示组件       │   │  - 火山引擎 API 集成          │  │
│  └───────────────────────┘   └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     火山引擎大模型 API
```

## 项目结构

```
drama/
├── src/
│   ├── backend/              # Python 后端
│   │   ├── agent.py          # Agent 核心逻辑
│   │   ├── api.py            # Flask API
│   │   └── logger.py         # 日志配置
│   └── frontend/             # 前端资源
│       ├── index.html        # 主页面
│       ├── styles.css        # 样式
│       ├── app.js            # 交互逻辑
│       └── assets/           # 静态资源
├── electron/                  # Electron 配置
│   └── main.js               # 主进程
├── docs/                     # 文档
│   ├── ARCHITECTURE.md       # 架构文档
│   └── API.md                # API 文档
├── package.json              # Node.js 配置
└── requirements.txt          # Python 依赖
```

## 快速开始

### 方式一：直接运行（开发模式）

#### 1. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

#### 2. 启动 Flask API 服务

```bash
python src/backend/api.py
```

服务将在 `http://127.0.0.1:5000` 启动。

#### 3. 打开前端页面

直接用浏览器打开 `src/frontend/index.html` 文件即可使用。

### 方式二：Electron 桌面应用

#### 1. 安装 Node.js 依赖

```bash
npm install
```

#### 2. 开发模式运行

```bash
npm run electron:dev
```

#### 3. 打包应用

```bash
# Windows
npm run electron:build:win

# macOS
npm run electron:build:mac

# Linux
npm run electron:build:linux
```

打包产物将生成在 `dist/` 目录。

## 使用说明

### 功能特性

- ✅ 支持上传单张或多张图片
- ✅ 支持文字输入要求
- ✅ 智能生成短视频剧本
- ✅ 多轮对话迭代优化
- ✅ 自定义 API 密钥和模型
- ✅ 完整的日志记录

### API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/generate` | 生成剧本 |
| POST | `/api/clear-history` | 清空对话历史 |
| GET | `/api/health` | 健康检查 |

### 配置说明

- **API 密钥**：在界面中输入火山引擎 API 密钥
- **模型名称**：默认为 `doubao-seed-1-6-vision-250815`
- **配置保存**：API 配置会自动保存在浏览器本地

## 日志说明

日志文件保存在项目根目录的 `logs/` 文件夹中，按日期命名：

```
logs/
└── 2026-06-19.log
```

日志格式：

```
2026-06-19 12:00:00,123 - script_generator - INFO - api.py:45 - 接收到生成剧本请求
2026-06-19 12:00:01,456 - script_generator - DEBUG - agent.py:89 - 开始编码图片
```

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | HTML5 + CSS3 + JavaScript | 原生技术，无需框架 |
| 后端 | Python + Flask | 轻量级 Web 框架 |
| AI | 火山引擎 API | doubao-seed-1-6-vision 模型 |
| 桌面 | Electron | 跨平台桌面应用框架 |
| 打包 | electron-builder | Electron 应用打包工具 |

## 开发指南

### 添加新的 API 接口

在 `src/backend/api.py` 中添加：

```python
@app.route('/api/your-endpoint', methods=['POST'])
def your_endpoint():
    data = request.get_json()
    # 处理逻辑
    return jsonify({'success': True, 'result': ...})
```

### 自定义前端组件

在 `src/frontend/index.html` 中添加 HTML 结构，在 `styles.css` 中添加样式，在 `app.js` 中添加交互逻辑。

### 调试日志

日志级别说明：

| 级别 | 说明 |
|------|------|
| DEBUG | 详细信息，通常用于开发 |
| INFO | 一般信息 |
| WARNING | 警告信息 |
| ERROR | 错误信息 |

## 常见问题

### Q: 提示"网络错误"

A: 请确保 Flask API 服务已启动，运行在 `http://127.0.0.1:5000`。

### Q: 打包后无法启动

A: 检查是否正确安装了所有依赖，确保 `node_modules/` 目录存在。

### Q: 图片上传失败

A: 确保图片格式为 JPG 或 PNG，且文件大小适中。

## 许可证

MIT License

## 联系方式

如有问题，请提交 Issue 或联系开发者。
