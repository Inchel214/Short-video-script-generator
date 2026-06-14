import gradio as gr
from agent import generate_script, clear_history

# 存储所有上传的图片
uploaded_images = []

def add_images(files):
    """添加图片到列表"""
    global uploaded_images
    if files:
        for f in files:
            if f not in uploaded_images:
                uploaded_images.append(f)
    return update_gallery(), f"{len(uploaded_images)} 张", None, gr.Gallery(selected_index=None)

def update_gallery():
    """返回图片列表"""
    global uploaded_images
    return uploaded_images

def delete_selected(evt: gr.SelectData):
    """删除选中的图片"""
    global uploaded_images
    if evt.index < len(uploaded_images):
        uploaded_images.pop(evt.index)
    return update_gallery(), f"{len(uploaded_images)} 张", gr.Gallery(selected_index=None)

def process_images(text_requirement, api_key, model_name):
    """处理多张图片和文字，生成剧本"""
    global uploaded_images
    if not uploaded_images and not text_requirement:
        return {"error": "请上传图片或输入要求"}
    result = generate_script(uploaded_images, text_requirement, api_key, model_name)
    return result

def clear_images():
    """清空所有图片"""
    global uploaded_images
    uploaded_images = []
    return [], "0 张", gr.Gallery(selected_index=None)

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
            value="doubao-seed-1-6-vision-250815"
        )
    
    # 图片区域
    with gr.Row():
        with gr.Column(scale=1):
            # 拖拽上传区域
            file_input = gr.File(
                label="拖拽或点击上传图片",
                file_count="multiple",
                file_types=["image"],
                type="filepath"
            )
            
            # 缩略图画廊
            image_gallery = gr.Gallery(
                label="已上传图片预览（点击图片可删除）",
                height=300,
                columns=4,
                object_fit="contain",
                allow_preview=True
            )
            
            # 图片数量
            image_count = gr.Textbox(
                value="0 张",
                interactive=False,
                show_label=False
            )
            
            # 清空按钮
            clear_img_btn = gr.Button("清空所有图片", variant="stop", size="sm")
            
            gr.Markdown("*💡 提示：点击缩略图可删除该图片*")
            
        with gr.Column(scale=1):
            text_input = gr.Textbox(
                label="输入要求",
                placeholder="例如：生成一个30秒的温馨风格vlog剧本...",
                lines=8
            )
    
    # 生成按钮
    with gr.Row():
        submit_btn = gr.Button("生成剧本", variant="primary", size="lg")
        clear_btn = gr.Button("清空对话历史", variant="secondary")
    
    output = gr.JSON(label="生成结果")
    
    # 上传后自动累积
    file_input.change(
        fn=add_images,
        inputs=file_input,
        outputs=[image_gallery, image_count, file_input, image_gallery]
    )
    
    # 点击缩略图删除
    image_gallery.select(
        fn=delete_selected,
        inputs=[],
        outputs=[image_gallery, image_count, image_gallery]
    )
    
    # 清空图片
    clear_img_btn.click(
        fn=clear_images,
        inputs=[],
        outputs=[image_gallery, image_count, image_gallery]
    )
    
    # 生成剧本
    submit_btn.click(
        fn=process_images,
        inputs=[text_input, api_key_input, model_input],
        outputs=output
    )
    
    # 清空对话历史
    clear_btn.click(
        fn=clear_history,
        inputs=[],
        outputs=output
    )

if __name__ == "__main__":
    demo.launch()