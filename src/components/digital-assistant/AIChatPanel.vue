<template>
  <!-- AI 面板主体 -->
  <div class="ai-sidebar" role="dialog" aria-label="AI 助手对话面板">
    <!-- 头部 -->
    <div class="ai-header">
      <div class="ai-title">
        <span class="status-dot" aria-hidden="true"></span>
        AI Assistant
      </div>
    </div>

    <!-- 聊天内容区域 -->
    <div class="ai-chat-body" ref="chatBodyRef">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message', msg.role]"
      >
        <span v-html="renderMarkdown(msg.content)"></span>
      </div>

      <!-- Loading 动画占位 -->
      <div v-if="isThinking" class="message ai thinking" aria-label="AI 正在思考">
        <span>●</span><span>●</span><span>●</span>
      </div>
    </div>

    <!-- 底部输入区 -->
    <div class="ai-input-wrapper">
      <div class="input-card" :class="{ disabled: disableInput }">
        <!-- 文本编辑区 -->
        <textarea
          ref="inputRef"
          :value="inputText"
          :disabled="disableInput"
          class="chat-textarea"
          :placeholder="disableInput ? 'AI 正在响应...' : placeholder"
          rows="1"
          @input="onInput"
          @keydown.enter="onEnter"
        ></textarea>

        <!-- 底部工具栏 -->
        <div class="input-toolbar">
          <div class="toolbar-left">
            <!-- 添加按钮 + 弹出菜单 -->
            <div class="add-wrapper" ref="addWrapperRef">
              <button
                class="tool-btn add-btn"
                title="添加"
                @click="showAddMenu = !showAddMenu"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
                </svg>
              </button>
              <div v-if="showAddMenu" class="add-menu">
                <button class="menu-item" @click="onAdd('file')">
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>
                  <span>文件</span>
                </button>
                <button class="menu-item" @click="onAdd('image')">
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z"/></svg>
                  <span>图片</span>
                </button>
                <button class="menu-item" @click="onAdd('code')">
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12.89,3L14.85,3.4L11.11,21L9.15,20.6L12.89,3M16.59,9L12,13.58L13.41,15L18,10.41L16.59,9M7.41,9L6,10.41L10.59,15L12,13.58L7.41,9Z"/></svg>
                  <span>代码</span>
                </button>
              </div>
            </div>

            <!-- 模式下拉 -->
            <select class="mode-select" :value="chatMode" @change="$emit('update:chatMode', $event.target.value)">
              <option value="digital-human">数字人</option>
              <option value="text-only">文字交流</option>
            </select>
          </div>

          <div class="toolbar-right">
            <!-- 麦克风 -->
            <button class="tool-btn mic-btn" title="语音输入" @click="$emit('toggle-mic')">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z" />
              </svg>
            </button>
            <!-- 发送 -->
            <button
              class="tool-btn send-btn"
              :disabled="disableInput || !canSend"
              title="发送"
              @click="handleSend"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
import { marked } from 'marked';

const props = defineProps({
  /** 消息列表 [{ role: 'ai' | 'user', content: string }] */
  messages: { type: Array, default: () => [] },
  /** AI 思考中状态 */
  isThinking: { type: Boolean, default: false },
  /** 输入框文本,支持 v-model:inputText */
  inputText: { type: String, default: '' },
  /** 占位符 */
  placeholder: { type: String, default: '输入您的问题...' },
  /** 对话模式 digital-human | text-only, 支持 v-model:chatMode */
  chatMode: { type: String, default: 'digital-human' },
  /** 是否显示"新会话"按钮 */
  showReset: { type: Boolean, default: false },
  /** 思考中是否禁用输入(默认 true) */
  disableWhenThinking: { type: Boolean, default: true },
});

const emit = defineEmits([
  'update:inputText',
  'update:chatMode',
  'send',
  'reset',
  'toggle-mic',
  'add-file',
  'add-image',
  'add-code',
]);

// ================= 内部 ref =================
const chatBodyRef = ref(null);
const inputRef = ref(null);
const addWrapperRef = ref(null);
const showAddMenu = ref(false);

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

/** textarea 输入: auto-resize + emit */
function onInput(e) {
  const el = e.target;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  emit('update:inputText', el.value);
}

/** Enter 发送, Shift+Enter 换行 */
function onEnter(e) {
  if (e.shiftKey) return;
  e.preventDefault();
  handleSend();
}

/** 添加菜单项 */
const addActions = { file: 'add-file', image: 'add-image', code: 'add-code' };
function onAdd(type) {
  emit(addActions[type]);
  showAddMenu.value = false;
}

/** 点击外部关闭菜单 */
function onDocumentClick(e) {
  if (addWrapperRef.value && !addWrapperRef.value.contains(e.target)) {
    showAddMenu.value = false;
  }
}
onMounted(() => document.addEventListener('click', onDocumentClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));

/** Markdown 渲染 */
function renderMarkdown(text) {
  if (!text) return '';
  return marked.parse(text);
}

/** 处理发送:校验 + 触发 send + 清空输入 + 重置 textarea 高度 */
function handleSend() {
  if (disableInput.value) return;
  const text = props.inputText.trim();
  if (!text) return;
  emit('send', text);
  emit('update:inputText', '');
  if (inputRef.value) {
    inputRef.value.style.height = 'auto';
  }
}

// ================= 副作用 =================
// 消息变化或思考状态切换 → 自动滚到底部
watch(() => props.messages, scrollToBottom, { deep: true });
watch(() => props.isThinking, scrollToBottom);

// 暴露给父组件的 imperative API
defineExpose({ focus, scrollToBottom });
</script>

<style scoped>
/* ================= 面板主体 ================= */
.ai-sidebar {
  width: 40%;
  min-width: 360px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-left: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: var(--shadow-float);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

/* ================= 头部 ================= */
.ai-header {
  padding: 18px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.4);
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
  font-size: 0.95rem;
  line-height: 1.6;
  word-wrap: break-word;
  animation: slideUp 0.3s ease;
  text-align: left;
}

.message.ai {
  width: 100%;
  color: var(--text-main);
  padding: 4px 0;
}

.message.user {
  max-width: 75%;
  align-self: flex-end;
  padding: 12px 16px;
  border-radius: 16px;
  border-bottom-right-radius: 4px;
  background: var(--primary-gradient);
  color: var(--user-text);
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
  padding: 16px 20px 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  background: rgba(255, 255, 255, 0.6);
}

/* 输入卡片 */
.input-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 14px 16px 10px;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.input-card:focus-within {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.input-card.disabled {
  background: #f8fafc;
  opacity: 0.7;
}

/* 文本编辑区 */
.chat-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--text-main);
  font-family: inherit;
  background: transparent;
  min-height: 24px;
  max-height: 160px;
  overflow-y: auto;
}

.chat-textarea::placeholder {
  color: #94a3b8;
}

.chat-textarea:disabled {
  cursor: not-allowed;
}

/* 底部工具栏 */
.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  gap: 8px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 通用工具按钮 */
.tool-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.tool-btn svg {
  fill: currentColor;
}

.tool-btn:hover {
  background: #f1f5f9;
  color: var(--text-main);
}

/* 添加按钮 + 弹出菜单 */
.add-wrapper {
  position: relative;
}

.add-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  padding: 6px;
  min-width: 140px;
  z-index: 100;
  animation: fadeInUp 0.15s ease;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-main);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s;
}

.menu-item svg {
  fill: var(--text-secondary);
  flex-shrink: 0;
}

.menu-item:hover {
  background: #f1f5f9;
}

/* 模式下拉 */
.mode-select {
  height: 34px;
  padding: 0 28px 0 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: var(--text-main);
  font-size: 0.85rem;
  cursor: pointer;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' width='12' height='12' fill='%2364748b' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  transition: border-color 0.2s;
}

.mode-select:focus {
  border-color: #8b5cf6;
}

/* 发送按钮 */
.send-btn {
  background: var(--primary-gradient);
  color: #fff;
}

.send-btn svg {
  fill: #fff;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  color: #fff;
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ================= 移动端适配 ================= */
@media (max-width: 480px) {
  .ai-sidebar {
    width: 100%;
    min-width: unset;
  }
}
</style>
