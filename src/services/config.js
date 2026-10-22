/**
 * 应用级运行时配置中心。
 *
 * 项目使用 Vue CLI 5 (webpack),环境变量必须以 `VUE_APP_` 开头,
 * 编译期通过 DefinePlugin 替换 `process.env.VUE_APP_XXX` 为字符串字面量。
 *
 * **注意**: 必须直接访问 `process.env.VUE_APP_XXX`,不能用 `env[key]`
 * 动态属性名——后者 webpack 无法在编译期追溯,会恒返回 undefined。
 */

/** 直接取值,webpack DefinePlugin 会在编译期替换为字符串字面量 */
function pick(key, fallback) {
  // webpack 只能替换直接属性访问,不能替换 env[key] 动态键
  // 因此每个变量必须在这里显式列出
  switch (key) {
    case 'VUE_APP_ASR_TYPE':      { const v = process.env.VUE_APP_ASR_TYPE;      return v || fallback; }
    case 'VUE_APP_ASR_URL':       { const v = process.env.VUE_APP_ASR_URL;       return v || fallback; }
    case 'VUE_APP_ASR_LANG':      { const v = process.env.VUE_APP_ASR_LANG;      return v || fallback; }
    case 'VUE_APP_LLM_PROVIDER':  { const v = process.env.VUE_APP_LLM_PROVIDER;  return v || fallback; }
    case 'VUE_APP_LLM_URL':       { const v = process.env.VUE_APP_LLM_URL;       return v || fallback; }
    case 'VUE_APP_LLM_API_KEY':   { const v = process.env.VUE_APP_LLM_API_KEY;   return v || fallback; }
    case 'VUE_APP_LLM_USER_ID':   { const v = process.env.VUE_APP_LLM_USER_ID;   return v || fallback; }
    case 'VUE_APP_LLM_BOT_ID':    { const v = process.env.VUE_APP_LLM_BOT_ID;    return v || fallback; }
    case 'VUE_APP_TTS_PROVIDER':  { const v = process.env.VUE_APP_TTS_PROVIDER;  return v || fallback; }
    case 'VUE_APP_TTS_URL':       { const v = process.env.VUE_APP_TTS_URL;       return v || fallback; }
    case 'VUE_APP_TTS_REF_AUDIO': { const v = process.env.VUE_APP_TTS_REF_AUDIO; return v || fallback; }
    case 'VUE_APP_TTS_PROMPT_TEXT':{ const v = process.env.VUE_APP_TTS_PROMPT_TEXT;return v || fallback; }
    case 'VUE_APP_AVATAR_TYPE':   { const v = process.env.VUE_APP_AVATAR_TYPE;   return v || fallback; }
    case 'VUE_APP_AVATAR_MODEL':  { const v = process.env.VUE_APP_AVATAR_MODEL;  return v || fallback; }
    case 'VUE_APP_LIVETALKING_URL':{ const v = process.env.VUE_APP_LIVETALKING_URL;return v || fallback; }
    default: return fallback;
  }
}

export const ENV = Object.freeze({
  // ==================== ASR ====================
  ASR_TYPE: pick('VUE_APP_ASR_TYPE', 'sensevoice'),
  ASR_URL: pick('VUE_APP_ASR_URL', '/api/asr'),
  ASR_LANG: pick('VUE_APP_ASR_LANG', 'auto'),

  // ==================== LLM ====================
  LLM_PROVIDER: pick('VUE_APP_LLM_PROVIDER', 'dify'),
  LLM_URL: pick('VUE_APP_LLM_URL', 'http://192.168.1.168/v1/chat-messages'),
  LLM_API_KEY: pick('VUE_APP_LLM_API_KEY', 'app-MgDwAtResNzTPxtTmmxlKdd3'),
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
