"""
Agent 核心逻辑
调用火山引擎 API 生成短视频剧本
"""
import base64
import requests
import os
import json
import re
from . import logger

# 获取日志记录器
log = logger.setup_logger()

# 对话历史管理
conversation_history = []

# 生成取消标志
_cancel_requested = False


def encode_image_from_base64(image_base64):
    """
    验证 base64 图片编码
    
    Args:
        image_base64: base64 编码的图片字符串
    
    Returns:
        str: 原始 base64 字符串
    """
    log.debug(f"验证 base64 图片，长度: {len(image_base64)} 字符")
    
    # 移除可能的前缀
    if ',' in image_base64:
        image_base64 = image_base64.split(',')[1]
    
    # 验证 base64 格式
    try:
        # 尝试解码以验证格式
        decoded = base64.b64decode(image_base64)
        log.debug(f"base64 图片验证成功，大小: {len(decoded)} 字节")
        return image_base64
    except Exception as e:
        log.error(f"base64 图片格式无效: {str(e)}")
        raise ValueError("无效的图片 base64 编码")


def build_messages(image_data_list, text_requirement, shots_count=None):
    """
    构建消息，包含多张图片和文字
    
    Args:
        image_data_list: base64 编码的图片列表
        text_requirement: 用户输入的文字要求
        shots_count: 预期生成的分镜数量（可选）
    
    Returns:
        list: 消息列表
    """
    log.info(f"开始构建消息，图片数量: {len(image_data_list) if image_data_list else 0}, 镜头数量: {shots_count}")
    
    messages = []
    
    # 添加历史对话
    if conversation_history:
        log.debug(f"添加历史对话，条数: {len(conversation_history)}")
        messages.extend(conversation_history)
    
    # 构建当前消息
    content = []
    
    # 添加多张图片
    if image_data_list:
        for i, image_data in enumerate(image_data_list):
            try:
                # 处理可能是文件路径或 base64 的情况
                if os.path.exists(image_data):
                    # 如果是文件路径，读取并编码
                    with open(image_data, 'rb') as f:
                        image_base64 = base64.b64encode(f.read()).decode('utf-8')
                else:
                    # 否则假设是 base64 编码
                    image_base64 = encode_image_from_base64(image_data)
                
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}"
                    }
                })
                log.debug(f"已添加图片 {i+1}/{len(image_data_list)}")
            except Exception as e:
                log.warning(f"跳过图片 {i+1}: {str(e)}")
    
    # 构建镜头数量限制说明
    shots_limit_text = ""
    if shots_count and isinstance(shots_count, int) and shots_count > 0:
        shots_limit_text = f"""\n\n【硬性要求 - 必须遵守】\n你必须严格按照以下规则生成内容：\n1. 分镜列表必须且只能包含 {shots_count} 个分镜，绝对不能多也不能少\n2. 第 {shots_count} 个分镜必须是故事的结尾/收尾镜头\n3. 如果故事内容较多，请精简每个分镜的内容，而不是增加分镜数量\n4. 你返回的JSON中，"分镜列表"数组的长度必须等于 {shots_count}"""
        log.info(f"已设置分镜数量限制: {shots_count}")
    
    # 添加文字
    if text_requirement:
        content.append({
            "type": "text",
            "text": f"""你是一个专业的短视频剧本编剧。请根据以下信息生成一个完整的短视频剧本：

用户要求：{text_requirement}{shots_limit_text}

请严格输出一个纯 JSON 对象，禁止任何解释性文字、禁止 Markdown 代码块、禁止在内容中夹杂额外说明。
输出结构必须满足以下 schema：
{{
  "剧本标题": "字符串",
  "总时长": "字符串",
  "剧情简介": "字符串",
  "人物设定": {{
    "角色名": "角色简介"
  }},
  "分镜列表": [
    {{
      "时长": "字符串",
      "景别": "字符串",
      "画面描述": "字符串",
      "运镜方式": "字符串",
      "旁白/对话": "字符串",
      "音效建议": "字符串"
    }}
  ]
}}

要求：
1. 必须使用标准 JSON 语法，键名要用双引号，字符串值也要用双引号。
2. 分镜列表必须是数组，且长度严格等于 {shots_count}，如果未指定则由你自行决定。
3. 不能把整个剧本包在字符串里，不能输出伪 JSON。
4. 画面描述、旁白/对话、音效建议必须是清晰、可展示的文本。
5. 只返回 JSON，不要包含任何前后缀文字。"""
        })
        log.debug("已添加用户文字要求")
    
    messages.append({"role": "user", "content": content})
    log.info(f"消息构建完成，总长度: {len(messages)}")
    return messages


def generate_script(image_data_list, text_requirement, api_key='', model_name='doubao-seed-1-6-vision-250815', shots_count=None):
    """
    调用火山引擎 API 生成剧本
    
    Args:
        image_data_list: base64 编码的图片列表（支持文件路径或 base64）
        text_requirement: 用户输入的文字要求
        api_key: API 密钥（可选）
        model_name: 模型名称（可选）
    
    Returns:
        dict: 包含结构化结果或错误信息
    """
    global conversation_history, _cancel_requested
    log.info(f"开始生成剧本，图片数量: {len(image_data_list) if image_data_list else 0}")
    log.debug(f"用户要求: {text_requirement[:50]}..." if text_requirement else "无用户文字要求")
    
    _cancel_requested = False
    
    api_key = api_key or os.getenv("ARK_API_KEY")
    base_url = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
    
    if not api_key:
        log.error("API密钥为空")
        return {"error": "请输入API密钥"}
    
    try:
        messages = build_messages(image_data_list, text_requirement, shots_count)
        log.info("消息构建完成，准备调用API")
        
        log.debug(f"调用API: {base_url}/chat/completions")
        log.debug(f"模型: {model_name}")
        
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": model_name,
                "messages": messages,
                "temperature": 0.2,
                "stream": False,
                "response_format": {"type": "json_object"}
            },
            timeout=300
        )
        
        log.debug(f"API响应状态码: {response.status_code}")
        
        if response.status_code != 200:
            result = response.json()
            if "error" in result:
                err = result["error"]
                error_msg = err.get("message", "API调用失败") if isinstance(err, dict) else str(err)
            else:
                error_msg = f"API调用失败，状态码: {response.status_code}"
            log.error(f"API返回错误: {error_msg}")
            return {"error": error_msg}
        
        result_json = response.json()
        content = result_json.get('choices', [{}])[0].get('message', {}).get('content', '')
        if isinstance(content, list):
            content = ''.join([item.get('text', '') for item in content if isinstance(item, dict)])
        
        if _cancel_requested:
            log.info("检测到取消请求")
            return {"error": "生成已停止"}
        
        if not content:
            log.error("API未返回可用内容")
            return {"error": "API未返回可用内容，请检查模型和请求参数"}
        log.info(f"API调用成功，回复内容长度: {len(content)} 字符")
        
        conversation_history.append({"role": "user", "content": text_requirement or "请分析图片"})
        conversation_history.append({"role": "assistant", "content": content})
        log.debug(f"对话历史已更新，当前长度: {len(conversation_history)}")
        
        log.info(f"大模型原始返回内容: {content[:500]}...")
        
        parsed_result = parse_script_content(content)
        log.info(f"解析后的结果: {parsed_result}")
        
        if "error" in parsed_result:
            return parsed_result
        return parsed_result
    
    except requests.exceptions.Timeout:
        log.error("请求超时")
        return {"error": "请求超时，请重试"}
    except requests.exceptions.RequestException as e:
        log.error(f"网络错误: {str(e)}")
        return {"error": f"网络错误: {str(e)}"}
    except KeyError as e:
        log.error(f"API响应格式错误，缺少字段: {str(e)}")
        return {"error": "API响应格式错误"}
    except Exception as e:
        log.error(f"发生未知错误: {str(e)}", exc_info=True)
        return {"error": f"发生错误: {str(e)}"}


def clear_history():
    """
    清空对话历史
    """
    global conversation_history
    log.info("清空对话历史")
    conversation_history = []
    return {"message": "对话历史已清空"}


def cancel_generation():
    """
    请求取消当前生成任务
    """
    global _cancel_requested
    log.info("收到取消生成请求")
    _cancel_requested = True
    return {"message": "已请求停止生成"}


def parse_script_content(content):
    """
    解析 API 返回的内容，提取结构化剧本数据
    
    Args:
        content: API 返回的文本内容
    
    Returns:
        dict: 结构化的剧本数据
    """
    log.info("开始解析剧本内容")
    
    cleaned_content = content.strip()
    if cleaned_content.startswith("```"):
        cleaned_content = re.sub(r'^```(?:json)?\s*|\s*```$', '', cleaned_content, flags=re.MULTILINE)
    
    # 尝试直接解析完整 JSON
    try:
        data = json.loads(cleaned_content)
        log.info("成功解析 JSON 格式剧本")
        return data
    except json.JSONDecodeError as e:
        log.warning(f"JSON 解析失败: {e}")
    
    # 尝试提取 JSON（保底）
    json_match = re.search(r'\{[\s\S]*\}', cleaned_content)
    if json_match:
        try:
            data = json.loads(json_match.group())
            log.info("成功解析 JSON 格式剧本")
            return data
        except json.JSONDecodeError as e:
            log.warning(f"提取后的 JSON 解析失败: {e}")
    
    # 如果不是 JSON，尝试按文本格式解析
    log.info("尝试按文本格式解析剧本")
    
    # 提取剧情简介
    synopsis = ""
    synopsis_match = re.search(r'剧情简介[：:]\s*([\s\S]*?)(?=人物小传|$)', content)
    if synopsis_match:
        synopsis = synopsis_match.group(1).strip()
    
    # 提取人物小传
    characters = ""
    characters_match = re.search(r'人物[设定小传]+[：:]\s*([\s\S]*?)(?=分镜|$)', content)
    if characters_match:
        characters = characters_match.group(1).strip()
    
    # 提取分镜
    shots = []
    shot_pattern = r'(\d+)[.、]\s*([^剧情人物\n][^\n]*)'
    shot_matches = re.findall(shot_pattern, content)
    
    for i, (num, title) in enumerate(shot_matches):
        shots.append({
            "id": i + 1,
            "title": title.strip(),
            "description": f"分镜 {num} 的详细描述",
            "expanded": False
        })
    
    # 如果没有找到分镜，创建一个默认的
    if not shots:
        shots.append({
            "id": 1,
            "title": "剧本内容",
            "description": content[:500] + "..." if len(content) > 500 else content,
            "expanded": True
        })
    
    # 直接返回剧本数据
    return {
        "synopsis": synopsis or content[:300],
        "characters": characters or "暂无人物设定",
        "shots": shots
    }
