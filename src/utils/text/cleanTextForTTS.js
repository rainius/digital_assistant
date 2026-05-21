/**
 * 把大模型输出的原始文本清洗为 TTS 可读的纯文本。
 *
 * 行为(保持与重构前组件内同名函数完全一致):
 * 1. 去掉常见 Markdown 符号 (# * ` > ~ -)
 * 2. 多余换行符变成中文逗号
 * 3. 剔除 URL 链接
 * 4. 中文标点 → "英文标点 + 空格",强制触发 espeak-ng 呼吸停顿
 * 5. 收敛多余空白,首尾 trim
 *
 * @param {string} rawText - LLM 原始片段或整段输出
 * @returns {string} 适合 TTS 朗读的纯文本
 */
export function cleanTextForTTS(rawText) {
  if (!rawText) return '';
  return rawText
    // 1. 剔除 Markdown 特殊符号: # * ` > - ~
    .replace(/[#*`>~-]/g, '')

    // 2. 多余的换行符先替换为中文逗号
    .replace(/\n+/g, '，')

    // 3. 去除可能残留的 URL 链接
    .replace(/https?:\/\/[^\s]+/g, '')

    // 4. 中文标点 → 英文标点 + 空格,强制触发 TTS 停顿
    .replace(/，/g, ', ')
    .replace(/。/g, '. ')
    .replace(/！/g, '! ')
    .replace(/？/g, '? ')
    .replace(/、/g, ', ')

    // 5. 收敛多余空格(单个空格保留)
    .replace(/\s+/g, ' ')
    .trim();
}
