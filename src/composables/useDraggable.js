/**
 * 通用拖拽 composable —— 修复原组件中 startDrag 之后没人监听 mousemove 的 bug。
 *
 * 使用方式:
 * const { position, isDragging, onMouseDown } = useDraggable();
 * <div @mousedown="onMouseDown" :style="{ transform: `translate(${position.x}px, ${position.y}px)` }">
 *
 * @param {Object} options
 * @param {Function} options.bounds - 可选,返回 { minX, maxX, minY, maxY } 限制拖拽范围
 */
import { ref, onUnmounted } from 'vue';

export function useDraggable(options = {}) {
  const position = ref({ x: 0, y: 0 });
  const isDragging = ref(false);
  const dragStart = ref({ x: 0, y: 0 });

  const onMouseMove = (e) => {
    if (!isDragging.value) return;
    e.preventDefault();

    let newX = e.clientX - dragStart.value.x;
    let newY = e.clientY - dragStart.value.y;

    // 如果提供了边界限制函数,应用它
    if (options.bounds) {
      const bounds = options.bounds();
      if (bounds) {
        newX = Math.min(Math.max(newX, bounds.minX || -Infinity), bounds.maxX || Infinity);
        newY = Math.min(Math.max(newY, bounds.minY || -Infinity), bounds.maxY || Infinity);
      }
    }

    position.value = { x: newX, y: newY };
  };

  const onMouseUp = () => {
    isDragging.value = false;
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return; // 只响应左键
    isDragging.value = true;
    dragStart.value = {
      x: e.clientX - position.value.x,
      y: e.clientY - position.value.y,
    };
    e.preventDefault();
  };

  // 关键修复:在 window 上监听 mousemove 和 mouseup
  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  // 组件卸载时清理监听器
  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
  });

  return {
    position,
    isDragging,
    onMouseDown,
  };
}
