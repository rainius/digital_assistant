/**
 * 句子切分策略 —— 当 LLM 流式输出的某个 chunk 中包含句末标点时,
 * 视为一句完整的话结束,可以送进 TTS 队列。
 *
 * 这里把"判定逻辑"和"标点集合"独立出来,后续如果需要支持
 * 省略号 / 引号 / 自定义停顿规则,只需要改这一个文件。
 */

/** 默认句末标点(中英混合) */
export const SENTENCE_END_PUNCT = /[，。！？；、,.!?]/;

/**
 * 判断一段文本中是否包含句末标点。
 * @param {string} chunk
 * @returns {boolean}
 */
export function containsSentenceEnd(chunk) {
  if (!chunk) return false;
  return SENTENCE_END_PUNCT.test(chunk);
}
