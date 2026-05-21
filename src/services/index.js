/**
 * 服务层集中注册 —— 统一创建 ASR / LLM / TTS / Avatar 实例。
 *
 * 使用方式:
 * - main.js 中: app.provide(ServicesKey, createServices())
 * - 组件中:     const { asr, llm, tts } = inject(ServicesKey)
 *
 * 好处:
 * 1. 配置集中在 config.js,不散落在组件里
 * 2. 测试时可以 provide mock 服务,不依赖真实 API
 * 3. 切换 TTS/LLM 后端只需改 ENV,不改组件代码
 */

import { ASRFactory } from '@/utils/asr/ASRFactory';
import { LLMFactory } from '@/utils/llm/LLMFactory';
import { TTSFactory } from '@/utils/tts/TTSFactory';
// import { AvatarFactory } from '@/utils/avatar/AvatarFactory';
import { ENV } from './config';

/** provide/inject 的 key,用 Symbol 避免命名冲突 */
export const ServicesKey = Symbol('services');

/**
 * 创建服务实例集合。
 * @returns {{ asr, llm, tts, avatar }}
 */
export function createServices() {
  // ASR (语音识别)
  const asr = ASRFactory.create(ENV.ASR_TYPE, {
    apiUrl: ENV.ASR_URL,
    lang: ENV.ASR_LANG,
  });

  // LLM (大模型对话)
  const llm = LLMFactory.create(ENV.LLM_PROVIDER, {
    apiUrl: ENV.LLM_URL,
    apiKey: ENV.LLM_API_KEY,
    userId: ENV.LLM_USER_ID,
    botId: ENV.LLM_BOT_ID,  // Coze 需要,Dify 忽略
  });

  // TTS (语音合成)
  const tts = TTSFactory.create(ENV.TTS_PROVIDER, {
    apiUrl: ENV.TTS_URL,
    refAudio: ENV.TTS_REF_AUDIO,
    promptText: ENV.TTS_PROMPT_TEXT,
  });

  // Avatar (数字人渲染) —— 暂不在这里实例化,因为需要 DOM 容器
  // 组件内通过 AvatarFactory.create 按需创建
  const avatarConfig = {
    type: ENV.AVATAR_TYPE,
    modelPath: ENV.AVATAR_MODEL,
  };

  return { asr, llm, tts, avatarConfig };
}
