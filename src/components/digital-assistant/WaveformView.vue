<template>
  <div class="waveform-container" :class="{ active }">
    <canvas ref="canvasRef" class="waveform-canvas"></canvas>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';

const props = defineProps({
  active: { type: Boolean, default: false },
});

const canvasRef = ref(null);

let audioCtx = null;
let analyser = null;
let source = null;
let stream = null;
let rafId = null;
let dataArray = null;

// 滚动缓冲区：存储所有历史采样点
const scrollBuffer = [];
const SLOT_WIDTH = 4.5; // 每条竖线占据的固定宽度（含间隙）

/** 初始化音频 */
async function start() {
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;
    source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const bufferLen = analyser.fftSize;
    dataArray = new Uint8Array(bufferLen);
    scrollBuffer.length = 0;

    draw();
  } catch (err) {
    console.error('[Waveform] 麦克风访问失败:', err);
  }
}

function stop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (source) {
    source.disconnect();
    source = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  analyser = null;
  dataArray = null;
  scrollBuffer.length = 0;
}

function draw() {
  if (!canvasRef.value || !analyser) return;

  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 获取当前帧的时域波形
  analyser.getByteTimeDomainData(dataArray);

  // 降采样：每帧取少量点，留出间距
  const samplesPerFrame = 16;
  const step = Math.floor(dataArray.length / samplesPerFrame);
  const frameData = [];
  for (let i = 0; i < samplesPerFrame; i++) {
    const v = dataArray[i * step] / 128 - 1;
    frameData.push(v);
  }
  // 限制缓冲区长度，超出的丢掉
  const maxSlots = Math.ceil(w / SLOT_WIDTH) + 10;
  scrollBuffer.push(frameData);
  while (scrollBuffer.length > maxSlots) scrollBuffer.shift();

  // 清空画布
  ctx.clearRect(0, 0, w, h);

  const midY = h / 2;

  // 中线
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(w, midY);
  ctx.stroke();

  const totalFrames = scrollBuffer.length;
  if (totalFrames === 0) {
    rafId = requestAnimationFrame(draw);
    return;
  }

  const amp = h * 0.6;
  // 最小高度不低于 4px，让轻声也有可见波形
  const lineWidth = Math.max(1, SLOT_WIDTH * 0.5);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';

  // 从右向左绘制：最新帧在最右侧
  for (let fi = 0; fi < totalFrames; fi++) {
    const frame = scrollBuffer[fi];
    if (frame.length === 0) continue;
    let peak = 0;
    for (let si = 0; si < frame.length; si++) {
      peak = Math.max(peak, Math.abs(frame[si]));
    }
    const barHeight = Math.max(3, peak * amp);
    // x 坐标：最新帧靠右，旧帧靠左
    const x = w - (totalFrames - fi) * SLOT_WIDTH + SLOT_WIDTH / 2;
    // 跳过画布外的线
    if (x < 0 || x > w) continue;

    ctx.beginPath();
    ctx.moveTo(x, midY - barHeight);
    ctx.lineTo(x, midY + barHeight);
    ctx.stroke();
  }

  rafId = requestAnimationFrame(draw);
}

watch(
  () => props.active,
  (val) => {
    if (val) start();
    else stop();
  },
);

onBeforeUnmount(() => stop());
</script>

<style scoped>
.waveform-container {
  height: 0;
  overflow: hidden;
  transition: height 0.25s ease;
  background: #f8fafc;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.waveform-container.active {
  height: 64px;
}

.waveform-canvas {
  width: 100%;
  height: 64px;
  display: block;
}
</style>
