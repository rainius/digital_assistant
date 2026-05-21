<template>
  <!-- 1. 悬浮触发按钮(面板打开时自动隐藏) -->
  <button
    v-show="!isOpen"
    class="ai-float-btn"
    aria-label="打开 AI 助手"
    title="打开 AI 助手"
    @click="$emit('update:isOpen', true)"
  >
    <svg class="ai-icon" viewBox="0 0 24 24">
      <path
        d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z" />
    </svg>
  </button>

  <!-- 2. AI 面板主体 -->
  <div :class="['ai-sidebar', { active: isOpen }]" role="dialog" aria-label="AI 助手对话面板">
    <!-- 头部 -->
    <div class="ai-header">
      <div class="ai-title">
        <span class="status-dot" aria-hidden="true"></span>
        AI Assistant
      </div>
      <div class="header-actions">
        <button
          v-if="showReset"
          class="icon-btn reset-btn"
          aria-label="新会话"
          title="新会话"
          @click="$emit('reset')"
        >
          ⟳
        </button>
        <button
          class="icon-btn close-btn"
          aria-label="关闭面板"
          title="关闭"
          @click="$emit('update:isOpen', false)"
        >
          &times;
        </button>
      </div>
    </div>

    <!-- 聊天内容区域 -->
    <div class="ai-chat-body" ref="chatBodyRef">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message', msg.role]"
      >
        <!-- 仅渲染受信内容(由 LLM 回流);如需更严格防 XSS,后续可改为 markdown-it 渲染 -->
        <span v-html="msg.content"></span>
      </div>

      <!-- Loading 动画占位 -->
      <div v-if="isThinking" class="message ai thinking" aria-label="AI 正在思考">
        <span>●</span><span>●</span><span>●</span>
      </div>
    </div>

    <!-- 底部输入框 -->
    <div class="ai-input-wrapper">
      <div class="input-container" :class="{ disabled: disableInput }">
        <input
          ref="inputRef"
          :value="inputText"
          :disabled="disableInput"
          type="text"
          class="chat-input"
          :placeholder="disableInput ? 'AI 正在响应...' : placeholder"
          @input="$emit('update:inputText', $event.target.value)"
          @keydown.enter.prevent="handleSend"
        />
        <button
          class="send-btn"
          :disabled="disableInput || !canSend"
          aria-label="发送"
          title="发送"
          @click="handleSend"
        >
          <svg viewBox="0 0 24 24">
            <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue';

const props = defineProps({
  /** 面板是否展开,支持 v-model:isOpen */
  isOpen: { type: Boolean, default: true },
  /** 消息列表 [{ role: 'ai' | 'user', content: string }] */
  messages: { type: Array, default: () => [] },
  /** AI 思考中状态 */
  isThinking: { type: Boolean, default: false },
  /** 输入框文本,支持 v-model:inputText */
  inputText: { type: String, default: '' },
  /** 占位符 */
  placeholder: { type: String, default: '输入您的问题...' },
  /** 是否显示"新会话"按钮 */
  showReset: { type: Boolean, default: false },
  /** 思考中是否禁用输入(默认 true) */
  disableWhenThinking: { type: Boolean, default: true },
});

const emit = defineEmits([
  'update:isOpen',
  'update:inputText',
  'send',
  'reset',
]);

// ================= 内部 ref =================
const chatBodyRef = ref(null);
const inputRef = ref(null);

// ================= 计算属性 =================
const disableInput = computed(() => props.disableWhenThinking && props.isThinking);
const canSend = computed(() => props.inputText.trim().length > 0);

// ================= 方法 =================
/** 滚动到底部 */
async function scrollToBottom() {
  await nextTick();
  if (chatBodyRef.value) {
    chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight;
  }
}

/** 聚焦输入框 */
function focus() {
  inputRef.value?.focus();
}

/** 处理发送:校验 + 触发 send + 清空输入 */
function handleSend() {
  if (disableInput.value) return;
  const text = props.inputText.trim();
  if (!text) return;
  emit('send', text);
  // 清空输入框(通过 v-model 协议)
  emit('update:inputText', '');
}

// ================= 副作用 =================
// 消息变化或思考状态切换 → 自动滚到底部
watch(() => props.messages, scrollToBottom, { deep: true });
watch(() => props.isThinking, scrollToBottom);

// 面板打开时自动聚焦 + 滚到底部
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      nextTick(() => {
        focus();
        scrollToBottom();
      });
    }
  },
);

// 暴露给父组件的 imperative API
defineExpose({ focus, scrollToBottom });
</script>

<style scoped>
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

/* ================= 面板主体 ================= */
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
  inset: 0;
  border-radius: 50%;
  background: #10b981;
  opacity: 0.5;
  animation: ripple 1.5s infinite;
}

@keyframes ripple {
  0%   { transform: scale(1);   opacity: 0.5; }
  100% { transform: scale(2.5); opacity: 0; }
}

.header-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.icon-btn {
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

.icon-btn:hover {
  background: #e2e8f0;
  color: var(--text-main);
}

.reset-btn {
  font-size: 1.1rem;
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
  animation: slideUp 0.3s ease;
}

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

.message.thinking span:nth-child(1) { animation-delay: -0.32s; }
.message.thinking span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40%           { transform: scale(1); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
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

.input-container.disabled {
  background: #f8fafc;
  opacity: 0.7;
}

.input-container:focus-within:not(.disabled) {
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

.chat-input:disabled {
  cursor: not-allowed;
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
  transition: transform 0.2s, opacity 0.2s;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
}

.send-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.send-btn svg {
  width: 16px;
  height: 16px;
  fill: white;
  transform: translateX(2px);
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

  .ai-header,
  .ai-input-wrapper {
    border-radius: 0;
  }
}
</style>
