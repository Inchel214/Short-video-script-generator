# API 接口文档

> 本文档描述后端 API 的接口规范，供前端开发参考

---

## 一、接口概览

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | `/api/generate` | 生成剧本 | API Key |
| POST | `/api/clear-history` | 清空对话历史 | 无 |
| GET | `/api/health` | 健康检查 | 无 |

---

## 二、接口详情

### 2.1 生成剧本

**端点**
```
POST /api/generate
```

**请求头**
```
Content-Type: application/json
Authorization: Bearer <api_key>   # 可选，优先使用请求体中的 key
```

**请求体**
```json
{
    "images": [
        "base64编码图片1...",
        "base64编码图片2..."
    ],
    "text": "生成一个30秒的温馨风格vlog剧本",
    "api_key": "ark-xxx",        # 可选，未提供则使用环境变量
    "model_name": "doubao-seed-1-6-vision-250815"  # 可选
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| images | string[] | 否 | Base64 编码的图片列表 |
| text | string | 否 | 用户输入的文字要求 |
| api_key | string | 否 | 火山引擎 API 密钥 |
| model_name | string | 否 | 模型名称 |

**说明**：至少提供 images 或 text 之一

**成功响应**
```json
{
    "success": true,
    "result": "【剧本标题】温馨的早餐时光\n\n【总时长】30秒\n\n【分镜列表】\n\n1. 【特写】 0-3秒\n   画面：一杯冒着热气的咖啡\n   旁白：清晨的第一缕阳光...",
    "model": "doubao-seed-1-6-vision-250815"
}
```

**失败响应**
```json
{
    "success": false,
    "error": "请上传图片或输入要求"
}
```

**错误码**
| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | API 密钥无效 |
| 408 | 请求超时 |
| 500 | 服务器内部错误 |
| 502 | 外部 API 服务错误 |

---

### 2.2 清空对话历史

**端点**
```
POST /api/clear-history
```

**请求体**
```json
{}
```

**成功响应**
```json
{
    "success": true,
    "message": "对话历史已清空"
}
```

---

### 2.3 健康检查

**端点**
```
GET /api/health
```

**成功响应**
```json
{
    "status": "ok",
    "timestamp": "2026-06-19T12:00:00Z",
    "version": "1.0.0"
}
```

---

## 三、数据格式

### 3.1 图片格式

前端上传图片时，需要转换为 Base64 编码：

```javascript
// 示例：图片转 Base64
function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 使用
const images = await Promise.all(files.map(imageToBase64));
```

**注意**：不要包含 `data:image/xxx;base64,` 前缀，直接发送 Base64 字符串

### 3.2 错误响应格式

所有错误响应遵循以下格式：

```json
{
    "success": false,
    "error": "错误描述",
    "code": "ERROR_CODE",
    "details": {}  // 可选，详细信息
}
```

---

## 四、调用示例

### 4.1 JavaScript (前端)

```javascript
async function generateScript(images, text, apiKey) {
    try {
        const response = await fetch('http://localhost:5000/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                images: images,
                text: text,
                api_key: apiKey
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.result;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('生成剧本失败:', error);
        throw error;
    }
}
```

### 4.2 Python (后端调用)

```python
import requests

def call_generate_api(images, text, api_key):
    response = requests.post(
        'http://localhost:5000/api/generate',
        json={
            'images': images,
            'text': text,
            'api_key': api_key
        },
        timeout=120
    )
    
    data = response.json()
    
    if data['success']:
        return data['result']
    else:
        raise Exception(data['error'])
```

---

## 五、调试接口

### 5.1 本地测试

```bash
# 测试健康检查
curl http://localhost:5000/api/health

# 测试生成剧本
curl -X POST http://localhost:5000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "生成一个测试剧本"}'
```

### 5.2 日志查看

请求日志会保存在 `logs/` 目录：

```
logs/
└── 2026-06-19.log
```

日志格式：
```
2026-06-19 12:00:00,123 - script_generator - INFO - api.py:45 - 接收到生成剧本请求
2026-06-19 12:00:01,456 - script_generator - DEBUG - agent.py:89 - 开始编码图片
2026-06-19 12:00:02,789 - script_generator - INFO - agent.py:121 - API调用成功
```

---

## 六、版本管理

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-06-19 | 初始版本 |

---

*本文档由 AI 辅助生成，如有疑问请联系开发者*
