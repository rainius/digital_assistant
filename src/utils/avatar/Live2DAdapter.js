/**
 * Live2D 适配器
 * 封装 PIXI 和 pixi-live2d-display 的底层逻辑
 */
import { tracer } from '@/tracing/tracer';

export class Live2DAdapter {
  needsTTS = true;  // Live2D 需要外部 TTS 提供音频才能驱动口型
  streamMode = 'sentence'; // 一句话合一次音频驱动口型，越早越好
  constructor(config) {
    this.modelPath = config.modelPath;
    this.app = null;
    this.model = null;
    // 定义一个标准情绪到 Live2D 内部 expression index 的映射字典
    this.emotionMap = config.emotionMap || {
      'neutral': 0,
      'happy': 1,
      'thinking': 2,
      'sad': 3
    };
  }

  // 1. 挂载模型到容器
  async mount(container) {
    if (!window.PIXI || !window.PIXI.live2d) {
      throw new Error("PIXI 或 Live2D 核心库未加载");
    }

    // 创建画布元素
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    this.app = new window.PIXI.Application({
      view: canvas,
      autoStart: true,
      resizeTo: container,
      transparent: true,
      backgroundAlpha: 0,
      antialias: true,
    });

    try {
      this.model = await window.PIXI.live2d.Live2DModel.from(this.modelPath, { autoInteract: true });
      this.model.position.set(0, 0);

      const scale = Math.min(container.clientWidth / this.model.width, container.clientHeight / this.model.height);
      this.model.scale.set(scale);

      this.app.stage.addChild(this.model);
      console.log("Live2D 模型挂载成功");
    } catch (e) {
      console.error("模型加载失败", e);
    }
  }

  // 2. 说话与嘴型同步
  async speak(audioUrl /* , text */) {
    if (!this.model) return;
    tracer.mark('t5_play_start');
    return new Promise((resolve) => {
      // 调用 Live2D 内置的音频唇形同步方法
      this.model.speak(audioUrl, {
        volume: 1,
        expression: this.emotionMap['happy'], // 说话时可以默认带个微笑表情
        resetExpression: true,
        crossOrigin: "anonymous",
        onFinish: resolve,
        onError: resolve
      });
    });
  }

  // 3. 切换情绪表情
  setEmotion(emotionName) {
    if (!this.model) return;
    const expIndex = this.emotionMap[emotionName] !== undefined ? this.emotionMap[emotionName] : 0;
    this.model.expression(expIndex);
  }

  // 4. 停止说话
  stopSpeaking() {
    if (this.model && this.model.internalModel) {
      // Live2D 内部打断音频的逻辑
      this.model.internalModel.motionManager.stopAllMotions();
    }
  }

  // 5. 销毁实例
  destroy() {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      this.app = null;
      this.model = null;
    }
  }
}