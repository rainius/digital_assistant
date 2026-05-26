/**
 * 应用级运行时配置中心。
 *
 * 项目使用 Vue CLI 5 (webpack),环境变量必须以 `VUE_APP_` 开头,
 * 编译期通过 `process.env.VUE_APP_XXX` 注入。请配合根目录 `.env.local`
 * 使用,密钥不要提交到仓库。
 *
 * 任意一项未配置时,回落到与重构前组件中硬编码完全一致的默认值,
 * 确保未填 .env 也能跑(便于平滑迁移)。
 */

const env = (typeof process !== 'undefined' && process.env) ? process.env : {};

/** 取环境变量,fallback 到默认值 */
function pick(key, fallback) {
  const v = env[key];
  return (v === undefined || v === null || v === '') ? fallback : v;
}

export const ENV = Object.freeze({
  // ==================== ASR ====================
  ASR_TYPE: pick('VUE_APP_ASR_TYPE', 'sensevoice'),
  ASR_URL: pick('VUE_APP_ASR_URL', '/api/asr'),
  ASR_LANG: pick('VUE_APP_ASR_LANG', 'auto'),

  // ==================== LLM ====================
  LLM_PROVIDER: pick('VUE_APP_LLM_PROVIDER', 'dify'),
  LLM_URL: pick('VUE_APP_LLM_URL', 'http://192.168.1.168/v1/chat-messages'),
  LLM_API_KEY: pick('VUE_APP_LLM_API_KEY', 'app-SzWFJDVQBdNbNP0DrPmu98df'),
  LLM_USER_ID: pick('VUE_APP_LLM_USER_ID', 'digitalhuman-001'),
  LLM_BOT_ID: pick('VUE_APP_LLM_BOT_ID', ''),    // 仅 Coze 用

  // ==================== TTS ====================
  TTS_PROVIDER: pick('VUE_APP_TTS_PROVIDER', 'gpt-sovits'),
  TTS_URL: pick('VUE_APP_TTS_URL', '/api/tts'),
  TTS_REF_AUDIO: pick('VUE_APP_TTS_REF_AUDIO', 'examples/dbes01.wav'),
  TTS_PROMPT_TEXT: pick(
    'VUE_APP_TTS_PROMPT_TEXT',
    '欢迎来到南京大报恩寺遗址景区！这里曾是明代皇家寺院，其核心大报恩寺琉璃宝塔被誉为中世纪世界七大奇迹之一。'
  ),

  // ==================== Avatar ====================
  AVATAR_TYPE: pick('VUE_APP_AVATAR_TYPE', 'live2d'),
  AVATAR_MODEL: pick('VUE_APP_AVATAR_MODEL', './models/芍药/芍药身体运动.model3.json'),
  LIVETALKING_URL: pick('VUE_APP_LIVETALKING_URL', '/api/livetalking'),
});
