/**
 * 流式对话 composable —— 封装 LLM 流式输出 + 句子切分 + 世代号取消机制。
 *
 * 职责:
 * 1. 管理对话消息列表(messages)和思考状态(isThinking)
 * 2. 流式接收 LLM chunk,实时更新 UI
 * 3. 检测句末标点,切分完整句子并通过 onSentence 回调送给 TTS
 * 4. 用"世代号"防止连续提问时旧流污染新对话(适配器不支持 AbortController)
 * 5. 支持重置对话(清空消息 + 调用 llm.clearContext)
 *
 * 使用方式:
 * const chat = useChatStream({
 *   llm,
 *   onSentence: (sentence) => ttsQueue.enqueueText(sentence),
 *   initialMessages: [{ role: 'ai', content: '您好！我是您的智能助手。' }]
 * });
 *
 * chat.send('你好');
 * chat.reset(); // 新会话
 */
import { ref } from 'vue';
import { cleanTextForTTS, cleanTextForParagraphTTS } from '@/utils/text/cleanTextForTTS';
import { containsSentenceEnd } from '@/utils/text/sentenceSplitter';

export function useChatStream({ llm, onSentence, onParagraph, initialMessages = [] }) {
  const messages = ref(
    initialMessages.length > 0
      ? initialMessages
      : [{ role: 'ai', content: '您好！我是您的**智能学习助手**，我可以作为数字人，和你进行语音对话，也可以和你进行文字交谈。\n\n我可以帮您：\n\n- 解答课程**疑难问题**\n- 提供学习资源推荐\n- 辅助完成编程练习\n\n以下是 Python 示例：\n\n```python\ndef greet(name):\n    return f"你好，{name}！"\n```\n\n> 学习如逆水行舟，不进则退。\n\n有什么我可以帮您的吗？' }]
  );
  const isThinking = ref(false);

  // 世代号 —— 每次 send 时递增,旧流的 chunk 回调里检查世代号不匹配则丢弃
  const currentGen = ref(0);
  let sentenceBuffer = '';
  let paragraphBuffer = '';

  /**
   * 发送消息并流式接收 LLM 响应。
   * @param {string} text - 用户输入
   */
  async function send(text) {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    // 递增世代号,旧流的 chunk 会被丢弃
    currentGen.value++;
    const myGen = currentGen.value;

    // 添加用户消息
    messages.value.push({ role: 'user', content: trimmedText });
    isThinking.value = true;
    sentenceBuffer = '';
    paragraphBuffer = '';

    // 预先插入 AI 消息占位
    const aiMsgIndex = messages.value.push({ role: 'ai', content: '' }) - 1;

    try {
      await llm.streamChat(
        trimmedText,
        // onChunk: 打字机效果 + 句子切分
        (chunk) => {
          // 世代号守卫:如果不是当前世代,丢弃这个 chunk
          if (myGen !== currentGen.value) {
            console.log(`[Chat Stream] 丢弃旧世代 ${myGen} 的 chunk`);
            return;
          }

          // 1. 更新 UI
          messages.value[aiMsgIndex].content += chunk;

          // 2. 积攒到句子 / 段落缓冲区
          sentenceBuffer += chunk;
          paragraphBuffer += chunk;

          // 3. 检测句末标点 → 切分完整句子 → 送 TTS
          if (containsSentenceEnd(chunk)) {
            const cleanedSentence = cleanTextForTTS(sentenceBuffer);
            if (cleanedSentence) {
              onSentence?.(cleanedSentence);
            }
            sentenceBuffer = '';
          }
        },
        // onComplete: 流结束,处理残留句子
        () => {
          // 世代号守卫
          if (myGen !== currentGen.value) {
            console.log(`[Chat Stream] 丢弃旧世代 ${myGen} 的 complete 回调`);
            return;
          }

          isThinking.value = false;

          // 检查缓冲区是否有"漏网之鱼"(最后一句话没标点)
          if (sentenceBuffer.trim().length > 0) {
            const cleanedSentence = cleanTextForTTS(sentenceBuffer);
            if (cleanedSentence) {
              onSentence?.(cleanedSentence);
            }
            sentenceBuffer = '';
          }

          // 整段一次性回调 —— 段模式适配器（如 LiveTalking）使用
          if (paragraphBuffer.trim().length > 0) {
            const cleanedParagraph = cleanTextForParagraphTTS(paragraphBuffer);
            if (cleanedParagraph) {
              onParagraph?.(cleanedParagraph);
            }
            paragraphBuffer = '';
          }
        }
      );
    } catch (error) {
      // 世代号守卫
      if (myGen !== currentGen.value) {
        console.log(`[Chat Stream] 丢弃旧世代 ${myGen} 的错误`);
        return;
      }

      console.error('[Chat Stream] LLM API 错误:', error);
      isThinking.value = false;

      // 显示错误提示
      if (messages.value[aiMsgIndex].content === '') {
        messages.value[aiMsgIndex].content = '抱歉，服务暂时不可用，请稍后重试。';
      }
    }
  }

  /**
   * 重置对话 —— 清空消息列表并调用 llm.clearContext(如果支持)。
   */
  function reset() {
    currentGen.value++; // 递增世代号,丢弃所有进行中的流
    messages.value = initialMessages.length > 0
      ? [...initialMessages]
      : [{ role: 'ai', content: '您好！我是您的**智能学习助手**。\n\n我可以帮您：\n\n- 解答课程**疑难问题**\n- 提供学习资源推荐\n- 辅助完成编程练习\n\n以下是 Python 示例：\n\n```python\ndef greet(name):\n    return f"你好，{name}！"\n```\n\n> 学习如逆水行舟，不进则退。\n\n有什么我可以帮您的吗？' }];
    isThinking.value = false;
    sentenceBuffer = '';
    paragraphBuffer = '';

    // 如果 LLM 适配器支持 clearContext(如 DifyAdapter),调用它
    if (typeof llm.clearContext === 'function') {
      llm.clearContext();
    }
  }

  return {
    messages,
    isThinking,
    send,
    reset,
  };
}
