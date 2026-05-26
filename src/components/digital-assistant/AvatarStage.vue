<template>
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
          :value="modelSize"
          class="slider"
          @input="$emit('update:modelSize', Number($event.target.value))"
        />
      </div>

      <div class="avatar-type-selector">
        <select
          :value="avatarType"
          class="type-select"
          @change="$emit('update:avatarType', $event.target.value)"
        >
          <option value="live2d">2D卡通</option>
          <option value="livetalking">真人分身</option>
        </select>
      </div>
    </div>

    <!-- 模型展示区 -->
    <div ref="modelViewportRef" class="model-viewport">
      <div
        ref="characterWrapperRef"
        class="character-wrapper"
        :style="{
          transform: `scale(${modelSize / 2}) translate(${characterPosition.x}px, ${characterPosition.y}px)`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }"
        @mousedown="$emit('mousedown', $event)"
      >
        <!-- 父组件通过 #avatar slot 提供 Live2D 容器 ref -->
        <slot name="avatar" />
      </div>
      <div class="subtitle"> </div>

      <VoiceButton
        v-if="showVoiceButton"
        :is-recording="isRecording"
        :is-recognizing="isRecognizing"
        @click="$emit('toggle-record')"
      />
    </div>
  </main>
</template>

<script setup>
import { ref } from 'vue';
import VoiceButton from './VoiceButton.vue';

const modelViewportRef = ref(null);
const characterWrapperRef = ref(null);

defineExpose({ modelViewportRef, characterWrapperRef });

defineProps({
  modelSize: { type: Number, default: 2.0 },
  characterPosition: { type: Object, default: () => ({ x: 0, y: 0 }) },
  isDragging: { type: Boolean, default: false },
  isRecording: { type: Boolean, default: false },
  isRecognizing: { type: Boolean, default: false },
  showVoiceButton: { type: Boolean, default: true },
  avatarType: { type: String, default: 'live2d' },
});

defineEmits(['update:modelSize', 'mousedown', 'toggle-record', 'update:avatarType']);
</script>

<style scoped>
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

.avatar-type-selector {
  margin-left: auto;
}

.type-select {
  height: 32px;
  padding: 0 28px 0 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: #333;
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

.type-select:focus {
  border-color: #8b5cf6;
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
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
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
</style>
