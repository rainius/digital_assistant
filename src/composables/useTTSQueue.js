/**
 * TTS 音频队列管理 composable —— 修复组件卸载时残留 blob URL 的内存泄漏。
 *
 * 职责:
 * 1. 接收文本 → 调用 tts.fetchAudio → 推入队列
 * 2. 串行播放队列中的音频(一句说完再说下一句)
 * 3. 播放时驱动 avatar 表情(thinking → neutral)
 * 4. 组件卸载时释放所有残留的 blob URL
 *
 * 使用方式:
 * const ttsQueue = useTTSQueue({ tts, avatar });
 * ttsQueue.enqueueText('你好世界');
 * ttsQueue.stop(); // 清空队列并释放资源
 */
import { ref, onUnmounted } from 'vue';
import { tracer } from '@/tracing/tracer';

export function useTTSQueue({ tts, avatar }) {
  const queue = [];
  const isPlaying = ref(false);
  let stopped = false;

  /**
   * 把一句文本送进 TTS,拿到音频 URL 后推入播放队列。
   * 段模式适配器（如 LiveTalking）整段一次性发送，所以这里直接跳过。
   * @param {string} sentence - 已清洗的纯文本
   */
  async function enqueueText(sentence) {
    if (!sentence || stopped) return;
    if (avatar?.value?.streamMode === 'paragraph') return;

    try {
      // 文本驱动型适配器（如 LiveTalking）不需要外部 TTS，跳过合成
      const skipTTS = avatar?.value && avatar.value.needsTTS === false;
      const audioUrl = skipTTS ? null : await tts.fetchAudio(sentence);
      if (!skipTTS) tracer.mark('t4_tts_first_return');  // 首段音频就绪

      if (stopped) return;
      if (!skipTTS && !audioUrl) return;

      queue.push({ audioUrl, text: sentence });
      drain();
    } catch (err) {
      console.error('[TTS Queue] 音频合成失败:', err);
    }
  }

  /**
   * 整段一次性入队 —— 段模式适配器（如 LiveTalking）使用，
   * 让服务端按自己的节奏拆句、合成、播放。句模式适配器忽略本调用。
   * @param {string} paragraph - 已清洗的整段文本
   */
  async function enqueueParagraph(paragraph) {
    if (!paragraph || stopped) return;
    if (avatar?.value?.streamMode !== 'paragraph') return;

    try {
      const skipTTS = avatar?.value && avatar.value.needsTTS === false;
      const audioUrl = skipTTS ? null : await tts.fetchAudio(paragraph);
      if (!skipTTS) tracer.mark('t4_tts_first_return');

      if (stopped) return;
      if (!skipTTS && !audioUrl) return;

      queue.push({ audioUrl, text: paragraph });
      drain();
    } catch (err) {
      console.error('[TTS Queue] 段落合成失败:', err);
    }
  }

  /**
   * 播放队列排水 —— 串行播放,一句说完再说下一句。
   */
  async function drain() {
    if (isPlaying.value || queue.length === 0 || stopped) return;

    isPlaying.value = true;
    const { audioUrl, text } = queue.shift();

    try {
      // 播放前切换表情
      if (avatar?.value) {
        avatar.value.setEmotion('thinking');
      }

      // 让数字人说话（text 供 LiveTalking 等文本驱动型适配器使用）
      if (avatar?.value) {
        await avatar.value.speak(audioUrl, text);
      }

      // 说完恢复平静
      if (avatar?.value) {
        avatar.value.setEmotion('neutral');
      }

      // 两句话之间短暂缓冲,听感更自然
      await new Promise((r) => setTimeout(r, 50));
    } catch (error) {
      console.error('[TTS Queue] 音频播放被中断或出错:', error);
    } finally {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      isPlaying.value = false;

      // 递归调用自己,继续播放队列里剩下的句子
      if (!stopped) {
        drain();
      }
    }
  }

  /**
   * 停止播放并清空队列,释放所有残留的 blob URL。
   */
  function stop() {
    stopped = true;
    // 释放队列中所有未播放的 URL(修复内存泄漏)
    queue.forEach(({ audioUrl }) => { if (audioUrl) URL.revokeObjectURL(audioUrl); });
    queue.length = 0;
    isPlaying.value = false;
  }

  // 组件卸载时自动清理
  onUnmounted(() => {
    stop();
  });

  return {
    enqueueText,
    enqueueParagraph,
    stop,
    isPlaying,
  };
}
