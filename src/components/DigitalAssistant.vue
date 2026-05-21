<template>
  <div class="page-container">
    <!-- 左侧侧边栏 (添加 overflow: hidden) -->
    <aside class="sidebar" :class="{ 'collapsed': !isSidebarOpen }">
      <div class="sidebar-inner">
        <!-- ... 这里保留原本的所有侧边栏内容 ... -->

        <!-- 测试音频按钮 -->
        <div class="row">
          <button class="btn btn-default" @click="handlePlayTestAudio">测试音频</button>
        </div>

        <!-- 场景选择 -->
        <div class="row control-group">
          <label>选择数字人模型：</label>
          <div class="flex-row">
            <select v-model="selectedScene" class="form-select" ref="selected">
              <option value="eva">EVA RIN</option>
              <option value="hiyori">Hiyori</option>
              <option value="kei">kei_vowels_pro</option>
              <option value="march7th">March 7th</option>
              <option value="nova">Nova</option>
              <option value="pachan">Pachan</option>
            </select>
            <button class="btn btn-default">更新场景</button>
          </div>
        </div>

        <!-- 眼神跟随 -->
        <div class="row control-group">
          <label>眼神跟随鼠标：</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" value="follow" v-model="eyeTracking" />
              <span class="radio-text">跟随鼠标</span>
            </label>
            <label class="radio-label">
              <input type="radio" value="straight" v-model="eyeTracking" />
              <span class="radio-text">前方直视</span>
            </label>
          </div>
        </div>

        <!-- 聊天交互卡片 -->
        <div class="card">
          <div class="card-header">聊天交互</div>
          <div class="card-body">
            <div class="flex-row mb-2">
              <input type="text" v-model="chatInput" class="form-input" placeholder="输入消息..." />
              <button class="btn btn-default" @click="sendMessage">发送消息</button>
            </div>
            <textarea class="form-textarea readonly" readonly v-model="chatResponse"></textarea>
          </div>
        </div>

        <!-- 语音合成卡片 -->
        <div class="card">
          <div class="card-header">语音合成</div>
          <div class="card-body">
            <textarea class="form-textarea mb-2" v-model="ttsInput"></textarea>
            <div class="flex-row button-group">
              <button class="btn btn-default">并行推理</button>
              <button class="btn btn-default">流式推理</button>
              <button class="btn btn-default">停止讲话</button>
            </div>
          </div>
        </div>

      </div>
    </aside>

    <!-- ★ 重点：按钮移到了这里，并根据状态控制位置 -->
    <div class="toggle-btn" :class="{ 'collapsed': !isSidebarOpen }" @click="toggleSidebar" title="切换侧边栏">
      <span>{{ isSidebarOpen ? '❮' : '❯' }}</span>
    </div>

    <!-- 右侧主内容区 -->
    <main class="main-content">
      <!-- 顶部工具栏 -->
      <div class="top-bar">
        <span>调整大小: {{ modelSize }}</span>
        <div class="slider-container">
          <input type="range" min="0.5" max="3.0" step="0.1" v-model="modelSize" class="slider" />
        </div>
      </div>

      <!-- 模型展示区 -->
      <div class="model-viewport">
        <div class="character-wrapper" :style="{
          transform: `scale(${modelSize / 2}) translate(${characterPosition.x}px, ${characterPosition.y}px)`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }" @mousedown="startDrag">
          <!-- <div class="live2d-container" ref="live2dContainer">
            <canvas ref="canvas" id="live2d-canvas"></canvas>
          </div> -->
          <div ref="avatarContainer" class="avatar-container" style="width: 100%; height: 100%;"></div>
        </div>
        <div class="subtitle"> </div>

        <div class="voice-interaction-container">
          <button class="voice-btn" :class="{ 'recording': isRecording }" @click="toggleVoiceRecording" title="点击开始对话">
            <svg class="mic-icon" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path
                d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>

            <div class="voice-ripple" v-if="isRecording"></div>
          </button>
          <span class="voice-status" v-if="isRecording">正在聆听...</span>
          <span class="voice-status processing" v-if="isRecognizing">正在识别...</span>
        </div>
      </div>
    </main>
    <!-- AI 面板区 -->
    <!-- 1. 悬浮触发按钮 -->
    <button class="ai-float-btn" @click="toggleAISidebar">
      <svg class="ai-icon" viewBox="0 0 24 24">
        <path
          d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z" />
      </svg>
    </button>

    <!-- 2. AI 侧边栏主体 -->
    <div :class="['ai-sidebar', { active: isOpen }]">
      <!-- 头部 -->
      <div class="ai-header">
        <div class="ai-title">
          <span class="status-dot"></span>
          AI Assistant
        </div>
        <button class="close-btn" @click="toggleAISidebar">&times;</button>
      </div>

      <!-- 聊天内容区域 -->
      <div class="ai-chat-body" ref="chatBodyRef">
        <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
          <!-- 使用 v-html 可以支持简单的格式，或者只用 {{ }} 纯文本 -->
          <span v-html="msg.content"></span>
        </div>

        <!-- Loading 动画占位 -->
        <div v-if="isThinking" class="message ai thinking">
          <span>●</span><span>●</span><span>●</span>
        </div>
      </div>

      <!-- 底部输入框 -->
      <div class="ai-input-wrapper">
        <div class="input-container">
          <input ref="inputRef" v-model="inputText" type="text" class="chat-input" placeholder="输入您的问题..."
            @keydown.enter="sendAIMessage" />
          <button class="send-btn" @click="sendAIMessage">
            <svg style="width:16px;height:16px;fill:white;transform:translateX(2px)" viewBox="0 0 24 24">
              <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, inject, onMounted, nextTick, watch } from 'vue';
import { ServicesKey } from '@/services';
import { useAvatar } from '@/composables/useAvatar';
import { useTTSQueue } from '@/composables/useTTSQueue';
import { useChatStream } from '@/composables/useChatStream';
import { useVoiceRecorder } from '@/composables/useVoiceRecorder';
import { useDraggable } from '@/composables/useDraggable';

// ================= 1. 核心服务 =================
const { asr, llm, tts, avatarConfig } = inject(ServicesKey);

// ================= 2. UI 局部状态 =================
const isSidebarOpen = ref(false);   // 左侧控制面板开合
const isOpen = ref(true);           // 右侧 AI 面板开合
const modelSize = ref(2.0);
const eyeTracking = ref('follow');
const selectedScene = ref('nova');

// 侧边栏(左)的输入框 —— 目前与对话主流程是两套 UI,保持原状
const chatInput = ref('');
const chatResponse = ref('');
const ttsInput = ref('');

// AI 面板(右)的输入框
const inputText = ref('');
const chatBodyRef = ref(null);
const inputRef = ref(null);

// Avatar 容器 ref
const avatarContainer = ref(null);

// ================= 3. composable 装配 =================
// Avatar 生命周期
const { instance: avatarInstance, load: loadAvatar } = useAvatar(avatarContainer, {
  type: avatarConfig.type,
});

// TTS 音频队列(依赖 avatar instance)
const ttsQueue = useTTSQueue({ tts, avatar: avatarInstance });

// 流式对话(依赖 llm,把句子转发给 TTS 队列)
const chat = useChatStream({
  llm,
  onSentence: (sentence) => ttsQueue.enqueueText(sentence),
});
// 暴露给模板的 messages / isThinking
const messages = chat.messages;
const isThinking = chat.isThinking;

// 语音录音(识别后自动发送)
const recorder = useVoiceRecorder({
  asr,
  onText: (text) => {
    inputText.value = text;
    if (!isOpen.value) toggleAISidebar();
    setTimeout(() => sendAIMessage(), 500); // 自动发送,保持原行为
  },
});
const isRecording = recorder.isRecording;
const isRecognizing = recorder.isRecognizing;

// 拖拽
const dragger = useDraggable();
const characterPosition = dragger.position;
const isDragging = dragger.isDragging;
const startDrag = dragger.onMouseDown;

// ================= 4. 事件处理(薄一层) =================
const scrollToBottom = async () => {
  await nextTick();
  if (chatBodyRef.value) chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight;
};

// 发送文字消息 —— 仅做"取值 + 清空输入框 + 调用 composable + 滚动"
const sendAIMessage = async () => {
  const text = inputText.value.trim();
  if (!text) return;
  inputText.value = '';
  await chat.send(text);
};

// 监听消息变化,自动滚动到底部
watch(messages, () => { scrollToBottom(); }, { deep: true });
watch(isThinking, () => { scrollToBottom(); });

// 录音切换
const toggleVoiceRecording = () => recorder.toggle();

// 侧边栏开合
const toggleSidebar = () => { isSidebarOpen.value = !isSidebarOpen.value; };
const toggleAISidebar = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    nextTick(() => {
      inputRef.value?.focus();
      scrollToBottom();
    });
  }
};

// 侧边栏(左)的"发送消息" —— 与原行为一致,沿用 chatResponse 文本框
const sendMessage = async () => {
  const text = chatInput.value.trim();
  if (!text) return;
  chatResponse.value = '正在思考...';
  // 走与主对话相同的链路
  inputText.value = text;
  chatInput.value = '';
  await sendAIMessage();
  // 主对话最后一条 AI 回复回填到侧边栏的只读框
  const lastAi = [...messages.value].reverse().find((m) => m.role === 'ai');
  chatResponse.value = lastAi ? lastAi.content.replace(/<br\s*\/?>(\s)?/gi, '\n') : '';
};

// 测试音频按钮 —— 占位,后续 PR-4 接线
const handlePlayTestAudio = () => {
  console.log('[DigitalAssistant] 测试音频按钮 (待接线)');
};

// ================= 5. 初始化 =================
onMounted(async () => {
  await loadAvatar(avatarConfig.modelPath);
});
</script>


<style scoped>
/* 全局容器 */
.page-container {
  display: flex;
  height: 100vh;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #333;
  background-color: #f5f7fa;
  overflow: hidden;
  position: relative;
  /* 为绝对定位的按钮提供参考 */

  --primary-gradient: linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%);
  --glass-bg: rgba(255, 255, 255, 0.75);
  --text-main: #1e293b;
  --text-secondary: #64748b;
  --ai-bubble-bg: #f1f5f9;
  --user-text: #ffffff;
  --shadow-float: 0 10px 40px -10px rgba(0, 0, 0, 0.15);
  --panel-width: 400px;

}

/* --- 侧边栏样式 --- */
.sidebar {
  width: 360px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  /* 关键：必须设置为 hidden，否则宽度变0时内容依然可见 */
  overflow: hidden;
  /* 关键：防止 flex 布局自动压缩侧边栏，确保宽度完全由 width 控制 */
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  z-index: 10;
}

/* 折叠状态 */
.sidebar.collapsed {
  width: 0;
  border-right: none;
  /* 折叠时隐藏边框 */
}

/* 内部内容容器：固定宽度 */
.sidebar-inner {
  width: 360px;
  /* 固定宽度，防止内容被挤压 */
  min-width: 360px;
  /* 强制最小宽度 */
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  /* 滚动条加在这里 */
  height: 100%;
  box-sizing: border-box;
}

/* --- 悬浮切换按钮样式 --- */
.toggle-btn {
  position: absolute;
  top: 50%;
  /* 默认位置：侧边栏宽度(360px)处 */
  left: 360px;
  transform: translateY(-50%);
  width: 16px;
  height: 60px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-left: none;
  /* 看起来像是粘在侧边栏上 */
  border-radius: 0 8px 8px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #909399;
  font-size: 12px;
  user-select: none;
  z-index: 20;
  transition: left 0.3s ease;
  /* 关键：跟随侧边栏移动 */
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
}

.toggle-btn:hover {
  background-color: #f0f2f5;
  color: #409eff;
}

/* 按钮折叠状态的位置 */
.toggle-btn.collapsed {
  left: 0;
  /* 折叠时回到最左侧 */
  border-left: 1px solid #e4e7ed;
  /* 补上左边框 */
}

/* --- 原有样式保留 --- */
.row {
  margin-bottom: 5px;
}

.control-group label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
  display: block;
}

.btn {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn:hover {
  color: #409eff;
  border-color: #c6e2ff;
  background-color: #ecf5ff;
}

.form-select,
.form-input {
  width: 100%;
  padding: 6px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  border-color: #409eff;
}

.flex-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.mb-2 {
  margin-bottom: 8px;
}

.radio-group {
  display: flex;
  gap: 15px;
}

.radio-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 13px;
}

.radio-label input {
  margin-right: 4px;
  accent-color: #409eff;
}

.card {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
  flex-shrink: 0;
}

.card-header {
  padding: 10px 15px;
  color: #409eff;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid #ebeef5;
}

.card-body {
  padding: 15px;
}

.form-textarea {
  width: 100%;
  height: 100px;
  padding: 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  resize: none;
  font-size: 12px;
  line-height: 1.5;
  color: #606266;
  box-sizing: border-box;
}

.form-textarea.readonly {
  background-color: #f5f7fa;
  color: #909399;
}

.button-group {
  display: flex;
  justify-content: space-between;
}

/* 右侧主内容样式 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
  transition: all 0.3s ease;
  /* 确保右侧内容在左侧折叠时平滑扩展 */
}

.top-bar {
  height: 50px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 20px;
  background: #fdfdfd;
}

.slider-container {
  width: 200px;
}

.slider {
  width: 100%;
  accent-color: #409eff;
}

.model-viewport {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 水平居中 */
  justify-content: center;
  /* 垂直居中 */
  position: relative;
  background: radial-gradient(circle at center, #ffffff 0%, #f0f2f5 100%);
  overflow: hidden;
  padding: 20px;
  /* 防止正方形贴边 */
}

.character-wrapper {
  transition: transform 0.1s;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.live2d-container {
  /* 核心：强制宽高比为 1:1 */
  aspect-ratio: 1 / 1;

  /* 响应式大小控制：
     让它尽可能大，但不要超过父容器宽度的 90%，
     也不要超过父容器高度的 80% (留出底部字幕空间) 
  */
  width: min(90%, 80vh);

  /* 只是为了调试看清楚区域，可以加个临时背景色，正式版删掉 */
  /* background: rgba(0,0,0,0.05); */
  /* border: 1px dashed #ccc; */

  position: relative;
}

.character-img {
  height: 400px;
  width: auto;
}

.subtitle {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 24px;
  font-weight: bold;
  color: #000;
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.8);
  font-family: sans-serif;
  max-width: 80%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}

/* ================= 悬浮按钮 ================= */
.ai-float-btn {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--primary-gradient);
  box-shadow: 0 8px 20px rgba(79, 70, 229, 0.4);
  border: 2px solid white;
  cursor: pointer;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ai-float-btn:hover {
  transform: translateY(-5px) scale(1.05);
  box-shadow: 0 15px 30px rgba(79, 70, 229, 0.5);
}

.ai-icon {
  width: 28px;
  height: 28px;
  fill: white;
}

/* ================= 侧边栏 ================= */
.ai-sidebar {
  position: fixed;
  top: 10px;
  bottom: 10px;
  right: calc(var(--panel-width) * -1.2);
  width: var(--panel-width);
  background: var(--glass-bg);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 20px;
  box-shadow: var(--shadow-float);
  z-index: 10000;
  /* 确保在最上层 */
  transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}

.ai-sidebar.active {
  right: 10px;
}

/* ================= 头部 ================= */
.ai-header {
  padding: 18px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 20px 20px 0 0;
}

.ai-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-main);
  font-weight: 700;
  font-size: 1.05rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  background-color: #10b981;
  border-radius: 50%;
  position: relative;
}

.status-dot::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #10b981;
  opacity: 0.5;
  animation: ripple 1.5s infinite;
}

@keyframes ripple {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }

  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

.close-btn {
  background: #f1f5f9;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e2e8f0;
  color: var(--text-main);
}

/* ================= 聊天区 ================= */
.ai-chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: rgba(255, 255, 255, 0.2);
}

.ai-chat-body::-webkit-scrollbar {
  width: 5px;
}

.ai-chat-body::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

.message {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 0.95rem;
  line-height: 1.6;
  position: relative;
  word-wrap: break-word;
  /* 防止长单词撑开 */
  animation: slideUp 0.3s ease;
}

/* 角色样式区分 */
.message.ai {
  align-self: flex-start;
  background: var(--ai-bubble-bg);
  color: var(--text-main);
  border-bottom-left-radius: 4px;
}

.message.user {
  align-self: flex-end;
  background: var(--primary-gradient);
  color: var(--user-text);
  border-bottom-right-radius: 4px;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

/* 思考中动画点 */
.message.thinking {
  display: flex;
  gap: 4px;
  padding: 16px 20px;
}

.message.thinking span {
  width: 4px;
  height: 4px;
  background-color: #94a3b8;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.message.thinking span:nth-child(1) {
  animation-delay: -0.32s;
}

.message.thinking span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {

  0%,
  80%,
  100% {
    transform: scale(0);
  }

  40% {
    transform: scale(1);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ================= 输入区 ================= */
.ai-input-wrapper {
  padding: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  background: rgba(255, 255, 255, 0.6);
  border-radius: 0 0 20px 20px;
}

.input-container {
  display: flex;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 5px 5px 5px 20px;
  transition: all 0.3s;
}

.input-container:focus-within {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.95rem;
  color: var(--text-main);
}

.chat-input::placeholder {
  color: #94a3b8;
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--primary-gradient);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  transition: transform 0.2s;
}

.send-btn:hover {
  transform: scale(1.05);
}

/* ================= 移动端适配 ================= */
@media (max-width: 480px) {
  .ai-sidebar {
    --panel-width: 100%;
    top: 0;
    bottom: 0;
    right: -100%;
    border-radius: 0;
  }

  .ai-sidebar.active {
    right: 0;
  }

  .ai-header {
    border-radius: 0;
  }

  .ai-input-wrapper {
    border-radius: 0;
  }
}

/* ================= 语音交互按钮 ================= */
.voice-interaction-container {
  position: absolute;
  bottom: 80px;
  /* 位于字幕上方 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  /* 保证在模型之上，但低于侧边栏 */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.voice-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);

  /* 默认状态：高识别度的主题色 */
  background: var(--primary-gradient);
  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
}

.mic-icon {
  width: 28px;
  height: 28px;
  fill: white;
  z-index: 2;
  /* 确保图标在光晕之上 */
  transition: transform 0.3s ease;
}

/* 悬停效果 */
.voice-btn:hover:not(.recording) {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(79, 70, 229, 0.6);
}

/* ================= 录音状态 (Siri 风格) ================= */

/* 1. 按钮主体的变化 */
.voice-btn.recording {
  /* Siri 经典的混合渐变色 */
  background: linear-gradient(135deg, #1AF0DC, #A044FF, #FF0055);
  background-size: 200% 200%;
  animation: siri-gradient 3s ease infinite, breathe-btn 2s ease-in-out infinite;
  box-shadow: none;
  /* 阴影交给 ripple 处理 */
}

/* 2. 图标的微动 */
.voice-btn.recording .mic-icon {
  transform: scale(0.9);
  fill: rgba(255, 255, 255, 0.95);
}

/* 3. 外部波纹/光晕层 */
.voice-ripple {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  z-index: 1;
  box-shadow: 0 0 20px 5px rgba(160, 68, 255, 0.6),
    0 0 40px 10px rgba(26, 240, 220, 0.4);
  animation: ripple-pulse 2s infinite;
}

/* 4. 状态文字 */
.voice-status {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.8);
  padding: 4px 12px;
  border-radius: 12px;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.3s ease;
}

/* ================= 动画关键帧 ================= */

/* 背景色流动 */
@keyframes siri-gradient {
  0% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}

/* 按钮本体呼吸 (缩放) */
@keyframes breathe-btn {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.1);
  }

  100% {
    transform: scale(1);
  }
}

/* 光晕扩散 */
@keyframes ripple-pulse {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }

  50% {
    transform: scale(1.3);
    opacity: 0.4;
  }

  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}


/* === 新增：处理中状态 (API请求时) === */
.voice-btn.processing {
  background: #cbd5e1;
  /* 灰色背景表示等待 */
  cursor: wait;
  transform: scale(0.95);
  box-shadow: none;
}

.voice-status.processing {
  color: #4f46e5;
  background: rgba(255, 255, 255, 0.9);
}

/* Loading 旋转动画 */
.spinner-icon {
  width: 28px;
  height: 28px;
  fill: #4f46e5;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

/* 优化之前的 mic-icon 样式，确保它在 v-else 切换时平滑 */
.mic-icon {
  width: 28px;
  height: 28px;
  fill: white;
  z-index: 2;
  transition: transform 0.3s ease;
}
</style>
