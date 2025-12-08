<template>
  <div class="page-container">
    <!-- 左侧侧边栏 (添加 overflow: hidden) -->
    <aside class="sidebar" :class="{ 'collapsed': !isSidebarOpen }">
      <div class="sidebar-inner">
        <!-- ... 这里保留原本的所有侧边栏内容 ... -->
        
        <!-- 测试音频按钮 -->
        <div class="row">
          <button class="btn btn-default">测试音频</button>
        </div>
        
        <!-- 场景选择 -->
        <div class="row control-group">
          <label>选择已发布场景：</label>
          <div class="flex-row">
            <select v-model="selectedScene" class="form-select">
              <option value="haru">关爱老婆数字人 (Haru)</option>
              <option value="other">其他场景...</option>
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
            <textarea 
              class="form-textarea readonly" 
              readonly 
              v-model="chatResponse"
            ></textarea>
          </div>
        </div>

        <!-- 语音合成卡片 -->
        <div class="card">
          <div class="card-header">语音合成</div>
          <div class="card-body">
            <textarea 
              class="form-textarea mb-2" 
              v-model="ttsInput"
            ></textarea>
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
    <div 
      class="toggle-btn" 
      :class="{ 'collapsed': !isSidebarOpen }" 
      @click="toggleSidebar" 
      title="切换侧边栏"
    >
      <span>{{ isSidebarOpen ? '❮' : '❯' }}</span>
    </div>

    <!-- 右侧主内容区 -->
    <main class="main-content">
      <!-- 顶部工具栏 -->
      <div class="top-bar">
        <span>调整大小: {{ modelSize }}</span>
        <div class="slider-container">
          <input 
            type="range" 
            min="0.5" 
            max="3.0" 
            step="0.1" 
            v-model="modelSize" 
            class="slider"
          />
        </div>
      </div>

      <!-- 模型展示区 -->
      <div class="model-viewport">
        <div 
          class="character-wrapper" 
          :style="{ 
            transform: `scale(${modelSize / 2}) translate(${characterPosition.x}px, ${characterPosition.y}px)`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }"
          @mousedown="startDrag"
        >
           <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Haru&clothing=blazerAndShirt&hairColor=2c1b18" alt="Character" class="character-img" />
        </div>
        <div class="subtitle">怎么去发布和上架</div>
      </div>
    </main>
    <!-- AI 面板区 -->
    <!-- 1. 悬浮触发按钮 -->
    <button class="ai-float-btn" @click="toggleAISidebar">
      <svg class="ai-icon" viewBox="0 0 24 24">
        <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z" />
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
        <div 
          v-for="(msg, index) in messages" 
          :key="index" 
          :class="['message', msg.role]"
        >
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
          <input 
            ref="inputRef"
            v-model="inputText" 
            type="text" 
            class="chat-input" 
            placeholder="输入您的问题..." 
            @keydown.enter="sendAIMessage"
          />
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
import { ref, onMounted, onUnmounted, nextTick } from 'vue';

// 侧边栏状态
const isSidebarOpen = ref(true);
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

// ... (保留原本的其他所有 script 逻辑，无需改动) ...
const selectedScene = ref('haru');
const eyeTracking = ref('follow');
const modelSize = ref(2.0);
const chatInput = ref('你能做什么');
const defaultText = '我可以基于【马斯克·陈】提供的关爱老婆百事通里包含的老婆喜好、喜欢的东西、习惯、身体状况等信息，分析老婆的情况并给出行动建议。';
const chatResponse = ref(defaultText);
const ttsInput = ref(defaultText);
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const characterPosition = ref({ x: 0, y: 0 });

const startDrag = (e) => {
  if (e.button !== 0) return;
  isDragging.value = true;
  dragStart.value = {
    x: e.clientX - characterPosition.value.x,
    y: e.clientY - characterPosition.value.y,
  };
  e.preventDefault();
};

const onDrag = (e) => {
  if (!isDragging.value) return;
  e.preventDefault();
  const modelViewport = document.querySelector('.model-viewport');
  const characterWrapper = document.querySelector('.character-wrapper');
  if (!modelViewport || !characterWrapper) return;
  const viewportRect = modelViewport.getBoundingClientRect();
  const wrapperRect = characterWrapper.getBoundingClientRect();
  const maxX = viewportRect.width / 2 - wrapperRect.width / 2;
  const maxY = viewportRect.height / 2 - wrapperRect.height / 2;
  characterPosition.value = {
    x: Math.min(Math.max(e.clientX - dragStart.value.x, -maxX), maxX),
    y: Math.min(Math.max(e.clientY - dragStart.value.y, -maxY), maxY),
  };
};

const stopDrag = () => {
  isDragging.value = false;
};
const sendMessage = () => console.log('发送消息:', chatInput.value);

onMounted(() => {
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
});
onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
});

// -------- AI边栏 ----------
// --- 状态定义 ---
const isOpen = ref(false);
const inputText = ref('');
const isThinking = ref(false);
const chatBodyRef = ref(null);
const inputRef = ref(null);

// 初始消息数据
const messages = ref([
  { 
    role: 'ai', 
    content: '您好！我是您的智能助手。<br>有什么我可以帮您的吗？' 
  }
]);

// --- 方法逻辑 ---

// 1. 切换侧边栏状态
const toggleAISidebar = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    // 展开时自动聚焦输入框
    nextTick(() => {
      inputRef.value?.focus();
      scrollToBottom();
    });
  }
};

// 2. 发送消息
const sendAIMessage = async () => {
  const text = inputText.value.trim();
  if (!text) return;

  // 添加用户消息
  messages.value.push({ role: 'user', content: text });
  inputText.value = '';
  scrollToBottom();

  // 模拟 AI 思考状态
  isThinking.value = true;
  await scrollToBottom();

  // 模拟 API 请求延迟
  setTimeout(() => {
    isThinking.value = false;
    // 添加 AI 回复
    const responses = [
      "这是一个基于 Vue 3 的组件化实现。",
      "样式已适配白色明亮主题，使用了 Glassmorphism 效果。",
      "收到您的指令，正在处理数据..."
    ];
    const randomRes = responses[Math.floor(Math.random() * responses.length)];
    
    messages.value.push({ role: 'ai', content: randomRes });
    scrollToBottom();
  }, 800);
};

// 3. 滚动到底部工具函数
const scrollToBottom = async () => {
  await nextTick(); // 等待 DOM 更新
  if (chatBodyRef.value) {
    chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight;
  }
};

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
  position: relative; /* 为绝对定位的按钮提供参考 */

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
  border-right: none; /* 折叠时隐藏边框 */
}

/* 内部内容容器：固定宽度 */
.sidebar-inner {
  width: 360px; /* 固定宽度，防止内容被挤压 */
  min-width: 360px; /* 强制最小宽度 */
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto; /* 滚动条加在这里 */
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
  border-left: none; /* 看起来像是粘在侧边栏上 */
  border-radius: 0 8px 8px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #909399;
  font-size: 12px;
  user-select: none;
  z-index: 20;
  transition: left 0.3s ease; /* 关键：跟随侧边栏移动 */
  box-shadow: 2px 0 4px rgba(0,0,0,0.05);
}

.toggle-btn:hover {
  background-color: #f0f2f5;
  color: #409eff;
}

/* 按钮折叠状态的位置 */
.toggle-btn.collapsed {
  left: 0; /* 折叠时回到最左侧 */
  border-left: 1px solid #e4e7ed; /* 补上左边框 */
}

/* --- 原有样式保留 --- */
.row { margin-bottom: 5px; }
.control-group label { font-size: 14px; color: #606266; margin-bottom: 8px; display: block; }
.btn { padding: 6px 12px; font-size: 12px; border-radius: 4px; cursor: pointer; border: 1px solid #dcdfe6; background: #fff; color: #606266; transition: all 0.2s; white-space: nowrap; }
.btn:hover { color: #409eff; border-color: #c6e2ff; background-color: #ecf5ff; }
.form-select, .form-input { width: 100%; padding: 6px; border: 1px solid #dcdfe6; border-radius: 4px; font-size: 12px; outline: none; box-sizing: border-box; }
.form-select:focus, .form-input:focus, .form-textarea:focus { border-color: #409eff; }
.flex-row { display: flex; gap: 8px; align-items: center; }
.mb-2 { margin-bottom: 8px; }
.radio-group { display: flex; gap: 15px; }
.radio-label { display: flex; align-items: center; cursor: pointer; font-size: 13px; }
.radio-label input { margin-right: 4px; accent-color: #409eff; }
.card { border: 1px solid #e4e7ed; border-radius: 4px; background: #fff; overflow: hidden; flex-shrink: 0; }
.card-header { padding: 10px 15px; color: #409eff; font-weight: 600; font-size: 14px; border-bottom: 1px solid #ebeef5; }
.card-body { padding: 15px; }
.form-textarea { width: 100%; height: 100px; padding: 8px; border: 1px solid #dcdfe6; border-radius: 4px; resize: none; font-size: 12px; line-height: 1.5; color: #606266; box-sizing: border-box; }
.form-textarea.readonly { background-color: #f5f7fa; color: #909399; }
.button-group { display: flex; justify-content: space-between; }

/* 右侧主内容样式 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden; 
  transition: all 0.3s ease; /* 确保右侧内容在左侧折叠时平滑扩展 */
}

.top-bar { height: 50px; border-bottom: 1px solid #e4e7ed; display: flex; align-items: center; padding: 0 20px; gap: 20px; background: #fdfdfd; }
.slider-container { width: 200px; }
.slider { width: 100%; accent-color: #409eff; }
.model-viewport { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; background: #fff; overflow: hidden; }
.character-wrapper { transition: transform 0.1s; cursor: grab; user-select: none; -webkit-user-select: none; }
.character-img { height: 400px; width: auto; }
.subtitle { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); font-size: 24px; font-weight: bold; color: #000; text-shadow: 0 0 5px rgba(255,255,255,0.8); font-family: sans-serif; max-width: 80%; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }

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

.ai-icon { width: 28px; height: 28px; fill: white; }

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
  z-index: 10000; /* 确保在最上层 */
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
  border-bottom: 1px solid rgba(0,0,0,0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255,255,255,0.4);
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
  top: 0; left: 0;
  width: 100%; height: 100%;
  border-radius: 50%;
  background: #10b981;
  opacity: 0.5;
  animation: ripple 1.5s infinite;
}

@keyframes ripple {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(2.5); opacity: 0; }
}

.close-btn {
  background: #f1f5f9;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.2rem;
  transition: all 0.2s;
}
.close-btn:hover { background: #e2e8f0; color: var(--text-main); }

/* ================= 聊天区 ================= */
.ai-chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: rgba(255,255,255,0.2);
}

.ai-chat-body::-webkit-scrollbar { width: 5px; }
.ai-chat-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

.message {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 0.95rem;
  line-height: 1.6;
  position: relative;
  word-wrap: break-word; /* 防止长单词撑开 */
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
  width: 4px; height: 4px;
  background-color: #94a3b8;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}
.message.thinking span:nth-child(1) { animation-delay: -0.32s; }
.message.thinking span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ================= 输入区 ================= */
.ai-input-wrapper {
  padding: 20px;
  border-top: 1px solid rgba(0,0,0,0.05);
  background: rgba(255,255,255,0.6);
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
.chat-input::placeholder { color: #94a3b8; }

.send-btn {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--primary-gradient);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  margin-left: 8px;
  transition: transform 0.2s;
}
.send-btn:hover { transform: scale(1.05); }

/* ================= 移动端适配 ================= */
@media (max-width: 480px) {
  .ai-sidebar {
    --panel-width: 100%;
    top: 0; bottom: 0; right: -100%;
    border-radius: 0;
  }
  .ai-sidebar.active { right: 0; }
  .ai-header { border-radius: 0; }
  .ai-input-wrapper { border-radius: 0; }
}

</style>
