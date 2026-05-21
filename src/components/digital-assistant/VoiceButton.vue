<template>
  <div class="voice-interaction-container">
    <button
      class="voice-btn"
      :class="{ 'recording': isRecording }"
      @click="$emit('click')"
      title="点击开始对话"
    >
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
</template>

<script setup>
defineProps({
  isRecording: { type: Boolean, default: false },
  isRecognizing: { type: Boolean, default: false },
});
defineEmits(['click']);
</script>

<style scoped>
/* ================= 语音交互按钮 ================= */
.voice-interaction-container {
  position: absolute;
  bottom: 80px;
  /* 位于字幕上方 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  /* 保证在模型之上,但低于侧边栏 */
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

  /* 默认状态:高识别度的主题色 */
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

.voice-status.processing {
  color: #4f46e5;
  background: rgba(255, 255, 255, 0.9);
}

/* ================= 动画关键帧 ================= */
@keyframes siri-gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes breathe-btn {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@keyframes ripple-pulse {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.3); opacity: 0.4; }
  100% { transform: scale(1.5); opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
