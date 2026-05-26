import { Live2DAdapter } from './Live2DAdapter';
import { LiveTalkingAdapter } from './LiveTalkingAdapter';

export class AvatarFactory {
  static create(type, config) {
    switch (type.toLowerCase()) {
      case 'live2d':
        return new Live2DAdapter(config);
      case 'livetalking':
        return new LiveTalkingAdapter(config);
      default:
        throw new Error(`不支持的数字人类型: ${type}`);
    }
  }
}