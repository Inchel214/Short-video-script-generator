# 短视频剧本生成器

一键生成短视频剧本的工具。

## 使用方法

### 方式一：直接运行（需要Python环境）

1. 安装依赖：
```bash
pip install -r requirements.txt
```

2. 配置API密钥：
复制 `.env.example` 为 `.env`，填入你的火山引擎API密钥。

3. 运行：
```bash
python app.py
```
或双击 `启动.bat`

---

### 方式二：打包成桌面程序（给非技术人员使用）

1. 安装打包工具：
```bash
pip install pyinstaller
```

2. 打包：
```bash
pyinstaller build.spec
```

3. 打包完成后，在 `dist` 目录下会生成对应平台的程序文件

4. 将以下文件一起发给用户：
   - Windows：`短视频剧本生成器.exe`
   - macOS 通用版（推荐）：`dist/短视频剧本生成器_universal2/短视频剧本生成器`（同时支持Intel和Apple Silicon）
   - macOS Intel 专用：`dist/短视频剧本生成器_x86_64/短视频剧本生成器`
   - macOS Apple Silicon 专用：`dist/短视频剧本生成器_arm64/短视频剧本生成器`
   - `.env`（配置好API密钥）

**推荐使用 `mac-build-universal2` 版本**，它可以在Intel和Apple Silicon两种Mac上原生运行。

> 如果你在 Mac 上看到 `bad CPU type in executable`，说明架构不匹配：
> - 使用 `mac-build-universal2` 可以解决此问题（推荐）
> - 或选择和你Mac芯片架构匹配的专用版本：
>   - 旧款Intel Mac：选用 `mac-build-intel` 或 `mac-build-universal2`
>   - M1/M2/M3 Apple Silicon：选用 `mac-build-arm64` 或 `mac-build-universal2`

---

## 配置说明

在 `.env` 文件中配置：

```
ARK_API_KEY=你的API密钥
ARK_MODEL=doubao-seed-1-6-vision-250815
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

---

## 功能

- 上传图片 + 文字要求 → 生成短视频剧本
- 支持多轮对话迭代优化
- 一键清空对话历史