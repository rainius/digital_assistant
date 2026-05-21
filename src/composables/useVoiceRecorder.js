/**
 * 语音录音 composable —— 封装 ASR 录音状态机。
 *
 * 职责:
 * 1. 管理录音状态(idle → recording → recognizing → idle)
 * 2. 调用 asr.start / asr.stopAndRecognize
 * 3. 识别成功后通过 onText 回调通知上层
 * 4. 组件卸载时自动取消录音
 *
 * 使用方式:
 * const recorder = useVoiceRecorder({
 *   asr,
 *   onText: (text) => { console.log('识别结果:', text); }
 * });
 *
 * <button @click="recorder.toggle">{{ recorder.isRecording ? '停止' : '开始' }}</button>
 */
import { ref, onUnmounted } from 'vue';

export function useVoiceRecorder({ asr, onText }) {
  const isRecording = ref(false);
  const isRecognizing = ref(false);

  /**
   * 切换录音状态 —— 与原组件 toggleVoiceRecording 行为完全一致。
   */
  async function toggle() {
    // 正在识别时不响应
    if (isRecognizing.value) return;

    if (!isRecording.value) {
      // 开始录音
      try {
        await asr.start();
        isRecording.value = true;
      } catch (err) {
        console.error('[Voice Recorder] 启动录音失败:', err);
      }
    } else {
      // 停止录音并识别
      isRecording.value = false;
      isRecognizing.value = true;

      try {
        const text = await asr.stopAndRecognize();
        if (text) {
          onText?.(text); // 通知上层
        }
      } catch (err) {
        console.error('[Voice Recorder] 语音识别失败:', err);
        onText?.('[语音识别失败，请重试]');
      } finally {
        isRecognizing.value = false;
      }
    }
  }

  /**
   * 强制取消录音(用户离开页面时)。
   */
  function cancel() {
    isRecording.value = false;
    isRecognizing.value = false;
    // ASR 适配器没有暴露 cancel 方法,这里只重置状态
  }

  // 组件卸载时自动取消
  onUnmounted(() => {
    cancel();
  });

  return {
    isRecording,
    isRecognizing,
    toggle,
    cancel,
  };
}
