import { GptSovitsAdapter } from './GptSovitsAdapter';
import { EdgeTTSAdapter } from './EdgeTTSAdapter';

/**
 * TTS 工厂类
 * 负责根据传入的 engine 类型，动态实例化并返回对应的 TTS 驱动
 */
export class TTSFactory {
  /**
   * 创建 TTS 实例
   * @param {string} engine - 引擎名称 ('gpt-sovits' 或 'edge')
   * @param {Object} config - 该引擎所需的配置参数
   * @returns {Object} 实例化的 TTS 适配器
   */
  static create(engine, config = {}) {
    switch (engine.toLowerCase()) {
      case 'gpt-sovits':
        console.log('[TTS Factory] 正在加载 GPT-SoVITS 引擎...');
        return new GptSovitsAdapter(config);
        
      case 'edge':
        console.log('[TTS Factory] 正在加载 微软 Edge TTS 引擎...');
        return new EdgeTTSAdapter(config);
        
      default:
        console.warn(`[TTS Factory] 未知引擎: ${engine}，默认回退至 Edge TTS`);
        return new EdgeTTSAdapter(config);
    }
  }
}