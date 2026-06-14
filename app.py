import gradio as gr
from agent import generate_script, clear_history

def process(images, text_requirement, api_key, model_name):
    """处理多张图片和文字，生成剧本"""
    # 图片和文字至少有一个即可
    if not images and not text_requirement:
        return {"error": "请上传图片或输入要求"}
    
    # 处理图片路径列表
    image_paths = images if images else None
    
    return generate_script(image_paths, text_requirement, api_key, model_name)

# 创建界面
with gr.Blocks(title="短视频剧本生成器") as demo:
    gr.Markdown("# 🎬 短视频剧本生成器")
    gr.Markdown("支持上传**一张或多张图片**，生成连贯的短视频剧本")
    
    # API配置区域
    with gr.Accordion("API配置（首次使用请填写）", open=True):
        api_key_input = gr.Textbox(
            label="API密钥",
            placeholder="输入火山引擎API密钥，如：ark-xxx...",
            type="password"
        )
        model_input = gr.Textbox(
            label="模型名称",
            placeholder="doubao-seed-1-6-vision-250815",
            value="doubao-seed-1-6-vision-250815"
        )
    
    # 输入区域
    with gr.Row():
        image_input = gr.File(
            label="上传图片（支持多张）",
            file_count="multiple",
            file_types=["image"]
        )
        text_input = gr.Textbox(
            label="输入要求",
            placeholder="例如：生成一个30秒的温馨风格vlog剧本...",
            lines=5
        )
    
    # 操作按钮
    with gr.Row():
        submit_btn = gr.Button("生成剧本", variant="primary")
        clear_btn = gr.Button("清空对话历史", variant="secondary")
    
    output = gr.JSON(label="生成结果")
    
    submit_btn.click(
        fn=process,
        inputs=[image_input, text_input, api_key_input, model_input],
        outputs=output
    )
    
    clear_btn.click(
        fn=clear_history,
        inputs=[],
        outputs=output
    )

if __name__ == "__main__":
    demo.launch()