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

### 方式二：打包成exe（给非技术人员使用）

1. 安装打包工具：
```bash
pip install pyinstaller
```

2. 打包：
```bash
pyinstaller build.spec
```

3. 打包完成后，在 `dist` 目录下会生成 `短视频剧本生成器.exe`

4. 将以下文件一起发给用户：
   - `短视频剧本生成器.exe`
   - `.env`（配置好API密钥）

用户双击 exe 即可使用。

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