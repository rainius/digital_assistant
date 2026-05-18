import { Live2DAdapter } from './Live2DAdapter';
// 未来你可以引入： import { VrmAdapter } from './VrmAdapter';

export class AvatarFactory {
  static create(type, config) {
    switch (type.toLowerCase()) {
      case 'live2d':
        return new Live2DAdapter(config);
      // case 'vrm': 
      //   return new VrmAdapter(config);
      // case 'video':
      //   return new VideoAvatarAdapter(config);
      default:
        throw new Error(`不支持的数字人类型: ${type}`);
    }
  }
}