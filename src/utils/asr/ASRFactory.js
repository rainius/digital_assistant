import { SenseVoiceAdapter } from './SenseVoiceAdapter';

/**
 * ASR 工厂类
 * 负责根据传入的类型动态实例化 ASR 驱动
 */
export class ASRFactory {
  /**
   * 创建 ASR 实例
   * @param {string} type - 引擎类型（如 'sensevoice'）
   * @param {Object} config - 配置参数
   */
  static create(type, config = {}) {
    switch (type.toLowerCase()) {
      case 'sensevoice':
        console.log('[ASR Factory] 正在加载阿里 SenseVoice 语音识别引擎...');
        return new SenseVoiceAdapter(config);
        
      // 未来可以无缝扩展其他引擎，例如：
      // case 'whisper':
      //   return new WhisperAdapter(config);
        
      default:
        console.warn(`[ASR Factory] 未知引擎: ${type}，默认回退至 SenseVoice`);
        return new SenseVoiceAdapter(config);
    }
  }
}