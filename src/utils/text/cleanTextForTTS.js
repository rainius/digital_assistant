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

/**
 * 段模式（如 LiveTalking）专用的轻量清洗。
 *
 * 服务端有自己的中文分句和 TTS 节奏，所以不要把中文标点替换成英文，
 * 也不要把换行强行改成逗号 —— 让原始标点交给服务端处理。
 * 只去掉会让 TTS 念出来的 Markdown 符号、URL，并收敛空白。
 *
 * @param {string} rawText - LLM 原始整段输出
 * @returns {string} 保留中文标点、适合段模式投递的纯文本
 */
export function cleanTextForParagraphTTS(rawText) {
  if (!rawText) return '';
  return rawText
    // 去 Markdown 装饰符（保留破折号 - 担心数字范围"3-5"被吃，所以也去掉，与句模式保持一致）
    .replace(/[#*`>~]/g, '')
    // 列表项前导符 "- " / "* "
    .replace(/^[\s]*[-*]\s+/gm, '')
    // URL
    .replace(/https?:\/\/\S+/g, '')
    // 多余换行收敛成单个换行（保留段落感即可）
    .replace(/\n{2,}/g, '\n')
    // 收敛行内多余空白
    .replace(/[ \t]+/g, ' ')
    .trim();
}
