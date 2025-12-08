<template>
  <div class="ai-component-container">
    <!-- 1. 悬浮触发按钮 -->
    <button class="ai-float-btn" @click="toggleSidebar">
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
        <button class="close-btn" @click="toggleSidebar">&times;</button>
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
            @keydown.enter="sendMessage"
          />
          <button class="send-btn" @click="sendMessage">
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
import { ref, nextTick } from 'vue';

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
const toggleSidebar = () => {
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
const sendMessage = async () => {
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
/* 定义局部 CSS 变量，不污染全局 */
.ai-component-container {
  --primary-gradient: linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%);
  --glass-bg: rgba(255, 255, 255, 0.75);
  --text-main: #1e293b;
  --text-secondary: #64748b;
  --ai-bubble-bg: #f1f5f9;
  --user-text: #ffffff;
  --shadow-float: 0 10px 40px -10px rgba(0, 0, 0, 0.15);
  --panel-width: 400px;
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
