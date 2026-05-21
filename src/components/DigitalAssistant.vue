<template>
  <div class="page-container">
    <!-- 左侧控制面板 -->
    <ControlSidebar
      v-model:selectedScene="selectedScene"
      v-model:eyeTracking="eyeTracking"
      v-model:chatInput="chatInput"
      v-model:ttsInput="ttsInput"
      :is-open="isSidebarOpen"
      :chat-response="chatResponse"
      @toggle="toggleSidebar"
      @play-test-audio="handlePlayTestAudio"
      @update-scene="handleUpdateScene"
      @send-sidebar-message="handleSidebarSend"
      @tts-parallel="handleTtsParallel"
      @tts-stream="handleTtsStream"
      @tts-stop="handleTtsStop"
    />

    <!-- 中间数字人舞台 -->
    <AvatarStage
      v-model:modelSize="modelSize"
      :character-position="characterPosition"
      :is-dragging="isDragging"
      :is-recording="isRecording"
      :is-recognizing="isRecognizing"
      @mousedown="startDrag"
      @toggle-record="toggleVoiceRecording"
    >
      <template #avatar>
        <div
          ref="avatarContainer"
          class="avatar-container"
          style="width: 100%; height: 100%;"
        ></div>
      </template>
    </AvatarStage>

    <!-- 右侧 AI 对话面板 -->
    <AIChatPanel
      v-model:isOpen="isAIPanelOpen"
      v-model:inputText="inputText"
      :messages="messages"
      :is-thinking="isThinking"
      @send="handleAISend"
    />
  </div>
</template>


<script setup>
import { ref, inject, onMounted } from 'vue';
import { ServicesKey } from '@/services';
import { useAvatar } from '@/composables/useAvatar';
import { useTTSQueue } from '@/composables/useTTSQueue';
import { useChatStream } from '@/composables/useChatStream';
import { useVoiceRecorder } from '@/composables/useVoiceRecorder';
import { useDraggable } from '@/composables/useDraggable';

import ControlSidebar from './digital-assistant/ControlSidebar.vue';
import AvatarStage from './digital-assistant/AvatarStage.vue';
import AIChatPanel from './digital-assistant/AIChatPanel.vue';

// ================= 1. 核心服务 =================
const { asr, llm, tts, avatarConfig } = inject(ServicesKey);

// ================= 2. UI 局部状态 =================
const isSidebarOpen = ref(false);   // 左侧控制面板开合
const isAIPanelOpen = ref(true);    // 右侧 AI 面板开合
const modelSize = ref(2.0);
const eyeTracking = ref('follow');
const selectedScene = ref('nova');

// 左侧侧边栏的本地输入
const chatInput = ref('');
const chatResponse = ref('');
const ttsInput = ref('');

// 右侧 AI 面板的输入
const inputText = ref('');

// Avatar 容器 ref(通过 slot 传给 AvatarStage)
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
const messages = chat.messages;
const isThinking = chat.isThinking;

// 语音录音(识别后自动发送)
const recorder = useVoiceRecorder({
  asr,
  onText: (text) => {
    inputText.value = text;
    if (!isAIPanelOpen.value) isAIPanelOpen.value = true;
    setTimeout(() => handleAISend(text), 500); // 自动发送
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
// 左侧侧边栏开合
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

// 录音切换
const toggleVoiceRecording = () => recorder.toggle();

// AI 面板发送 —— AIChatPanel 已自动清空 inputText
const handleAISend = async (text) => {
  await chat.send(text);
};

// 左侧侧边栏"发送消息" —— 走主对话链路,回填到只读框
const handleSidebarSend = async (text) => {
  const trimmed = text.trim();
  if (!trimmed) return;
  chatResponse.value = '正在思考...';
  chatInput.value = '';
  await chat.send(trimmed);
  const lastAi = [...messages.value].reverse().find((m) => m.role === 'ai');
  chatResponse.value = lastAi ? lastAi.content.replace(/<br\s*\/?>(\s)?/gi, '\n') : '';
};

// ================= 5. 暂未接线的入口(PR-4 收尾) =================
const handlePlayTestAudio = () => {
  console.log('[DigitalAssistant] 测试音频按钮 (PR-4 待接线)');
};

const handleUpdateScene = (sceneId) => {
  console.log(`[DigitalAssistant] 更新场景: ${sceneId} (PR-4 待接线 sceneManifest)`);
};

const handleTtsParallel = (text) => {
  console.log('[DigitalAssistant] 并行推理 (适配器未实现):', text);
};

const handleTtsStream = (text) => {
  console.log('[DigitalAssistant] 流式推理 (适配器未实现):', text);
};

const handleTtsStop = () => {
  ttsQueue.stop();
};

// ================= 6. 初始化 =================
onMounted(async () => {
  await loadAvatar(avatarConfig.modelPath);
});
</script>


<style scoped>
/* 全局容器 —— 仅保留页面级布局,
   设计 token (--primary-gradient / --glass-bg ...) 已迁移到 src/styles/tokens.css */
.page-container {
  display: flex;
  height: 100vh;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #333;
  background-color: #f5f7fa;
  overflow: hidden;
  position: relative;
  /* 为绝对定位的子组件(toggle-btn / ai-sidebar)提供参考 */
}

/* Avatar 容器 —— 通过 slot 注入 AvatarStage,父组件持有 ref */
:deep(.avatar-container) {
  width: 100%;
  height: 100%;
}
</style>
