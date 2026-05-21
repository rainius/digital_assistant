<template>
  <!-- 左侧侧边栏 -->
  <aside class="sidebar" :class="{ 'collapsed': !isOpen }">
    <div class="sidebar-inner">
      <!-- 测试音频按钮 -->
      <div class="row">
        <button class="btn btn-default" @click="$emit('play-test-audio')">测试音频</button>
      </div>

      <!-- 场景选择 -->
      <div class="row control-group">
        <label>选择数字人模型：</label>
        <div class="flex-row">
          <select
            :value="selectedScene"
            class="form-select"
            @change="$emit('update:selectedScene', $event.target.value)"
          >
            <option value="eva">EVA RIN</option>
            <option value="hiyori">Hiyori</option>
            <option value="kei">kei_vowels_pro</option>
            <option value="march7th">March 7th</option>
            <option value="nova">Nova</option>
            <option value="pachan">Pachan</option>
          </select>
          <button class="btn btn-default" @click="$emit('update-scene', selectedScene)">更新场景</button>
        </div>
      </div>

      <!-- 眼神跟随 -->
      <div class="row control-group">
        <label>眼神跟随鼠标：</label>
        <div class="radio-group">
          <label class="radio-label">
            <input
              type="radio"
              value="follow"
              :checked="eyeTracking === 'follow'"
              @change="$emit('update:eyeTracking', 'follow')"
            />
            <span class="radio-text">跟随鼠标</span>
          </label>
          <label class="radio-label">
            <input
              type="radio"
              value="straight"
              :checked="eyeTracking === 'straight'"
              @change="$emit('update:eyeTracking', 'straight')"
            />
            <span class="radio-text">前方直视</span>
          </label>
        </div>
      </div>

      <!-- 聊天交互卡片 -->
      <div class="card">
        <div class="card-header">聊天交互</div>
        <div class="card-body">
          <div class="flex-row mb-2">
            <input
              type="text"
              :value="chatInput"
              class="form-input"
              placeholder="输入消息..."
              @input="$emit('update:chatInput', $event.target.value)"
              @keydown.enter="$emit('send-sidebar-message', chatInput)"
            />
            <button class="btn btn-default" @click="$emit('send-sidebar-message', chatInput)">发送消息</button>
          </div>
          <textarea class="form-textarea readonly" readonly :value="chatResponse"></textarea>
        </div>
      </div>

      <!-- 语音合成卡片 -->
      <div class="card">
        <div class="card-header">语音合成</div>
        <div class="card-body">
          <textarea
            class="form-textarea mb-2"
            :value="ttsInput"
            @input="$emit('update:ttsInput', $event.target.value)"
          ></textarea>
          <div class="flex-row button-group">
            <button class="btn btn-default" @click="$emit('tts-parallel', ttsInput)">并行推理</button>
            <button class="btn btn-default" @click="$emit('tts-stream', ttsInput)">流式推理</button>
            <button class="btn btn-default" @click="$emit('tts-stop')">停止讲话</button>
          </div>
        </div>
      </div>
    </div>
  </aside>

  <!-- 悬浮切换按钮 -->
  <div
    class="toggle-btn"
    :class="{ 'collapsed': !isOpen }"
    @click="$emit('toggle')"
    title="切换侧边栏"
  >
    <span>{{ isOpen ? '❮' : '❯' }}</span>
  </div>
</template>

<script setup>
defineProps({
  isOpen: { type: Boolean, default: false },
  selectedScene: { type: String, default: 'nova' },
  eyeTracking: { type: String, default: 'follow' },
  chatInput: { type: String, default: '' },
  chatResponse: { type: String, default: '' },
  ttsInput: { type: String, default: '' },
});

defineEmits([
  'toggle',
  'update:selectedScene',
  'update:eyeTracking',
  'update:chatInput',
  'update:ttsInput',
  'play-test-audio',
  'update-scene',
  'send-sidebar-message',
  'tts-parallel',
  'tts-stream',
  'tts-stop',
]);
</script>

<style scoped>
/* --- 侧边栏样式 --- */
.sidebar {
  width: 360px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  /* 关键:必须设置为 hidden,否则宽度变 0 时内容依然可见 */
  overflow: hidden;
  /* 关键:防止 flex 布局自动压缩侧边栏 */
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
}

/* 内部内容容器:固定宽度 */
.sidebar-inner {
  width: 360px;
  min-width: 360px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
}

/* --- 悬浮切换按钮样式 --- */
.toggle-btn {
  position: absolute;
  top: 50%;
  left: 360px;
  transform: translateY(-50%);
  width: 16px;
  height: 60px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-left: none;
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
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
}

.toggle-btn:hover {
  background-color: #f0f2f5;
  color: #409eff;
}

.toggle-btn.collapsed {
  left: 0;
  border-left: 1px solid #e4e7ed;
}

/* --- 通用控件样式 --- */
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
</style>
