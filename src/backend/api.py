"""
Flask API 服务
提供 HTTP 接口供前端调用 Agent 逻辑
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from . import agent
from . import logger
import os

# 创建 Flask 应用
app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 获取日志记录器
log = logger.setup_logger()


@app.route('/api/health', methods=['GET'])
def health_check():
    """
    健康检查接口
    """
    log.info("接收到健康检查请求")
    return jsonify({
        'status': 'ok',
        'message': '服务正常运行'
    })


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
        
        if not data:
            log.warning("请求体为空")
            return jsonify({
                'success': False,
                'error': '请求体不能为空'
            }), 400
        
        # 获取参数
        images = data.get('images', [])
        text = data.get('text', '')
        api_key = data.get('api_key', '')
        model_name = data.get('model_name', 'doubao-seed-1-6-vision-250815')
        shots_count = data.get('shots_count')  # 可选，不提供则由AI自动判断
        
        log.info(f"请求参数：图片数量={len(images)}, 文字长度={len(text)}, 模型={model_name}, 镜头数量={shots_count}")
        
        # 至少需要图片或文字之一
        if not images and not text:
            log.warning("未提供图片或文字")
            return jsonify({
                'success': False,
                'error': '请上传图片或输入要求'
            }), 400
        
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
        
        # 处理结果
        if 'error' in result:
            log.error(f"生成剧本失败：{result['error']}")
            return jsonify({
                'success': False,
                'error': result['error']
            }), 500
        
        log.info("剧本生成成功，即将返回给前端")
        log.info(f"原始返回数据: {result}")
        
        # 转换字段名：中文字段名 -> 英文字段名
        transformed_result = {
            'synopsis': result.get('剧情简介和人物设定', {}).get('剧情简介', '') or result.get('剧情简介', ''),
            'characters': result.get('剧情简介和人物设定', {}).get('人物设定', '') or result.get('人物设定', ''),
            'shots': result.get('分镜列表', result.get('分镜', []))
        }
        log.info(f"转换后的数据: synopsis长度={len(transformed_result['synopsis'])}, shots数量={len(transformed_result['shots'])}")
        
        # 返回正确格式的数据
        return jsonify({
            'success': True,
            'result': transformed_result
        })
        
    except Exception as e:
        log.error(f"生成剧本时发生异常：{str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'服务器错误：{str(e)}'
        }), 500


@app.route('/api/clear-history', methods=['POST'])
def clear_history():
    """
    清空对话历史
    """
    log.info("接收到清空对话历史请求")
    
    try:
        result = agent.clear_history()
        log.info("对话历史已清空")
        return jsonify({
            'success': True,
            'message': '对话历史已清空'
        })
    except Exception as e:
        log.error(f"清空对话历史失败：{str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


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
