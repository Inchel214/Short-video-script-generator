/**
 * 前端交互逻辑
 * 处理用户操作，调用后端 API
 */

// API 地址配置
const API_BASE_URL = 'http://127.0.0.1:5000/api';

// 状态管理
const state = {
    images: [],          // base64 编码的图片列表
    isGenerating: false, // 是否正在生成
    currentStep: 1,       // 当前步骤
    synopsisExpanded: false,
    lastResult: null,     // 上次生成的结果，用于页面切换时恢复
    abortController: null // 用于取消请求的控制器
};

// 从 localStorage 恢复数据
function loadStateFromStorage() {
    const saved = localStorage.getItem('scriptGeneratorResult');
    if (saved) {
        try {
            state.lastResult = JSON.parse(saved);
        } catch (e) {
            console.error('恢复失败:', e);
        }
    }
}

// 保存结果到 localStorage
function saveStateToStorage() {
    if (state.lastResult) {
        localStorage.setItem('scriptGeneratorResult', JSON.stringify(state.lastResult));
        console.log('结果已保存到 localStorage');
    }
}

// DOM 元素
const elements = {
    // 配置
    apiKeyInput: document.getElementById('api-key'),
    apiKeyToggleBtn: document.getElementById('toggle-api-key-visibility'),
    modelNameInput: document.getElementById('model-name'),
    
    // 上传
    uploadArea: document.getElementById('upload-area'),
    fileInput: document.getElementById('file-input'),
    previewSection: document.getElementById('preview-section'),
    imagePreview: document.getElementById('image-preview'),
    imageCount: document.getElementById('image-count'),
    clearImagesBtn: document.getElementById('clear-images'),
    
    // 输入
    textInput: document.getElementById('text-input'),
    shotsCountInput: document.getElementById('shots-count-input'),
    
    // 按钮
    generateBtn: document.getElementById('generate-btn'),
    clearHistoryBtn: document.getElementById('clear-history'),
    retryBtn: document.getElementById('retry-btn'),
    exportBtn: document.getElementById('export-btn'),
    
    // 结果
    loadingSection: document.getElementById('loading'),
    resultSection: document.getElementById('result-section'),
    errorSection: document.getElementById('error-section'),
    errorMessage: document.getElementById('error-message'),
    synopsisSection: document.getElementById('synopsis-section'),
    shotsList: document.getElementById('shots-list'),
    shotCount: document.getElementById('shot-count'),
    
    // 步骤
    steps: document.querySelectorAll('.step')
};

/**
 * 初始化
 */
function init() {
    console.log('初始化前端应用');
    setupEventListeners();
    loadConfig();
    // 从 localStorage 恢复数据
    loadStateFromStorage();
    // 如果有恢复的结果，显示它
    if (state.lastResult) {
        displayResult(state.lastResult);
    }
    // 初始步骤1：输入
    setStep(1);
}

/**
 * 设置事件监听
 */
function setupEventListeners() {
    // 上传区域点击
    elements.uploadArea.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    // 文件选择
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    // 拖拽上传
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleDrop);
    
    // 页面可见性变化时保持结果显示
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // 尝试从 localStorage 恢复（如果内存中没有）
            if (!state.lastResult) {
                loadStateFromStorage();
            }
            // 页面重新可见时，确保结果区域显示
            if (state.lastResult) {
                elements.resultSection.style.display = 'block';
                elements.errorSection.style.display = 'none';
                // 恢复结果显示
                displayResult(state.lastResult);
            }
        }
    });
    
    // 切换 API 密钥显示
    if (elements.apiKeyToggleBtn) {
        elements.apiKeyToggleBtn.addEventListener('click', toggleApiKeyVisibility);
    }

    // 清空图片
    elements.clearImagesBtn.addEventListener('click', clearImages);
    
    // 生成剧本
    elements.generateBtn.addEventListener('click', () => {
        if (state.isGenerating) {
            stopGeneration();
        } else {
            generateScript();
        }
    });
    
    // 清空历史
    elements.clearHistoryBtn.addEventListener('click', clearHistory);
    
    // 重试
    elements.retryBtn.addEventListener('click', () => {
        hideError();
        generateScript();
    });
    
    // 导出剧本
    elements.exportBtn.addEventListener('click', exportScript);
}

/**
 * 加载配置
 */
function loadConfig() {
    // 从 localStorage 加载 API 配置
    const savedApiKey = localStorage.getItem('api_key');
    const savedModelName = localStorage.getItem('model_name');
    
    if (savedApiKey) {
        elements.apiKeyInput.value = savedApiKey;
    }
    
    if (savedModelName) {
        elements.modelNameInput.value = savedModelName;
    }
}

/**
 * 切换 API 密钥显示状态
 */
function toggleApiKeyVisibility() {
    if (!elements.apiKeyInput || !elements.apiKeyToggleBtn) {
        return;
    }

    const isPassword = elements.apiKeyInput.type === 'password';
    elements.apiKeyInput.type = isPassword ? 'text' : 'password';
    elements.apiKeyToggleBtn.setAttribute('aria-pressed', String(isPassword));
}

/**
 * 保存配置
 */
function saveConfig() {
    localStorage.setItem('api_key', elements.apiKeyInput.value);
    localStorage.setItem('model_name', elements.modelNameInput.value);
}

/**
 * 处理文件选择
 */
function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        processFiles(files);
    }
}

/**
 * 处理拖拽悬停
 */
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    elements.uploadArea.style.borderColor = '#667eea';
    elements.uploadArea.style.background = '#f8f8ff';
}

/**
 * 处理拖拽离开
 */
function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    elements.uploadArea.style.borderColor = '#ddd';
    elements.uploadArea.style.background = 'white';
}

/**
 * 处理文件拖放
 */
function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    elements.uploadArea.style.borderColor = '#ddd';
    elements.uploadArea.style.background = 'white';
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processFiles(files);
    }
}

/**
 * 处理文件
 */
async function processFiles(files) {
    console.log('开始处理文件，数量:', files.length);
    
    for (let file of files) {
        if (!file.type.startsWith('image/')) {
            console.warn('跳过非图片文件:', file.name);
            continue;
        }
        
        try {
            const base64 = await fileToBase64(file);
            state.images.push(base64);
            console.log('已添加图片:', file.name);
        } catch (error) {
            console.error('处理图片失败:', error);
            showError('处理图片失败: ' + error.message);
        }
    }
    
    updateImagePreview();
    saveConfig();
}

/**
 * 文件转 Base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * 更新图片预览
 */
function updateImagePreview() {
    const count = state.images.length;
    
    // 更新计数
    elements.imageCount.textContent = count;
    
    // 显示/隐藏预览区域
    elements.previewSection.style.display = count > 0 ? 'block' : 'none';
    
    // 清空预览
    elements.imagePreview.innerHTML = '';
    
    // 添加预览图片
    state.images.forEach((base64, index) => {
        const item = document.createElement('div');
        item.className = 'image-item';
        item.innerHTML = `
            <img src="${base64}" alt="图片${index + 1}">
            <button class="delete-btn" data-index="${index}">×</button>
        `;
        
        // 删除按钮事件
        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(e.target.dataset.index);
            deleteImage(idx);
        });
        
        elements.imagePreview.appendChild(item);
    });
}

/**
 * 删除图片
 */
function deleteImage(index) {
    console.log('删除图片，索引:', index);
    state.images.splice(index, 1);
    updateImagePreview();
}

/**
 * 清空图片
 */
function clearImages() {
    console.log('清空所有图片');
    state.images = [];
    elements.fileInput.value = '';
    updateImagePreview();
}

/**
 * 生成剧本
 */
async function generateScript() {
    // 收集参数
    const apiKey = elements.apiKeyInput.value.trim();
    const modelName = elements.modelNameInput.value.trim();
    const text = elements.textInput.value.trim();
    const shotsCount = elements.shotsCountInput.value.trim();

    console.log('=== DEBUG: 收集参数 ===');
    console.log('shotsCountInput raw value:', elements.shotsCountInput.value);
    console.log('shotsCountInput type:', typeof elements.shotsCountInput.value);
    console.log('shotsCount after trim:', shotsCount);
    console.log('shotsCount length:', shotsCount.length);
    console.log('parseInt result:', shotsCount ? parseInt(shotsCount) : null);
    console.log('=======================');

    // 验证输入
    if (!apiKey) {
        showError('请输入 API 密钥');
        return;
    }

    if (state.images.length === 0 && !text) {
        showError('请上传图片或输入要求');
        return;
    }

    // 开始生成
    state.isGenerating = true;
    state.abortController = new AbortController();
    saveConfig();
    showLoading();
    updateGenerateBtnState();

    // 步骤2：分析中
    setStep(2);

    console.log('开始生成剧本');
    console.log('API 密钥:', apiKey ? '已提供' : '未提供');
    console.log('模型:', modelName);
    console.log('图片数量:', state.images.length);
    console.log('文字长度:', text.length);

    try {
        const requestBody = {
            images: state.images,
            text: text,
            api_key: apiKey,
            model_name: modelName,
            shots_count: shotsCount ? parseInt(shotsCount) : null
        };
        console.log('=== DEBUG: 请求体 ===');
        console.log('shots_count in request:', requestBody.shots_count);
        console.log('requestBody:', JSON.stringify(requestBody, null, 2));
        console.log('=======================');

        const response = await fetch(`${API_BASE_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: state.abortController.signal
        });

        const data = await response.json();
        console.log('API 响应:', JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('响应成功，result:', JSON.stringify(data.result, null, 2));
            
            setStep(3);
            await new Promise(resolve => setTimeout(resolve, 1000));
            setStep(4);
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            displayResult(data.result);
        } else {
            throw new Error(data.error || '生成失败');
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('生成已被取消');
            showError('生成已停止');
        } else {
            console.error('生成剧本失败:', error);
            showError(error.message || '网络错误，请检查后端服务是否启动');
        }
    } finally {
        state.isGenerating = false;
        state.abortController = null;
        hideLoading();
        updateGenerateBtnState();
    }
}

/**
 * 停止生成
 */
async function stopGeneration() {
    console.log('停止生成');
    
    if (state.abortController) {
        state.abortController.abort();
    }
    
    try {
        await fetch(`${API_BASE_URL}/stop`, {
            method: 'POST'
        });
    } catch (error) {
        console.log('通知后端停止失败:', error);
    }
}

/**
 * 更新生成按钮状态
 */
function updateGenerateBtnState() {
    const generateIcon = elements.generateBtn.querySelector('.generate-icon');
    const generateText = elements.generateBtn.querySelector('.generate-text');
    
    if (state.isGenerating) {
        elements.generateBtn.classList.add('stop-mode');
        if (generateIcon) {
            generateIcon.innerHTML = '■';
        }
        if (generateText) {
            generateText.textContent = '停止生成';
        }
    } else {
        elements.generateBtn.classList.remove('stop-mode');
        if (generateIcon) {
            generateIcon.innerHTML = '✨';
        }
        if (generateText) {
            generateText.textContent = '去生成';
        }
    }
}

/**
 * 显示加载状态
 */
function showLoading() {
    elements.loadingSection.style.display = 'flex';
    elements.resultSection.style.display = 'none';
    elements.errorSection.style.display = 'none';
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
    elements.loadingSection.style.display = 'none';
    elements.generateBtn.disabled = false;
    // 恢复结果区域显示
    if (state.lastResult) {
        elements.resultSection.style.display = 'block';
    }
}

/**
 * 显示错误
 */
function showError(message) {
    console.error('错误:', message);
    elements.errorSection.style.display = 'block';
    elements.resultSection.style.display = 'none';
    elements.errorMessage.textContent = message;
}

/**
 * 隐藏错误
 */
function hideError() {
    elements.errorSection.style.display = 'none';
}

/**
 * 设置步骤
 */
function setStep(step) {
    state.currentStep = step;
    elements.steps.forEach((stepEl, index) => {
        const stepNum = index + 1;
        stepEl.classList.remove('pending', 'active', 'completed');

        if (stepNum < step) {
            // 已完成的步骤
            stepEl.classList.add('completed');
        } else if (stepNum === step) {
            // 当前进行中的步骤
            stepEl.classList.add('active');
        } else {
            // 待处理的步骤
            stepEl.classList.add('pending');
        }
    });
}

/**
 * 显示结果
 */
function tryParseJsonString(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (trimmed.startsWith('```')) {
        const cleaned = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
        return tryParseJsonString(cleaned);
    }
    try {
        return JSON.parse(trimmed);
    } catch (e) {
        return value;
    }
}

function normalizeResult(result) {
    const normalized = { ...result };

    const synopsisCandidate = normalized.synopsis ?? normalized['剧情简介'] ?? normalized['剧情简介和人物设定'] ?? '';
    normalized.synopsis = tryParseJsonString(synopsisCandidate);
    if (typeof normalized.synopsis === 'object' && normalized.synopsis !== null) {
        normalized.synopsis = normalized.synopsis['剧情简介'] || normalized.synopsis['synopsis'] || '';
    }

    const charactersCandidate = normalized.characters ?? normalized['人物设定'] ?? normalized['人物小传'] ?? '';
    normalized.characters = tryParseJsonString(charactersCandidate);
    if (typeof normalized.characters === 'object' && normalized.characters !== null && !Array.isArray(normalized.characters)) {
        const charsStr = Object.entries(normalized.characters).map(([name, desc]) => `${name}：${desc}`).join('\n');
        normalized.characters = charsStr;
    }

    const shotsCandidate = normalized.shots ?? normalized['分镜列表'] ?? normalized['分镜'] ?? [];
    normalized.shots = tryParseJsonString(shotsCandidate);
    if (!Array.isArray(normalized.shots)) {
        normalized.shots = [];
    }

    normalized.shots = normalized.shots.map((shot, index) => {
        if (shot && typeof shot === 'object') {
            return {
                id: shot.id ?? index + 1,
                title: shot.title ?? shot['标题'] ?? '',
                description: shot.description ?? shot['画面描述'] ?? shot['description'] ?? '',
                duration: shot.duration ?? shot['时长'] ?? '',
                scene: shot.scene ?? shot['景别'] ?? '',
                camera: shot.camera ?? shot['运镜方式'] ?? '',
                dialogue: shot.dialogue ?? shot['旁白/对话'] ?? '',
                soundEffect: shot.soundEffect ?? shot['音效建议'] ?? '',
                expanded: typeof shot.expanded === 'boolean' ? shot.expanded : true,
                '画面描述': shot['画面描述'] ?? shot.description ?? shot['description'] ?? '',
                '运镜方式': shot['运镜方式'] ?? shot.camera ?? '',
                '旁白/对话': shot['旁白/对话'] ?? shot.dialogue ?? '',
                '音效建议': shot['音效建议'] ?? shot.soundEffect ?? '',
                '时长': shot['时长'] ?? shot.duration ?? '',
                '景别': shot['景别'] ?? shot.scene ?? ''
            };
        }
        return shot;
    });

    return normalized;
}

function displayResult(result) {
    const normalizedResult = normalizeResult(result);

    console.log('displayResult - 原始result:', JSON.stringify(result, null, 2));
    console.log('displayResult - synopsis:', normalizedResult.synopsis);
    console.log('displayResult - characters:', normalizedResult.characters);
    console.log('displayResult - shots:', normalizedResult.shots);
    console.log('displayResult - shots length:', normalizedResult.shots ? normalizedResult.shots.length : 'undefined');
    
    state.lastResult = normalizedResult;
    saveStateToStorage();
    
    elements.resultSection.style.display = 'block';
    elements.errorSection.style.display = 'none';
    
    const synopsis = normalizedResult.synopsis || '';
    console.log('处理后 synopsis:', synopsis);
    
    let characters = normalizedResult.characters || '';
    console.log('处理后 characters:', characters);
    
    const shots = normalizedResult.shots || [];
    console.log('处理后 shots:', shots);
    console.log('处理后 shots length:', shots.length);    
    let content = '';
    if (synopsis) {
        content += synopsis;
    }
    if (characters) {
        if (content) content += '\n\n';
        content += characters;
    }
    console.log('最终 content:', content);
    console.log('content length:', content.length);
    
    if (content) {
        elements.synopsisSection.innerHTML = '<div class="merged-content">' + content + '</div>';
    } else {
        elements.synopsisSection.innerHTML = '<p class="placeholder">暂无内容</p>';
    }
    
    // 初始状态：剧情简介收起
    state.synopsisExpanded = false;
    elements.synopsisSection.classList.remove('expanded');
    
    // 设置剧情简介的展开/收起事件
    const resultCards = document.querySelectorAll('.result-card');
    resultCards.forEach((card, index) => {
        const titleEl = card.querySelector('.result-card-title');
        const arrowIcon = titleEl.querySelector('.arrow-icon');
        
        if (index === 0) {
            // 剧情简介
            titleEl.onclick = () => {
                state.synopsisExpanded = !state.synopsisExpanded;
                elements.synopsisSection.classList.toggle('expanded', state.synopsisExpanded);
                arrowIcon.classList.toggle('expanded', state.synopsisExpanded);
            };
        }
    });
    
    // 显示分镜列表
    elements.shotCount.textContent = shots.length;
    elements.shotsList.innerHTML = '';
    
    if (shots.length > 0) {
        shots.forEach((shot, index) => {
            const shotEl = createShotItem(shot, index);
            elements.shotsList.appendChild(shotEl);
        });
    } else {
        elements.shotsList.innerHTML = '<p class="placeholder">暂无分镜内容</p>';
    }
    
    setStep(5);
    elements.resultSection.style.display = 'block';
}

/**
 * 创建分镜项
 */
function createShotItem(shot, index) {
    const shotEl = document.createElement('div');
    shotEl.className = 'shot-item';
    shotEl.dataset.id = shot.id || index + 1;
    
    const number = index + 1;
    const duration = shot['时长'] || shot.duration || '';
    const scene = shot['景别'] || shot.scene || '';
    const description = shot['画面描述'] || shot.description || shot['description'] || '';
    const camera = shot['运镜方式'] || shot.camera || '';
    const dialogue = shot['旁白/对话'] || shot.dialogue || '';
    const soundEffect = shot['音效建议'] || shot.soundEffect || '';
    
    const title = shot.title || shot['标题'] || (description ? description.substring(0, 20) : `分镜 ${number}`);
    const fullDescription = [
        duration ? `时长：${duration}` : '',
        scene ? `景别：${scene}` : '',
        description ? `\n\n画面描述：\n${description}` : '',
        camera ? `\n\n运镜方式：${camera}` : '',
        dialogue ? `\n\n旁白/对话：${dialogue}` : '',
        soundEffect ? `\n\n音效建议：${soundEffect}` : ''
    ].filter(Boolean).join('\n\n');
    const descriptionText = fullDescription || '';
    const isExpanded = true; // 默认展开
    
    // 编辑图标
    const editIcon = 'https://seal-img.nos-jd.163yun.com/obj/w5rCgMKVw6DCmGzCmsK-/80937478818/2c03/0821/5b7f/499e02d41a7ba6618507de66bb4780f8.png';
    // 删除图标
    const deleteIcon = 'https://seal-img.nos-jd.163yun.com/obj/w5rCgMKVw6DCmGzCmsK-/80937475560/732d/78fa/0bfa/ef69a3f36529bf83fb2a51e1081c1b24.png';
    // 箭头图标
    const arrowIcon = 'https://seal-img.nos-jd.163yun.com/obj/w5rCgMKVw6DCmGzCmsK-/80937478858/c347/651d/afa5/bb9fede252f974bddb880ec051aef1e3.png';
    
    shotEl.innerHTML = `
        <div class="shot-item-header">
            <span class="shot-number">${number}</span>
            <input type="text" class="shot-title-input" value="${escapeHtml(title)}">
            <div class="shot-actions">
                <span class="shot-action-btn" data-action="edit" title="复制">
                    <img src="${editIcon}" alt="编辑">
                </span>
                <span class="shot-action-btn" data-action="delete" title="删除">
                    <img src="${deleteIcon}" alt="删除">
                </span>
                <img class="shot-expand-arrow ${isExpanded ? 'expanded' : ''}" src="${arrowIcon}" alt="展开">
            </div>
        </div>
        <div class="shot-item-content ${isExpanded ? 'expanded' : ''}">
            <textarea class="shot-description-input" placeholder="请输入分镜描述...">${escapeHtml(descriptionText)}</textarea>
        </div>
    `;
    
    // 事件处理
    const header = shotEl.querySelector('.shot-item-header');
    const expandArrow = shotEl.querySelector('.shot-expand-arrow');
    const content = shotEl.querySelector('.shot-item-content');
    const editBtn = shotEl.querySelector('[data-action="edit"]');
    const deleteBtn = shotEl.querySelector('[data-action="delete"]');
    const titleInput = shotEl.querySelector('.shot-title-input');
    const descInput = shotEl.querySelector('.shot-description-input');
    
    // 点击行头或箭头切换展开/收起
    header.onclick = (e) => {
        if (e.target === titleInput) return;
        toggleShotExpand(shotEl);
    };
    
    expandArrow.onclick = (e) => {
        e.stopPropagation();
        toggleShotExpand(shotEl);
    };
    
    // 编辑按钮 - 复制内容
    editBtn.onclick = (e) => {
        e.stopPropagation();
        const text = `标题: ${titleInput.value}\n\n描述: ${descInput.value}`;
        navigator.clipboard.writeText(text).then(() => {
            alert('已复制到剪贴板');
        }).catch(err => {
            console.error('复制失败:', err);
        });
    };
    
    // 删除按钮
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        showDeleteConfirm(() => {
            deleteShot(shotEl);
        });
    };
    
    return shotEl;
}

/**
 * 切换分镜展开/收起
 */
function toggleShotExpand(shotEl) {
    const arrow = shotEl.querySelector('.shot-expand-arrow');
    const content = shotEl.querySelector('.shot-item-content');
    
    const isExpanded = content.classList.toggle('expanded');
    arrow.classList.toggle('expanded', isExpanded);
}

/**
 * 删除分镜
 */
function deleteShot(shotEl) {
    shotEl.remove();
    
    // 更新分镜计数
    const shots = elements.shotsList.querySelectorAll('.shot-item');
    elements.shotCount.textContent = shots.length;
    
    // 重新编号
    shots.forEach((shot, index) => {
        const numberEl = shot.querySelector('.shot-number');
        if (numberEl) {
            numberEl.textContent = index + 1;
        }
    });
    
    if (shots.length === 0) {
        elements.shotsList.innerHTML = '<p class="placeholder">暂无分镜内容</p>';
    }
}

/**
 * 显示删除确认
 */
function showDeleteConfirm(onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-dialog">
            <p>确定要删除这个分镜吗？</p>
            <div class="confirm-buttons">
                <button class="btn-cancel">取消</button>
                <button class="btn-confirm">确定</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const cancelBtn = overlay.querySelector('.btn-cancel');
    const confirmBtn = overlay.querySelector('.btn-confirm');
    
    cancelBtn.onclick = () => {
        overlay.remove();
    };
    
    confirmBtn.onclick = () => {
        overlay.remove();
        onConfirm();
    };
    
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 清空历史
 */
async function clearHistory() {
    if (!confirm('确定要清空对话历史吗？')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/clear`, {
            method: 'POST'
        });
        
        if (response.ok) {
            alert('对话历史已清空');
            // 刷新页面
            location.reload();
        } else {
            throw new Error('清空失败');
        }
    } catch (error) {
        console.error('清空历史失败:', error);
        alert('清空失败: ' + error.message);
    }
}

/**
 * 导出剧本为 TXT 文件
 */
function exportScript() {
    if (!state.lastResult) {
        alert('没有可导出的剧本，请先生成剧本');
        return;
    }
    
    const result = state.lastResult;
    const synopsis = result.synopsis || '';
    const characters = result.characters || '';
    const shots = result.shots || [];
    
    let content = '';
    const timestamp = new Date().toLocaleString('zh-CN');
    
    content += '========================================\n';
    content += '          短视频剧本\n';
    content += '========================================\n';
    content += `生成时间: ${timestamp}\n`;
    content += '========================================\n\n';
    
    if (synopsis) {
        content += '【剧情简介】\n';
        content += synopsis + '\n\n';
    }
    
    if (characters) {
        content += '【人物设定】\n';
        content += characters + '\n\n';
    }
    
    content += '【分镜剧本】\n';
    content += '========================================\n';
    
    if (shots.length > 0) {
        shots.forEach((shot, index) => {
            const number = index + 1;
            const title = shot.title || shot['画面描述']?.substring(0, 20) || `分镜 ${number}`;
            const description = shot.description || shot['画面描述'] || '';
            const dialogue = shot['旁白/对话'] || '';
            const soundEffect = shot['音效建议'] || '';
            
            content += `\n第 ${number} 镜\n`;
            content += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            content += `标题：${title}\n`;
            
            if (description) {
                content += `画面描述：\n${description}\n`;
            }
            
            if (dialogue) {
                content += `旁白/对话：\n${dialogue}\n`;
            }
            
            if (soundEffect) {
                content += `音效建议：\n${soundEffect}\n`;
            }
        });
    } else {
        content += '暂无分镜内容\n';
    }
    
    content += '\n========================================\n';
    content += '                    结束\n';
    content += '========================================\n';
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `短视频剧本_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('剧本导出成功');
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
