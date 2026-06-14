import base64
import requests
import os
from dotenv import load_dotenv

load_dotenv()

# 对话历史管理
conversation_history = []

def encode_image(image_path):
    """将图片编码为base64"""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

def build_messages(image_paths, text_requirement):
    """构建消息，包含多张图片和文字"""
    messages = []

    # 添加历史对话
    messages.extend(conversation_history)

    # 构建当前消息
    content = []

    # 添加多张图片
    if image_paths:
        for image_path in image_paths:
            image_base64 = encode_image(image_path)
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{image_base64}"
                }
            })

    # 添加文字
    if text_requirement:
        content.append({
            "type": "text",
            "text": f"""你是一个专业的短视频剧本编剧。请根据以下信息生成一个完整的短视频剧本：

用户要求：{text_requirement}

请生成包含以下内容的剧本：
1. 剧本标题
2. 总时长
3. 分镜列表（每个分镜包含：时长、景别、画面描述、运镜方式、旁白/对话、音效建议）

请用JSON格式返回结果。"""
        })

    messages.append({"role": "user", "content": content})
    return messages

def generate_script(image_paths, text_requirement, api_key, model_name):
    """调用火山引擎API生成剧本"""
    global conversation_history

    # 使用用户提供的密钥，或从环境变量获取
    api_key = api_key or os.getenv("ARK_API_KEY")
    model_name = model_name or os.getenv("ARK_MODEL", "doubao-seed-1-6-vision-250815")
    base_url = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")

    if not api_key:
        return {"error": "请输入API密钥"}

    try:
        messages = build_messages(image_paths, text_requirement)

        response = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model_name,
                "messages": messages,
                "temperature": 0.7
            },
            timeout=60
        )

        result = response.json()

        if "error" in result:
            return {"error": result["error"].get("message", "API调用失败")}

        # 提取回复内容
        content = result["choices"][0]["message"]["content"]

        # 保存到对话历史
        conversation_history.append({"role": "user", "content": text_requirement or "请分析图片"})
        conversation_history.append({"role": "assistant", "content": content})

        return {"result": content}

    except requests.exceptions.Timeout:
        return {"error": "请求超时，请重试"}
    except requests.exceptions.RequestException as e:
        return {"error": f"网络错误: {str(e)}"}
    except Exception as e:
        return {"error": f"发生错误: {str(e)}"}

def clear_history():
    """清空对话历史"""
    global conversation_history
    conversation_history = []
    return {"message": "对话历史已清空"}