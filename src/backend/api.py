"""
Flask API 服务
提供 HTTP 接口供前端调用 Agent 逻辑
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from src.backend import agent
from src.backend import logger
import json
import os

import os

frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend')

app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
CORS(app)

# 获取日志记录器
log = logger.setup_logger()


def api_response(data=None, error=None, status=200):
    """
    统一响应格式
    
    Args:
        data: 成功响应数据
        error: 错误信息
        status: HTTP 状态码
    
    Returns:
        Response: Flask 响应对象
    """
    if error:
        response_data = {
            'success': False,
            'error': error
        }
    else:
        response_data = {
            'success': True,
            'data': data
        }
    resp = jsonify(response_data)
    resp.status_code = status
    return resp


@app.errorhandler(400)
def bad_request(error):
    """
    处理 400 错误
    """
    return api_response(error=str(error), status=400)


@app.errorhandler(404)
def not_found(error):
    """
    处理 404 错误
    """
    return api_response(error=str(error), status=404)


@app.errorhandler(500)
def internal_error(error):
    """
    处理 500 错误
    """
    log.error(f"内部服务器错误: {str(error)}", exc_info=True)
    return api_response(error="服务器内部错误，请稍后重试", status=500)


@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/api/health', methods=['GET'])
def health_check():
    """
    健康检查接口
    """
    log.info("接收到健康检查请求")
    return api_response(data={'status': 'ok', 'message': '服务正常运行'})


@app.route('/api/generate', methods=['POST'])
def generate_script():
    """
    生成剧本接口
    
    请求体:
    {
        "images": ["base64编码图片..."],
        "text": "用户要求",
        "api_key": "API密钥（可选）",
        "model_name": "模型名称（可选）"
    }
    
    响应:
    {
        "success": true,
        "result": "剧本内容" | "error": "错误信息"
    }
    """
    log.info("接收到生成剧本请求")
    
    try:
        # 解析请求数据
        data = request.get_json()
        log.info(f"DEBUG: request.get_json() type={type(data)}, value={repr(data)[:200]}")
        
        if not data:
            log.warning("请求体为空")
            return api_response(error='请求体不能为空', status=400)
        
        if not isinstance(data, dict):
            log.error(f"请求体格式错误，期望 dict，实际为 {type(data)}")
            return api_response(error=f'请求体格式错误，期望 JSON 对象，实际为 {type(data).__name__}', status=400)
        
        # 获取参数
        images = data.get('images', [])
        text = data.get('text', '')
        api_key = data.get('api_key', '')
        model_name = data.get('model_name', 'doubao-seed-1-6-vision-250815')
        shots_count = data.get('shots_count')  # 可选，不提供则由AI自动判断
        
        log.info(f"请求参数：图片数量={len(images)}, 文字长度={len(text)}, 模型={model_name}, 镜头数量={shots_count}")
        log.info(f"DEBUG: shots_count type={type(shots_count)}, value={shots_count}, is_int={isinstance(shots_count, int)}")
        log.info(f"DEBUG: request body keys={list(data.keys())}")
        log.info(f"DEBUG: full shots_count value from request={repr(data.get('shots_count'))}")
        
        # 至少需要图片或文字之一
        if not images and not text:
            log.warning("未提供图片或文字")
            return api_response(error='请上传图片或输入要求', status=400)
        
        # 调用 Agent 生成剧本
        log.info("开始调用 Agent 生成剧本")
        
        # 调用真正的 agent 生成剧本
        result = agent.generate_script(
            image_data_list=images,
            text_requirement=text,
            api_key=api_key,
            model_name=model_name,
            shots_count=shots_count
        )
        
        log.info(f"DEBUG: agent.generate_script() returned type={type(result)}, is_dict={isinstance(result, dict)}")
        if not isinstance(result, dict):
            log.error(f"Agent 返回格式错误，期望 dict，实际为 {type(result)}: {repr(result)[:200]}")
            return api_response(error=f'Agent 返回格式错误: {type(result).__name__}', status=500)
        
        # 处理结果
        if 'error' in result:
            log.error(f"生成剧本失败：{result['error']}")
            return api_response(error=result['error'], status=500)
        
        log.info("剧本生成成功，即将返回给前端")
        log.info(f"原始返回数据: {result}")
        
        # 转换字段名：支持中英文键名
        def try_parse_json_value(value):
            if isinstance(value, str):
                raw = value.strip()
                if raw.startswith('```'):
                    raw = raw.strip('`')
                    if raw.startswith('json'):
                        raw = raw[4:].strip()
                try:
                    return json.loads(raw)
                except Exception:
                    return value
            return value

        parsed_result = try_parse_json_value(result)
        if isinstance(parsed_result, dict):
            result = parsed_result

        shots = result.get('shots', result.get('分镜列表', result.get('分镜', [])))
        shots = try_parse_json_value(shots)
        if not isinstance(shots, list):
            shots = []

        normalized_shots = []
        for idx, shot in enumerate(shots):
            if not isinstance(shot, dict):
                continue
            normalized_shots.append({
                'id': shot.get('id', idx + 1),
                'title': shot.get('title', shot.get('主题', shot.get('标题', ''))),
                'description': shot.get('description', shot.get('画面描述', '')),
                '时长': shot.get('时长', shot.get('duration', '')),
                '景别': shot.get('景别', shot.get('scene', '')),
                '画面描述': shot.get('画面描述', shot.get('description', '')),
                '运镜方式': shot.get('运镜方式', shot.get('camera', '')),
                '旁白/对话': shot.get('旁白/对话', shot.get('dialogue', '')),
                '音效建议': shot.get('音效建议', shot.get('soundEffect', '')),
                'expanded': shot.get('expanded', True),
                '主题': shot.get('主题', '')
            })
        shots = normalized_shots

        original_shots_count = len(shots)
        log.info(f"DEBUG: 截断检查 - shots_count={shots_count}, type={type(shots_count)}, original_shots_count={original_shots_count}")
        log.info(f"DEBUG: 截断条件判断 - shots_count truthy={bool(shots_count)}, is_int={isinstance(shots_count, int)}, shots_count>0={shots_count > 0 if isinstance(shots_count, (int, float)) else 'N/A'}, original>shots={original_shots_count > shots_count if isinstance(shots_count, (int, float)) else 'N/A'}")
        
        if shots_count and isinstance(shots_count, int) and shots_count > 0:
            if original_shots_count > shots_count:
                log.warning(f"AI返回分镜数量({original_shots_count})超过限制({shots_count})，进行截断")
                shots = shots[:shots_count]
            elif original_shots_count < shots_count:
                log.warning(f"AI返回分镜数量({original_shots_count})不足限制({shots_count})，进行补足")
                while len(shots) < shots_count:
                    shots.append({
                        'id': len(shots) + 1,
                        'title': f'补充分镜 {len(shots) + 1}',
                        'description': '根据要求补充的镜头内容。',
                        '时长': '',
                        '景别': '',
                        '画面描述': '根据要求补充的镜头内容。',
                        '运镜方式': '',
                        '旁白/对话': '',
                        '音效建议': '',
                        'expanded': True
                    })
            log.info(f"截断/补足后分镜数量: {len(shots)}")
        else:
            log.info(f"DEBUG: 截断条件不满足，不执行截断")
        
        synopsis_value = result.get('synopsis', '') or result.get('剧情简介', '') or result.get('剧情简介和人物设定', {}).get('剧情简介', '')
        characters_value = result.get('characters', '') or result.get('人物设定', '') or result.get('剧情简介和人物设定', {}).get('人物设定', '')
        synopsis_value = try_parse_json_value(synopsis_value)
        if isinstance(synopsis_value, dict):
            synopsis_value = synopsis_value.get('剧情简介', '') or synopsis_value.get('synopsis', '')
        characters_value = try_parse_json_value(characters_value)
        if isinstance(characters_value, dict):
            characters_value = '\n'.join([f'{name}：{desc}' for name, desc in characters_value.items()])
        
        transformed_result = {
            'synopsis': synopsis_value,
            'characters': characters_value,
            'shots': shots
        }
        log.info(f"转换后的数据: synopsis长度={len(transformed_result['synopsis'])}, shots数量={len(transformed_result['shots'])}")
        
        # 返回正确格式的数据
        return api_response(data=transformed_result)
        
    except Exception as e:
        log.error(f"生成剧本时发生异常：{str(e)}", exc_info=True)
        return api_response(error=f'服务器错误：{str(e)}', status=500)


@app.route('/api/clear', methods=['POST'])
@app.route('/api/clear-history', methods=['POST'])
def clear_history():
    """
    清空对话历史
    """
    log.info("接收到清空对话历史请求")
    
    try:
        agent.clear_history()
        log.info("对话历史已清空")
        return api_response(data={'message': '对话历史已清空'})
    except Exception as e:
        log.error(f"清空对话历史失败：{str(e)}", exc_info=True)
        return api_response(error=str(e), status=500)


@app.route('/api/stop', methods=['POST'])
def stop_generation():
    """
    停止当前生成任务
    """
    log.info("接收到停止生成请求")
    
    try:
        agent.cancel_generation()
        log.info("已请求停止生成")
        return api_response(data={'message': '已请求停止生成'})
    except Exception as e:
        log.error(f"停止生成失败：{str(e)}", exc_info=True)
        return api_response(error=str(e), status=500)


@app.route('/api/chat', methods=['POST'])
def chat():
    """
    聊天接口
    
    请求体:
    {
        "message": "用户消息",
        "api_key": "API密钥（可选）",
        "model_name": "模型名称（可选）"
    }
    
    响应:
    {
        "success": true,
        "data": {"response": "AI回复内容", "script": {完整剧本数据}} | "error": "错误信息"
    }
    """
    log.info("接收到聊天请求")
    
    try:
        data = request.get_json()
        
        if not data or not isinstance(data, dict):
            log.warning("请求体为空或格式错误")
            return api_response(error='请求体格式错误', status=400)
        
        message = data.get('message', '').strip()
        api_key = data.get('api_key', '')
        model_name = data.get('model_name', 'doubao-seed-1-6-vision-250815')
        
        if not message:
            log.warning("消息内容为空")
            return api_response(error='消息内容不能为空', status=400)
        
        log.info(f"聊天消息长度: {len(message)}")
        
        result = agent.chat(message, api_key, model_name)
        
        if 'error' in result:
            log.error(f"聊天失败：{result['error']}")
            return api_response(error=result['error'], status=500)
        
        log.info("聊天成功")
        
        updated_script = result.get('updated_script')
        log.info(f"updated_script 类型: {type(updated_script)}")
        log.info(f"updated_script 是否有值: {updated_script is not None}")
        
        if updated_script:
            shots_count = len(updated_script.get('shots', []))
            log.info(f"返回的剧本包含 {shots_count} 个分镜")
            
            script_to_return = {
                'synopsis': updated_script.get('synopsis', '') or updated_script.get('剧情简介', ''),
                'characters': updated_script.get('characters', '') or updated_script.get('人物设定', ''),
                'shots': updated_script.get('shots', []) or updated_script.get('分镜列表', [])
            }
            
            return api_response(data={
                'response': result['response'],
                'script': script_to_return
            })
        
        scene_memory = agent.memory_manager.get_scene_memory()
        shots_count = len(scene_memory.get('shots', []))
        log.info(f"返回场景记忆，包含 {shots_count} 个分镜")
        
        return api_response(data={
            'response': result['response'],
            'script': scene_memory
        })
    
    except Exception as e:
        log.error(f"聊天时发生异常：{str(e)}", exc_info=True)
        return api_response(error=f'服务器错误：{str(e)}', status=500)


@app.route('/api/update-script', methods=['POST'])
def update_script():
    """
    更新当前剧本状态（场景记忆）
    
    请求体:
    {
        "synopsis": "剧情简介",
        "characters": "人物设定",
        "shots": []
    }
    
    响应:
    {
        "success": true,
        "data": {"message": "更新成功"} | "error": "错误信息"
    }
    """
    log.info("接收到更新剧本状态请求")
    
    try:
        data = request.get_json()
        
        if not data or not isinstance(data, dict):
            log.warning("请求体为空或格式错误")
            return api_response(error='请求体格式错误', status=400)
        
        agent.update_script(data)
        
        log.info("剧本状态更新成功")
        return api_response(data={'message': '剧本状态已更新'})
    
    except Exception as e:
        log.error(f"更新剧本时发生异常：{str(e)}", exc_info=True)
        return api_response(error=f'服务器错误：{str(e)}', status=500)


def run_server(host='127.0.0.1', port=5000, debug=False):
    """
    运行 Flask 服务器
    
    Args:
        host: 服务器地址
        port: 端口号
        debug: 调试模式
    """
    log.info(f"启动 Flask API 服务：{host}:{port}")
    app.run(host=host, port=port, debug=debug)


if __name__ == '__main__':
    run_server(debug=False)
