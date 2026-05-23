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
    </div>

    <!-- 模型展示区 -->
    <div class="model-viewport">
      <div
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
import VoiceButton from './VoiceButton.vue';

defineProps({
  modelSize: { type: Number, default: 2.0 },
  characterPosition: { type: Object, default: () => ({ x: 0, y: 0 }) },
  isDragging: { type: Boolean, default: false },
  isRecording: { type: Boolean, default: false },
  isRecognizing: { type: Boolean, default: false },
  showVoiceButton: { type: Boolean, default: true },
});

defineEmits(['update:modelSize', 'mousedown', 'toggle-record']);
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
