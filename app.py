import gradio as gr
from agent import generate_script, clear_history

def process(image, text_requirement):
    """处理图片和文字，生成剧本"""
    # 图片和文字至少有一个即可
    if image is None and not text_requirement:
        return {"error": "请上传图片或输入要求"}
    
    return generate_script(image, text_requirement)

# 创建界面
with gr.Blocks(title="短视频剧本生成器") as demo:
    gr.Markdown("# 🎬 短视频剧本生成器")
    
    with gr.Row():
        image_input = gr.Image(label="上传图片", type="filepath")
        text_input = gr.Textbox(
            label="输入要求",
            placeholder="例如：生成一个30秒的温馨风格vlog剧本...",
            lines=5
        )
    
    with gr.Row():
        submit_btn = gr.Button("生成剧本", variant="primary")
        clear_btn = gr.Button("清空对话历史", variant="secondary")
    
    output = gr.JSON(label="生成结果")
    
    submit_btn.click(
        fn=process,
        inputs=[image_input, text_input],
        outputs=output
    )
    
    clear_btn.click(
        fn=clear_history,
        inputs=[],
        outputs=output
    )

if __name__ == "__main__":
    demo.launch()