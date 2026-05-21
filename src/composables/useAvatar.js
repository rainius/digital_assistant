/**
 * Avatar 数字人管理 composable —— 封装 mount/destroy/load,支持切换模型。
 *
 * 职责:
 * 1. 在指定 DOM 容器上挂载 Live2D 模型
 * 2. 支持运行时切换模型(destroy 旧实例 → create 新实例 → mount)
 * 3. 组件卸载时自动销毁
 *
 * 使用方式:
 * const avatarContainerRef = ref(null);
 * const { instance, currentModel, load } = useAvatar(avatarContainerRef, { type: 'live2d' });
 *
 * onMounted(() => {
 *   load('./models/芍药/芍药身体运动.model3.json');
 * });
 *
 * // 切换模型
 * load('./models/nova/nova.model3.json');
 */
import { ref, onUnmounted } from 'vue';
import { AvatarFactory } from '@/utils/avatar/AvatarFactory';

export function useAvatar(containerRef, options = {}) {
  const instance = ref(null);
  const currentModel = ref(null);
  const avatarType = options.type || 'live2d';

  /**
   * 加载指定模型。如果已有实例,先销毁再重建。
   * @param {string} modelPath - 模型文件路径
   */
  async function load(modelPath) {
    if (!containerRef.value) {
      console.warn('[useAvatar] 容器 ref 尚未就绪,无法挂载');
      return;
    }

    // 销毁旧实例
    if (instance.value) {
      instance.value.destroy();
      instance.value = null;
    }

    try {
      // 创建新实例
      instance.value = AvatarFactory.create(avatarType, { modelPath });

      // 挂载到 DOM
      await instance.value.mount(containerRef.value);

      currentModel.value = modelPath;
      console.log(`[useAvatar] 模型加载成功: ${modelPath}`);
    } catch (error) {
      console.error('[useAvatar] 模型加载失败:', error);
      instance.value = null;
      currentModel.value = null;
    }
  }

  /**
   * 手动销毁实例(通常不需要调用,onUnmounted 会自动处理)。
   */
  function destroy() {
    if (instance.value) {
      instance.value.destroy();
      instance.value = null;
      currentModel.value = null;
    }
  }

  // 组件卸载时自动销毁
  onUnmounted(() => {
    destroy();
  });

  return {
    instance,
    currentModel,
    load,
    destroy,
  };
}
