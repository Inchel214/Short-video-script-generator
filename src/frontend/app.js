/**
 * 前端交互逻辑
 * 处理用户操作，调用后端 API
 */

// API 地址配置
const API_BASE_URL = 'http://127.0.0.1:5000/api';

// 状态管理
const state = {
    images: [],
    isGenerating: false,
    currentStep: 1,
    synopsisExpanded: false,
    lastResult: null,
    abortController: null,
    modifiedShots: {}
};

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

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

function showCustomAlert(message, icon = '📋', title = '提示') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-dialog-overlay');
        const iconEl = document.getElementById('custom-dialog-icon');
        const titleEl = document.getElementById('custom-dialog-title');
        const msgEl = document.getElementById('custom-dialog-message');
        const cancelBtn = document.getElementById('btn-dialog-cancel');
        const confirmBtn = document.getElementById('btn-dialog-confirm');

        iconEl.textContent = icon;
        titleEl.textContent = title;
        msgEl.textContent = message;

        cancelBtn.style.display = 'none';
        confirmBtn.textContent = '确定';

        const close = () => {
            overlay.style.display = 'none';
            confirmBtn.removeEventListener('click', close);
            overlay.removeEventListener('click', handleOverlayClick);
            resolve();
        };

        const handleOverlayClick = (e) => {
            if (e.target === overlay) close();
        };

        confirmBtn.addEventListener('click', close);
        overlay.addEventListener('click', handleOverlayClick);

        overlay.style.display = 'flex';
    });
}

function showCustomConfirm(message, icon = '❓', title = '确认') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-dialog-overlay');
        const iconEl = document.getElementById('custom-dialog-icon');
        const titleEl = document.getElementById('custom-dialog-title');
        const msgEl = document.getElementById('custom-dialog-message');
        const cancelBtn = document.getElementById('btn-dialog-cancel');
        const confirmBtn = document.getElementById('btn-dialog-confirm');

        iconEl.textContent = icon;
        titleEl.textContent = title;
        msgEl.textContent = message;

        cancelBtn.style.display = 'block';
        confirmBtn.textContent = '确定';

        const close = (result) => {
            overlay.style.display = 'none';
            cancelBtn.removeEventListener('click', cancel);
            confirmBtn.removeEventListener('click', confirm);
            overlay.removeEventListener('click', handleOverlayClick);
            resolve(result);
        };

        const cancel = () => close(false);
        const confirm = () => close(true);

        const handleOverlayClick = (e) => {
            if (e.target === overlay) close(false);
        };

        cancelBtn.addEventListener('click', cancel);
        confirmBtn.addEventListener('click', confirm);
        overlay.addEventListener('click', handleOverlayClick);

        overlay.style.display = 'flex';
    });
}

function saveStateToStorage() {
    if (state.lastResult) {
        localStorage.setItem('scriptGeneratorResult', JSON.stringify(state.lastResult));
        console.log('结果已保存到 localStorage');
    }
}

const elements = {
    apiKeyInput: document.getElementById('api-key'),
    apiKeyToggleBtn: document.getElementById('toggle-api-key-visibility'),
    modelNameInput: document.getElementById('model-name'),
    
    uploadArea: document.getElementById('upload-area'),
    fileInput: document.getElementById('file-input'),
    previewSection: document.getElementById('preview-section'),
    imagePreview: document.getElementById('image-preview'),
    imageCount: document.getElementById('image-count'),
    clearImagesBtn: document.getElementById('clear-images'),
    
    shotsCountInput: document.getElementById('shots-count-input'),
    
    generateBtn: document.getElementById('generate-btn'),
    clearHistoryBtn: document.getElementById('clear-history'),
    retryBtn: document.getElementById('retry-btn'),
    exportBtn: document.getElementById('export-btn'),
    
    loadingSection: document.getElementById('loading'),
    resultSection: document.getElementById('result-section'),
    errorSection: document.getElementById('error-section'),
    errorMessage: document.getElementById('error-message'),
    synopsisSection: document.getElementById('synopsis-section'),
    shotsList: document.getElementById('shots-list'),
    shotCount: document.getElementById('shot-count'),
    
    steps: document.querySelectorAll('.step'),
    
    updateBtn: document.getElementById('update-btn'),
    
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendChatBtn: document.getElementById('send-chat-btn'),
    clearChatBtn: document.getElementById('clear-chat')
};

function init() {
    console.log('初始化前端应用');
    setupEventListeners();
    loadConfig();
    loadStateFromStorage();
    if (state.lastResult) {
        displayResult(state.lastResult);
    }
    setStep(1);
}

function setupEventListeners() {
    elements.uploadArea.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleDrop);
    
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            if (!state.lastResult) {
                loadStateFromStorage();
            }
            if (state.lastResult) {
                elements.resultSection.style.display = 'block';
                elements.errorSection.style.display = 'none';
                displayResult(state.lastResult);
            }
        }
    });
    
    if (elements.apiKeyToggleBtn) {
        elements.apiKeyToggleBtn.addEventListener('click', toggleApiKeyVisibility);
    }

    elements.clearImagesBtn.addEventListener('click', clearImages);
    
    elements.generateBtn.addEventListener('click', () => {
        if (state.isGenerating) {
            stopGeneration();
        } else {
            generateScript();
        }
    });
    
    elements.clearHistoryBtn.addEventListener('click', clearHistory);
    
    elements.retryBtn.addEventListener('click', () => {
        hideError();
        generateScript();
    });
    
    elements.exportBtn.addEventListener('click', exportScript);
    
    if (elements.updateBtn) {
        elements.updateBtn.addEventListener('click', handleUpdateClick);
    }
    
    elements.sendChatBtn.addEventListener('click', sendChatMessage);
    
    elements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    
    elements.clearChatBtn.addEventListener('click', clearChat);
    
    setupElectronUpdateListener();
}

function loadConfig() {
    const savedApiKey = localStorage.getItem('api_key');
    const savedModelName = localStorage.getItem('model_name');
    
    if (savedApiKey) {
        elements.apiKeyInput.value = savedApiKey;
    }
    
    if (savedModelName) {
        elements.modelNameInput.value = savedModelName;
    }
}

function toggleApiKeyVisibility() {
    if (!elements.apiKeyInput || !elements.apiKeyToggleBtn) {
        return;
    }

    const isPassword = elements.apiKeyInput.type === 'password';
    elements.apiKeyInput.type = isPassword ? 'text' : 'password';
    elements.apiKeyToggleBtn.setAttribute('aria-pressed', String(isPassword));
}

function saveConfig() {
    localStorage.setItem('api_key', elements.apiKeyInput.value);
    localStorage.setItem('model_name', elements.modelNameInput.value);
}

function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        processFiles(files);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    elements.uploadArea.style.borderColor = '#667eea';
    elements.uploadArea.style.background = '#f8f8ff';
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    elements.uploadArea.style.borderColor = '#ddd';
    elements.uploadArea.style.background = 'white';
}

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

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function updateImagePreview() {
    const count = state.images.length;
    
    elements.imageCount.textContent = count;
    
    elements.previewSection.style.display = count > 0 ? 'block' : 'none';
    
    elements.imagePreview.innerHTML = '';
    
    state.images.forEach((base64, index) => {
        const item = document.createElement('div');
        item.className = 'image-item';
        item.innerHTML = `
            <img src="${base64}" alt="图片${index + 1}">
            <button class="delete-btn" data-index="${index}">×</button>
        `;
        
        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(e.target.dataset.index);
            deleteImage(idx);
        });
        
        elements.imagePreview.appendChild(item);
    });
}

function deleteImage(index) {
    console.log('删除图片，索引:', index);
    state.images.splice(index, 1);
    updateImagePreview();
}

function clearImages() {
    console.log('清空所有图片');
    state.images = [];
    elements.fileInput.value = '';
    updateImagePreview();
}

async function generateScript() {
    const apiKey = elements.apiKeyInput.value.trim();
    const modelName = elements.modelNameInput.value.trim();
    const text = elements.chatInput.innerText.trim();
    const shotsCount = elements.shotsCountInput.value.trim();

    if (!apiKey) {
        showError('请输入 API 密钥');
        return;
    }

    if (state.images.length === 0 && !text) {
        showError('请上传图片或输入要求');
        return;
    }

    state.isGenerating = true;
    state.abortController = new AbortController();
    
    const timeoutId = setTimeout(() => {
        if (state.abortController && !state.abortController.signal.aborted) {
            state.abortController.abort();
            console.error('请求超时');
        }
    }, 300000);
    
    state.abortTimeoutId = timeoutId;
    
    saveConfig();
    showLoading();
    updateGenerateBtnState();

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
            console.log('响应成功，data:', JSON.stringify(data.data, null, 2));
            
            setStep(3);
            await new Promise(resolve => setTimeout(resolve, 1000));
            setStep(4);
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            displayResult(data.data);
            
            updateScriptState(data.data);
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
        if (state.abortTimeoutId) {
            clearTimeout(state.abortTimeoutId);
            state.abortTimeoutId = null;
        }
        hideLoading();
        updateGenerateBtnState();
    }
}

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

function showLoading() {
    elements.loadingSection.style.display = 'flex';
    elements.resultSection.style.display = 'none';
    elements.errorSection.style.display = 'none';
}

function hideLoading() {
    elements.loadingSection.style.display = 'none';
    elements.generateBtn.disabled = false;
    if (state.lastResult) {
        elements.resultSection.style.display = 'block';
    }
}

function showError(message) {
    console.error('错误:', message);
    elements.errorSection.style.display = 'block';
    elements.resultSection.style.display = 'none';
    elements.errorMessage.textContent = message;
}

function hideError() {
    elements.errorSection.style.display = 'none';
}

function setStep(step) {
    state.currentStep = step;
    elements.steps.forEach((stepEl, index) => {
        const stepNum = index + 1;
        stepEl.classList.remove('pending', 'active', 'completed');

        if (stepNum < step) {
            stepEl.classList.add('completed');
        } else if (stepNum === step) {
            stepEl.classList.add('active');
        } else {
            stepEl.classList.add('pending');
        }
    });
}

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

function cleanText(text) {
    if (!text) return text;
    return text.replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeResult(result) {
    const normalized = { ...result };

    const synopsisCandidate = normalized.synopsis ?? normalized['剧情简介'] ?? normalized['剧情简介和人物设定'] ?? '';
    normalized.synopsis = tryParseJsonString(synopsisCandidate);
    if (typeof normalized.synopsis === 'object' && normalized.synopsis !== null) {
        normalized.synopsis = normalized.synopsis['剧情简介'] || normalized.synopsis['synopsis'] || '';
    }
    normalized.synopsis = cleanText(normalized.synopsis);

    const charactersCandidate = normalized.characters ?? normalized['人物设定'] ?? normalized['人物小传'] ?? '';
    normalized.characters = tryParseJsonString(charactersCandidate);
    if (typeof normalized.characters === 'object' && normalized.characters !== null && !Array.isArray(normalized.characters)) {
        const charsStr = Object.entries(normalized.characters).map(([name, desc]) => `${name}：${desc}`).join('\n');
        normalized.characters = charsStr;
    }
    normalized.characters = cleanText(normalized.characters);

    const shotsCandidate = normalized.shots ?? normalized['分镜列表'] ?? normalized['分镜'] ?? [];
    normalized.shots = tryParseJsonString(shotsCandidate);
    if (!Array.isArray(normalized.shots)) {
        normalized.shots = [];
    }

    normalized.shots = normalized.shots.map((shot, index) => {
        if (shot && typeof shot === 'object') {
            return {
                id: shot.id ?? index + 1,
                title: shot.title ?? shot['主题'] ?? shot['标题'] ?? '',
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
                '景别': shot['景别'] ?? shot.scene ?? '',
                '主题': shot['主题'] ?? ''
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
    
    state.synopsisExpanded = false;
    elements.synopsisSection.classList.remove('expanded');
    
    const resultCards = document.querySelectorAll('.result-card');
    resultCards.forEach((card, index) => {
        const titleEl = card.querySelector('.result-card-title');
        const arrowIcon = titleEl.querySelector('.arrow-icon');
        const contentEl = card.querySelector('.result-card-content');
        
        if (index === 0) {
            titleEl.onclick = () => {
                state.synopsisExpanded = !state.synopsisExpanded;
                contentEl.classList.toggle('expanded', state.synopsisExpanded);
                arrowIcon.classList.toggle('expanded', state.synopsisExpanded);
            };
            
            state.synopsisExpanded = true;
            contentEl.classList.add('expanded');
            arrowIcon.classList.add('expanded');
        }
    });
    
    elements.shotCount.textContent = shots.length;
    elements.shotsList.innerHTML = '';
    
    if (shots.length > 0) {
        shots.forEach((shot, index) => {
            const shotEl = createShotItem(shot, index);
            elements.shotsList.appendChild(shotEl);
        });
        setTimeout(() => {
            document.querySelectorAll('.shot-description-input').forEach(textarea => {
                autoResizeTextarea(textarea);
            });
        }, 0);
    } else {
        elements.shotsList.innerHTML = '<p class="placeholder">暂无分镜内容</p>';
    }
    
    setStep(5);
    elements.resultSection.style.display = 'block';
}

function createShotItem(shot, index) {
    const shotEl = document.createElement('div');
    shotEl.className = 'shot-item';
    shotEl.dataset.id = shot.id || index + 1;
    shotEl.dataset.index = index;
    
    const number = index + 1;
    const duration = shot['时长'] || shot.duration || '';
    const scene = shot['景别'] || shot.scene || '';
    const description = shot['画面描述'] || shot.description || shot['description'] || '';
    const camera = shot['运镜方式'] || shot.camera || '';
    const dialogue = shot['旁白/对话'] || shot.dialogue || '';
    const soundEffect = shot['音效建议'] || shot.soundEffect || '';
    const shotTitle = shot['主题'] || shot.title || shot['标题'] || '';
    
    const title = shotTitle || (description ? description.substring(0, 20) + '...' : `分镜 ${number}`);
    const fullDescription = [
        duration ? `时长：${duration}` : '',
        scene ? `景别：${scene}` : '',
        description ? `画面描述：${description}` : '',
        camera ? `运镜方式：${camera}` : '',
        dialogue ? `旁白/对话：${dialogue}` : '',
        soundEffect ? `音效建议：${soundEffect}` : ''
    ].filter(Boolean).join('\n');
    const descriptionText = fullDescription || '';
    const isExpanded = true;
    
    const deleteIcon = 'https://seal-img.nos-jd.163yun.com/obj/w5rCgMKVw6DCmGzCmsK-/80937475560/732d/78fa/0bfa/ef69a3f36529bf83fb2a51e1081c1b24.png';
    const arrowIcon = 'https://seal-img.nos-jd.163yun.com/obj/w5rCgMKVw6DCmGzCmsK-/80937478858/c347/651d/afa5/bb9fede252f974bddb880ec051aef1e3.png';
    
    shotEl.innerHTML = `
        <div class="shot-item-header">
            <span class="shot-number">${number}</span>
            <input type="text" class="shot-title-input" value="${escapeHtml(title)}">
            <div class="shot-actions">
                <span class="shot-action-btn" data-action="reference" title="引用到聊天">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                        <path d="m12 15-5.5 5.5"/>
                    </svg>
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
    
    const header = shotEl.querySelector('.shot-item-header');
    const expandArrow = shotEl.querySelector('.shot-expand-arrow');
    const content = shotEl.querySelector('.shot-item-content');
    const referenceBtn = shotEl.querySelector('[data-action="reference"]');
    const deleteBtn = shotEl.querySelector('[data-action="delete"]');
    const titleInput = shotEl.querySelector('.shot-title-input');
    const descInput = shotEl.querySelector('.shot-description-input');
    
    header.onclick = (e) => {
        if (e.target === titleInput) return;
        toggleShotExpand(shotEl);
    };
    
    expandArrow.onclick = (e) => {
        e.stopPropagation();
        toggleShotExpand(shotEl);
    };
    
    referenceBtn.onclick = (e) => {
        e.stopPropagation();
        referenceShotToChat(number, title, descriptionText);
    };
    
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        showDeleteConfirm(() => {
            deleteShot(shotEl);
        });
    };
    
    titleInput.addEventListener('input', () => {
        updateShotData(index, 'title', titleInput.value);
    });
    
    descInput.addEventListener('input', () => {
        autoResizeTextarea(descInput);
        updateShotData(index, 'description', descInput.value);
    });
    
    return shotEl;
}

function updateShotData(index, field, value) {
    if (!state.lastResult || !state.lastResult.shots || !state.lastResult.shots[index]) {
        return;
    }
    
    const shot = state.lastResult.shots[index];
    
    if (field === 'title') {
        shot.title = value;
        shot['主题'] = value;
    } else if (field === 'description') {
        const parts = parseDescription(value);
        shot.duration = parts.duration || shot.duration || '';
        shot['时长'] = parts.duration || shot['时长'] || '';
        shot.scene = parts.scene || shot.scene || '';
        shot['景别'] = parts.scene || shot['景别'] || '';
        shot.description = parts.description || shot.description || '';
        shot['画面描述'] = parts.description || shot['画面描述'] || '';
        shot.camera = parts.camera || shot.camera || '';
        shot['运镜方式'] = parts.camera || shot['运镜方式'] || '';
        shot.dialogue = parts.dialogue || shot.dialogue || '';
        shot['旁白/对话'] = parts.dialogue || shot['旁白/对话'] || '';
        shot.soundEffect = parts.soundEffect || shot.soundEffect || '';
        shot['音效建议'] = parts.soundEffect || shot['音效建议'] || '';
    }
    
    saveStateToStorage();
}

function parseDescription(text) {
    const parts = {};
    const lines = text.split('\n');
    
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('时长：')) {
            parts.duration = trimmed.replace('时长：', '');
        } else if (trimmed.startsWith('景别：')) {
            parts.scene = trimmed.replace('景别：', '');
        } else if (trimmed.startsWith('画面描述：')) {
            parts.description = trimmed.replace('画面描述：', '');
        } else if (trimmed.startsWith('运镜方式：')) {
            parts.camera = trimmed.replace('运镜方式：', '');
        } else if (trimmed.startsWith('旁白/对话：')) {
            parts.dialogue = trimmed.replace('旁白/对话：', '');
        } else if (trimmed.startsWith('音效建议：')) {
            parts.soundEffect = trimmed.replace('音效建议：', '');
        }
    });
    
    return parts;
}

function updateShotFromChat(shotIndex, updatedData) {
    const shotItems = elements.shotsList.querySelectorAll('.shot-item');
    const shotEl = shotItems[shotIndex - 1];
    
    if (!shotEl) {
        console.warn(`未找到分镜 ${shotIndex}`);
        return;
    }
    
    const titleInput = shotEl.querySelector('.shot-title-input');
    const descInput = shotEl.querySelector('.shot-description-input');
    
    if (updatedData.title && titleInput) {
        titleInput.value = updatedData.title;
    }
    
    if (updatedData.description && descInput) {
        descInput.value = updatedData.description;
        autoResizeTextarea(descInput);
    }
    
    if (state.lastResult && state.lastResult.shots && state.lastResult.shots[shotIndex - 1]) {
        const shot = state.lastResult.shots[shotIndex - 1];
        
        if (updatedData.title) {
            shot.title = updatedData.title;
            shot['主题'] = updatedData.title;
        }
        
        if (updatedData.description) {
            const parts = parseDescription(updatedData.description);
            shot.duration = parts.duration || shot.duration || '';
            shot['时长'] = parts.duration || shot['时长'] || '';
            shot.scene = parts.scene || shot.scene || '';
            shot['景别'] = parts.scene || shot['景别'] || '';
            shot.description = parts.description || shot.description || '';
            shot['画面描述'] = parts.description || shot['画面描述'] || '';
            shot.camera = parts.camera || shot.camera || '';
            shot['运镜方式'] = parts.camera || shot['运镜方式'] || '';
            shot.dialogue = parts.dialogue || shot.dialogue || '';
            shot['旁白/对话'] = parts.dialogue || shot['旁白/对话'] || '';
            shot.soundEffect = parts.soundEffect || shot.soundEffect || '';
            shot['音效建议'] = parts.soundEffect || shot['音效建议'] || '';
        }
        
        saveStateToStorage();
    }
    
    console.log(`分镜 ${shotIndex} 已更新`);
}

function toggleShotExpand(shotEl) {
    const arrow = shotEl.querySelector('.shot-expand-arrow');
    const content = shotEl.querySelector('.shot-item-content');
    
    const isExpanded = content.classList.toggle('expanded');
    arrow.classList.toggle('expanded', isExpanded);
}

function deleteShot(shotEl) {
    const index = parseInt(shotEl.dataset.index);
    shotEl.remove();
    
    if (state.lastResult && state.lastResult.shots) {
        state.lastResult.shots.splice(index, 1);
        saveStateToStorage();
    }
    
    const shots = elements.shotsList.querySelectorAll('.shot-item');
    elements.shotCount.textContent = shots.length;
    
    shots.forEach((shot, i) => {
        const numberEl = shot.querySelector('.shot-number');
        if (numberEl) {
            numberEl.textContent = i + 1;
        }
        shot.dataset.index = i;
    });
    
    if (shots.length === 0) {
        elements.shotsList.innerHTML = '<p class="placeholder">暂无分镜内容</p>';
    }
}

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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function clearHistory() {
    const confirmed = await showCustomConfirm('确定要清空对话历史吗？', '⚠️');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/clear`, {
            method: 'POST'
        });
        
        if (response.ok) {
            await showCustomAlert('对话历史已清空', '✅');
            location.reload();
        } else {
            throw new Error('清空失败');
        }
    } catch (error) {
        console.error('清空历史失败:', error);
        await showCustomAlert('清空失败: ' + error.message, '❌');
    }
}

function exportScript() {
    if (!state.lastResult) {
        showCustomAlert('没有可导出的剧本，请先生成剧本', '📝');
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

let updateState = {
    version: '',
    downloaded: false
};

function setupElectronUpdateListener() {
    if (!window.electronAPI) {
        console.log('非 Electron 环境，跳过更新监听');
        return;
    }

    window.electronAPI.onUpdateAvailable((info) => {
        console.log('[Update] 发现新版本:', info);
        updateState.version = info.version;
        updateState.downloaded = false;
        
        if (elements.updateBtn) {
            elements.updateBtn.style.display = 'flex';
            elements.updateBtn.classList.remove('downloading', 'downloaded');
            elements.updateBtn.querySelector('.update-text').textContent = `版本 ${info.version}`;
        }
    });

    window.electronAPI.onUpdateDownloadProgress((progress) => {
        console.log('[Update] 下载进度:', progress);
        
        if (elements.updateBtn) {
            elements.updateBtn.classList.add('downloading');
            elements.updateBtn.classList.remove('downloaded');
            elements.updateBtn.querySelector('.update-text').textContent = `${progress.percent}%`;
        }
    });

    window.electronAPI.onUpdateDownloaded((info) => {
        console.log('[Update] 更新下载完成:', info);
        updateState.downloaded = true;
        
        if (elements.updateBtn) {
            elements.updateBtn.classList.remove('downloading');
            elements.updateBtn.classList.add('downloaded');
            elements.updateBtn.querySelector('.update-text').textContent = '立即重启';
        }
    });

    window.electronAPI.onUpdateError((error) => {
        console.error('[Update] 更新错误:', error);
    });
}

async function handleUpdateClick() {
    if (!window.electronAPI) {
        return;
    }

    if (updateState.downloaded) {
        const confirmed = await showCustomConfirm(`版本 ${updateState.version} 已下载完成，是否立即重启应用安装更新？`, '🔄');
        if (confirmed) {
            window.electronAPI.triggerUpdateInstall();
        }
    } else {
        const confirmed = await showCustomConfirm(`发现新版本 ${updateState.version}，是否开始下载更新？`, '📥');
        if (confirmed) {
            window.electronAPI.triggerUpdateDownload();
        }
    }
}

function addChatMessage(message, isUser) {
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${isUser ? 'user' : 'assistant'}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = isUser ? '👤' : '🤖';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'chat-content';
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    
    const highlightedMessage = message.replace(/(\[引用:\d+\])/g, '<span class="reference-tag">$1</span>');
    bubble.innerHTML = highlightedMessage;
    
    const time = document.createElement('div');
    time.className = 'chat-time';
    const now = new Date();
    time.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    contentWrapper.appendChild(bubble);
    contentWrapper.appendChild(time);
    
    messageEl.appendChild(avatar);
    messageEl.appendChild(contentWrapper);
    
    const welcomeEl = elements.chatMessages.querySelector('.chat-welcome');
    if (welcomeEl) {
        welcomeEl.style.display = 'none';
    }
    
    elements.chatMessages.appendChild(messageEl);
    
    scrollToBottom();
}

function scrollToBottom() {
    if (elements.chatMessages) {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
}

async function sendChatMessage() {
    const message = elements.chatInput.innerText.trim();
    if (!message) return;
    
    const apiKey = elements.apiKeyInput.value.trim();
    if (!apiKey) {
        await showCustomAlert('请先输入 API 密钥', '🔑');
        return;
    }
    
    elements.chatInput.innerHTML = '';
    elements.sendChatBtn.disabled = true;
    
    addChatMessage(message, true);
    
    const resolvedMessage = resolveReferences(message);
    
    console.log('发送给后端的完整消息:', resolvedMessage);
    
    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: resolvedMessage,
                api_key: apiKey,
                model_name: elements.modelNameInput.value.trim()
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const responseText = data.data.response;
            addChatMessage(responseText, false);
            parseAndUpdateShotsFromResponse(responseText);
        } else {
            await showCustomAlert(data.error || '聊天失败', '❌');
        }
    } catch (error) {
        console.error('聊天失败:', error);
        await showCustomAlert('网络错误，请检查后端服务是否启动', '❌');
    } finally {
        elements.sendChatBtn.disabled = false;
    }
}

function parseAndUpdateShotsFromResponse(response) {
    const shotPattern = /第\s*(\d+)\s*镜[\s\S]*?(?=第\s*\d+\s*镜|$)/g;
    let match;
    
    while ((match = shotPattern.exec(response)) !== null) {
        const shotIndex = parseInt(match[1]);
        const shotContent = match[0];
        
        let title = '';
        const titleMatch = shotContent.match(/标题[：:]?\s*(.+)/);
        if (titleMatch) {
            title = titleMatch[1].trim();
        }
        
        let description = '';
        const descMatch = shotContent.match(/画面描述[：:]?\s*[\s\S]+?(?=\n\s*\w+[：:]|$)/);
        if (descMatch) {
            description = descMatch[0].replace(/画面描述[：:]?\s*/, '').trim();
        }
        
        if (title || description) {
            updateShotFromChat(shotIndex, { title, description: description || shotContent });
        }
    }
}

function clearChat() {
    elements.chatMessages.innerHTML = `
        <div class="chat-welcome">
            <span class="welcome-icon">👤</span>
            <p>你好！我是你的剧本助手。</p>
            <p>上传图片后输入要求即可生成剧本。</p>
            <p>点击分镜后可以引用到这里进行修改。</p>
        </div>
    `;
}

const referencedShots = [];

function referenceShotToChat(shotIndex, shotTitle, shotContent) {
    const referenceId = `[引用:${shotIndex}]`;
    referencedShots.push({
        id: referenceId,
        index: shotIndex,
        title: shotTitle,
        content: shotContent
    });
    
    const tag = document.createElement('span');
    tag.className = 'reference-tag';
    tag.textContent = referenceId;
    tag.setAttribute('data-reference', referenceId);
    tag.setAttribute('contenteditable', 'false');
    
    elements.chatInput.focus();
    
    const range = document.createRange();
    const selection = window.getSelection();
    
    if (elements.chatInput.childNodes.length > 0) {
        const lastChild = elements.chatInput.lastChild;
        range.selectNodeContents(lastChild);
        range.collapse(false);
    } else {
        range.selectNodeContents(elements.chatInput);
        range.collapse(true);
    }
    
    if (elements.chatInput.innerText.trim()) {
        range.insertNode(document.createTextNode('\n'));
        range.collapse(false);
    }
    
    range.insertNode(tag);
    range.collapse(false);
    
    selection.removeAllRanges();
    selection.addRange(range);
}

function resolveReferences(message) {
    let resolved = message;
    referencedShots.forEach(shot => {
        const replacement = `\n\n【第${shot.index}镜：${shot.title}】\n${shot.content}\n`;
        resolved = resolved.replace(shot.id, replacement);
    });
    return resolved;
}

async function updateScriptState(scriptData) {
    try {
        const response = await fetch(`${API_BASE_URL}/update-script`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scriptData)
        });
        
        const data = await response.json();
        if (data.success) {
            console.log('剧本状态已更新到后端');
        }
    } catch (error) {
        console.error('更新剧本状态失败:', error);
    }
}

document.addEventListener('DOMContentLoaded', init);