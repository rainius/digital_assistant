import { CozeAdapter } from './CozeAdapter';
import { DifyAdapter } from './DifyAdapter';

export class LLMFactory {
  /**
   * 创建大模型驱动实例
   * @param {string} provider - 服务提供商 ('coze' | 'dify')
   * @param {Object} config - 对应提供商的配置字典
   * @returns {Object} 大模型驱动实例
   */
  static create(provider, config) {
    switch (provider.toLowerCase()) {
      case 'coze':
        return new CozeAdapter(config);
      case 'dify':
        return new DifyAdapter(config);
      case 'sherpa':
        return new DifyAdapter(config);
      default:
        throw new Error(`不支持的 LLM 提供商: ${provider}`);
    }
  }
}