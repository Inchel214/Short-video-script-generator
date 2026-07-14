"""
Agent 核心逻辑
调用火山引擎 API 生成短视频剧本
"""
import base64
import requests
import os
import json
import re
import time
from . import logger

# 获取日志记录器
log = logger.setup_logger()


class MemoryManager:
    """
    记忆管理器
    负责管理短期记忆（对话历史）、场景记忆（当前剧本）和长期记忆（用户偏好）
    """
    
    def __init__(self, max_history=20):
        """
        初始化记忆管理器
        
        Args:
            max_history: 最大对话历史条数
        """
        self.max_history = max_history
        self._short_term_memory = []
        self._scene_memory = {
            "synopsis": "",
            "characters": "",
            "shots": [],
            "last_update_time": None
        }
        self._long_term_memory = {}
        self._cancel_requested = False
        
        self._load_long_term_memory()
    
    def _load_long_term_memory(self):
        """
        从文件加载长期记忆
        """
        try:
            memory_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'memory.json')
            if os.path.exists(memory_file):
                with open(memory_file, 'r', encoding='utf-8') as f:
                    self._long_term_memory = json.load(f)
                log.info("长期记忆加载成功")
            else:
                log.info("长期记忆文件不存在，将创建新文件")
        except Exception as e:
            log.warning(f"加载长期记忆失败: {e}")
    
    def _save_long_term_memory(self):
        """
        保存长期记忆到文件
        """
        try:
            memory_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'memory.json')
            with open(memory_file, 'w', encoding='utf-8') as f:
                json.dump(self._long_term_memory, f, ensure_ascii=False, indent=2)
            log.debug("长期记忆保存成功")
        except Exception as e:
            log.warning(f"保存长期记忆失败: {e}")
    
    def add_short_term_memory(self, role, content):
        """
        添加短期记忆（对话历史）
        
        Args:
            role: 角色（user/assistant）
            content: 内容
        """
        self._short_term_memory.append({
            "role": role,
            "content": content,
            "timestamp": time.time()
        })
        
        if len(self._short_term_memory) > self.max_history:
            self._short_term_memory = self._short_term_memory[-self.max_history:]
        
        log.debug(f"短期记忆已更新，当前条数: {len(self._short_term_memory)}")
    
    def get_short_term_memory(self):
        """
        获取短期记忆（对话历史）
        
        Returns:
            list: 对话历史列表
        """
        return [{"role": item["role"], "content": item["content"]} 
                for item in self._short_term_memory]
    
    def clear_short_term_memory(self):
        """
        清空短期记忆（对话历史）
        """
        self._short_term_memory = []
        log.info("短期记忆已清空")
    
    def update_scene_memory(self, script_data):
        """
        更新场景记忆（当前剧本）
        
        Args:
            script_data: 剧本数据
        """
        self._scene_memory = {
            "synopsis": script_data.get("synopsis", script_data.get("剧情简介", "")),
            "characters": script_data.get("characters", script_data.get("人物设定", "")),
            "shots": script_data.get("shots", script_data.get("分镜列表", [])),
            "last_update_time": time.time()
        }
        log.info(f"场景记忆已更新，分镜数量: {len(self._scene_memory['shots'])}")
    
    def get_scene_memory(self):
        """
        获取场景记忆（当前剧本）
        
        Returns:
            dict: 当前剧本状态
        """
        return self._scene_memory
    
    def has_scene_memory(self):
        """
        检查是否有场景记忆
        
        Returns:
            bool: 是否有剧本数据
        """
        return len(self._scene_memory.get("shots", [])) > 0
    
    def update_long_term_memory(self, key, value):
        """
        更新长期记忆（用户偏好）
        
        Args:
            key: 键名
            value: 值
        """
        self._long_term_memory[key] = value
        self._save_long_term_memory()
        log.debug(f"长期记忆已更新: {key}")
    
    def get_long_term_memory(self, key=None):
        """
        获取长期记忆（用户偏好）
        
        Args:
            key: 键名（可选，不提供则返回全部）
        
        Returns:
            dict/any: 长期记忆数据
        """
        if key is None:
            return self._long_term_memory
        return self._long_term_memory.get(key)
    
    def request_cancel(self):
        """
        请求取消生成任务
        """
        self._cancel_requested = True
        log.info("收到取消生成请求")
    
    def is_cancel_requested(self):
        """
        检查是否有取消请求
        
        Returns:
            bool: 是否已请求取消
        """
        return self._cancel_requested
    
    def reset_cancel(self):
        """
        重置取消标志
        """
        self._cancel_requested = False


memory_manager = MemoryManager()


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
    构建发送给大模型的消息
    
    Args:
        image_data_list: 图片数据列表
        text_requirement: 用户文字要求
        shots_count: 镜头数量
        
    Returns:
        list: 消息列表
    """
    log.info(f"开始构建消息，图片数量: {len(image_data_list) if image_data_list else 0}, 镜头数量: {shots_count}")
    
    messages = []
    
    messages.append({
        "role": "system",
        "content": "你是一个专业的短视频剧本编剧。请严格输出一个纯 JSON 对象，禁止任何解释性文字、禁止 Markdown 代码块。JSON 键名必须使用双引号。"
    })
    
    short_term_memory = memory_manager.get_short_term_memory()
    if short_term_memory:
        log.debug(f"添加历史对话，条数: {len(short_term_memory)}")
        messages.extend(short_term_memory)
    
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
      "主题": "字符串",
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
    log.info(f"开始生成剧本，图片数量: {len(image_data_list) if image_data_list else 0}")
    log.debug(f"用户要求: {text_requirement[:50]}..." if text_requirement else "无用户文字要求")
    
    memory_manager.reset_cancel()
    
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
                "stream": False
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
        
        if memory_manager.is_cancel_requested():
            log.info("检测到取消请求")
            return {"error": "生成已停止"}
        
        if not content:
            log.error("API未返回可用内容")
            return {"error": "API未返回可用内容，请检查模型和请求参数"}
        log.info(f"API调用成功，回复内容长度: {len(content)} 字符")
        
        memory_manager.add_short_term_memory("user", text_requirement or "请分析图片")
        memory_manager.add_short_term_memory("assistant", content)
        log.debug(f"对话历史已更新")
        
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
    log.info("清空对话历史")
    memory_manager.clear_short_term_memory()
    return {"message": "对话历史已清空"}


def cancel_generation():
    """
    请求取消当前生成任务
    """
    log.info("收到取消生成请求")
    memory_manager.request_cancel()
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
        return normalize_script_data(data)
    except json.JSONDecodeError as e:
        log.warning(f"JSON 解析失败: {e}")
    
    # 尝试提取 JSON（保底）
    json_match = re.search(r'\{[\s\S]*\}', cleaned_content)
    if json_match:
        try:
            data = json.loads(json_match.group())
            log.info("成功解析 JSON 格式剧本")
            return normalize_script_data(data)
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


def normalize_script_data(data):
    """
    标准化剧本数据，确保包含中英文两种键名
    
    Args:
        data: 原始剧本数据
    
    Returns:
        dict: 标准化后的剧本数据
    """
    log.info("开始标准化剧本数据")
    
    normalized = {}
    
    normalized['synopsis'] = data.get('synopsis', '') or data.get('剧情简介', '')
    normalized['剧情简介'] = normalized['synopsis']
    
    characters = data.get('characters', '') or data.get('人物设定', '')
    if isinstance(characters, dict):
        characters = '\n'.join([f'{name}：{desc}' for name, desc in characters.items()])
    normalized['characters'] = characters
    normalized['人物设定'] = characters
    
    shots = data.get('shots', []) or data.get('分镜列表', [])
    if not isinstance(shots, list):
        shots = []
    
    normalized_shots = []
    for idx, shot in enumerate(shots):
        if not isinstance(shot, dict):
            continue
        
        shot_normalized = {
            'id': shot.get('id', idx + 1),
            'title': shot.get('title', '') or shot.get('主题', '') or shot.get('标题', ''),
            '主题': shot.get('主题', '') or shot.get('title', '') or shot.get('标题', ''),
            'description': shot.get('description', '') or shot.get('画面描述', ''),
            '画面描述': shot.get('画面描述', '') or shot.get('description', ''),
            'duration': shot.get('duration', '') or shot.get('时长', ''),
            '时长': shot.get('时长', '') or shot.get('duration', ''),
            'scene': shot.get('scene', '') or shot.get('景别', ''),
            '景别': shot.get('景别', '') or shot.get('scene', ''),
            'camera': shot.get('camera', '') or shot.get('运镜方式', ''),
            '运镜方式': shot.get('运镜方式', '') or shot.get('camera', ''),
            'dialogue': shot.get('dialogue', '') or shot.get('旁白/对话', ''),
            '旁白/对话': shot.get('旁白/对话', '') or shot.get('dialogue', ''),
            'soundEffect': shot.get('soundEffect', '') or shot.get('音效建议', ''),
            '音效建议': shot.get('音效建议', '') or shot.get('soundEffect', ''),
            'expanded': shot.get('expanded', True)
        }
        normalized_shots.append(shot_normalized)
    
    normalized['shots'] = normalized_shots
    normalized['分镜列表'] = normalized_shots
    
    log.info(f"标准化完成，分镜数量: {len(normalized_shots)}")
    
    return normalized


def build_chat_messages(message):
    """
    构建聊天消息（包含上下文和历史）
    
    Args:
        message: 用户输入的消息
    
    Returns:
        list: 消息列表
    """
    log.info(f"开始构建聊天消息，消息长度: {len(message)}")
    
    messages = []
    
    system_content = """你是一个专业的短视频剧本编剧。请严格输出一个纯 JSON 对象，禁止任何解释性文字、禁止 Markdown 代码块。JSON 键名必须使用双引号。

当用户要求修改剧本时，请按照以下规则回复：
1. 无论用户是修改分镜还是进行任何与剧本相关的操作，都必须输出修改后的完整剧本结构（JSON格式），包含所有分镜
2. 修改后的剧本必须包含完整的结构：剧情简介、人物设定、分镜列表（每个分镜包含主题、时长、景别、画面描述、运镜方式、旁白/对话、音效建议）

请根据当前剧本上下文进行修改，不要要求用户重新提供原剧本。

输出结构必须满足以下 schema：
{
  "剧情简介": "字符串",
  "人物设定": {
    "角色名": "角色简介"
  },
  "分镜列表": [
    {
      "主题": "字符串",
      "时长": "字符串",
      "景别": "字符串",
      "画面描述": "字符串",
      "运镜方式": "字符串",
      "旁白/对话": "字符串",
      "音效建议": "字符串"
    }
  ]
}

要求：
1. 必须使用标准 JSON 语法，键名要用双引号，字符串值也要用双引号。
2. 分镜列表必须是数组。
3. 不能把整个剧本包在字符串里，不能输出伪 JSON。
4. 画面描述、旁白/对话、音效建议必须是清晰、可展示的文本。
5. 只返回 JSON，不要包含任何前后缀文字。"""
    
    scene_memory = memory_manager.get_scene_memory()
    if memory_manager.has_scene_memory():
        script_summary = f"""【当前剧本上下文】
剧情简介：{scene_memory["synopsis"]}
人物设定：{scene_memory["characters"]}

分镜列表：
"""
        for i, shot in enumerate(scene_memory["shots"], 1):
            script_summary += f"""第{i}镜：{shot.get('title', shot.get('主题', ''))}
- 时长：{shot.get('时长', shot.get('duration', ''))}
- 景别：{shot.get('景别', shot.get('scene', ''))}
- 画面描述：{shot.get('画面描述', shot.get('description', ''))}
- 运镜方式：{shot.get('运镜方式', shot.get('camera', ''))}
- 旁白/对话：{shot.get('旁白/对话', shot.get('dialogue', ''))}
- 音效建议：{shot.get('音效建议', shot.get('soundEffect', ''))}

"""
        
        system_content = f"{system_content}\n\n{script_summary}"
    
    messages.append({
        "role": "system",
        "content": system_content
    })
    
    short_term_memory = memory_manager.get_short_term_memory()
    if short_term_memory:
        log.debug(f"添加历史对话，条数: {len(short_term_memory)}")
        messages.extend(short_term_memory)
    
    messages.append({"role": "user", "content": message})
    
    log.info(f"聊天消息构建完成，总长度: {len(messages)}")
    return messages


def chat(message, api_key='', model_name='doubao-seed-1-6-vision-250815'):
    """
    聊天接口
    
    Args:
        message: 用户消息
        api_key: API密钥
        model_name: 模型名称
    
    Returns:
        dict: 响应结果
    """
    log.info(f"开始聊天，消息长度: {len(message)}")
    
    api_key = api_key or os.getenv("ARK_API_KEY")
    base_url = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
    
    if not api_key:
        log.error("API密钥为空")
        return {"error": "请输入API密钥"}
    
    try:
        messages = build_chat_messages(message)
        
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
                "temperature": 0.7,
                "stream": False
            },
            timeout=120
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
        
        if not content:
            log.error("API未返回可用内容")
            return {"error": "API未返回可用内容"}
        
        log.info(f"聊天响应成功，内容长度: {len(content)}")
        log.info(f"聊天响应内容前500字符: {content[:500]}")
        
        memory_manager.add_short_term_memory("user", message)
        memory_manager.add_short_term_memory("assistant", content)
        
        log.debug("对话历史已更新")
        
        parsed_result = parse_script_content(content)
        log.info(f"解析结果: {parsed_result}")
        
        if parsed_result and parsed_result.get('shots'):
            shots = parsed_result['shots']
            has_valid_script = False
            
            if len(shots) > 1:
                has_valid_script = True
            elif len(shots) == 1:
                shot = shots[0]
                if shot.get('description') or shot.get('duration') or shot.get('scene') or shot.get('camera') or shot.get('dialogue') or shot.get('soundEffect'):
                    has_valid_script = True
            
            if has_valid_script:
                log.info("聊天响应包含剧本数据，更新场景记忆")
                memory_manager.update_scene_memory(parsed_result)
                
                normalized_script = normalize_script_data(parsed_result)
                log.info(f"返回更新后的剧本，分镜数量: {len(normalized_script['shots'])}")
                return {"success": True, "response": content, "updated_script": normalized_script}
            else:
                log.info("聊天响应不包含有效的剧本数据，不更新场景记忆")
        
        scene_memory = memory_manager.get_scene_memory()
        normalized_memory = normalize_script_data(scene_memory)
        log.info(f"返回当前场景记忆，分镜数量: {len(normalized_memory['shots'])}")
        return {"success": True, "response": content, "updated_script": normalized_memory}
    
    except requests.exceptions.Timeout:
        log.error("请求超时")
        return {"error": "请求超时，请重试"}
    except requests.exceptions.RequestException as e:
        log.error(f"网络错误: {str(e)}")
        return {"error": f"网络错误: {str(e)}"}
    except Exception as e:
        log.error(f"发生未知错误: {str(e)}", exc_info=True)
        return {"error": f"发生错误: {str(e)}"}


def update_script(script_data):
    """
    更新当前剧本状态（场景记忆）
    
    Args:
        script_data: 剧本数据
    
    Returns:
        dict: 更新结果
    """
    log.info("更新当前剧本状态")
    
    memory_manager.update_scene_memory(script_data)
    
    scene_memory = memory_manager.get_scene_memory()
    log.info(f"剧本状态已更新，分镜数量: {len(scene_memory['shots'])}")
    return {"success": True, "message": "剧本状态已更新"}
