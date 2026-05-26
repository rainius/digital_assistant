<template>
  <div class="page-container">
    <!-- 顶部导航条 -->
    <nav class="top-nav">
      <span class="nav-brand">Digital Human</span>
    </nav>

    <!-- 主体区域: 左侧用户信息 + 中间舞台 + 右侧 AI -->
    <div class="main-area">
      <UserInfoPanel />

      <!-- 中间数字人舞台 -->
      <AvatarStage
        ref="avatarStageRef"
        v-model:modelSize="modelSize"
        v-model:avatarType="avatarType"
        :character-position="characterPosition"
        :is-dragging="isDragging"
        :is-recording="isRecording"
        :is-recognizing="isRecognizing"
        :show-voice-button="false"
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
        v-model:inputText="inputText"
        v-model:chatMode="chatMode"
        :messages="messages"
        :is-thinking="isThinking"
        :is-recording="isRecording"
        @send="handleAISend"
        @toggle-mic="toggleVoiceRecording"
        @add-file="onAddFile"
        @add-image="onAddImage"
        @add-code="onAddCode"
      />
    </div>
  </div>
</template>


<script setup>
import { ref, inject, onMounted, watch } from 'vue';
import { ServicesKey } from '@/services';
import { useAvatar } from '@/composables/useAvatar';
import { useTTSQueue } from '@/composables/useTTSQueue';
import { useChatStream } from '@/composables/useChatStream';
import { useVoiceRecorder } from '@/composables/useVoiceRecorder';
import { useDraggable } from '@/composables/useDraggable';

import UserInfoPanel from './digital-assistant/UserInfoPanel.vue';
import AvatarStage from './digital-assistant/AvatarStage.vue';
import AIChatPanel from './digital-assistant/AIChatPanel.vue';

// ================= 1. 核心服务 =================
const { asr, llm, tts, avatarConfig } = inject(ServicesKey);

// ================= 2. UI 局部状态 =================
const modelSize = ref(2.0);
const chatMode = ref('digital-human');

// 右侧 AI 面板的输入
const inputText = ref('');

// Avatar 容器 ref(通过 slot 传给 AvatarStage)
const avatarContainer = ref(null);

// ================= 3. composable 装配 =================
// Avatar 生命周期
const { instance: avatarInstance, load: loadAvatar, avatarType } = useAvatar(avatarContainer, {
  type: avatarConfig.type,
});

// 类型 → 模型路径映射
const avatarModelMap = {
  live2d: avatarConfig.modelPath,
  livetalking: avatarConfig.livetalkingUrl,
};

// 切换数字人类型时重新加载
watch(avatarType, async (newType) => {
  await loadAvatar(avatarModelMap[newType] || avatarConfig.modelPath);
});

// TTS 音频队列(依赖 avatar instance)
const ttsQueue = useTTSQueue({ tts, avatar: avatarInstance });

// 流式对话(依赖 llm,把句子转发给 TTS 队列)
const chat = useChatStream({
  llm,
  onSentence: (sentence) => ttsQueue.enqueueText(sentence),
  onParagraph: (paragraph) => ttsQueue.enqueueParagraph(paragraph),
});
const messages = chat.messages;
const isThinking = chat.isThinking;

// 语音录音(识别后自动发送)
const recorder = useVoiceRecorder({
  asr,
  onText: (text) => {
    inputText.value = text;
    setTimeout(() => handleAISend(text), 500); // 自动发送
  },
});
const isRecording = recorder.isRecording;
const isRecognizing = recorder.isRecognizing;

// 拖拽
const avatarStageRef = ref(null);

const dragger = useDraggable({
  bounds: () => {
    const viewport = avatarStageRef.value?.modelViewportRef;
    const wrapper = avatarStageRef.value?.characterWrapperRef;
    if (!viewport || !wrapper) return null;

    const vpWidth = viewport.clientWidth;
    const vpHeight = viewport.clientHeight;
    const scale = modelSize.value / 2;
    const scaledW = wrapper.offsetWidth * scale;
    const scaledH = wrapper.offsetHeight * scale;

    const maxX = Math.max(0, (vpWidth - scaledW) / 2);
    const maxY = Math.max(0, (vpHeight - scaledH) / 2);

    return { minX: -maxX, maxX, minY: -maxY, maxY };
  },
});
const characterPosition = dragger.position;
const isDragging = dragger.isDragging;
const startDrag = dragger.onMouseDown;

// ================= 3. 事件处理 =================
// 录音切换
const toggleVoiceRecording = () => recorder.toggle();

// AI 面板发送
const handleAISend = async (text) => {
  await chat.send(text);
};

// 添加菜单项（后续接线）
const onAddFile = () => console.log('[DigitalAssistant] 添加文件');
const onAddImage = () => console.log('[DigitalAssistant] 添加图片');
const onAddCode = () => console.log('[DigitalAssistant] 添加代码');

// ================= 4. 初始化 =================
onMounted(async () => {
  await loadAvatar(avatarModelMap[avatarType.value] || avatarConfig.modelPath);
});
</script>


<style scoped>
/* 全局容器 */
.page-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #333;
  background-color: #f5f7fa;
  overflow: hidden;
}

/* 顶部导航条 */
.top-nav {
  height: 52px;
  min-height: 52px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  z-index: 100;
}

.nav-brand {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-main);
}

/* 主体: 左侧栏 + 中间舞台 + 右侧 AI 面板 */
.main-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Avatar 容器 —— 通过 slot 注入 AvatarStage,父组件持有 ref */
:deep(.avatar-container) {
  width: 100%;
  height: 100%;
}
</style>
