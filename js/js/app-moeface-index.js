window.pageMeta = {
    content_type: "app",
    page_name: "moeface",
    category: ""
};

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-TR4FT7JPDZ');

// ========== 配置 ==========
const CONFIG = {
    // 检测模型与特征库全部随本站静态托管
    MODEL_URLS: [
        'models/',
        'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/'
    ],
    // 与桌面端同源的 FaceNet(InceptionResnetV1/vggface2)，PyTorch 导出后转 float16
    // （int8 动态量化版本在 onnxruntime-web 的 wasm 后端没有 ConvInteger 实现，跑不了）
    FACENET_URLS: [
        'models/facenet_fp16.onnx'
    ],
    FEATURE_DB_FALLBACKS: ['features/features.moe'],
    // 特征库由 FaceNet(InceptionResnetV1/vggface2) 生成，512 维
    FEATURE_DIM: 512,
    // 桌面端预处理尺寸
    FACENET_SIZE: 160
};

let modelsReady = false;
let facenetSession = null;
let database = null;
let negativeDatabase = null;
let currentImage = null;
let detections = [];
let activeAnimation = null;

// DOM
const els = {
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),
    loadingProgress: document.getElementById('loadingProgress'),
    statusModels: document.getElementById('statusModels'),
    statusDB: document.getElementById('statusDB'),
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    previewContainer: document.getElementById('previewContainer'),
    previewImage: document.getElementById('previewImage'),
    canvasOverlay: document.getElementById('canvasOverlay'),
    controls: document.getElementById('controls'),
    threshold: document.getElementById('threshold'),
    thresholdValue: document.getElementById('thresholdValue'),
    recognizeBtn: document.getElementById('recognizeBtn'),
    clearBtn: document.getElementById('clearBtn'),
    results: document.getElementById('results'),
    faceCount: document.getElementById('faceCount'),
    resultList: document.getElementById('resultList'),
    noResult: document.getElementById('noResult'),
    logContainer: document.getElementById('logContainer'),
    charCount: document.getElementById('charCount'),
    engineState: document.getElementById('engineState'),
    realtimeToggle: document.getElementById('realtimeToggle'),
    realtimeHint: document.getElementById('realtimeHint'),
    cameraBar: document.getElementById('cameraBar'),
    cameraVideo: document.getElementById('cameraVideo'),
    cameraCanvas: document.getElementById('cameraCanvas'),
    cameraHint: document.getElementById('cameraHint')
};

// 实时识别状态
let cameraStream = null;
let realtimeRunning = false;
let realtimeBusy = false;

function log(message, type = 'info') {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="log-time">[${time}]</span>${escapeHtml(String(message))}`;
    els.logContainer.appendChild(entry);
    els.logContainer.scrollTop = els.logContainer.scrollHeight;
    console.log(`[${type}] ${message}`);
}

function setEngineState(text, cls = '') {
    els.engineState.textContent = text;
    els.engineState.className = `engine-state ${cls}`;
}

function updateStatus(elementId, text, status) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.className = `status-item ${status}`;
    const span = el.querySelector('span:last-child');
    if (span) span.textContent = text;
}

function setProgress(text, percent) {
    els.loadingText.textContent = text;
    els.loadingProgress.style.width = `${percent}%`;
}

function hideLoading() {
    els.loadingOverlay.classList.add('hidden');
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}

// ========== 相似度 ==========
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
}

/**
 * 比对浏览器端 FaceNet 嵌入与特征库向量。
 *
 * 现在两边是同源模型（同一份 InceptionResnetV1/vggface2 权重、同一套
 * resize 160×160 → /255 → NCHW 预处理），余弦值可以直接当相似度用。
 * 动漫人脸特征普遍靠得很近，常见分布是"命中 0.75~0.90、干扰 0.55~0.75"，
 * 所以阈值默认给 0.68，而不是桌面端真人脸的 0.45。
 */
function matchDescriptor(desc, refVec) {
    if (!desc || !refVec || desc.length !== refVec.length) return 0;
    const sim = cosineSimilarity(desc, refVec);
    return Number.isFinite(sim) ? Math.max(0, sim) : 0;
}

// ========== 特征库加载（.moe 格式） ==========
async function fetchText(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
        const res = await fetch(url, { signal: controller.signal, cache: 'force-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } finally {
        clearTimeout(timer);
    }
}

async function loadDatabase() {
    log('正在加载特征库...');
    updateStatus('statusDB', '特征库加载中...', '');

    let text = null;
    let lastErr = null;
    for (const url of CONFIG.FEATURE_DB_FALLBACKS) {
        try {
            setProgress('下载特征库...', 15);
            text = await fetchText(url);
            log(`特征库已获取 (${(text.length / 1048576).toFixed(2)} MB)`, 'success');
            break;
        } catch (err) {
            lastErr = err;
            log(`通道失败 ${url.split('/')[0]}: ${err.message}`, 'warning');
        }
    }
    if (!text) throw lastErr || new Error('所有特征库通道均不可用');

    setProgress('解析特征库...', 45);
    const data = parseMoe(text);
    const total = Object.keys(data).length;
    if (total === 0) throw new Error('.moe 解析结果为空，格式可能已变更');
    log(`特征库解析完成，共 ${total} 个条目`);

    // 分离负面特征（"负面_" 前缀）
    const NEG_PREFIX = '负面_';
    const negEntries = {};
    const posEntries = {};
    for (const [name, vec] of Object.entries(data)) {
        if (name.startsWith(NEG_PREFIX)) negEntries[name.slice(NEG_PREFIX.length)] = vec;
        else posEntries[name] = vec;
    }
    database = posEntries;
    negativeDatabase = Object.keys(negEntries).length > 0 ? negEntries : null;

    const posCount = Object.keys(database).length;
    const negCount = negativeDatabase ? Object.keys(negativeDatabase).length : 0;
    log(`角色特征 ${posCount} 个 | 负面特征 ${negCount} 个类别`, 'success');
    updateStatus('statusDB', `特征库 ${posCount} 角色`, 'ready');
    els.charCount.textContent = posCount;

    const negStatusEl = document.getElementById('statusNegDB');
    if (negStatusEl) {
        if (negCount > 0) {
            negStatusEl.hidden = false;
            negStatusEl.querySelector('span:last-child').textContent = `负面 ${negCount} 类`;
            negStatusEl.className = 'status-item ready';
        } else {
            negStatusEl.hidden = true;
        }
    }
    return { posCount, negCount };
}

/**
 * 解析 .moe：("角色名"{eye:浮点,...:nose:浮点,...}..."角色名2"{...})
 * 同一角色所有部位向量按分量取平均，得到一条 512 维代表向量。
 */
function parseMoe(text) {
    const out = {};
    let raw = text.trim();
    if (!raw.startsWith('(') || !raw.endsWith(')')) {
        throw new Error('.moe 格式错误：缺少外层括号');
    }
    raw = raw.slice(1, -1);
    const segments = raw.split('"');

    let vecDim = null;
    for (let i = 1; i + 1 < segments.length; i += 2) {
        const charName = segments[i].trim();
        const block = segments[i + 1].trim();
        if (!charName || !block.startsWith('{') || !block.endsWith('}')) continue;

        let content = block.slice(1, -1);
        if (content.endsWith(':')) content = content.slice(0, -1);
        if (!content) continue;

        const parts = content.split(':');
        let sumVec = null;
        let partCount = 0;

        for (let j = 0; j + 1 < parts.length; j += 2) {
            const valStr = parts[j + 1];
            if (!valStr || valStr === 'placeholder') continue;
            const floats = valStr.split(',').map(Number);
            if (!floats.length || floats.some(Number.isNaN)) continue;
            if (vecDim === null) vecDim = floats.length;
            if (floats.length !== vecDim) continue; // 维度不一致的部件直接丢弃

            if (!sumVec) sumVec = new Float32Array(vecDim);
            for (let k = 0; k < vecDim; k++) sumVec[k] += floats[k];
            partCount++;
        }

        if (sumVec && partCount > 0) {
            const avg = new Float32Array(vecDim);
            for (let k = 0; k < vecDim; k++) avg[k] = sumVec[k] / partCount;
            out[charName] = avg;
        }
    }
    return out;
}

// ========== 模型加载 ==========
async function loadModels() {
    log('正在加载动漫人脸检测模型...');
    updateStatus('statusModels', '模型加载中...', '');

    let lastErr = null;
    for (const base of CONFIG.MODEL_URLS) {
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(base),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(base)
            ]);
            if (!base.startsWith('models/')) log('本地检测模型不可用，已回退 CDN', 'warning');
            log('检测模型加载完成', 'success');
            updateStatus('statusModels', '检测模型就绪', 'ready');
            return true;
        } catch (err) {
            lastErr = err;
            log(`检测模型通道失败 ${base.startsWith('models/') ? '本站' : 'CDN'}: ${err.message}`, 'warning');
        }
    }
    log(`检测模型加载失败: ${lastErr ? lastErr.message : '未知错误'}`, 'error');
    updateStatus('statusModels', '模型失败', 'error');
    throw lastErr || new Error('检测模型加载失败');
}

// ========== FaceNet 特征提取（ONNX Runtime Web） ==========
async function loadFaceNet() {
    if (typeof ort === 'undefined') {
        log('ONNX Runtime Web 未加载，无法做角色匹配', 'error');
        return false;
    }
    for (const url of CONFIG.FACENET_URLS) {
        try {
            setProgress('加载 FaceNet 特征模型...', 70);
            // wasm 后缀：纯前端、无需 WebGL，兼容性最好
            ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
            ort.env.wasm.numThreads = 1;
            facenetSession = await ort.InferenceSession.create(url, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all'
            });
            log('FaceNet 特征模型加载完成（512 维，与特征库同源）', 'success');
            updateStatus('statusDB', '特征引擎就绪', 'ready');
            return true;
        } catch (err) {
            log(`FaceNet 加载失败 ${url.startsWith('models/') ? '本站' : 'CDN'}: ${err.message}`, 'warning');
            facenetSession = null;
        }
    }
    return false;
}

/**
 * 从原图裁出人脸框，按桌面端流程提特征：
 * BGR/RGB 无关（都是通道顺序一致的 RGB）→ resize 160×160 → /255 → NCHW → FaceNet
 */
async function extractFaceNetEmbedding(imgEl, box) {
    if (!facenetSession) return null;
    const S = CONFIG.FACENET_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    // 稍微外扩，避免把下巴/发际线切掉（动漫脸级联框偏紧）
    const pad = 0.06;
    const x = Math.max(0, box.x - box.width * pad);
    const y = Math.max(0, box.y - box.height * pad);
    const w = Math.min(imgEl.naturalWidth - x, box.width * (1 + pad * 2));
    const h = Math.min(imgEl.naturalHeight - y, box.height * (1 + pad * 2));
    ctx.drawImage(imgEl, x, y, w, h, 0, 0, S, S);

    const data = ctx.getImageData(0, 0, S, S).data;
    const input = new Float32Array(3 * S * S);
    const plane = S * S;
    for (let i = 0; i < plane; i++) {
        const p = i * 4;
        input[i] = data[p] / 255;              // R
        input[plane + i] = data[p + 1] / 255;  // G
        input[plane * 2 + i] = data[p + 2] / 255; // B
    }

    const tensor = new ort.Tensor('float32', input, [1, 3, S, S]);
    const feeds = {};
    feeds[facenetSession.inputNames[0]] = tensor;
    const out = await facenetSession.run(feeds);
    const emb = out[facenetSession.outputNames[0]].data;
    return Array.from(emb);
}

// ========== 初始化 ==========
async function prepareTensorflowBackend() {
    if (typeof faceapi === 'undefined') {
        log('face-api.js 未能加载（CDN 被拦截？）—— 无法识别', 'error');
        return false;
    }
    try {
        // 优先 WebGL，不可用时退回 CPU（虚拟显卡 / 远程桌面 / 集显驱动异常时 WebGL 会卡死）
        const ok = await faceapi.tf.setBackend('webgl');
        if (!ok) await faceapi.tf.setBackend('cpu');
        await faceapi.tf.ready();
        log(`运算后端: ${faceapi.tf.getBackend()}`, 'info');
        return true;
    } catch (err) {
        try {
            await faceapi.tf.setBackend('cpu');
            await faceapi.tf.ready();
            log('WebGL 不可用，已切到 CPU 后端（速度会慢一些）', 'warning');
            return true;
        } catch (e2) {
            log(`TensorFlow 后端初始化失败: ${e2.message}`, 'error');
            return false;
        }
    }
}

async function initialize() {
    if (!(await prepareTensorflowBackend())) {
        updateStatus('statusModels', 'AI 引擎失败', 'error');
        updateStatus('statusDB', '未加载', 'error');
        setEngineState('AI 引擎初始化失败：浏览器或网络拦截了 face-api.js，请刷新重试', 'error');
        setProgress('初始化失败', 100);
        setTimeout(hideLoading, 600);
        return;
    }

    setProgress('初始化...', 5);
    const dbTask = loadDatabase().catch(err => {
        log(`特征库加载失败: ${err.message}`, 'error');
        updateStatus('statusDB', '特征库加载失败', 'error');
        els.charCount.textContent = '0';
        return null;
    });
    const detTask = loadModels().catch(() => false);
    const fnTask = loadFaceNet().catch(() => false);

    const [detOk, dbInfo, fnOk] = await Promise.all([detTask, dbTask, fnTask]);
    const detReady = document.getElementById('statusModels').classList.contains('ready');
    modelsReady = detReady && !!database && !!facenetSession;

    setProgress('就绪', 100);
    setTimeout(hideLoading, 300);

    if (modelsReady) {
        const n = Object.keys(database).length;
        setEngineState(`引擎就绪 · ${n} 个角色特征 · 512 维 FaceNet`, 'ready');
        log('MoeFace 初始化完成', 'success');
        if (currentImage) els.recognizeBtn.disabled = false;
        els.realtimeToggle.disabled = false;
        setRealtimeHint('勾选后开启摄像头，边看边识别');
    } else {
        const missing = [];
        if (!detReady) missing.push('人脸检测模型');
        if (!database) missing.push('特征库');
        if (!facenetSession) missing.push('FaceNet 特征模型');
        setEngineState(`初始化不完整，缺少：${missing.join('、')} —— 刷新页面重试`, 'error');
    }
}

// ========== 上传 / 预览 ==========
function setupUploadHandlers() {
    els.fileInput.addEventListener('change', e => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
    els.uploadZone.addEventListener('dragover', e => {
        e.preventDefault();
        els.uploadZone.classList.add('dragover');
    });
    els.uploadZone.addEventListener('dragleave', () => els.uploadZone.classList.remove('dragover'));
    els.uploadZone.addEventListener('drop', e => {
        e.preventDefault();
        els.uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    els.threshold.addEventListener('input', () => {
        els.thresholdValue.textContent = parseFloat(els.threshold.value).toFixed(2);
    });
    els.recognizeBtn.addEventListener('click', recognize);
    els.clearBtn.addEventListener('click', clearAll);
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        log('请上传图片文件', 'warning');
        return;
    }
    const reader = new FileReader();
    reader.onload = e => {
        currentImage = e.target.result;
        showPreview(currentImage);
    };
    reader.onerror = () => log('图片读取失败', 'error');
    reader.readAsDataURL(file);
}

function showPreview(src) {
    els.previewImage.src = src;
    els.previewContainer.classList.add('show');
    els.uploadZone.style.display = 'none';
    els.controls.hidden = false;
    els.results.classList.remove('show');
    els.previewImage.onload = () => {
        syncCanvasSize();
        log(`图片尺寸 ${els.previewImage.naturalWidth}x${els.previewImage.naturalHeight}`);
    };
    els.recognizeBtn.disabled = !(modelsReady && database);
}

function syncCanvasSize() {
    const img = els.previewImage;
    const rect = img.getBoundingClientRect();
    // 用显示尺寸 × DPR 提高描边清晰度
    const dpr = window.devicePixelRatio || 1;
    els.canvasOverlay.width = Math.round(rect.width * dpr);
    els.canvasOverlay.height = Math.round(rect.height * dpr);
    els.canvasOverlay.style.width = `${rect.width}px`;
    els.canvasOverlay.style.height = `${rect.height}px`;
    els.canvasOverlay.style.left = `${(img.offsetWidth - rect.width) / 2}px`;

    const ctx = els.canvasOverlay.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clearAll() {
    if (activeAnimation) {
        cancelAnimationFrame(activeAnimation);
        activeAnimation = null;
    }
    currentImage = null;
    detections = [];
    els.previewContainer.classList.remove('show');
    els.uploadZone.style.display = 'block';
    els.controls.hidden = true;
    els.results.classList.remove('show');
    els.noResult.hidden = true;
    els.fileInput.value = '';
    els.previewImage.removeAttribute('src');
    const ctx = els.canvasOverlay.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, els.canvasOverlay.width, els.canvasOverlay.height);
    els.resultList.innerHTML = '';
    log('已清空，可上传新图片');
}

// ========== 粒子汇聚动画 ==========
function startParticleConvergence(boxes, ctx, w, h, duration, callback) {
    if (activeAnimation) {
        cancelAnimationFrame(activeAnimation);
        activeAnimation = null;
    }
    const PARTICLES_PER_FACE = 200;
    const particles = [];
    const startTime = performance.now();

    for (const box of boxes) {
        const perEdge = Math.floor(PARTICLES_PER_FACE / 4);
        const targets = [];
        for (let i = 0; i <= perEdge; i++) targets.push({ x: box.x + box.w * i / perEdge, y: box.y });
        for (let i = 0; i <= perEdge; i++) targets.push({ x: box.x + box.w * i / perEdge, y: box.y + box.h });
        for (let i = 1; i < perEdge; i++) targets.push({ x: box.x, y: box.y + box.h * i / perEdge });
        for (let i = 1; i < perEdge; i++) targets.push({ x: box.x + box.w, y: box.y + box.h * i / perEdge });
        for (const t of targets) {
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                tx: t.x,
                ty: t.y
            });
        }
    }

    if (!particles.length) {
        if (callback) callback();
        return;
    }

    function drawBoxes() {
        ctx.clearRect(0, 0, w, h);
        for (const box of boxes) {
            ctx.strokeStyle = '#0EA5E9';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(box.x, box.y, box.w, box.h);
        }
    }

    function animate(now) {
        const t = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = `rgba(14, 165, 233, ${0.85 - t * 0.4})`;
        for (const p of particles) {
            const cx = p.x + (p.tx - p.x) * ease;
            const cy = p.y + (p.ty - p.y) * ease;
            ctx.beginPath();
            ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
        if (t < 1) {
            activeAnimation = requestAnimationFrame(animate);
        } else {
            activeAnimation = null;
            drawBoxes();
            if (callback) callback();
        }
    }
    activeAnimation = requestAnimationFrame(animate);
}

// ========== 检测（只负责找人脸框） ==========
async function detectFaces() {
    const img = els.previewImage;
    const attempts = [
        new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.20 }),
        new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.12 }),
        new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.08 })
    ];
    for (let i = 0; i < attempts.length; i++) {
        try {
            const res = await faceapi.detectAllFaces(img, attempts[i]);
            if (res.length > 0) {
                if (i > 0) log(`第 ${i + 1} 档检测参数命中`, 'info');
                return res;
            }
        } catch (err) {
            log(`检测尝试 ${i + 1} 出错: ${err.message}`, 'warning');
        }
    }
    return [];
}

// ========== 匹配 ==========
function matchAll(descriptors, threshold) {
    const perFace = [];
    for (const desc of descriptors) {
        const hits = [];
        for (const [name, refVec] of Object.entries(database)) {
            const sim = matchDescriptor(desc, refVec);
            if (sim >= threshold) hits.push({ name, similarity: sim });
        }
        hits.sort((a, b) => b.similarity - a.similarity);
        perFace.push(hits.slice(0, 3));
    }
    return perFace;
}

function bestOf(descriptors) {
    let best = { name: '', similarity: 0 };
    for (const desc of descriptors) {
        for (const [name, refVec] of Object.entries(database)) {
            const sim = matchDescriptor(desc, refVec);
            if (sim > best.similarity) best = { name, similarity: sim };
        }
    }
    return best;
}

async function recognize() {
    if (!modelsReady) {
        log('引擎未就绪（检测模型 / 特征库 / FaceNet 缺一不可），刷新页面重试', 'error');
        return;
    }
    if (!currentImage) {
        log('请先上传图片', 'warning');
        return;
    }

    const threshold = parseFloat(els.threshold.value);
    els.recognizeBtn.disabled = true;
    els.recognizeBtn.textContent = '识别中...';
    els.noResult.hidden = true;
    els.resultList.innerHTML = '';
    log(`开始识别（阈值 ${threshold.toFixed(2)}）`);

    try {
        syncCanvasSize();
        const raw = await detectFaces();

        if (raw.length === 0) {
            log('未检测到人脸区域 —— 动漫脸和真人脸差异大，换更清晰的正脸特写效果会好很多', 'warning');
            els.results.classList.add('show');
            els.faceCount.textContent = '0 张人脸';
            els.noResult.hidden = false;
            return;
        }
        log(`检测到 ${raw.length} 个人脸区域`, 'success');
        detections = raw;

        const img = els.previewImage;
        const rect = img.getBoundingClientRect();
        const sx = rect.width / img.naturalWidth;
        const sy = rect.height / img.naturalHeight;
        const boxes = raw.map(d => {
            // detectAllFaces 不带 .withFaceLandmarks() 时返回的是 FaceDetection 本身
            const b = (d.detection ? d.detection.box : d.box);
            return { x: b.x * sx, y: b.y * sy, w: b.width * sx, h: b.height * sy };
        });

        const ctx = els.canvasOverlay.getContext('2d');
        await new Promise(resolve => {
            startParticleConvergence(boxes, ctx, rect.width, rect.height, 700, resolve);
        });

        // 用 FaceNet 提取 512 维特征
        const embeddings = [];
        for (let i = 0; i < raw.length; i++) {
            const t0 = performance.now();
            const box = raw[i].detection ? raw[i].detection.box : raw[i].box;
            const emb = await extractFaceNetEmbedding(img, box);
            if (emb) {
                embeddings.push(emb);
                log(`人脸 #${i + 1} 特征提取完成（${Math.round(performance.now() - t0)}ms）`);
            } else {
                log(`人脸 #${i + 1} 特征提取失败`, 'warning');
            }
        }

        if (!embeddings.length) {
            log('所有人脸都提取不到特征，重试或换图', 'error');
            displayResults([], raw.length);
            return;
        }

        const perFace = matchAll(embeddings, threshold);
        const merged = [].concat(...perFace);

        if (merged.length === 0) {
            const best = bestOf(embeddings);
            if (best.similarity > 0.45) {
                log(`最接近的是「${best.name}」，得分 ${(best.similarity * 100).toFixed(1)}%，低于阈值 ${threshold.toFixed(2)}`, 'warning');
                log(`可以把阈值降到 ${Math.max(0.25, best.similarity - 0.03).toFixed(2)} 再试一次`);
            } else {
                log('所有候选分数都很低，这张图大概率不在特征库覆盖范围内', 'warning');
            }
            displayResults([], raw.length);
        } else {
            displayResults(merged, raw.length);
        }
    } catch (err) {
        log(`识别异常: ${err.message}`, 'error');
        console.error(err);
    } finally {
        els.recognizeBtn.disabled = false;
        els.recognizeBtn.textContent = '开始识别';
    }
}

function displayResults(matches, faceCountVal) {
    els.results.classList.add('show');
    els.faceCount.textContent = `${faceCountVal} 张人脸`;

    if (!matches.length) {
        els.resultList.innerHTML = '';
        els.noResult.hidden = false;
        return;
    }
    els.noResult.hidden = true;

    const unique = new Map();
    for (const m of matches) {
        const prev = unique.get(m.name);
        if (!prev || prev.similarity < m.similarity) unique.set(m.name, m);
    }
    const sorted = Array.from(unique.values()).sort((a, b) => b.similarity - a.similarity);

    els.resultList.innerHTML = '';
    sorted.slice(0, 10).forEach((m, idx) => {
        const cls = m.similarity >= 0.7 ? 'high' : (m.similarity >= 0.55 ? 'medium' : 'low');
        const item = document.createElement('div');
        item.className = `result-item${idx === 0 ? ' top' : ''}`;
        item.innerHTML = `<span class="result-rank">#${idx + 1}</span>
                          <span class="result-name">${escapeHtml(m.name)}</span>
                          <span class="result-score ${cls}">${(m.similarity * 100).toFixed(1)}%</span>`;
        els.resultList.appendChild(item);
    });
    log(`命中 ${sorted.length} 个角色，最高「${sorted[0].name}」${(sorted[0].similarity * 100).toFixed(1)}%`, 'success');
}

// ========== 实时人脸识别（摄像头） ==========
const RT = {
    WIDTH: 640,
    INTERVAL: 350,   // 两次推理之间的最小间隔（ms），避免 CPU 吃满
    KEY: 'moeface_realtime'
};

function setRealtimeHint(text, cls = '') {
    els.realtimeHint.textContent = text;
    els.realtimeHint.className = `realtime-hint ${cls}`;
}

async function startRealtime() {
    if (realtimeRunning) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setRealtimeHint('当前浏览器不支持摄像头调用（需要 https 或 localhost）');
        log('浏览器不支持 getUserMedia，实时识别不可用', 'error');
        els.realtimeToggle.checked = false;
        return;
    }
    try {
        setRealtimeHint('正在请求摄像头权限...');
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: RT.WIDTH }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false
        });
        els.cameraVideo.srcObject = cameraStream;
        await els.cameraVideo.play().catch(() => {});
        els.cameraBar.classList.add('show');
        realtimeRunning = true;
        setRealtimeHint('实时识别中 · 把动漫图怼到镜头前试试', 'ready');
        log('摄像头已开启，开始实时人脸识别', 'success');
        realtimeLoop();
    } catch (err) {
        const msg = err && err.name === 'NotAllowedError'
            ? '摄像头权限被拒绝 —— 在地址栏图标里重新允许后重试'
            : `摄像头打开失败：${err.message}`;
        setRealtimeHint(msg);
        log(msg, 'error');
        els.realtimeToggle.checked = false;
        stopRealtime(true);
    }
}

function stopRealtime(silent = false) {
    realtimeRunning = false;
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    if (els.cameraVideo) els.cameraVideo.srcObject = null;
    els.cameraBar.classList.remove('show');
    els.cameraHint.textContent = '摄像头实时识别已停止';
    const ctx = els.canvasOverlay.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, els.canvasOverlay.width, els.canvasOverlay.height);
    if (!silent) {
        setRealtimeHint('已停止 · 勾选可重新开启');
        log('实时识别已停止');
    }
}

async function realtimeLoop() {
    if (!realtimeRunning) return;
    if (realtimeBusy) {
        setTimeout(realtimeLoop, 120);
        return;
    }
    realtimeBusy = true;
    try {
        await realtimeTick();
    } catch (err) {
        console.warn('实时识别异常', err);
    } finally {
        realtimeBusy = false;
        if (realtimeRunning) setTimeout(realtimeLoop, RT.INTERVAL);
    }
}

async function realtimeTick() {
    const v = els.cameraVideo;
    if (!v.videoWidth) return;

    const w = Math.min(RT.WIDTH, v.videoWidth);
    const h = Math.round(v.videoHeight * (w / v.videoWidth));
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    off.getContext('2d').drawImage(v, 0, 0, w, h);

    const dets = await faceapi.detectAllFaces(off, new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.25
    }));

    const canvas = els.cameraCanvas;
    const rect = v.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(rect.width * dpr);
    const ch = Math.round(rect.height * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!dets.length) {
        els.cameraHint.textContent = '实时识别中 · 没有检测到人脸';
        els.faceCount.textContent = '0 张人脸';
        return;
    }

    // 视频按 object-fit: contain 显示，坐标要按实际缩放比映射
    const scale = Math.min(rect.width / v.videoWidth, rect.height / v.videoHeight);
    const offX = (rect.width - v.videoWidth * scale) / 2;
    const offY = (rect.height - v.videoHeight * scale) / 2;
    const threshold = parseFloat(els.threshold.value) - 0.06; // 视频帧质量差，略放宽
    const allMatches = [];

    for (const d of dets) {
        const box = d.box || (d.detection && d.detection.box);
        if (!box) continue;
        const emb = await extractFaceNetEmbedding(off, {
            x: box.x, y: box.y, width: box.width, height: box.height
        });
        let label = '?';
        let score = 0;
        if (emb) {
            // 局部比对：直接用真实分数
            let top = { name: '', similarity: 0 };
            for (const [name, vec] of Object.entries(database)) {
                const s = matchDescriptor(emb, vec);
                if (s > top.similarity) top = { name, similarity: s };
            }
            if (top.similarity >= threshold) {
                label = `${top.name} ${(top.similarity * 100).toFixed(0)}%`;
                score = top.similarity;
                allMatches.push(top);
            } else {
                label = '未知角色';
            }
        }

        const x = offX + box.x * scale;
        const y = offY + box.y * scale;
        const bw = box.width * scale;
        const bh = box.height * scale;
        ctx.strokeStyle = score ? '#0EA5E9' : '#94A3B8';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x, y, bw, bh);

        if (label) {
            ctx.font = '600 13px system-ui, sans-serif';
            const tw = ctx.measureText(label).width + 12;
            const ty = y > 22 ? y - 20 : y + bh + 4;
            ctx.fillStyle = score ? 'rgba(14,165,233,0.92)' : 'rgba(100,116,139,0.85)';
            ctx.fillRect(x, ty, tw, 19);
            ctx.fillStyle = '#fff';
            ctx.fillText(label, x + 6, ty + 14);
        }
    }

    els.faceCount.textContent = `${dets.length} 张人脸`;
    els.cameraHint.textContent = allMatches.length
        ? `实时识别中 · 命中：${allMatches.map(m => m.name).join('、')}`
        : `实时识别中 · 检测到 ${dets.length} 张人脸，暂未命中已知角色`;

    if (allMatches.length) {
        els.results.classList.add('show');
        displayResults(allMatches, dets.length);
    }
}

window.addEventListener('resize', () => {
    if (els.previewContainer.classList.contains('show')) syncCanvasSize();
});

// 摄像头复选框
els.realtimeToggle.addEventListener('change', () => {
    if (els.realtimeToggle.checked) {
        startRealtime();
    } else {
        stopRealtime();
    }
});

// 离开页面务必释放摄像头
window.addEventListener('pagehide', () => stopRealtime(true));

document.addEventListener('DOMContentLoaded', () => {
    setupUploadHandlers();
    initialize();
});
